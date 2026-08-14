#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
compose_file="$repo_root/deploy/zero-one/compose.yml"
readme_file="$repo_root/deploy/zero-one/README.md"
operations_file="$repo_root/docs/OPERATIONS.md"

require() {
	file=$1
	text=$2
	if ! grep -Fq "$text" "$file"; then
		echo "missing direct-upstream contract in $file: $text" >&2
		exit 1
	fi
}

if ! grep -Eq '^[[:space:]]+superapi-direct:[[:space:]]+host-gateway[[:space:]]*$' "$compose_file"; then
	echo "missing active superapi-direct host-gateway mapping in $compose_file" >&2
	exit 1
fi

require "$readme_file" "http://superapi-direct:18181"
require "$readme_file" "getent hosts superapi-direct"
require "$readme_file" 'BRIDGE_LISTEN'
require "$readme_file" 'UFW `to` address'
require "$operations_file" "http://superapi-direct:18181"
require "$operations_file" "getent hosts superapi-direct"
require "$operations_file" "/etc/01yapi-bridge/client.env"
require "$operations_file" "01yapi-bridge-client.service"
require "$operations_file" 'test "${resolved_host_gateway}:18181" = "$bridge_listen"'
require "$operations_file" 'from "$gateway_subnet"'
require "$operations_file" 'to "$resolved_host_gateway" port 18181'
require "$operations_file" "01yapi bridge via host-gateway"

if grep -Eq '172\.[0-9]+\.[0-9]+\.[0-9]+' "$compose_file" "$readme_file" "$operations_file"; then
	echo "direct-upstream contract must not pin a Docker bridge address" >&2
	exit 1
fi

echo "zero-one direct-upstream contract OK"
