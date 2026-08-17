/**
 * 高峰时段倍率的共享展示逻辑。
 *
 * 高峰窗口由后端按服务器全局时区判定（Group.PeakMultiplierAt），
 * 前端展示必须带上服务器时区标注（来自公共设置 server_utc_offset），
 * 避免用户按浏览器本地时间误读计费窗口。
 */

export interface PeakRateFields {
  peak_rate_enabled?: boolean
  peak_start?: string
  peak_end?: string
  peak_rate_multiplier?: number
}

export function hasPeakRate(fields?: PeakRateFields | null): boolean {
  return Boolean(fields?.peak_rate_enabled && fields.peak_start && fields.peak_end)
}

/** "+08:00" → "UTC+08:00"；旧缓存无该字段时返回空串，调用方降级为不带时区标注 */
export function serverTimezoneLabel(utcOffset?: string | null): string {
  return utcOffset ? `UTC${utcOffset}` : ''
}

/** "14:00-18:00 ×2 (UTC+08:00)"，tzLabel 为空时省略括号部分 */
export function formatPeakRateWindow(
  fields: PeakRateFields | null | undefined,
  tzLabel?: string
): string {
  if (!hasPeakRate(fields) || !fields) return ''
  const base = `${fields.peak_start}-${fields.peak_end} ×${fields.peak_rate_multiplier ?? 1}`
  return tzLabel ? `${base} (${tzLabel})` : base
}

function parseOffsetMinutes(utcOffset?: string | null): number | null {
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(utcOffset ?? '')
  if (!match) return null
  const hours = Number(match[2])
  const minutes = Number(match[3])
  if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) return null
  return (match[1] === '-' ? -1 : 1) * (hours * 60 + minutes)
}

function parseTimeMinutes(value?: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? '')
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

/**
 * Mirrors the server's Group.PeakMultiplierAt using the public server offset.
 * Without a valid offset it fails closed to the base rate rather than guessing
 * from the visitor's local timezone.
 */
export function peakMultiplierAt(
  fields: PeakRateFields | null | undefined,
  subscriptionType: string | undefined,
  now: Date,
  serverUtcOffset?: string | null
): number {
  if (!hasPeakRate(fields) || subscriptionType !== 'subscription' || !fields) return 1
  const offset = parseOffsetMinutes(serverUtcOffset)
  const start = parseTimeMinutes(fields.peak_start)
  const end = parseTimeMinutes(fields.peak_end)
  if (offset === null || start === null || end === null || start >= end || !Number.isFinite(now.getTime())) return 1

  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  const serverMinutes = (utcMinutes + offset + 1_440) % 1_440
  return serverMinutes >= start && serverMinutes < end ? fields.peak_rate_multiplier ?? 1 : 1
}
