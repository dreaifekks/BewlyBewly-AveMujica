<script setup lang="ts">
import DOMPurify from 'dompurify'
import { useI18n } from 'vue-i18n'
import { useToast } from 'vue-toastification'

import { accessKey, settings } from '~/logic'
import type { AccountListResult, PublicAccountProfile } from '~/types/accountManager'
import {
  registerCurrentAccount,
  removeAccount,
  startAddAccount,
  switchAccount,
} from '~/utils/accountManager'
import api from '~/utils/api'
import { revokeAccessKey } from '~/utils/authProvider'
import { numFormatter } from '~/utils/dataFormatter'
import { LV0_ICON, LV1_ICON, LV2_ICON, LV3_ICON, LV4_ICON, LV5_ICON, LV6_ICON, LV6_LIGHTNING_ICON } from '~/utils/lvIcons'
import { getCSRF, getUserID, isHomePage, removeHttpFromUrl } from '~/utils/main'

import type { UserInfo, UserStat } from '../types'

const props = defineProps<{
  userInfo: UserInfo
}>()

const { t } = useI18n()
const toast = useToast()

const accountState = ref<AccountListResult | null>(null)
const accountSwitcherOpen = ref(false)
const accountListLoading = ref(false)
const switchingUid = ref<string | null>(null)
const addingAccount = ref(false)

const accounts = computed(() => accountState.value?.accounts ?? [])
const currentAccount = computed(() => accounts.value.find(account => account.current) ?? null)

const mid = computed(() => {
  return getUserID()
})

const otherLinks = computed((): { name: string, url: string, icon: string }[] => {
  return [

    {
      name: t('topbar.user_dropdown.uploads_manager'),
      url: 'https://member.bilibili.com/v2#/upload-manager/article',
      icon: 'i-solar:video-library-bold-duotone',
    },
    {
      name: t('topbar.user_dropdown.account_settings'),
      url: 'https://account.bilibili.com/account/home',
      icon: 'i-solar:user-circle-bold-duotone',
    },
    {
      name: t('topbar.user_dropdown.bilibili_premium'),
      url: 'https://account.bilibili.com/big',
      icon: 'i-solar:accessibility-bold-duotone',
    },
    {
      name: t('topbar.user_dropdown.b_coins_wallet'),
      url: 'https://pay.bilibili.com/',
      icon: 'i-solar:wallet-money-bold-duotone',
    },
    {
      name: t('topbar.user_dropdown.orders'),
      url: 'https://show.bilibili.com/orderlist',
      icon: 'i-solar:clipboard-list-bold-duotone',
    },
    {
      name: t('topbar.user_dropdown.workshop'),
      url: 'https://gf.bilibili.com?msource=main_station',
      icon: 'i-solar:garage-bold-duotone',
    },
    {
      name: t('topbar.user_dropdown.my_stream_info'),
      url: 'https://link.bilibili.com/p/center/index',
      icon: 'i-solar:videocamera-record-bold-duotone',
    },
    {
      name: t('topbar.user_dropdown.my_courses'),
      url: 'https://www.bilibili.com/cheese/mine/list',
      icon: 'i-solar:notebook-bookmark-bold-duotone',
    },
  ]
})

const levelProgressBarWidth = computed(() => {
  const { next_exp: nextExp, current_exp: currentExp } = props.userInfo.level_info

  const percentage = (currentExp / nextExp) * 100
  return `${percentage.toFixed(2)}%`
})

const userStat = reactive<UserStat>({} as UserStat)

onMounted(() => {
  api.user.getUserStat()
    .then((res) => {
      if (res.code === 0)
        Object.assign(userStat, res.data)
    })
  void refreshAccounts()
})

async function logout() {
  const uid = String(props.userInfo.mid || getUserID())
  await revokeAccessKey().catch((error) => {
    console.error('[AccountManager] Failed to clear the current mobile token:', error)
  })
  api.auth.logout({
    biliCSRF: getCSRF(),
  }).then(async () => {
    if (uid) {
      await removeAccount(uid).catch((error) => {
        console.error('[AccountManager] Failed to remove the logged-out account:', error)
      })
    }
    location.reload()
  })
}

