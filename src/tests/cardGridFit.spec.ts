import { describe, expect, it } from 'vitest'

import { fitCardRows } from '../utils/cardGridFit'

describe('fitCardRows', () => {
  it('shrinks cards to fit an extra row instead of leaving a gap', () => {
    // 能放 4.5 行：多放一行，缩小
    const { rows, scale } = fitCardRows(792, 176, 0)
    expect(rows).toBe(5)
    expect(scale).toBeCloseTo(0.9, 2)
  })

  it('slightly enlarges cards when only a sliver is left over', () => {
    const { rows, scale } = fitCardRows(722, 176, 0)
    expect(rows).toBe(4)
    expect(scale).toBeGreaterThan(1)
  })

  it('fills the available height exactly when the scale is not clamped', () => {
    const { rows, scale } = fitCardRows(782, 176, 4)
    expect(rows * 176 * scale + (rows - 1) * 4).toBeCloseTo(782, 0)
  })

  it('keeps at least one row and clamps the scale', () => {
    expect(fitCardRows(50, 176, 4)).toEqual({ rows: 1, scale: 0.6 })
    expect(fitCardRows(400, 400 / 1.5, 0).scale).toBeLessThanOrEqual(1.15)
  })
})
