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

require "$compose_file" "superapi-direct: host-gateway"
require "$readme_file" "http://superapi-direct:18181"
require "$operations_file" "http://superapi-direct:18181"

if grep -Eq '172\.[0-9]+\.[0-9]+\.[0-9]+' "$compose_file" "$readme_file" "$operations_file"; then
	echo "direct-upstream contract must not pin a Docker bridge address" >&2
	exit 1
fi

echo "zero-one direct-upstream contract OK"
