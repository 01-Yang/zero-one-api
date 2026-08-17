import { describe, expect, it } from 'vitest'
import { peakMultiplierAt } from '../peak-rate'

const peak = {
  peak_rate_enabled: true,
  peak_start: '09:00',
  peak_end: '12:30',
  peak_rate_multiplier: 1.5,
}

describe('peakMultiplierAt', () => {
  it('uses the configured server offset at the same boundaries as backend billing', () => {
    expect(peakMultiplierAt(peak, 'subscription', new Date('2026-08-16T01:00:00Z'), '+08:00')).toBe(1.5)
    expect(peakMultiplierAt(peak, 'subscription', new Date('2026-08-16T04:29:00Z'), '+08:00')).toBe(1.5)
    expect(peakMultiplierAt(peak, 'subscription', new Date('2026-08-16T04:30:00Z'), '+08:00')).toBe(1)
  })

  it('fails closed for invalid configuration and never applies peak pricing to standard groups', () => {
    expect(peakMultiplierAt(peak, 'standard', new Date('2026-08-16T01:00:00Z'), '+08:00')).toBe(1)
    expect(peakMultiplierAt(peak, 'subscription', new Date('2026-08-16T01:00:00Z'), 'invalid')).toBe(1)
    expect(peakMultiplierAt({ ...peak, peak_end: '08:00' }, 'subscription', new Date(), '+08:00')).toBe(1)
  })
})
