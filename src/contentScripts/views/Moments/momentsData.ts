// 把B站动态接口的返回整理成动态页卡片用的结构，并提供瀑布流的计算。
// 这里只放纯函数，方便测试

import type { List as FollowingLiveItem } from '~/models/live/getFollowingLiveList'
import type { FeedItem, FeedMajor, LiveRcmdContent, PortalLiveUser, PortalUp, RichTextNode } from '~/models/moment/momentFeed'

import type { MomentContent, MomentEntry, MomentImage, MomentOpenTarget, MomentsLiveUser, MomentsTab, MomentsUp, RichSegment } from './types'

/** 每列最窄多少像素，窗口不够宽时自动减少列数 */
export const MIN_COLUMN_WIDTH = 300
/** 卡片之间的间距 */
export const COLUMN_GAP = 16

const VIDEO_TYPES = new Set([
  'DYNAMIC_TYPE_AV',
  'DYNAMIC_TYPE_PGC',
  'DYNAMIC_TYPE_PGC_UNION',
  'DYNAMIC_TYPE_UGC_SEASON',
  'DYNAMIC_TYPE_COURSES',
  'DYNAMIC_TYPE_COURSES_SEASON',
  'DYNAMIC_TYPE_COURSES_BATCH',
])
const LIVE_TYPES = new Set(['DYNAMIC_TYPE_LIVE', 'DYNAMIC_TYPE_LIVE_RCMD'])

/** 除「全部」以外，这条动态属于哪个筛选。直播只在「全部」里出现 */
export function groupOf(type: string): MomentEntry['group'] {
  if (VIDEO_TYPES.has(type))
    return 'video'
  if (type === 'DYNAMIC_TYPE_ARTICLE')
    return 'article'
  if (LIVE_TYPES.has(type))
    return null
  return 'dynamic'
}

export function matchesTab(entry: MomentEntry, tab: MomentsTab): boolean {
  return tab === 'all' || entry.group === tab
}

/**
 * 请求信息流时用的 type。「视频」「文章」用接口自带的分类；
 * 「动态」接口没有，要从「全部」里挑；只看某个 UP 主时也从「全部」里挑
 */
export function feedTypeOf(tab: MomentsTab, hostMid?: string): 'all' | 'video' | 'article' {
  if (hostMid)
    return 'all'
  if (tab === 'video' || tab === 'article')
    return tab
  return 'all'
}

