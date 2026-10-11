import { beforeEach, describe, expect, it, vi } from 'vitest'

import { accessKey } from '~/logic/storage'
import { revokeAccessKey, syncAccessKey } from '~/utils/authProvider'

const storageMock = vi.hoisted(() => ({
  accessKey: { value: '' },
}))

const accountManagerMock = vi.hoisted(() => ({
  clearCurrentMobileCredential: vi.fn(),
  getCurrentMobileToken: vi.fn(),
}))

vi.mock('~/logic/storage', () => storageMock)
vi.mock('~/utils/accountManager', () => accountManagerMock)

describe('accessKey projection', () => {
  beforeEach(() => {
    accessKey.value = 'stale-token'
    accountManagerMock.clearCurrentMobileCredential.mockReset()
    accountManagerMock.getCurrentMobileToken.mockReset()
  })

  it('hydrates the current realm from the current account token', async () => {
    accountManagerMock.getCurrentMobileToken.mockResolvedValue('current-token')

    await expect(syncAccessKey()).resolves.toBe('current-token')
    expect(accessKey.value).toBe('current-token')
  })

  it('clears a stale projection when the current account is tokenless', async () => {
    accountManagerMock.getCurrentMobileToken.mockResolvedValue(null)

    await expect(syncAccessKey()).resolves.toBe('')
    expect(accessKey.value).toBe('')
  })

  it('clears the current projection before async revoke completes', async () => {
    let finishRevoke: (() => void) | undefined
    accountManagerMock.clearCurrentMobileCredential.mockReturnValue(new Promise<void>((resolve) => {
      finishRevoke = resolve
    }))

    const revoke = revokeAccessKey()
    expect(accessKey.value).toBe('')

    finishRevoke?.()
    await revoke
  })
})
