export function waitMs(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function timestampSecondsAgo(seconds: number): number {
  return Date.now() - seconds * 1000
}

export function timestampSecondsFromNow(seconds: number): number {
  return Date.now() + seconds * 1000
}
