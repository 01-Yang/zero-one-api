#!/usr/bin/env node

import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'

const supportedEndpoints = new Set(['/v1/responses', '/v1/chat/completions', '/v1/messages'])

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

export function isSemanticSSEPayload(payload) {
  const trimmed = payload.trim()
  if (!trimmed || trimmed === '[DONE]') return false

  let value
  try {
    value = JSON.parse(trimmed)
  } catch {
    return false
  }

  if (Array.isArray(value.choices)) {
    return value.choices.some(({ delta } = {}) => {
      if (!delta || typeof delta !== 'object') return false
      if (nonEmptyString(delta.content)) return true
      if (Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0) return true
      return delta.function_call && typeof delta.function_call === 'object'
    })
  }

  if (value.type === 'response.output_text.delta') return nonEmptyString(value.delta)
  if (value.type === 'response.function_call_arguments.delta') return nonEmptyString(value.delta)
  if (value.type === 'response.output_item.added') {
    const type = value.item?.type
    return typeof type === 'string' && (type === 'function_call' || type.endsWith('_call'))
  }
  if (value.type === 'content_block_delta') {
    return nonEmptyString(value.delta?.text) || nonEmptyString(value.delta?.partial_json)
  }
  if (value.type === 'content_block_start') return value.content_block?.type === 'tool_use'
  return false
}

function eventPayload(event) {
  const data = event
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^ /u, ''))
  return data.length > 0 ? data.join('\n') : null
}

export class SSESemanticParser {
  constructor() {
    this.decoder = new TextDecoder()
    this.buffer = ''
    this.semanticFound = false
  }

  push(chunk) {
    this.buffer += this.decoder.decode(chunk, { stream: true })
    this.buffer = this.buffer.replace(/\r\n?/gu, '\n')
    this.#consumeCompleteEvents()
    return this.semanticFound
  }

  finish() {
    this.buffer += this.decoder.decode()
    this.buffer = this.buffer.replace(/\r\n?/gu, '\n')
    this.#consumeCompleteEvents()
    if (this.buffer.trim()) this.#consumeEvent(this.buffer)
    this.buffer = ''
    return this.semanticFound
  }

  #consumeCompleteEvents() {
    let boundary = this.buffer.indexOf('\n\n')
    while (boundary >= 0) {
      const event = this.buffer.slice(0, boundary)
      this.buffer = this.buffer.slice(boundary + 2)
      this.#consumeEvent(event)
      boundary = this.buffer.indexOf('\n\n')
    }
  }

  #consumeEvent(event) {
    const payload = eventPayload(event)
    if (payload !== null && isSemanticSSEPayload(payload)) this.semanticFound = true
  }
}

function positiveInteger(value, name, { allowZero = false } = {}) {
  const parsed = Number.parseInt(value, 10)
  const minimum = allowZero ? 0 : 1
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new Error(`${name} must be an integer >= ${minimum}`)
  }
  return parsed
}

