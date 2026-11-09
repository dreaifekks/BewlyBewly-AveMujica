import type { APIMAP } from '../../utils'
import { AHS } from '../../utils'

const API_MOMENT = {
  getTopBarNewMomentsCount: {
    url: 'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all/update',
    _fetch: {
      method: 'get',
    },
    params: {
      type: 'video',
      update_baseline: '0',
    },
    afterHandle: AHS.J_D,
  },
  getTopBarMoments: {
    url: 'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/nav',
    _fetch: {
      method: 'get',
    },
    params: {
      type: 'video',
      update_baseline: '',
      offset: '',
    },
    afterHandle: AHS.J_D,
  },
  getTopBarLiveMoments: {
    url: 'https://api.live.bilibili.com/xlive/web-ucenter/v1/xfetter/FeedList',
    _fetch: {
      method: 'get',
    },
    params: {
      page: 1,
      pagesize: 10,
    },
    afterHandle: AHS.J_D,
  },
  getMoments: {
    url: 'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all',
    _fetch: {
      method: 'get',
    },
    params: {
      type: 'all',
      offset: 0,
      update_baseline: '',
    },
    afterHandle: AHS.J_D,
  },
  // 动态页的信息流，参数和B站自己的动态页一致。
  // itemOpusStyle 让图文、纯文字和文章都以 MAJOR_TYPE_OPUS 返回；host_mid 只看某个 UP 主
  getMomentsFeed: {
    url: 'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all',
    _fetch: {
      method: 'get',
    },
    params: {
      timezone_offset: -480,
      type: 'all',
      platform: 'web',
      page: 1,
      offset: '',
      host_mid: '',
      features: 'itemOpusStyle',
      web_location: '333.1365',
    },
    afterHandle: AHS.J_D,
  },
  // 动态页上方的头像栏：最常访问的 UP 主（has_update 表示有新动态）和正在直播的 UP 主
  getMomentsPortal: {
    url: 'https://api.bilibili.com/x/polymer/web-dynamic/v1/portal',
    _fetch: {
      method: 'get',
    },
    params: {
      up_list_more: 1,
      web_location: '333.1365',
    },
    afterHandle: AHS.J_D,
  },
  // 给动态点赞（up: 1）或取消点赞（up: 2）。csrf 放在查询参数里，正文是 JSON，和B站动态页一致
  likeMoment: {
    url: 'https://api.bilibili.com/x/dynamic/feed/dyn/thumb',
    _fetch: {
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        dyn_id_str: '',
        up: 1,
        spmid: '333.1365.0.0',
      },
    },
    params: {
      csrf: '',
    },
    afterHandle: AHS.J_D,
  },
} satisfies APIMAP

export default API_MOMENT
