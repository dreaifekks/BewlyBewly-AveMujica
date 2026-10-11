import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCOUNT_MANAGER_CHANNEL } from '~/types/accountManager'
import { getCurrentMobileToken, startAddAccount } from '~/utils/accountManager'

const browserMock = vi.hoisted(() => ({
  sendMessage: vi.fn(),
}))

vi.mock('webextension-polyfill', () => ({
  default: {
    runtime: {
      sendMessage: browserMock.sendMessage,
    },
  },
}))

describe('account manager client', () => {
  beforeEach(() => {
    browserMock.sendMessage.mockReset()
  })

  it('returns the token selected by the current tab account', async () => {
    browserMock.sendMessage.mockResolvedValue({
      ok: true,
      data: 'current-token',
    })

    await expect(getCurrentMobileToken()).resolves.toBe('current-token')
    expect(browserMock.sendMessage).toHaveBeenCalledWith({
      action: 'getCurrentMobileToken',
      channel: ACCOUNT_MANAGER_CHANNEL,
    })
  })

  it('fails closed as tokenless when the cold-start background is unavailable', async () => {
    browserMock.sendMessage.mockResolvedValue(undefined)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(getCurrentMobileToken()).resolves.toBeNull()
    expect(consoleError).toHaveBeenCalledOnce()

    consoleError.mockRestore()
  })

  it('reports whether adding an account cleared the current Cookie session', async () => {
    browserMock.sendMessage.mockResolvedValue({
      ok: true,
      data: { currentSessionCleared: false },
    })

    await expect(startAddAccount()).resolves.toEqual({ currentSessionCleared: false })
    expect(browserMock.sendMessage).toHaveBeenCalledWith({
      action: 'startAddAccount',
      channel: ACCOUNT_MANAGER_CHANNEL,
    })
  })
})
