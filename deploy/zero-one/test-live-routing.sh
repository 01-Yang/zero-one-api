#!/bin/sh
set -eu

edge_image=${1:?usage: test-live-routing.sh EDGE_IMAGE}
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
test_dir=$(mktemp -d)
test_suffix="${GITHUB_RUN_ID:-local}-$$"
network_name="zero-one-routing-$test_suffix"
upstream_name="zero-one-upstream-$test_suffix"
edge_name="zero-one-edge-$test_suffix"

cleanup() {
	docker rm -f "$edge_name" "$upstream_name" >/dev/null 2>&1 || true
	docker network rm "$network_name" >/dev/null 2>&1 || true
	rm -rf "$test_dir"
}
trap cleanup EXIT INT TERM

fail() {
	echo "live Caddy routing contract failed: $1" >&2
	docker logs "$edge_name" >&2 2>/dev/null || true
	docker logs "$upstream_name" >&2 2>/dev/null || true
	exit 1
}

assert_text() {
	value=$1
	expected=$2
	label=$3
	printf '%s' "$value" | grep -Fq "$expected" || fail "$label"
}

sed \
	-e 's/^api\.01yapi\.com {/http:\/\/api.01yapi.test:8080 {/' \
	-e 's/^app\.01yapi\.com {/http:\/\/app.01yapi.test:8080 {/' \
	-e 's/^api\.01yapi\.cc {/http:\/\/api-backup.01yapi.test:8080 {/' \
	-e 's/^01yapi\.com, www\.01yapi\.com {/http:\/\/01yapi.test:8080, http:\/\/www.01yapi.test:8080 {/' \
	"$repo_root/deploy/zero-one/Caddyfile" >"$test_dir/Caddyfile"

docker network create "$network_name" >/dev/null
docker run -d \
	--name "$upstream_name" \
	--network "$network_name" \
	--network-alias sub2api \
	-v "$repo_root/deploy/zero-one/test-upstream.mjs:/srv/test-upstream.mjs:ro" \
	node:24-alpine node /srv/test-upstream.mjs >/dev/null

docker run -d \
	--name "$edge_name" \
	--network "$network_name" \
	-p 127.0.0.1::8080 \
	-e ACME_EMAIL=ci@example.invalid \
	-v "$test_dir/Caddyfile:/etc/caddy/Caddyfile:ro" \
	"$edge_image" >/dev/null

edge_port=$(docker inspect --format '{{(index (index .NetworkSettings.Ports "8080/tcp") 0).HostPort}}' "$edge_name")
edge_url="http://127.0.0.1:$edge_port"

attempt=0
until curl -fsS -H 'Host: api.01yapi.test' "$edge_url/" >"$test_dir/landing.html" &&
	curl -fsS -H 'Host: api.01yapi.test' "$edge_url/health-probe" >/dev/null; do
	attempt=$((attempt + 1))
	if [ "$attempt" -ge 30 ]; then
		fail 'edge did not become ready'
	fi
	sleep 1
done

landing=$(cat "$test_dir/landing.html")
assert_text "$landing" '<title>零一 API</title>' 'primary root did not return the React page'

head_headers=$(curl -fsSI -H 'Host: api.01yapi.test' "$edge_url/")
assert_text "$head_headers" 'Cache-Control: no-cache, no-store, must-revalidate' 'primary HEAD root cache policy changed'

asset_path=$(printf '%s' "$landing" | grep -o '/_landing/assets/[^" ]*\.js' | head -n 1)
[ -n "$asset_path" ] || fail 'landing JavaScript asset was not discoverable'
asset_headers=$(curl -fsSI -H 'Host: api.01yapi.test' "$edge_url$asset_path")
assert_text "$asset_headers" 'Cache-Control: public, max-age=31536000, immutable' 'hashed landing asset is not immutable'

notice_headers=$(curl -fsSI -H 'Host: api.01yapi.test' "$edge_url/_landing/THIRD_PARTY_NOTICES.txt")
assert_text "$notice_headers" 'Cache-Control: no-cache' 'third-party notice cache policy changed'

post_root=$(curl -fsS -X POST -H 'Host: api.01yapi.test' --data 'probe' "$edge_url/")
assert_text "$post_root" '"method":"POST"' 'non-GET root did not reach Sub2API'
assert_text "$post_root" '"url":"/"' 'proxied root path changed'

for api_path in /v1/models /v1beta/models /responses /backend-api/codex /antigravity; do
	api_response=$(curl -fsS -H 'Host: api.01yapi.test' "$edge_url$api_path")
	assert_text "$api_response" "\"url\":\"$api_path\"" "$api_path did not reach Sub2API"
done

