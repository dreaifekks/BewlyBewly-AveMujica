/** 动态页的筛选：全部、视频、动态（图文、纯文字和转发）、文章 */
export type MomentsTab = 'all' | 'video' | 'dynamic' | 'article'

export const MOMENTS_TABS: { tab: MomentsTab, i18nKey: string, descI18nKey?: string }[] = [
  { tab: 'all', i18nKey: 'moments.tabs.all' },
  { tab: 'video', i18nKey: 'moments.tabs.video' },
  { tab: 'dynamic', i18nKey: 'moments.tabs.dynamic', descI18nKey: 'moments.tabs.dynamic_desc' },
  { tab: 'article', i18nKey: 'moments.tabs.article' },
]

/** 一段动态正文：文字、表情或链接（@、话题、网页、视频等） */
export type RichSegment
  = | { kind: 'text', text: string }
    | { kind: 'emoji', text: string, url: string, large: boolean }
    | { kind: 'link', text: string, url: string }

export interface MomentAuthor {
  mid: string
  name: string
  face: string
  spaceUrl: string
  /** 大会员的名字用粉色 */
  vip: boolean
}

export interface MomentImage {
  url: string
  width: number
  height: number
}

export interface MomentVideo {
  aid?: string
  bvid?: string
  title: string
  cover: string
  url: string
  desc?: string
  duration?: string
  play?: string
  danmaku?: string
  /** 番剧、课程等的角标 */
  badge?: string
}

export interface MomentArticle {
  title: string
  summary: string
  cover?: string
  url: string
}

export interface MomentLive {
  title: string
  cover: string
  url: string
  area?: string
  /** B站给的「N人看过」 */
  watched?: string
  /** 直播已经结束 */
  ended: boolean
}

/** 音乐、装扮、课程之类的附件卡片 */
export interface MomentAttachment {
  title: string
  desc?: string
  cover?: string
  url?: string
  badge?: string
}

export type MomentContent
  = | { kind: 'none' }
    | { kind: 'video', video: MomentVideo }
    | { kind: 'images', images: MomentImage[] }
    | { kind: 'article', article: MomentArticle }
    | { kind: 'live', live: MomentLive }
    | { kind: 'attachment', attachment: MomentAttachment }
  /** 转发；原动态被删除时 `orig` 为空，`tip` 是B站给的提示 */
    | { kind: 'forward', orig: MomentEntry | null, tip?: string }

/** 点卡片时打开什么 */
export type MomentOpenTarget
  /** 视频：按「视频卡片链接打开方式」设置打开 */
  = | { kind: 'video', url: string }
  /** 本站的动态详情页，可以放进抽屉 */
    | { kind: 'drawer', url: string }
  /** 其他站点的页面（t.bilibili.com、直播间等），在新标签页打开 */
    | { kind: 'newTab', url: string }

export interface MomentEntry {
  id: string
  /** 动态类型，例如 DYNAMIC_TYPE_AV */
  type: string
  /** 除「全部」以外属于哪个筛选；直播只在「全部」里出现，为 null */
  group: Exclude<MomentsTab, 'all'> | null
  author: MomentAuthor
  /** 「1小时前」 */
  time: string
  /** 「投稿了视频」 */
  action: string
  /** 图文动态可以有标题 */
  title?: string
  text: RichSegment[]
  /** 正文被接口截断，完整内容要去详情页看 */
  textTruncated: boolean
  content: MomentContent
  stats: {
    forward: number
    comment: number
    like: number
    liked: boolean
  }
  open: MomentOpenTarget
}

/** 头像栏里正在直播的 UP 主 */
export interface MomentsLiveUser {
  mid: string
  name: string
  face: string
  roomUrl: string
  title: string
  cover?: string
  area?: string
  /** 看过的人数，例如「4368」「1.2万」 */
  watched?: string
}

/** 头像栏里的 UP 主 */
export interface MomentsUp {
  mid: string
  name: string
  face: string
  hasUpdate: boolean
}