/** `//i0.hdslb.com/...`、`http://...` 统一成 https */
export function toHttps(url: string | undefined | null): string {
  if (!url)
    return ''
  if (url.startsWith('//'))
    return `https:${url}`
  return url.replace(/^http:\/\//, 'https://')
}

/**
 * B站图片的缩略图地址。GIF 加参数会变成静态图，保留原图。
 * 不传高度时按宽度等比缩放，传了就裁剪成这个尺寸
 */
export function thumbnailUrl(url: string, width: number, height?: number): string {
  const src = toHttps(url)
  if (!src || !/hdslb\.com\//.test(src) || /\.gif$/i.test(src) || src.includes('@'))
    return src
  return height ? `${src}@${width}w_${height}h_1c.webp` : `${src}@${width}w.webp`
}

export function parseRichText(nodes: RichTextNode[] | null | undefined, fallbackText = ''): RichSegment[] {
  if (!nodes?.length)
    return fallbackText ? [{ kind: 'text', text: fallbackText }] : []

  const segments: RichSegment[] = []
  for (const node of nodes) {
    const text = node.text ?? node.orig_text ?? ''
    if (node.type === 'RICH_TEXT_NODE_TYPE_EMOJI' && node.emoji?.icon_url) {
      segments.push({ kind: 'emoji', text, url: toHttps(node.emoji.icon_url), large: Number(node.emoji.size) >= 2 })
      continue
    }
    if (node.type === 'RICH_TEXT_NODE_TYPE_AT' && node.rid) {
      segments.push({ kind: 'link', text, url: `https://space.bilibili.com/${node.rid}` })
      continue
    }
    if (node.type !== 'RICH_TEXT_NODE_TYPE_TEXT' && node.jump_url) {
      segments.push({ kind: 'link', text, url: toHttps(node.jump_url) })
      continue
    }
    const last = segments.at(-1)
    if (last?.kind === 'text')
      last.text += text
    else if (text)
      segments.push({ kind: 'text', text })
  }
  return segments
}

export function richTextToPlain(segments: RichSegment[]): string {
  return segments.map(s => s.text).join('')
}

function parseLiveRcmd(content: string | undefined): LiveRcmdContent['live_play_info'] {
  if (!content)
    return null
  try {
    return (JSON.parse(content) as LiveRcmdContent).live_play_info ?? null
  }
  catch {
    return null
  }
}

function contentOf(item: FeedItem, major: FeedMajor | null | undefined): MomentContent {
  if (!major)
    return { kind: 'none' }

  switch (major.type) {
    case 'MAJOR_TYPE_ARCHIVE': {
      const a = major.archive
      if (!a)
        break
      return {
        kind: 'video',
        video: {
          aid: a.aid,
          bvid: a.bvid,
          title: a.title,
          cover: a.cover,
          url: toHttps(a.jump_url) || `https://www.bilibili.com/video/${a.bvid}`,
          desc: a.desc && a.desc !== '-' ? a.desc : undefined,
          duration: a.duration_text,
          play: a.stat?.play,
          danmaku: a.stat?.danmaku,
          // 普通投稿的角标都是「投稿视频」，不用显示
          badge: a.badge?.text && a.badge.text !== '投稿视频' ? a.badge.text : undefined,
        },
      }
    }
    case 'MAJOR_TYPE_PGC': {
      const p = major.pgc
      if (!p)
        break
      return {
        kind: 'video',
        video: { title: p.title, cover: p.cover, url: toHttps(p.jump_url), play: p.stat?.play, danmaku: p.stat?.danmaku, badge: p.badge?.text },
      }
    }
    case 'MAJOR_TYPE_UGC_SEASON': {
      const s = major.ugc_season
      if (!s)
        break
      return {
        kind: 'video',
        video: { title: s.title, cover: s.cover, url: toHttps(s.jump_url), desc: s.desc, duration: s.duration_text, play: s.stat?.play, danmaku: s.stat?.danmaku },
      }
    }
    case 'MAJOR_TYPE_COURSES': {
      const c = major.courses
      if (!c)
        break
      return {
        kind: 'video',
        video: { title: c.title, cover: c.cover, url: toHttps(c.jump_url), desc: c.sub_title || c.desc, badge: c.badge?.text },
      }
    }
    case 'MAJOR_TYPE_OPUS': {
      const o = major.opus
      if (!o)
        break
      const pics = (o.pics ?? []).filter(p => p.url)
      if (item.type === 'DYNAMIC_TYPE_ARTICLE') {
        return {
          kind: 'article',
          article: {
            title: o.title ?? '',
            summary: o.summary?.text ?? '',
            cover: pics[0]?.url,
            url: toHttps(o.jump_url) || `https://www.bilibili.com/opus/${item.id_str}`,
          },
        }
      }
      if (pics.length)
        return { kind: 'images', images: pics.map(p => ({ url: p.url, width: p.width, height: p.height })) }
      return { kind: 'none' }
    }
    case 'MAJOR_TYPE_DRAW': {
      const images: MomentImage[] = (major.draw?.items ?? []).map(i => ({ url: i.src, width: i.width, height: i.height }))
      return images.length ? { kind: 'images', images } : { kind: 'none' }
    }
    case 'MAJOR_TYPE_ARTICLE': {
      const a = major.article
      if (!a)
        break
      return { kind: 'article', article: { title: a.title, summary: a.desc ?? '', cover: a.covers?.[0], url: toHttps(a.jump_url) } }
    }
    case 'MAJOR_TYPE_LIVE_RCMD': {
      const info = parseLiveRcmd(major.live_rcmd?.content)
      if (!info)
        break
      return {
        kind: 'live',
        live: {
          title: info.title,
          cover: info.cover,
          url: `https://live.bilibili.com/${info.room_id}`,
          area: info.area_name,
          watched: info.watched_show?.text_large,
          ended: info.live_status !== 1,
        },
      }
    }
    case 'MAJOR_TYPE_LIVE': {
      const l = major.live
      if (!l)
        break
      return {
        kind: 'live',
        live: { title: l.title, cover: l.cover, url: toHttps(l.jump_url), area: l.desc_first, watched: l.desc_second, ended: l.live_state !== 1 },
      }
    }
    case 'MAJOR_TYPE_COMMON': {
      const c = major.common
      if (!c)
        break
      return { kind: 'attachment', attachment: { title: c.title, desc: c.desc, cover: c.cover, url: toHttps(c.jump_url), badge: c.badge?.text } }
    }
    case 'MAJOR_TYPE_MUSIC': {
      const m = major.music
      if (!m)
        break
      return { kind: 'attachment', attachment: { title: m.title, desc: m.label, cover: m.cover, url: toHttps(m.jump_url) } }
    }
  }
  return { kind: 'none' }
}

function openTargetOf(item: FeedItem, content: MomentContent): MomentOpenTarget {
  if (content.kind === 'video' && content.video.url)
    return { kind: 'video', url: content.video.url }
  if (content.kind === 'live' && content.live.url)
    return { kind: 'newTab', url: content.live.url }
  // 图文、纯文字和文章的详情页在 www.bilibili.com/opus 下，能放进抽屉；
  // 视频动态和转发的 opus 页会跳到 t.bilibili.com，只能在新标签页打开
  const jumpUrl = item.basic?.jump_url || item.modules.module_dynamic?.major?.opus?.jump_url || ''
  if (/\/\/(?:www\.)?bilibili\.com\/opus\//.test(jumpUrl))
    return { kind: 'drawer', url: `https://www.bilibili.com/opus/${item.id_str}` }
  if (content.kind === 'article' && content.article.url)
    return { kind: 'newTab', url: content.article.url }
  return { kind: 'newTab', url: `https://t.bilibili.com/${item.id_str}` }
}

/** 整理一条动态；被删除、不可见或认不出来的返回 null */
export function normalizeMoment(item: FeedItem): MomentEntry | null {
  if (!item?.id_str || item.visible === false || item.type === 'DYNAMIC_TYPE_NONE' || !item.modules?.module_author)
    return null

  const author = item.modules.module_author
  const dynamic = item.modules.module_dynamic
  const major = dynamic?.major
  const opus = major?.type === 'MAJOR_TYPE_OPUS' ? major.opus : null

  let content: MomentContent
  if (item.type === 'DYNAMIC_TYPE_FORWARD') {
    const origMajor = item.orig?.modules?.module_dynamic?.major
    const orig = item.orig && origMajor?.type !== 'MAJOR_TYPE_NONE' ? normalizeMoment(item.orig) : null
    content = { kind: 'forward', orig, tip: orig ? undefined : origMajor?.none?.tips }
  }
  else {
    content = contentOf(item, major)
  }

  // 文章的摘要放在文章块里，不再当正文显示
  const text = opus
    ? (content.kind === 'article' ? [] : parseRichText(opus.summary?.rich_text_nodes, opus.summary?.text))
    : parseRichText(dynamic?.desc?.rich_text_nodes, dynamic?.desc?.text)

  const stat = item.modules.module_stat
  const mid = String(author.mid)

  return {
    id: item.id_str,
    type: item.type,
    group: groupOf(item.type),
    author: {
      mid,
      name: author.name,
      face: author.face,
      spaceUrl: `https://space.bilibili.com/${mid}`,
      vip: author.vip?.status === 1 && !!author.vip.nickname_color,
    },
    time: author.pub_time ?? '',
    action: author.pub_action ?? '',
    title: content.kind !== 'article' && opus?.title ? opus.title : undefined,
    text,
    textTruncated: content.kind !== 'article' && !!opus?.summary?.has_more,
    content,
    stats: {
      forward: stat?.forward?.count ?? 0,
      comment: stat?.comment?.count ?? 0,
      like: stat?.like?.count ?? 0,
      liked: !!stat?.like?.status,
    },
    open: openTargetOf(item, content),
  }
}

/** 整理一页动态，跳过已经有的（翻页时接口偶尔会返回重复的） */
export function normalizeMoments(items: FeedItem[] | null | undefined, seen?: Set<string>): MomentEntry[] {
  const result: MomentEntry[] = []
  for (const item of items ?? []) {
    const entry = normalizeMoment(item)
    if (!entry || seen?.has(entry.id))
      continue
    seen?.add(entry.id)
    result.push(entry)
  }
  return result
}

export function normalizeUps(items: PortalUp[] | null | undefined): MomentsUp[] {
  return (items ?? []).map(u => ({ mid: String(u.mid), name: u.uname, face: u.face, hasUpdate: !!u.has_update }))
}

/** 直播的 UP 主：优先用直播接口的关注列表（有封面、分区和观看人数），拿不到时用头像栏接口给的 */
export function normalizeLiveUsers(followingLive: FollowingLiveItem[] | null | undefined, portalLive: PortalLiveUser[] | null | undefined): MomentsLiveUser[] {
  const live = (followingLive ?? []).filter(item => item.live_status === 1)
  if (live.length) {
    return live.map(item => ({
      mid: String(item.uid),
      name: item.uname,
      face: item.face,
      roomUrl: `https://live.bilibili.com/${item.roomid}`,
      title: item.title,
      cover: item.room_cover,
      area: item.area_name_v2,
      watched: item.text_small,
    }))
  }
  return (portalLive ?? []).map(item => ({
    mid: String(item.mid),
    name: item.uname,
    face: item.face,
    roomUrl: toHttps(item.jump_url) || `https://live.bilibili.com/${item.room_id}`,
    title: item.title,
  }))
}

/** 窗口宽度最多能放几列 */
export function maxColumnsFit(width: number, minColumnWidth = MIN_COLUMN_WIDTH, gap = COLUMN_GAP): number {
  return Math.max(1, Math.floor((width + gap) / (minColumnWidth + gap)))
}

/** 最矮的一列；高度差不到半像素的取靠左的 */
export function shortestColumn(heights: number[]): number {
  let index = 0
  let min = Number.POSITIVE_INFINITY
  heights.forEach((height, i) => {
    if (height < min - 0.5) {
      min = height
      index = i
    }
  })
  return index
}

/** 单张图片的显示比例（宽 / 高），太长太宽的裁掉 */
export function singleImageRatio(image: MomentImage): number {
  if (!image.width || !image.height)
    return 4 / 3
  return Math.min(Math.max(image.width / image.height, 3 / 4), 2)
}
