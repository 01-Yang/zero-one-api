import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SSESemanticParser,
  isSemanticSSEPayload,
  parseArguments,
  percentile,
} from './benchmark-ttft.mjs'

const encoder = new TextEncoder()

test('detects semantic events for Responses, Chat Completions, and Messages', () => {
  assert.equal(
    isSemanticSSEPayload('{"type":"response.output_text.delta","delta":"OK"}'),
    true,
  )
  assert.equal(
    isSemanticSSEPayload('{"choices":[{"delta":{"content":"OK"}}]}'),
    true,
  )
  assert.equal(
    isSemanticSSEPayload('{"type":"content_block_delta","delta":{"text":"OK"}}'),
    true,
  )
  assert.equal(
    isSemanticSSEPayload('{"type":"content_block_start","content_block":{"type":"tool_use"}}'),
    true,
  )
})

test('ignores keepalives, usage-only events, roles, and terminal metadata', () => {
  for (const payload of [
    '',
    '[DONE]',
    '{"type":"response.completed","response":{"usage":{"input_tokens":1}}}',
    '{"choices":[{"delta":{"role":"assistant"}}]}',
    '{"type":"message_delta","usage":{"output_tokens":1}}',
    'not-json',
  ]) {
    assert.equal(isSemanticSSEPayload(payload), false, payload)
  }
})

test('parses fragmented CRLF SSE frames and ignores comments before first output', () => {
  const parser = new SSESemanticParser()
  assert.equal(parser.push(encoder.encode(': keepalive\r\n\r\ndata: {"type":"response.')), false)
  assert.equal(parser.push(encoder.encode('output_text.delta","delta":"O')), false)
  assert.equal(parser.push(encoder.encode('K"}\r\n\r\n')), true)
  assert.equal(parser.finish(), true)
})

test('treats tool arguments as semantic output', () => {
  const parser = new SSESemanticParser()
  assert.equal(
    parser.push(
      encoder.encode(
        'data: {"type":"response.function_call_arguments.delta","delta":"{\\"q\\":1}"}\n\n',
      ),
    ),
    true,
  )
})

test('uses nearest-rank percentiles', () => {
  assert.equal(percentile([], 0.5), null)
  assert.equal(percentile([40, 10, 30, 20], 0.5), 20)
  assert.equal(percentile([40, 10, 30, 20], 0.9), 40)
})

test('parses a safe benchmark cohort without accepting an API key argument', () => {
  assert.deepEqual(
    parseArguments([
      '--base-url',
      'https://api.example.test/',
      '--endpoint',
      '/v1/responses',
      '--model',
      'gpt-test',
      '--reasoning',
      'high',
      '--requests',
      '50',
      '--warmup',
      '2',
    ]),
    {
      baseUrl: 'https://api.example.test',
      endpoint: '/v1/responses',
      model: 'gpt-test',
      reasoning: 'high',
      requests: 50,
      warmup: 2,
      maxOutputTokens: 16,
      timeoutMs: 120000,
    },
  )
  assert.throws(() => parseArguments(['--api-key', 'secret']), /unknown argument/)
})
