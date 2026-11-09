import { describe, expect, it } from 'vitest'

import {
  feedTypeOf,
  groupOf,
  matchesTab,
  maxColumnsFit,
  normalizeLiveUsers,
  normalizeMoment,
  normalizeMoments,
  normalizeUps,
  parseRichText,
  shortestColumn,
  singleImageRatio,
  thumbnailUrl,
  toHttps,
} from '../contentScripts/views/Moments/momentsData'
import type { List as FollowingLiveItem } from '../models/live/getFollowingLiveList'
import type { FeedItem, FeedMajor, RichTextNode } from '../models/moment/momentFeed'

function feedItem(id: string, type: string, options: {
  major?: FeedMajor | null
  desc?: { text: string, rich_text_nodes?: RichTextNode[] } | null
  jumpUrl?: string
  orig?: FeedItem | null
  liked?: boolean
} = {}): FeedItem {
  return {
    id_str: id,
    type,
    visible: true,
    basic: { jump_url: options.jumpUrl ?? '' },
    modules: {
      module_author: {
        mid: 42,
        name: '测试UP',
        face: 'https://i0.hdslb.com/bfs/face/a.jpg',
        pub_time: '1小时前',
        pub_action: type === 'DYNAMIC_TYPE_AV' ? '投稿了视频' : '',
        vip: { status: 1, nickname_color: '#FB7299' },
      },
      module_dynamic: { desc: options.desc ?? null, major: options.major ?? null },
      module_stat: {
        forward: { count: 1 },
        comment: { count: 2 },
        like: { count: 3, status: !!options.liked },
      },
    },
    orig: options.orig ?? null,
  }
}

const textNode = (text: string): RichTextNode => ({ type: 'RICH_TEXT_NODE_TYPE_TEXT', text })

describe('moments groups', () => {
  it('puts videos, articles, posts and live into the right tabs', () => {
    expect(groupOf('DYNAMIC_TYPE_AV')).toBe('video')
    expect(groupOf('DYNAMIC_TYPE_PGC')).toBe('video')
    expect(groupOf('DYNAMIC_TYPE_ARTICLE')).toBe('article')
    expect(groupOf('DYNAMIC_TYPE_DRAW')).toBe('dynamic')
    expect(groupOf('DYNAMIC_TYPE_WORD')).toBe('dynamic')
    expect(groupOf('DYNAMIC_TYPE_FORWARD')).toBe('dynamic')
    expect(groupOf('DYNAMIC_TYPE_LIVE_RCMD')).toBeNull()
  })

  it('shows live only in the all tab', () => {
    const live = normalizeMoment(feedItem('1', 'DYNAMIC_TYPE_LIVE_RCMD'))!
    expect(matchesTab(live, 'all')).toBe(true)
    expect(matchesTab(live, 'video')).toBe(false)
    expect(matchesTab(live, 'dynamic')).toBe(false)
  })

  it('asks the API for videos and articles, and picks posts out of all', () => {
    expect(feedTypeOf('all')).toBe('all')
    expect(feedTypeOf('video')).toBe('video')
    expect(feedTypeOf('article')).toBe('article')
    expect(feedTypeOf('dynamic')).toBe('all')
    // 只看某个 UP 主时总是从「全部」里挑
    expect(feedTypeOf('video', '42')).toBe('all')
  })
})

describe('moments urls', () => {
  it('normalizes protocol-relative and http urls to https', () => {
    expect(toHttps('//i0.hdslb.com/a.jpg')).toBe('https://i0.hdslb.com/a.jpg')
    expect(toHttps('http://i0.hdslb.com/a.jpg')).toBe('https://i0.hdslb.com/a.jpg')
    expect(toHttps('')).toBe('')
  })

  it('builds bilibili thumbnails but leaves gifs and other hosts alone', () => {
    expect(thumbnailUrl('http://i0.hdslb.com/bfs/a.jpg', 300, 300)).toBe('https://i0.hdslb.com/bfs/a.jpg@300w_300h_1c.webp')
    expect(thumbnailUrl('https://i0.hdslb.com/bfs/a.png', 720)).toBe('https://i0.hdslb.com/bfs/a.png@720w.webp')
    expect(thumbnailUrl('https://i0.hdslb.com/bfs/a.gif', 300, 300)).toBe('https://i0.hdslb.com/bfs/a.gif')
    expect(thumbnailUrl('https://i0.hdslb.com/bfs/a.jpg@100w.webp', 300)).toBe('https://i0.hdslb.com/bfs/a.jpg@100w.webp')
    expect(thumbnailUrl('https://example.com/a.jpg', 300)).toBe('https://example.com/a.jpg')
  })
})

