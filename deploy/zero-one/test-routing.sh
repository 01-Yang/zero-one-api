#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
production_caddyfile="$repo_root/deploy/zero-one/Caddyfile"
preview_caddyfile="$repo_root/deploy/zero-one/Caddyfile.preview"
shared_caddyfile="$repo_root/deploy/zero-one/Caddyfile.shared"
recovered_console_index="$repo_root/deploy/zero-one/recovered-frontend/console/index.html"
recovered_console_entry='await import("/assets/repaired-20260819/index-9xJBhx8B.js")'
recovered_pricing_chunk="$repo_root/deploy/zero-one/recovered-frontend/console/assets/repaired-20260819/useKeyedDebouncedSearch-8ZSLsOsW.js"
recovered_console_redeem_chunk="$repo_root/deploy/zero-one/recovered-frontend/console/assets/repaired-20260819/RedeemView-DH0TVgR6.js"
recovered_console_admin_redeem_chunk="$repo_root/deploy/zero-one/recovered-frontend/console/assets/repaired-20260819/RedeemView-PVvUxBqr.js"
recovered_console_promo_chunk="$repo_root/deploy/zero-one/recovered-frontend/console/assets/repaired-20260819/PromoCodesView-4T6ytmJZ.js"
recovered_console_locale_chunk="$repo_root/deploy/zero-one/recovered-frontend/console/assets/repaired-20260819/index-C45dYm7d.js"
recovered_asset_alias="$repo_root/deploy/zero-one/recovered-frontend/console/assets/pricing-autofill-fix"

require() {
	file=$1
	contract=$2
	if ! grep -Fq "$contract" "$file"; then
		echo "missing Caddy routing contract in ${file#"$repo_root"/}: $contract" >&2
		exit 1
	fi
}

forbid() {
	file=$1
	contract=$2
	if grep -Fq "$contract" "$file"; then
		echo "forbidden recovered Console behavior in ${file#"$repo_root"/}: $contract" >&2
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
require "$shared_caddyfile" 'https://checkout-demo.airwallex.com https:; frame-ancestors'

require "$recovered_console_index" 'fetch("/api/v1/settings/public"'
require "$recovered_console_index" "$recovered_console_entry"
forbid "$recovered_console_index" '/assets/pricing-autofill-fix/'
forbid "$recovered_pricing_chunk" 'getModelDefaultPricing('
require "$recovered_console_redeem_chunk" 'redeem'
require "$recovered_console_admin_redeem_chunk" 'generate-benefit'
require "$recovered_console_admin_redeem_chunk" 'generate-mystery-box'
require "$recovered_console_admin_redeem_chunk" 'mystery_box'
require "$recovered_console_locale_chunk" '福利兑换码'
require "$recovered_console_locale_chunk" '盲盒兑换码'
require "$recovered_console_promo_chunk" 'promo.create'

if [ "$(readlink "$recovered_asset_alias")" != 'repaired-20260819' ]; then
	echo 'recovered Console cache-busting asset alias is missing or points at the wrong build' >&2
	exit 1
fi

if grep -RFlq 'index-Dio6syRk.js' "$repo_root/deploy/zero-one/recovered-frontend/console/assets/repaired-20260819"; then
	echo 'recovered Console chunks must reference the single mounted entry module' >&2
	exit 1
fi

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
