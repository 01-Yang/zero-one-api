import { pathToFileURL } from 'node:url'

const expected = Object.freeze({
  api_base_url: 'https://api.01yapi.com',
  invitation_code_enabled: false,
  payment_enabled: false,
  promo_code_enabled: false,
  registration_enabled: true,
  site_name: '零一 API',
  site_subtitle: '从零到一，连接每一次模型调用。',
})

function asRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null
}

export function verifyPublicSettings(payload) {
  const response = asRecord(payload)
  const data = asRecord(response?.data)

  if (!response || response.code !== 0 || !data) {
    return ['public settings response is not a successful { code, data } object']
  }

  return Object.entries(expected).flatMap(([key, value]) =>
    data[key] === value ? [] : [`${key}: expected ${JSON.stringify(value)}, received ${JSON.stringify(data[key])}`],
  )
}

async function readPayload(source) {
  if (source === '-') {
    let input = ''
    process.stdin.setEncoding('utf8')
    for await (const chunk of process.stdin) input += chunk
    return JSON.parse(input)
  }

  const url = new URL(source)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('settings URL must use http or https')
  }

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`settings request failed with HTTP ${response.status}`)
  return response.json()
}

async function main() {
  const source = process.argv[2]
  if (!source) {
    throw new Error('usage: node verify-public-settings.mjs URL|-')
  }

  const failures = verifyPublicSettings(await readPayload(source))
  if (failures.length) {
    for (const failure of failures) console.error(`- ${failure}`)
    process.exitCode = 1
    return
  }

  console.log('zero-one public settings release gate OK')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