describe('parseRichText', () => {
  it('turns emoji, mentions and links into segments and merges plain text', () => {
    const segments = parseRichText([
      textNode('你好'),
      textNode('，'),
      { type: 'RICH_TEXT_NODE_TYPE_EMOJI', text: '[doge]', emoji: { icon_url: '//i0.hdslb.com/doge.png', size: 1 } },
      { type: 'RICH_TEXT_NODE_TYPE_AT', text: '@某人', rid: '123' },
      { type: 'RICH_TEXT_NODE_TYPE_TOPIC', text: '#话题#', jump_url: '//search.bilibili.com/all?keyword=话题' },
    ])
    expect(segments).toEqual([
      { kind: 'text', text: '你好，' },
      { kind: 'emoji', text: '[doge]', url: 'https://i0.hdslb.com/doge.png', large: false },
      { kind: 'link', text: '@某人', url: 'https://space.bilibili.com/123' },
      { kind: 'link', text: '#话题#', url: 'https://search.bilibili.com/all?keyword=话题' },
    ])
  })

  it('falls back to the plain text when there are no nodes', () => {
    expect(parseRichText(null, '只有文字')).toEqual([{ kind: 'text', text: '只有文字' }])
    expect(parseRichText([], '')).toEqual([])
  })
})

describe('normalizeMoment', () => {
  it('opens video moments as videos', () => {
    const entry = normalizeMoment(feedItem('100', 'DYNAMIC_TYPE_AV', {
      desc: { text: '新视频', rich_text_nodes: [textNode('新视频')] },
      major: {
        type: 'MAJOR_TYPE_ARCHIVE',
        archive: {
          aid: '170001',
          bvid: 'BV1xx411c7mD',
          title: '标题',
          cover: 'http://i0.hdslb.com/bfs/archive/c.jpg',
          desc: '-',
          duration_text: '01:23',
          jump_url: '//www.bilibili.com/video/BV1xx411c7mD',
          stat: { play: '387', danmaku: '0' },
          badge: { text: '投稿视频' },
        },
      },
    }))!
    expect(entry.group).toBe('video')
    expect(entry.action).toBe('投稿了视频')
    expect(entry.author).toMatchObject({ mid: '42', vip: true, spaceUrl: 'https://space.bilibili.com/42' })
    expect(entry.text).toEqual([{ kind: 'text', text: '新视频' }])
    expect(entry.content).toMatchObject({
      kind: 'video',
      video: { aid: '170001', url: 'https://www.bilibili.com/video/BV1xx411c7mD', desc: undefined, badge: undefined },
    })
    expect(entry.open).toEqual({ kind: 'video', url: 'https://www.bilibili.com/video/BV1xx411c7mD' })
    expect(entry.stats).toEqual({ forward: 1, comment: 2, like: 3, liked: false })
  })

  it('opens image posts in the drawer and keeps the opus title and text', () => {
    const entry = normalizeMoment(feedItem('200', 'DYNAMIC_TYPE_DRAW', {
      jumpUrl: '//www.bilibili.com/opus/200',
      major: {
        type: 'MAJOR_TYPE_OPUS',
        opus: {
          title: '图文标题',
          jump_url: '//www.bilibili.com/opus/200',
          summary: { text: '正文', rich_text_nodes: [textNode('正文')], has_more: true },
          pics: [{ url: 'http://i0.hdslb.com/bfs/new_dyn/1.png', width: 1080, height: 1080 }],
        },
      },
      liked: true,
    }))!
    expect(entry.group).toBe('dynamic')
    expect(entry.title).toBe('图文标题')
    expect(entry.text).toEqual([{ kind: 'text', text: '正文' }])
    expect(entry.textTruncated).toBe(true)
    expect(entry.content).toEqual({ kind: 'images', images: [{ url: 'http://i0.hdslb.com/bfs/new_dyn/1.png', width: 1080, height: 1080 }] })
    expect(entry.open).toEqual({ kind: 'drawer', url: 'https://www.bilibili.com/opus/200' })
    expect(entry.stats.liked).toBe(true)
  })

  it('shows articles as an article block instead of body text', () => {
    const entry = normalizeMoment(feedItem('300', 'DYNAMIC_TYPE_ARTICLE', {
      jumpUrl: '//www.bilibili.com/opus/300',
      major: {
        type: 'MAJOR_TYPE_OPUS',
        opus: {
          title: '文章标题',
          jump_url: '//www.bilibili.com/opus/300',
          summary: { text: '摘要', rich_text_nodes: [textNode('摘要')], has_more: true },
          pics: [{ url: 'https://i0.hdslb.com/bfs/note/cover.png', width: 838, height: 535 }],
        },
      },
    }))!
    expect(entry.group).toBe('article')
    expect(entry.text).toEqual([])
    expect(entry.title).toBeUndefined()
    expect(entry.textTruncated).toBe(false)
    expect(entry.content).toEqual({
      kind: 'article',
      article: { title: '文章标题', summary: '摘要', cover: 'https://i0.hdslb.com/bfs/note/cover.png', url: 'https://www.bilibili.com/opus/300' },
    })
    expect(entry.open.kind).toBe('drawer')
  })

  it('opens reposts on t.bilibili.com and keeps the original moment', () => {
    const orig = feedItem('400', 'DYNAMIC_TYPE_AV', {
      major: {
        type: 'MAJOR_TYPE_ARCHIVE',
        archive: { aid: '1', bvid: 'BV1', title: '原视频', cover: '', jump_url: '//www.bilibili.com/video/BV1' },
      },
    })
    const entry = normalizeMoment(feedItem('401', 'DYNAMIC_TYPE_FORWARD', {
      desc: { text: '转发理由', rich_text_nodes: [textNode('转发理由')] },
      orig,
    }))!
    expect(entry.group).toBe('dynamic')
    expect(entry.open).toEqual({ kind: 'newTab', url: 'https://t.bilibili.com/401' })
    expect(entry.content.kind).toBe('forward')
    if (entry.content.kind === 'forward') {
      expect(entry.content.orig?.id).toBe('400')
      expect(entry.content.orig?.open).toEqual({ kind: 'video', url: 'https://www.bilibili.com/video/BV1' })
    }
  })

  it('shows the tip when the original moment was deleted', () => {
    const orig = feedItem('500', 'DYNAMIC_TYPE_NONE', { major: { type: 'MAJOR_TYPE_NONE', none: { tips: '源动态已被作者删除' } } })
    const entry = normalizeMoment(feedItem('501', 'DYNAMIC_TYPE_FORWARD', { orig }))!
    expect(entry.content).toEqual({ kind: 'forward', orig: null, tip: '源动态已被作者删除' })
  })

  it('reads live recommendations from the JSON content', () => {
    const entry = normalizeMoment(feedItem('600', 'DYNAMIC_TYPE_LIVE_RCMD', {
      major: {
        type: 'MAJOR_TYPE_LIVE_RCMD',
        live_rcmd: {
          content: JSON.stringify({
            live_play_info: {
              room_id: 24772933,
              live_status: 1,
              title: '摸鱼',
              cover: 'https://i0.hdslb.com/bfs/live/cover.jpg',
              area_name: '手工绘画',
              watched_show: { text_large: '8人看过' },
            },
          }),
        },
      },
    }))!
    expect(entry.group).toBeNull()
    expect(entry.content).toEqual({
      kind: 'live',
      live: { title: '摸鱼', cover: 'https://i0.hdslb.com/bfs/live/cover.jpg', url: 'https://live.bilibili.com/24772933', area: '手工绘画', watched: '8人看过', ended: false },
    })
    expect(entry.open).toEqual({ kind: 'newTab', url: 'https://live.bilibili.com/24772933' })
  })

  it('skips invisible and deleted moments', () => {
    expect(normalizeMoment({ ...feedItem('700', 'DYNAMIC_TYPE_WORD'), visible: false })).toBeNull()
    expect(normalizeMoment(feedItem('701', 'DYNAMIC_TYPE_NONE'))).toBeNull()
  })

  it('drops moments that were already loaded', () => {
    const seen = new Set<string>()
    const first = normalizeMoments([feedItem('1', 'DYNAMIC_TYPE_WORD'), feedItem('2', 'DYNAMIC_TYPE_WORD')], seen)
    const second = normalizeMoments([feedItem('2', 'DYNAMIC_TYPE_WORD'), feedItem('3', 'DYNAMIC_TYPE_WORD')], seen)
    expect(first.map(e => e.id)).toEqual(['1', '2'])
    expect(second.map(e => e.id)).toEqual(['3'])
  })
})

