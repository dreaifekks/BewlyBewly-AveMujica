// 真实触控板惯性阶段的事件间隔最多约 70ms，超过这个时长没有事件就算新的手势
const GESTURE_GAP_MS = 150
// 手势开头的事件可能只有 1px，累计移动够了才锁定方向，避免被一个微小的事件带偏
const LOCK_DISTANCE = 8

export type WheelAxis = 'x' | 'y'

/**
 * 一次手势只判断一次滚动方向。
 * 手指稍微带点斜时，惯性末段的横竖分量取整后常常一样大（例如 1 和 -1），
 * 逐个事件判断方向就会来回翻转，所以锁定后一直沿用到手势结束。
 */
export function createWheelAxisLock() {
  let lastTime = Number.NEGATIVE_INFINITY
  let sumX = 0
  let sumY = 0
  let locked: WheelAxis | null = null

  return (deltaX: number, deltaY: number, time: number): WheelAxis => {
    if (time - lastTime > GESTURE_GAP_MS) {
      sumX = 0
      sumY = 0
      locked = null
    }
    lastTime = time

    if (locked)
      return locked

    sumX += Math.abs(deltaX)
    sumY += Math.abs(deltaY)
    const axis: WheelAxis = sumX > sumY ? 'x' : 'y'
    if (sumX + sumY >= LOCK_DISTANCE)
      locked = axis
    return axis
  }
}
