import { describe, it, expect } from 'vitest'
import { computeHostPosition, isWithinDrift } from '../time'
import { DRIFT_THRESHOLD_MS } from '../../constants'
import { timestampSecondsAgo, timestampSecondsFromNow } from './setup'

describe('computeHostPosition', () => {

  describe('when isPlaying is true', () => {

    it('adds elapsed seconds to lastPosition — 5 seconds elapsed produces ~105', () => {
      const result = computeHostPosition(100, timestampSecondsAgo(5), true)
      expect(result).toBeGreaterThan(104.9)
      expect(result).toBeLessThan(105.1)
    })

    it('adds elapsed seconds to lastPosition — 30 seconds elapsed produces ~130', () => {
      const result = computeHostPosition(100, timestampSecondsAgo(30), true)
      expect(result).toBeGreaterThan(129.9)
      expect(result).toBeLessThan(130.1)
    })

    it('works when lastPosition is 0 — video at the very start', () => {
      const result = computeHostPosition(0, timestampSecondsAgo(10), true)
      expect(result).toBeGreaterThan(9.9)
      expect(result).toBeLessThan(10.1)
    })

    it('handles 1 hour elapsed without floating point overflow', () => {
      const result = computeHostPosition(0, timestampSecondsAgo(3600), true)
      expect(result).toBeGreaterThan(3599.9)
      expect(result).toBeLessThan(3600.1)
    })

    it('does not return negative when lastTimestamp is slightly in the future (clock skew)', () => {
      const result = computeHostPosition(100, timestampSecondsFromNow(0.05), true)
      expect(result).toBeGreaterThanOrEqual(100)
    })

    it('returns a number greater than lastPosition after any positive elapsed time', () => {
      const result = computeHostPosition(500, timestampSecondsAgo(1), true)
      expect(result).toBeGreaterThan(500)
    })

  })

  describe('when isPlaying is false', () => {

    it('returns exact lastPosition regardless of how much time has passed', () => {
      const result = computeHostPosition(142.5, timestampSecondsAgo(60), false)
      expect(result).toBe(142.5)
    })

    it('returns 0 when lastPosition is 0 and paused', () => {
      const result = computeHostPosition(0, timestampSecondsAgo(100), false)
      expect(result).toBe(0)
    })

    it('returns same value regardless of whether timestamp is old or recent', () => {
      const old = computeHostPosition(300, timestampSecondsAgo(3600), false)
      const recent = computeHostPosition(300, timestampSecondsAgo(1), false)
      expect(old).toBe(recent)
    })

  })

})

describe('isWithinDrift', () => {
  const thresholdSeconds = DRIFT_THRESHOLD_MS / 1000 // 2.0

  it('returns true when guest and host are at identical positions', () => {
    expect(isWithinDrift(100, 100)).toBe(true)
  })

  it('returns true when difference is just below threshold (1.999s)', () => {
    expect(isWithinDrift(100, 101.999)).toBe(true)
  })

  it('returns false when difference is exactly at threshold (2.000s) — threshold is exclusive', () => {
    expect(isWithinDrift(100, 102.000)).toBe(false)
  })

  it('returns false when guest is 3 seconds behind host', () => {
    expect(isWithinDrift(97, 100)).toBe(false)
  })

  it('returns false when guest is 3 seconds ahead of host', () => {
    expect(isWithinDrift(103, 100)).toBe(false)
  })

  it('uses absolute value — behind and ahead same magnitude both return false', () => {
    expect(isWithinDrift(97, 100)).toBe(isWithinDrift(103, 100))
  })

  it('returns true when guest is 0.5 seconds behind host', () => {
    expect(isWithinDrift(99.5, 100)).toBe(true)
  })

  it('returns true when guest is 0.5 seconds ahead of host', () => {
    expect(isWithinDrift(100.5, 100)).toBe(true)
  })

})
