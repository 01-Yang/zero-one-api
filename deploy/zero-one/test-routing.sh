#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
production_caddyfile="$repo_root/deploy/zero-one/Caddyfile"
preview_caddyfile="$repo_root/deploy/zero-one/Caddyfile.preview"
shared_caddyfile="$repo_root/deploy/zero-one/Caddyfile.shared"

require() {
	file=$1
	contract=$2
	if ! grep -Fq "$contract" "$file"; then
		echo "missing Caddy routing contract in ${file#"$repo_root"/}: $contract" >&2
		exit 1
	fi
}

require "$production_caddyfile" 'import Caddyfile.shared'
require "$production_caddyfile" 'api.01yapi.com {'
require "$production_caddyfile" 'import landing_routes'
require "$production_caddyfile" '@public_home {'
require "$production_caddyfile" 'header @public_home Cache-Control "no-store"'
require "$production_caddyfile" 'redir @public_home https://api.01yapi.com{uri} 307'
require "$production_caddyfile" 'api.01yapi.cc {'
require "$production_caddyfile" 'header @backup_root Cache-Control "no-store"'
require "$production_caddyfile" 'respond @backup_root'
require "$production_caddyfile" '01yapi.com, www.01yapi.com {'
require "$production_caddyfile" 'redir https://api.01yapi.com{uri} 308'

require "$preview_caddyfile" 'auto_https off'
require "$preview_caddyfile" 'import Caddyfile.shared'
require "$preview_caddyfile" ':80 {'
require "$preview_caddyfile" 'import landing_routes'

require "$shared_caddyfile" '(landing_routes) {'
require "$shared_caddyfile" 'method GET HEAD'
require "$shared_caddyfile" 'path /'
require "$shared_caddyfile" 'handle_path /_landing/* {'
require "$shared_caddyfile" 'import sub2api_proxy'
require "$shared_caddyfile" 'reverse_proxy sub2api:8080'
require "$shared_caddyfile" 'header_up -CF-Connecting-IP'
require "$shared_caddyfile" 'header_up -True-Client-IP'
require "$shared_caddyfile" 'header_up -X-Client-IP'
require "$shared_caddyfile" 'header_up -X-Cluster-Client-IP'
require "$shared_caddyfile" 'header_up X-Real-IP {remote_host}'
require "$shared_caddyfile" 'header_up X-Forwarded-For {remote_host}'

for shell_caddyfile in "$production_caddyfile" "$preview_caddyfile"; do
	if grep -Fq 'reverse_proxy sub2api:8080' "$shell_caddyfile" ||
		grep -Fq 'handle_path /_landing/* {' "$shell_caddyfile"; then
		echo "Caddy shell duplicates shared routing: ${shell_caddyfile#"$repo_root"/}" >&2
		exit 1
	fi
done

for caddyfile in "$production_caddyfile" "$preview_caddyfile" "$shared_caddyfile"; do
	if grep -Eq '^[[:space:]]*flush_interval[[:space:]]' "$caddyfile"; then
		echo "Caddy must leave flush_interval unset: ${caddyfile#"$repo_root"/}" >&2
		exit 1
	fi
done

echo 'zero-one production and preview Caddy routing contract OK'