export function parseArguments(argv) {
  const options = {
    requests: 50,
    warmup: 3,
    maxOutputTokens: 16,
    timeoutMs: 120000,
  }
  const valueOptions = new Map([
    ['--base-url', 'baseUrl'],
    ['--endpoint', 'endpoint'],
    ['--model', 'model'],
    ['--reasoning', 'reasoning'],
    ['--requests', 'requests'],
    ['--warmup', 'warmup'],
    ['--max-output-tokens', 'maxOutputTokens'],
    ['--timeout-ms', 'timeoutMs'],
  ])

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    const property = valueOptions.get(argument)
    if (!property) throw new Error(`unknown argument: ${argument}`)
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value`)
    options[property] = value
    index += 1
  }

  if (!options.baseUrl) throw new Error('--base-url is required')
  const baseUrl = new URL(options.baseUrl)
  if (baseUrl.protocol !== 'http:' && baseUrl.protocol !== 'https:') {
    throw new Error('--base-url must use http or https')
  }
  options.baseUrl = baseUrl.toString().replace(/\/$/u, '')
  if (!supportedEndpoints.has(options.endpoint)) {
    throw new Error(`--endpoint must be one of: ${[...supportedEndpoints].join(', ')}`)
  }
  if (!nonEmptyString(options.model)) throw new Error('--model is required')
  options.requests = positiveInteger(options.requests, '--requests')
  options.warmup = positiveInteger(options.warmup, '--warmup', { allowZero: true })
  options.maxOutputTokens = positiveInteger(options.maxOutputTokens, '--max-output-tokens')
  options.timeoutMs = positiveInteger(options.timeoutMs, '--timeout-ms')
  if (options.endpoint === '/v1/messages' && options.reasoning) {
    throw new Error('--reasoning is not accepted for /v1/messages; use a protocol-specific request instead')
  }
  return options
}

export function percentile(values, quantile) {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.max(0, Math.ceil(quantile * sorted.length) - 1)
  return sorted[index]
}

function requestBody(options) {
  if (options.endpoint === '/v1/responses') {
    return {
      model: options.model,
      input: 'Reply with OK.',
      stream: true,
      max_output_tokens: options.maxOutputTokens,
      ...(options.reasoning ? { reasoning: { effort: options.reasoning } } : {}),
    }
  }
  if (options.endpoint === '/v1/chat/completions') {
    return {
      model: options.model,
      messages: [{ role: 'user', content: 'Reply with OK.' }],
      stream: true,
      max_tokens: options.maxOutputTokens,
      ...(options.reasoning ? { reasoning_effort: options.reasoning } : {}),
    }
  }
  return {
    model: options.model,
    messages: [{ role: 'user', content: 'Reply with OK.' }],
    stream: true,
    max_tokens: options.maxOutputTokens,
  }
}

function requestHeaders(options, apiKey) {
  const headers = {
    Accept: 'text/event-stream',
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'User-Agent': 'zero-one-ttft-benchmark/1.0',
    'X-Request-ID': `ttft-${randomUUID()}`,
  }
  if (options.endpoint === '/v1/messages') {
    headers['x-api-key'] = apiKey
    headers['anthropic-version'] = '2023-06-01'
  }
  return headers
}

function errorKind(error) {
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return 'timeout'
  return 'network_or_stream_error'
}

async function runRequest(options, apiKey) {
  const started = performance.now()
  let response
  try {
    response = await fetch(`${options.baseUrl}${options.endpoint}`, {
      method: 'POST',
      headers: requestHeaders(options, apiKey),
      body: JSON.stringify(requestBody(options)),
      signal: AbortSignal.timeout(options.timeoutMs),
    })
  } catch (error) {
    return { ok: false, error: errorKind(error), status: 'network' }
  }

  if (!response.ok || !response.body) {
    try {
      await response.body?.cancel()
    } catch {
      // The response body is intentionally discarded; never print provider content.
    }
    return {
      ok: false,
      error: response.status >= 500 ? 'http_5xx' : 'http_4xx',
      status: String(response.status),
    }
  }

  const parser = new SSESemanticParser()
  const reader = response.body.getReader()
  let ttftMs = null
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (parser.push(value) && ttftMs === null) ttftMs = performance.now() - started
    }
    if (parser.finish() && ttftMs === null) ttftMs = performance.now() - started
  } catch (error) {
    return { ok: false, error: errorKind(error), status: String(response.status) }
  }

  if (ttftMs === null) {
    return { ok: false, error: 'semantic_event_not_found', status: String(response.status) }
  }
  return { ok: true, status: String(response.status), ttftMs }
}

function increment(counts, key) {
  counts[key] = (counts[key] || 0) + 1
}

export async function runBenchmark(options, apiKey) {
  for (let index = 0; index < options.warmup; index += 1) {
    const result = await runRequest(options, apiKey)
    if (!result.ok) throw new Error(`warmup failed: ${result.error}`)
  }

  const windowStartedAt = new Date().toISOString()
  const durations = []
  const statuses = {}
  const errors = {}
  for (let index = 0; index < options.requests; index += 1) {
    const result = await runRequest(options, apiKey)
    increment(statuses, result.status)
    if (result.ok) durations.push(result.ttftMs)
    else increment(errors, result.error)
  }
  const windowEndedAt = new Date().toISOString()

  return {
    endpoint: options.endpoint,
    model: options.model,
    reasoning: options.reasoning || 'none',
    requested_samples: options.requests,
    successful_samples: durations.length,
    failed_samples: options.requests - durations.length,
    warmup_samples: options.warmup,
    max_output_tokens: options.maxOutputTokens,
    window_started_at: windowStartedAt,
    window_ended_at: windowEndedAt,
    ttft_ms: {
      p50: percentile(durations, 0.5),
      p90: percentile(durations, 0.9),
      p95: percentile(durations, 0.95),
    },
    status_counts: statuses,
    error_counts: errors,
  }
}

function readAPIKey() {
  const fromEnvironment = process.env.ZERO_ONE_API_KEY?.trim()
  if (fromEnvironment) return fromEnvironment
  if (process.stdin.isTTY) {
    throw new Error('set ZERO_ONE_API_KEY or pipe the API key on stdin')
  }
  const fromStdin = readFileSync(0, 'utf8').trim()
  if (!fromStdin) throw new Error('API key is empty')
  return fromStdin
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv)
  const result = await runBenchmark(options, readAPIKey())
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  if (result.successful_samples === 0) process.exitCode = 1
  return result
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
