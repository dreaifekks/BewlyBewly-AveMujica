import { describe, expect, it } from 'vitest'

import { createWheelAxisLock } from '../utils/wheelAxisLock'

// 依次送入事件，每个事件间隔 step 毫秒，返回每个事件判定的方向
function feed(lock: ReturnType<typeof createWheelAxisLock>, events: [number, number][], start = 0, step = 16) {
  return events.map(([dx, dy], i) => lock(dx, dy, start + i * step))
}

describe('createWheelAxisLock', () => {
  it('keeps a slanted trackpad swipe horizontal through the momentum tail', () => {
    // 开头和末尾取自真实触控板记录：末尾横竖分量一样大，甚至横向为 0
    const axes = feed(createWheelAxisLock(), [[1, 0], [18, -4], [35, -11], [20, -9], [2, -1], [1, -1], [1, -1], [0, -1], [1, 0], [0, -1]])
    expect(new Set(axes)).toEqual(new Set(['x']))
  })

  it('keeps a slanted vertical swipe vertical', () => {
    const axes = feed(createWheelAxisLock(), [[0, 1], [-2, 18], [-4, 35], [-1, 2], [-1, 1], [-1, 0], [-2, 0]])
    expect(new Set(axes)).toEqual(new Set(['y']))
  })

  it('does not let a tiny first event decide a vertical swipe', () => {
    const axes = feed(createWheelAxisLock(), [[1, 0], [0, 30], [1, 25], [2, 1]])
    expect(axes.slice(1)).toEqual(['y', 'y', 'y'])
  })

  it('locks immediately on a single mouse wheel tick', () => {
    const lock = createWheelAxisLock()
    expect(lock(0, 100, 0)).toBe('y')
    expect(lock(3, 1, 16)).toBe('y')
  })

  it('stays locked across the largest gap seen in a real gesture', () => {
    const lock = createWheelAxisLock()
    expect(lock(30, 0, 0)).toBe('x')
    expect(lock(1, -1, 69)).toBe('x')
    expect(lock(0, -1, 138)).toBe('x')
  })

  it('decides again after a pause', () => {
    const lock = createWheelAxisLock()
    expect(lock(30, 0, 0)).toBe('x')
    expect(lock(0, 30, 200)).toBe('y')
  })
})
