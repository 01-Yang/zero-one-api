#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
caddyfile="$repo_root/deploy/zero-one/Caddyfile"

require() {
	if ! grep -Fq "$1" "$caddyfile"; then
		echo "missing Caddy routing contract: $1" >&2
		exit 1
	fi
}

require "api.01yapi.com {"
require "method GET HEAD"
require "path /"
require "handle_path /_landing/* {"
require "reverse_proxy sub2api:8080"
require "header_up -CF-Connecting-IP"
require "header_up -True-Client-IP"
require "header_up -X-Client-IP"
require "header_up -X-Cluster-Client-IP"
require "header_up X-Real-IP {remote_host}"
require "header_up X-Forwarded-For {remote_host}"
require "@public_home {"
require "header @public_home Cache-Control \"no-store\""
require "redir @public_home https://api.01yapi.com{uri} 307"
require "api.01yapi.cc {"
require "header @backup_root Cache-Control \"no-store\""
require "respond @backup_root"
require "01yapi.com, www.01yapi.com {"
require "redir https://api.01yapi.com{uri} 308"

if grep -Eq '^[[:space:]]*flush_interval[[:space:]]' "$caddyfile"; then
	echo "Caddy must leave flush_interval unset for streaming responses" >&2
	exit 1
fi

echo "zero-one Caddy routing contract OK"