async function refreshAccounts() {
  if (!props.userInfo.mid || accountListLoading.value)
    return

  accountListLoading.value = true
  try {
    accountState.value = await registerCurrentAccount({
      uid: String(props.userInfo.mid),
      uname: props.userInfo.uname,
      avatar: props.userInfo.face,
    })
  }
  catch (error) {
    console.error('[AccountManager] Failed to load account list:', error)
  }
  finally {
    accountListLoading.value = false
  }
}

async function toggleAccountSwitcher() {
  accountSwitcherOpen.value = !accountSwitcherOpen.value
  if (accountSwitcherOpen.value)
    await refreshAccounts()
}

async function handleSwitchAccount(account: PublicAccountProfile) {
  if (account.current || switchingUid.value)
    return

  switchingUid.value = account.uid
  try {
    const result = await switchAccount(account.uid, location.href)
    if (!result.openedReplacementTab)
      location.reload()
  }
  catch (error) {
    toast.error(t('topbar.user_dropdown.switch_failed', {
      message: error instanceof Error ? error.message : String(error),
    }))
  }
  finally {
    switchingUid.value = null
  }
}

async function handleAddAccount() {
  if (addingAccount.value)
    return

  addingAccount.value = true
  try {
    const result = await startAddAccount()
    if (result.currentSessionCleared)
      accessKey.value = ''
  }
  catch (error) {
    toast.error(t('topbar.user_dropdown.add_account_failed', {
      message: error instanceof Error ? error.message : String(error),
    }))
  }
  finally {
    addingAccount.value = false
  }
}

const levelIcons: string[] = [
  LV0_ICON,
  LV1_ICON,
  LV2_ICON,
  LV3_ICON,
  LV4_ICON,
  LV5_ICON,
  LV6_ICON,
  LV6_LIGHTNING_ICON,
]

function getLvIcon(level: number, isSigma: boolean = false): string {
  if (level === 6 && isSigma) {
    return LV6_LIGHTNING_ICON
  }
  return levelIcons[level] || ''
}

function handleClickChannel() {
  if (settings.value.topBarLinkOpenMode === 'newTab') {
    window.open(`https://space.bilibili.com/${mid.value}`, '_blank')
  }
  else if (settings.value.topBarLinkOpenMode === 'currentTabIfNotHomepage') {
    if (isHomePage())
      window.open(`https://space.bilibili.com/${mid.value}`, '_blank')
    else
      window.open(`https://space.bilibili.com/${mid.value}`, '_self')
  }
  else {
    window.open(`https://space.bilibili.com/${mid.value}`, '_self')
  }
}
</script>

