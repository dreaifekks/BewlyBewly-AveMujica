import { describe, expect, it, vi } from 'vitest'

import type { Message } from '~/background/utils'
import { apiListenerFactory } from '~/background/utils'

vi.mock('webextension-polyfill', () => ({
  default: {},
}))

describe('background message routing', () => {
  it('ignores unrelated messages synchronously so another listener can respond', () => {
    const listener = apiListenerFactory({})
    const result = listener({
      channel: 'bewly-account-manager',
      action: 'getCurrentMobileToken',
    } as unknown as Message)

    expect(result).toBeUndefined()
    expect(result).not.toBeInstanceOf(Promise)
  })
})
