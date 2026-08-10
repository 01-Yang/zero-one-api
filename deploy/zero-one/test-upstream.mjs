import { createHash } from 'node:crypto'
import { createServer } from 'node:http'

let sseDisconnectObserved = false

const server = createServer((request, response) => {
  if (request.url === '/sse-disconnect-status') {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ observed: sseDisconnectObserved }))
    return
  }

  if (request.url === '/sse-disconnect') {
    response.writeHead(200, {
      'Cache-Control': 'no-cache',
      'Content-Type': 'text/event-stream',
    })
    response.flushHeaders()
    response.write('data: connected\n\n')
    const completionTimer = setTimeout(() => response.end('data: completed\n\n'), 10_000)
    response.once('close', () => {
      clearTimeout(completionTimer)
      if (!response.writableEnded) sseDisconnectObserved = true
    })
    return
  }

  if (request.url === '/sse') {
    response.writeHead(200, {
      'Cache-Control': 'no-cache',
      'Content-Type': 'text/event-stream',
    })
    response.flushHeaders()
    response.write('data: first\n\n')
    setTimeout(() => response.end('data: second\n\n'), 1_500)
    return
  }

  const chunks = []
  request.on('data', (chunk) => chunks.push(chunk))
  request.on('end', () => {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(
      JSON.stringify({
        body: Buffer.concat(chunks).toString('utf8'),
        headers: request.headers,
        method: request.method,
        url: request.url,
      }),
    )
  })
})

server.on('upgrade', (request, socket) => {
  const key = request.headers['sec-websocket-key']
  if (request.url !== '/ws' || typeof key !== 'string') {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n')
    return
  }

  const accept = createHash('sha1')
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64')

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Connection: Upgrade\r\n' +
      'Upgrade: websocket\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  )
  setTimeout(() => socket.end(), 50)
})

server.listen(8080, '0.0.0.0')