describe('moments strip', () => {
  it('normalizes the frequently visited UPs', () => {
    expect(normalizeUps([{ mid: 1, uname: 'A', face: 'f', has_update: true }])).toEqual([{ mid: '1', name: 'A', face: 'f', hasUpdate: true }])
    expect(normalizeUps(null)).toEqual([])
  })

  it('prefers the live following list and falls back to the portal', () => {
    const following = [
      { uid: 1, roomid: 11, uname: 'A', face: 'fa', title: 'TA', room_cover: 'ca', area_name_v2: '游戏', text_small: '4368', live_status: 1 },
      { uid: 2, roomid: 22, uname: 'B', face: 'fb', title: 'TB', room_cover: 'cb', area_name_v2: '', text_small: '', live_status: 0 },
    ] as FollowingLiveItem[]
    const portal = [{ mid: '3', uname: 'C', face: 'fc', room_id: '33', title: 'TC', jump_url: 'https://live.bilibili.com/33?live_from=85001' }]

    expect(normalizeLiveUsers(following, portal)).toEqual([
      { mid: '1', name: 'A', face: 'fa', roomUrl: 'https://live.bilibili.com/11', title: 'TA', cover: 'ca', area: '游戏', watched: '4368' },
    ])
    expect(normalizeLiveUsers(null, portal)).toEqual([
      { mid: '3', name: 'C', face: 'fc', roomUrl: 'https://live.bilibili.com/33?live_from=85001', title: 'TC' },
    ])
  })
})

describe('masonry layout', () => {
  it('fits as many 300px columns as the width allows', () => {
    expect(maxColumnsFit(0)).toBe(1)
    expect(maxColumnsFit(615)).toBe(1)
    expect(maxColumnsFit(616)).toBe(2)
    expect(maxColumnsFit(932)).toBe(3)
    expect(maxColumnsFit(1400)).toBe(4)
  })

  it('places the next card into the shortest column, leftmost on ties', () => {
    expect(shortestColumn([300, 120, 200])).toBe(1)
    expect(shortestColumn([100, 100.3, 100])).toBe(0)
    expect(shortestColumn([0, 0, 0])).toBe(0)
  })

  it('crops very tall or very wide single images', () => {
    expect(singleImageRatio({ url: '', width: 1600, height: 900 })).toBeCloseTo(16 / 9)
    expect(singleImageRatio({ url: '', width: 1080, height: 5000 })).toBe(0.75)
    expect(singleImageRatio({ url: '', width: 5000, height: 1000 })).toBe(2)
    expect(singleImageRatio({ url: '', width: 0, height: 0 })).toBeCloseTo(4 / 3)
  })
})
