import { defineStore } from 'pinia'

import type { UserInfo } from '~/models/user/userInfo'
import { removeAccount } from '~/utils/accountManager'
import api from '~/utils/api'
import { revokeAccessKey } from '~/utils/authProvider'
import { getCookie, getCSRF } from '~/utils/main'

export type SessionStatus = 'unknown' | 'loggedIn' | 'loggedOut'

export const useSessionStore = defineStore('session', () => {
  const status = ref<SessionStatus>('unknown')
  const userInfo = ref<UserInfo>()
  // 轻量非异步的账号ID访问器，在用户资料加载完成前也可直接从cookie取得。
  const userID = computed(() => {
    if (status.value === 'loggedOut')
      return undefined
    return userInfo.value?.mid ?? (Number(getCookie('DedeUserID')) || undefined)
  })
  let userInfoRequest: Promise<void> | undefined

  async function getUserInfo() {
    if (status.value === 'loggedIn')
      return
    if (userInfoRequest)
      return userInfoRequest

    userInfoRequest = (async () => {
      try {
        const res = await api.user.getUserInfo()

        if (res.code === 0) {
          userInfo.value = res.data
          status.value = 'loggedIn'
        }
        else if (res.code === -101) {
          userInfo.value = undefined
          status.value = 'loggedOut'
        }
      }
      catch (error) {
        userInfo.value = undefined
        status.value = 'loggedOut'
        console.error(error)
      }
    })()

    try {
      await userInfoRequest
    }
    finally {
      userInfoRequest = undefined
    }
  }

  async function logout() {
    const uid = userID.value ? String(userID.value) : ''
    await Promise.resolve(revokeAccessKey()).catch((error) => {
      console.error('[AccountManager] Failed to clear the current mobile token:', error)
    })
    await api.auth.logout({ biliCSRF: getCSRF() })
    if (uid) {
      await removeAccount(uid).catch((error) => {
        console.error('[AccountManager] Failed to remove the logged-out account:', error)
      })
    }
    userInfo.value = undefined
    status.value = 'loggedOut'
  }

  return { status, userInfo, userID, getUserInfo, logout }
})
