import { describe, expect, it } from 'vitest'

import { isNewerRelease } from '../utils/releaseTag'

describe('isNewerRelease', () => {
  it('compares full tags for a released build', () => {
    expect(isNewerRelease('v1.8.36-mlt.1', '1.8.36', 'v1.8.36-mlt.1')).toBe(false)
    expect(isNewerRelease('v1.8.36-mlt.2', '1.8.36', 'v1.8.36-mlt.1')).toBe(true)
    expect(isNewerRelease('v1.8.37-mlt.1', '1.8.36', 'v1.8.36-mlt.1')).toBe(true)
  })

  it('only compares the version for a local build without a tag', () => {
    expect(isNewerRelease('v1.8.36-mlt.3', '1.8.36', '')).toBe(false)
    expect(isNewerRelease('v1.8.37-mlt.1', '1.8.36', '')).toBe(true)
  })
})
