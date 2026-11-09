// 动态页用到的B站接口返回结构，只列出用到的字段。
// 信息流按 features=itemOpusStyle 请求：图文、纯文字和文章都以 MAJOR_TYPE_OPUS 返回

export interface FeedResult {
  code: number
  message: string
  data?: FeedData
}

export interface FeedData {
  has_more: boolean
  items: FeedItem[]
  offset: string
  update_baseline: string
  update_num: number
}

export interface FeedItem {
  id_str: string | null
  type: string
  visible?: boolean
  basic?: {
    comment_id_str?: string
    comment_type?: number
    jump_url?: string
    rid_str?: string
  } | null
  modules: FeedModules
  orig?: FeedItem | null
}

export interface FeedModules {
  module_author: FeedAuthor
  module_dynamic?: FeedDynamic | null
  module_stat?: FeedStat | null
  module_tag?: { text?: string } | null
}

export interface FeedAuthor {
  mid: number | string
  name: string
  face: string
  jump_url?: string
  pub_time?: string
  pub_ts?: number | string
  pub_action?: string
  type?: string
  vip?: {
    status?: number
    nickname_color?: string
  } | null
}

export interface RichTextNode {
  type: string
  text: string
  orig_text?: string
  jump_url?: string
  rid?: string
  emoji?: {
    icon_url: string
    size?: number | string
    text?: string
  } | null
}

export interface FeedDynamic {
  desc?: {
    text: string
    rich_text_nodes?: RichTextNode[] | null
  } | null
  topic?: {
    id: number | string
    name: string
    jump_url?: string
  } | null
  major?: FeedMajor | null
}

export interface FeedPic {
  url: string
  width: number
  height: number
}

interface FeedBadge {
  text: string
  bg_color?: string
  color?: string
}

interface FeedVideoStat {
  play?: string
  danmaku?: string
}

export interface FeedMajor {
  type: string
  archive?: {
    aid: string
    bvid: string
    title: string
    cover: string
    desc?: string
    duration_text?: string
    jump_url: string
    stat?: FeedVideoStat
    badge?: FeedBadge | null
  } | null
  pgc?: {
    title: string
    cover: string
    jump_url: string
    stat?: FeedVideoStat
    badge?: FeedBadge | null
  } | null
  ugc_season?: {
    title: string
    cover: string
    jump_url: string
    desc?: string
    duration_text?: string
    stat?: FeedVideoStat
  } | null
  courses?: {
    title: string
    cover: string
    jump_url: string
    desc?: string
    sub_title?: string
    badge?: FeedBadge | null
  } | null
  opus?: {
    title?: string | null
    jump_url?: string
    summary?: {
      text: string
      rich_text_nodes?: RichTextNode[] | null
      has_more?: boolean
    } | null
    pics?: FeedPic[] | null
  } | null
  draw?: {
    items: { src: string, width: number, height: number }[]
  } | null
  article?: {
    title: string
    desc?: string
    covers?: string[]
    jump_url: string
  } | null
  live_rcmd?: {
    content: string
  } | null
  live?: {
    title: string
    cover: string
    jump_url: string
    live_state?: number
    desc_first?: string
    desc_second?: string
  } | null
  common?: {
    title: string
    desc?: string
    cover?: string
    jump_url?: string
    badge?: FeedBadge | null
  } | null
  music?: {
    title: string
    cover: string
    jump_url: string
    label?: string
  } | null
  none?: {
    tips: string
  } | null
}

export interface FeedStat {
  forward?: { count: number } | null
  comment?: { count: number } | null
  like?: { count: number, status?: boolean } | null
}

/** MAJOR_TYPE_LIVE_RCMD 的 content 是一段 JSON 字符串 */
export interface LiveRcmdContent {
  live_play_info?: {
    title: string
    cover: string
    room_id: number
    live_status: number
    area_name?: string
    link?: string
    watched_show?: {
      text_large?: string
      text_small?: string
    } | null
  } | null
}

export interface PortalResult {
  code: number
  message: string
  data?: {
    up_list?: {
      items: PortalUp[] | null
    } | null
    live_users?: {
      count: number
      items: PortalLiveUser[] | null
    } | null
    my_info?: {
      mid: number
      name: string
      face: string
    } | null
  }
}

export interface PortalUp {
  mid: number | string
  uname: string
  face: string
  has_update: boolean
}

export interface PortalLiveUser {
  mid: number | string
  uname: string
  face: string
  room_id: number | string
  title: string
  jump_url: string
}
