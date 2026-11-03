// 高度放不下整数行时，多出的部分超过一行的这个比例就缩小卡片多放一行，否则略微放大补满
const EXTRA_ROW_THRESHOLD = 0.25
const MIN_SCALE = 0.6
const MAX_SCALE = 1.15

/**
 * 按可用高度和卡片的原始高度算出行数和缩放比例，让这几行正好铺满高度，
 * 不会因为差一点放不下一行就在行间留出大段空白。
 */
export function fitCardRows(available: number, itemHeight: number, rowGap: number): { rows: number, scale: number } {
  const fit = (available + rowGap) / (itemHeight + rowGap)
  const whole = Math.floor(fit)
  const rows = Math.max(1, fit - whole > EXTRA_ROW_THRESHOLD ? whole + 1 : whole)
  const scale = (available - (rows - 1) * rowGap) / (rows * itemHeight)
  return {
    rows,
    scale: Math.round(Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale)) * 1000) / 1000,
  }
}