header_response=$(curl -fsS \
	-H 'Host: api.01yapi.test' \
	-H 'session_id: underscore-ok' \
	-H 'CF-Connecting-IP: 8.8.8.8' \
	-H 'True-Client-IP: 8.8.4.4' \
	-H 'X-Client-IP: 1.1.1.1' \
	-H 'X-Cluster-Client-IP: 9.9.9.9' \
	-H 'X-Real-IP: 208.67.222.222' \
	-H 'X-Forwarded-For: 208.67.220.220, 4.2.2.2' \
	"$edge_url/headers")
assert_text "$header_response" '"session_id":"underscore-ok"' 'underscore request header was not preserved'
assert_text "$header_response" '"x-real-ip":' 'X-Real-IP was not rebuilt'
assert_text "$header_response" '"x-forwarded-for":' 'X-Forwarded-For was not rebuilt'
for spoofed_ip in 8.8.8.8 8.8.4.4 1.1.1.1 9.9.9.9 208.67.222.222 208.67.220.220 4.2.2.2; do
	if printf '%s' "$header_response" | grep -Fq "$spoofed_ip"; then
		fail "spoofed client IP reached Sub2API: $spoofed_ip"
	fi
done

console_response=$(curl -fsS -H 'Host: app.01yapi.test' "$edge_url/login")
assert_text "$console_response" '"url":"/login"' 'Console host did not proxy unchanged'

backup_headers=$(curl -fsS -D - -o "$test_dir/backup.json" -H 'Host: api-backup.01yapi.test' "$edge_url/")
assert_text "$backup_headers" 'Cache-Control: no-store' 'backup root is cacheable'
backup_body=$(cat "$test_dir/backup.json")
assert_text "$backup_body" '"automatic_failover":false' 'backup metadata changed'

backup_api=$(curl -fsS -H 'Host: api-backup.01yapi.test' "$edge_url/v1/models")
assert_text "$backup_api" '"url":"/v1/models"' 'backup API path did not proxy unchanged'

set +e
curl -sS --max-time 1 --no-buffer \
	-D "$test_dir/sse.headers" \
	-o "$test_dir/sse.body" \
	-H 'Host: api.01yapi.test' \
	"$edge_url/sse"
sse_status=$?
set -e
[ "$sse_status" -eq 28 ] || fail 'SSE probe completed before the upstream stream delay'
assert_text "$(cat "$test_dir/sse.headers")" 'Content-Type: text/event-stream' 'SSE content type changed'
assert_text "$(cat "$test_dir/sse.body")" 'data: first' 'SSE first event was buffered'
if grep -Fiq 'Content-Encoding:' "$test_dir/sse.headers"; then
	fail 'SSE response was compressed'
fi

set +e
curl -sS --max-time 1 --no-buffer \
	-o "$test_dir/sse-disconnect.body" \
	-H 'Host: api.01yapi.test' \
	"$edge_url/sse-disconnect"
disconnect_status=$?
set -e
[ "$disconnect_status" -eq 28 ] || fail 'client-disconnect probe completed before cancellation'
assert_text "$(cat "$test_dir/sse-disconnect.body")" 'data: connected' 'client-disconnect probe did not start streaming'

disconnect_observed=false
attempt=0
while [ "$attempt" -lt 5 ]; do
	disconnect_response=$(curl -fsS -H 'Host: api.01yapi.test' "$edge_url/sse-disconnect-status")
	if printf '%s' "$disconnect_response" | grep -Fq '"observed":true'; then
		disconnect_observed=true
		break
	fi
	attempt=$((attempt + 1))
	sleep 1
done
[ "$disconnect_observed" = true ] || fail 'client disconnect was not propagated to the upstream stream'

websocket_key='dGhlIHNhbXBsZSBub25jZQ==' # gitleaks:allow -- public RFC 6455 handshake fixture
websocket_response=$(curl -sS -i --http1.1 --max-time 2 \
	-H 'Host: api.01yapi.test' \
	-H 'Connection: Upgrade' \
	-H 'Upgrade: websocket' \
	-H 'Sec-WebSocket-Version: 13' \
	-H "Sec-WebSocket-Key: $websocket_key" \
	"$edge_url/ws" 2>/dev/null || true)
assert_text "$websocket_response" '101 Switching Protocols' 'WebSocket upgrade did not pass through Caddy'

redirect_headers=$(curl -fsSI -H 'Host: 01yapi.test' "$edge_url/status?source=contract")
assert_text "$redirect_headers" 'HTTP/1.1 308 Permanent Redirect' 'apex redirect status changed'
assert_text "$redirect_headers" 'Location: https://api.01yapi.com/status?source=contract' 'apex redirect lost its path or query'

echo 'zero-one live Caddy routing contract OK'