<template>
  <div
    style="backdrop-filter: var(--bew-filter-glass-1); max-height: 560px;"
    w-300px h="[calc(100vh-100px)]" important-overflow-y-auto
    p-4 rounded="$bew-radius" z--1 bg="$bew-elevated-alt"
    border="1 $bew-border-color"
    shadow="[var(--bew-shadow-3),var(--bew-shadow-edge-glow-1)]"
  >
    <div
      text="xl" font-medium flex="~ items-center gap-2"
    >
      <Button
        v-if="settings.touchScreenOptimization"
        type="secondary" strong @click="handleClickChannel"
      >
        {{ userInfo.uname ? userInfo.uname : '-' }}
      </Button>
      <span v-else>
        {{ userInfo.uname ? userInfo.uname : '-' }}
      </span>
    </div>
    <div
      text="xs $bew-text-2"
      m="t-1 b-2"
    >
      <ALink
        class="group mr-4"
        href="https://account.bilibili.com/account/coin"
        type="topBar"
      >
        {{ $t('topbar.user_dropdown.money') + (userInfo.money ?? '-') }}
      </ALink>
      <ALink
        class="group"
        href="https://pay.bilibili.com/pay-v2-web/bcoin_index"
        type="topBar"
      >
        {{
          $t('topbar.user_dropdown.b_coins') + (userInfo.wallet?.bcoin_balance ?? '-')
        }}
      </ALink>
    </div>

    <ALink
      href="//account.bilibili.com/account/record?type=exp"
      type="topBar"
      block mb-2 w-full
      flex="~ col justify-center items-start"
    >
      <template v-if="userInfo?.level_info?.current_level < 6">
        <div
          flex="~ items-center justify-center gap-2"
          w-full
        >
          <div
            flex="~ items-center"
            class="level"
            v-html="DOMPurify.sanitize(getLvIcon(userInfo.level_info.current_level))"
          />
          <div relative w="full" h="2px" bg="$bew-fill-3">
            <div
              pos="absolute top-0 left-0" h-2px
              h="2px"
              rounded="2px"
              bg="$bew-warning-color"
              :style="{ width: levelProgressBarWidth }"
            />
          </div>
          <div
            class="level level-next"
            flex="~ items-center"
            v-html="DOMPurify.sanitize(getLvIcon(userInfo.level_info.current_level + 1))"
          />
        </div>
        <div w-full text="xs $bew-text-3">
          {{
            $t('topbar.user_dropdown.exp_desc', {
              current_exp: userInfo.level_info.current_exp,
              level: userInfo.level_info.current_level + 1,
              need_exp: userInfo.level_info.next_exp - userInfo.level_info.current_exp || 0,
            })
          }}
        </div>
      </template>
      <template v-else>
        <div
          :style="{ width: userInfo?.is_senior_member ? '36px' : '28px' }"
          class="level"
          h-20px block
          v-html="DOMPurify.sanitize(getLvIcon(userInfo?.level_info?.current_level, userInfo?.is_senior_member))"
        />
      </template>
    </ALink>

    <div grid="~ cols-3 gap-2" mb-2>
      <ALink
        class="channel-info-item"
        :href="`https://space.bilibili.com/${mid}/fans/follow`"
        :title="`${userStat.following}`"
        type="topBar"
      >
        <div class="num">
          {{ userStat.following ? numFormatter(userStat.following) : '0' }}
        </div>
        <div>{{ $t('topbar.user_dropdown.following') }}</div>
      </ALink>
      <ALink
        class="channel-info-item"
        :href="`https://space.bilibili.com/${mid}/fans/fans`"
        :title="`${userStat.follower}`"
        type="topBar"
      >
        <div class="num">
          {{ userStat.follower ? numFormatter(userStat.follower) : '0' }}
        </div>
        <div>{{ $t('topbar.user_dropdown.followers') }}</div>
      </ALink>
      <ALink
        class="channel-info-item"
        :href="`https://space.bilibili.com/${mid}/dynamic`"
        :title="`${userStat.dynamic_count}`"
        type="topBar"
      >
        <div class="num">
          {{
            userStat.dynamic_count ? numFormatter(userStat.dynamic_count) : '0'
          }}
        </div>
        <div>{{ $t('topbar.user_dropdown.posts') }}</div>
      </ALink>
    </div>

    <div
      flex="~ justify-between col gap-1"
      class="account-switcher"
      mb-2 p-2 bg="$bew-fill-alt" rounded="$bew-radius"
      shadow="[var(--bew-shadow-edge-glow-1),var(--bew-shadow-1)]"
    >
      <button
        type="button"
        class="account-switch-trigger"
        :aria-expanded="accountSwitcherOpen"
        @click="toggleAccountSwitcher"
      >
        <span class="account-switch-icon">
          <span i-solar:transfer-horizontal-bold-duotone />
        </span>
        <span min-w-0 flex-1 text-left>
          <span block font-semibold>{{ $t('topbar.user_dropdown.switch_account') }}</span>
          <span block truncate text="xs $bew-text-3">
            {{ $t('topbar.user_dropdown.saved_accounts', { count: accounts.length }, accounts.length) }}
          </span>
        </span>
        <span
          v-if="currentAccount"
          class="account-token-badge"
          :class="{ active: currentAccount.hasMobileToken }"
          :title="currentAccount.hasMobileToken
            ? $t('topbar.user_dropdown.mobile_token_ready')
            : $t('topbar.user_dropdown.mobile_token_empty')"
        >
          {{ currentAccount.hasMobileToken ? 'APP' : 'WEB' }}
        </span>
        <span
          i-mingcute:down-line
          duration-250
          :class="{ 'rotate-180': accountSwitcherOpen }"
        />
      </button>

      <Transition name="account-list">
        <div v-if="accountSwitcherOpen" class="account-list">
          <div v-if="accountListLoading && !accounts.length" class="account-list-empty">
            <span i-svg-spinners:ring-resize />
            {{ $t('common.loading') }}
          </div>
          <div v-else-if="!accounts.length" class="account-list-empty">
            {{ $t('topbar.user_dropdown.no_saved_accounts') }}
          </div>
          <div v-else class="account-rows">
            <div
              v-for="account in accounts"
              :key="account.uid"
              class="account-row"
              :class="{ current: account.current }"
            >
              <button
                type="button"
                class="account-row-main"
                :disabled="account.current || Boolean(switchingUid)"
                @click="handleSwitchAccount(account)"
              >
                <span
                  class="account-avatar"
                  :style="{
                    backgroundImage: account.avatar
                      ? `url(${removeHttpFromUrl(account.avatar)})`
                      : undefined,
                  }"
                >
                  <span v-if="!account.avatar" i-solar:user-circle-bold-duotone />
                </span>
                <span min-w-0 flex-1 text-left>
                  <span block truncate font-semibold>{{ account.uname }}</span>
                  <span block truncate text="xs $bew-text-3">UID {{ account.uid }}</span>
                </span>
                <span
                  class="account-token-dot"
                  :class="{ active: account.hasMobileToken }"
                  :title="account.hasMobileToken
                    ? $t('topbar.user_dropdown.mobile_token_ready')
                    : $t('topbar.user_dropdown.mobile_token_empty')"
                />
                <span v-if="switchingUid === account.uid" i-svg-spinners:ring-resize />
                <span v-else-if="account.current" i-mingcute:check-line text="$bew-theme-color" />
                <span v-else i-mingcute:right-line text="$bew-text-3" />
              </button>
            </div>
          </div>

          <button
            type="button"
            class="account-add-button"
            :disabled="addingAccount"
            @click="handleAddAccount"
          >
            <span
              :class="addingAccount
                ? 'i-svg-spinners:ring-resize'
                : 'i-solar:user-plus-rounded-bold-duotone'"
            />
            {{ $t('topbar.user_dropdown.add_account') }}
          </button>
        </div>
      </Transition>
    </div>

    <div
      flex="~ justify-between col gap-1"
      mb-2 p-2 bg="$bew-fill-alt" rounded="$bew-radius"
      shadow="[var(--bew-shadow-edge-glow-1),var(--bew-shadow-1)]"
    >
      <a
        v-for="item in otherLinks.filter((_, index) => index <= 1)"
        :key="item.url"
        :href="item.url"
        target="_blank"
        p="x-4 y-2" flex="~ items-center justify-between"
        rounded="$bew-radius"
        duration-300
        bg="hover:$bew-fill-2"
      >
        <div flex="~ items-center gap-2">
          <div :class="item.icon" text="$bew-text-2" />
          {{ item.name }}
        </div>
        <div i-mingcute:arrow-right-line />
      </a>
    </div>

    <div
      flex="~ justify-between col gap-1"
      p-2 bg="$bew-fill-alt" rounded="$bew-radius"
      shadow="[var(--bew-shadow-edge-glow-1),var(--bew-shadow-1)]"
    >
      <a
        v-for="item in otherLinks.filter((_, index) => index > 1)"
        :key="item.url"
        :href="item.url"
        target="_blank"
        p="x-4 y-2" flex="~ items-center justify-between"
        rounded="$bew-radius"
        duration-300
        hover:bg="$bew-fill-2"
      >
        <div flex="~ items-center gap-2">
          <div :class="item.icon" text="$bew-text-2" />
          {{ item.name }}
        </div>
        <div i-mingcute:arrow-right-line />
      </a>
      <div
        text="$bew-error-color"
        p="x-4 y-2" flex="~ items-center"
        rounded="$bew-radius"
        duration-300 cursor-pointer
        hover:bg="$bew-fill-2"
        @click="logout()"
      >
        <div i-solar:logout-2-bold-duotone text="$bew-error-60" mr-2 />
        {{ $t('topbar.user_dropdown.log_out') }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.account-switcher {
  overflow: hidden;
}

.account-switch-trigger {
  --uno: "w-full min-h-48px px-3 py-2 flex items-center gap-3 rounded-$bew-radius";
  --uno: "text-$bew-text-1 cursor-pointer transition-all duration-250 hover:bg-$bew-fill-2";
}

.account-switch-icon {
  --uno: "w-32px h-32px shrink-0 grid place-items-center rounded-full text-lg";
  background: radial-gradient(circle at 30% 25%, var(--bew-theme-color-30), transparent 65%), var(--bew-fill-2);
  color: var(--bew-theme-color);
  box-shadow: inset 0 0 0 1px var(--bew-theme-color-20);
}

.account-token-badge {
  --uno: "px-1.5 py-1 rounded text-10px font-bold leading-none";
  color: var(--bew-text-3);
  background: var(--bew-fill-2);

  &.active {
    color: var(--bew-theme-color);
    background: var(--bew-theme-color-10);
    box-shadow: inset 0 0 0 1px var(--bew-theme-color-20);
  }
}

.account-list {
  --uno: "mt-1 pt-2";
  border-top: 1px solid var(--bew-border-color);
}

// 账号多时只让列表自己滚动，避免把面板里原有的入口挤出可视范围
.account-rows {
  --uno: "max-h-190px overflow-y-auto";
  scrollbar-width: thin;
}

.account-row {
  --uno: "mb-1 last:mb-0 flex items-center gap-1 rounded-$bew-radius";
  transition:
    background-color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover:not(.current) {
    background: var(--bew-fill-2);
  }

  &.current {
    background: var(--bew-theme-color-10);
    box-shadow: inset 0 0 0 1px var(--bew-theme-color-20);
  }
}

.account-row-main {
  --uno: "min-w-0 flex-1 px-2 py-2 flex items-center gap-2 rounded-$bew-radius";
  --uno: "text-$bew-text-1 transition-all duration-200";

  &:disabled {
    cursor: default;
  }
}

.account-avatar {
  --uno: "w-34px h-34px shrink-0 rounded-full grid place-items-center text-xl";
  background-color: var(--bew-fill-3);
  background-position: center;
  background-size: cover;
  box-shadow: inset 0 0 0 1px var(--bew-border-color);
}

.account-token-dot {
  --uno: "w-8px h-8px rounded-full shrink-0";
  background: var(--bew-text-3);
  box-shadow: 0 0 0 3px var(--bew-fill-1);

  &.active {
    background: var(--bew-success-color);
    box-shadow: 0 0 0 3px var(--bew-success-color-20);
  }
}

.account-list-empty {
  --uno: "min-h-64px px-3 flex items-center justify-center gap-2 text-sm text-$bew-text-3";
}

.account-add-button {
  --uno: "w-full mt-2 px-3 py-2 flex items-center justify-center gap-2 rounded-$bew-radius";
  --uno: "text-sm font-semibold text-$bew-theme-color bg-$bew-theme-color-10";
  --uno: "hover:bg-$bew-theme-color-20 transition-all duration-200";

  &:disabled {
    --uno: "opacity-50 cursor-wait";
  }
}

.account-list-enter-active,
.account-list-leave-active {
  transition: all 0.22s ease;
  transform-origin: top;
}

.account-list-enter-from,
.account-list-leave-to {
  opacity: 0;
  transform: translateY(-6px) scaleY(0.96);
}

.level :deep(svg) {
  --uno: "w-25px h-16px";
}

.level-next :deep(svg .level-bg) {
  --uno: "fill-#c9ccd0";
}

.channel-info-item {
  --uno: "p-2 m-0 rounded-$bew-radius text-sm flex flex-col items-center transition-all duration-300";
  --uno: "bg-$bew-fill-alt hover:bg-$bew-fill-2";
  --uno: "shadow-[var(--bew-shadow-edge-glow-1),var(--bew-shadow-1)]";

  > * {
    --uno: "transition-all duration-300";
  }

  .num {
    --uno: "font-semibold text-xl";

    + div {
      --uno: "text-$bew-text-2 mt-1 text-xs font-semibold";
    }
  }
}
</style>
