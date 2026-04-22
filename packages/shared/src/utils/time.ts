import { DRIFT_THRESHOLD_MS } from '../constants.js'

export function computeHostPosition(
  lastPosition: number,
  lastTimestamp: number,
  isPlaying: boolean,
): number {
  if (!isPlaying) return lastPosition
  const elapsedSeconds = Math.max(0, (Date.now() - lastTimestamp) / 1000)
  return lastPosition + elapsedSeconds
}

export function isWithinDrift(guestPosition: number, hostPosition: number): boolean {
  return Math.abs(guestPosition - hostPosition) < DRIFT_THRESHOLD_MS / 1000
}
