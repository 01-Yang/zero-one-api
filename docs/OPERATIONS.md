# 零一 API 运维手册

## Initial Deployment

1. Keep the public DNS records unpointed. Copy `deploy/zero-one/.env.example` to `deploy/zero-one/.env`, replace every placeholder secret and replace all four runtime image values with approved registry digests.
2. From the repository root, validate both Compose files, pull the pinned images, then start PostgreSQL, Redis and Sub2API with the loopback-only bootstrap override:

   ```bash
   docker compose --env-file deploy/zero-one/.env -f deploy/zero-one/compose.yml -f deploy/zero-one/compose.bootstrap.yml config -q
   docker compose --env-file deploy/zero-one/.env -f deploy/zero-one/compose.yml -f deploy/zero-one/compose.bootstrap.yml pull postgres redis sub2api
   docker compose --env-file deploy/zero-one/.env -f deploy/zero-one/compose.yml -f deploy/zero-one/compose.bootstrap.yml up -d --no-build postgres redis sub2api
   ```

3. If operating remotely, open an SSH tunnel with `ssh -L 18080:127.0.0.1:18080 SERVER`. Log in at `http://127.0.0.1:18080/login`, enable administrator 2FA and apply every setting in `docs/TECHNICAL-PLAN.md`, including the site subtitle and `frontend_url`.
4. From a release workstation with Node.js 20 or newer, run `node deploy/zero-one/verify-public-settings.mjs http://127.0.0.1:18080/api/v1/settings/public`. Confirm `frontend_url=https://app.01yapi.com` once more in `/admin/settings`.
5. Remove the temporary loopback port by recreating Sub2API from the production Compose file only, then confirm port `18080` is no longer listening:

   ```bash
   docker compose --env-file deploy/zero-one/.env -f deploy/zero-one/compose.yml up -d --no-build --force-recreate sub2api
   docker compose --env-file deploy/zero-one/.env -f deploy/zero-one/compose.yml port sub2api 8080
   ```

   The final command must print nothing. Do not continue if it reports a host port.
6. Start the pinned edge image with `pull` followed by `up -d --no-build`, then point DNS-only A/AAAA records for `api.01yapi.com`, `app.01yapi.com`, `api.01yapi.cc`, `01yapi.com` and `www.01yapi.com` to the server.
7. Confirm Caddy has obtained certificates, every service reports healthy and the public release gate passes at `https://api.01yapi.com/api/v1/settings/public` before announcing the service.

The bootstrap override binds `18080` to loopback only and must not be used after
initial settings are saved. Never expose 8080, 18080, 5432 or 6379 in the host
firewall. Keep fixed values for `JWT_SECRET` and `TOTP_ENCRYPTION_KEY`; changing
them invalidates sessions or enrolled 2FA secrets.

### Client IP Boundary

The v1 edge is reached directly and is not behind a CDN. Caddy removes
client-supplied `CF-Connecting-IP`, `True-Client-IP`, `X-Client-IP` and
`X-Cluster-Client-IP`, then rebuilds `X-Real-IP` and `X-Forwarded-For` from the
socket peer. Keep the Administrator setting `forwarded_client_ip_headers`
empty in this topology. If a CDN is introduced later, restrict the origin to
that CDN's maintained egress ranges and update both the trusted-proxy and
header policy before enabling a CDN-specific client-IP header.

Before each production release, replace the local image names in `.env` with
approved immutable registry digests and use `docker compose ... up -d --no-build`.
Never use `latest` as a production image reference. Caddy's ACME storage is
part of the deployment state; preserve `deploy/zero-one/state/caddy-data` when
migrating the host to avoid unnecessary certificate issuance.

The version badge is informational for this managed Docker deployment. Do not
use Sub2API's in-place binary update or rollback endpoints: the container runs
as a non-root user, and an upstream binary would also discard the Zero One
Console customizations. Upgrade and roll back only by switching the approved
project-owned image digest through the release procedure below.

## Administrator Workflow

The same login page serves users and administrators. An administrator is redirected to `/admin/dashboard`; `/admin/ops` is the operational monitor. User, group, channel, Provider Account, proxy, announcement, usage, risk and system settings remain under the existing `/admin/*` routes.

Redeem Code workflow:

1. Generate balance, concurrency or subscription codes at `/admin/redeem`.
2. Export or distribute codes through an approved private channel.
3. The User redeems once at `/redeem` and checks the resulting balance or entitlement.
4. Use the administrator page to expire, delete or audit codes.

Online purchasing stays disabled. `/admin/promo-codes` belongs to the purchase flow and is not a replacement for Redeem Code management.

## Monitoring

Monitor container health, PostgreSQL readiness, Redis response, disk usage, TLS expiry, HTTP 5xx rate and latency. The `/health` endpoint checks process liveness only; it does not prove that PostgreSQL, Redis or upstream model calls work.

Add two external probes:

- An unauthenticated `GET /api/v1/settings/public` check through both the primary and Console hosts.
- A low-frequency authenticated model request using a dedicated probe User and tightly limited API Key.

Alert separately for primary-host DNS/TLS failure and origin failure. A successful `.cc` DNS lookup does not indicate origin health because both API domains use the same deployment.

Inspect Caddy's JSON access logs for status, latency and client IP, but avoid
adding request-body or authorization-header logging. Use the dashboard and
application audit logs for user-level troubleshooting rather than copying
Provider Account credentials into an incident ticket.

The Compose overlay caps each container's Docker JSON logs at five 100 MB files.
Monitor both Docker storage and application data volumes; rotation limits disk
growth but does not replace centralized logs when longer retention is required.

### SuperAPI direct-tunnel rollout

`sub2api` resolves the stable name `superapi-direct` through Docker's
`host-gateway` mapping. A host-local SuperAPI tunnel on port `18181` must be
configured in Provider Accounts as `http://superapi-direct:18181` with no
account proxy. Never pin a Docker bridge IP in the database: its subnet is an
implementation detail and can change after Compose network recreation.

Verify the tunnel from inside the production container before editing an
account. This request carries no Provider credential:

```bash
docker compose --env-file deploy/zero-one/.env -f deploy/zero-one/compose.yml \
  exec -T sub2api wget -qO- -T 5 http://superapi-direct:18181/health
```

For a safe canary, duplicate the target Provider Account, leave the duplicate
unschedulable, change only its Base URL, and run three same-model connectivity
tests. Delete the duplicate after the test. Then change one production account
and observe at least 50 comparable native `/v1/responses` requests before
moving another account. Compare the same model, reasoning effort and time
window; use these initial acceptance thresholds unless a newer incident
baseline is recorded:

- TTFT P50 at most 12 seconds and P90 at most 25 seconds.
- Provider-owned `/v1/responses` 5xx attempt rate at most 2 percent.

Record the previous Base URL as the per-account rollback value. If either
threshold regresses, restore that value immediately and keep the remaining
accounts on their current route while investigating the upstream credential
pool. A passing `/health` check proves reachability only; it does not replace
the canary model calls or usage-log comparison.

## Backup And Recovery

- Run an encrypted PostgreSQL logical backup every day and retain 7 daily plus 4 weekly copies outside the server.
- `deploy/zero-one/backup-postgres.sh` is the scheduled backup entry point. It
  uses `age` public-key encryption, writes a checksum next to each custom dump,
  retains 7 daily copies and promotes Sunday copies into 4 weekly recovery
  points. It requires `flock` and `mountpoint` from util-linux. The private
  recovery key must not reside on the production host.
- The same task creates a separately encrypted archive containing the runtime
  `.env`, Caddy/Compose files and `deploy/zero-one/state/sub2api`, with the same
  7-daily/4-weekly retention. Redis persistence may be copied for faster
  recovery but is not a substitute for PostgreSQL backup.
- Never store `.env`, database dumps or Provider Account credentials in Git.
- Perform a documented restore exercise at least once per quarter using an isolated host.

Recovery order is PostgreSQL, Sub2API data, Redis, then application and edge containers. After recovery, verify administrator login, API Key authentication, one streamed model request and one Redeem Code redemption with a test user.

`BACKUP_DIR` must itself be an off-host filesystem mount point; a subdirectory on
the production root filesystem does not satisfy the backup requirement. After
mounting it, create the sentinel inside the mounted filesystem:

```bash
mountpoint -q /mnt/offsite/zero-one
printf '%s\n' 'zero-one off-site backup target' > /mnt/offsite/zero-one/.offsite-mounted
chmod 600 /mnt/offsite/zero-one/.offsite-mounted
```

The backup refuses to create any directory until both `mountpoint` and the
sentinel succeed, so a dropped mount cannot silently receive local backups. Set
`BACKUP_SENTINEL_FILE` in the scheduler environment to use another single file
name. Create the sentinel only after the remote filesystem is mounted; never
place a copy in the hidden local mount-point directory. A bind mount from the
same server still passes these mechanical checks and is not an off-host backup.

Run restore drills only on an isolated recovery host that has the offline age
identity and Docker. Use the approved PostgreSQL 18 image digest from the release
record, and provide the matching state archive when available:

```bash
RESTORE_AGE_IDENTITY=/secure/offline/zero-one.agekey \
RESTORE_POSTGRES_IMAGE='postgres:18-alpine@sha256:REPLACE_WITH_APPROVED_DIGEST' \
sh deploy/zero-one/restore-drill.sh \
  /mnt/offsite/zero-one/daily/postgres-YYYY-MM-DD.dump.age \
  /mnt/offsite/zero-one/daily/zero-one-state-YYYY-MM-DD.tar.gz.age
```

`restore-drill.sh` verifies both adjacent checksum files, decrypts only into a
private temporary directory, checks the deployment-state archive, and restores
the database with `pg_restore --exit-on-error` into a new random Docker volume.
The temporary PostgreSQL container uses `--network none`, publishes no ports,
never joins the production Compose project and is deleted with its volume on
exit. A successful run reports the number of restored public tables. It cannot
be pointed at the production database because it accepts no database address or
Compose environment file.

The backup destination must be encrypted and outside the production host.
Document the backup encryption key owner and restore permissions separately;
do not place encryption keys, dumps, `.env`, or Provider Account secrets in
this repository.

## Release And Rollback

Before release, record the deployed Sub2API and edge image digests and take a database backup. Deploy immutable images, run the routing and smoke checks, then announce completion.

Rollback uses the previous image digests without rolling back the database unless an upstream migration is proven incompatible. Database rollback is a separate destructive operation and must be based on a verified backup and maintenance window.

## Required Smoke Tests

- For releases based on v0.1.176, confirm `schema_migrations` contains both `221_group_model_pricing.sql` and `222_group_pricing_auth_cache_invalidation.sql`; verify `groups.long_context_pricing_enabled` is non-null with default `true`, `groups.model_pricing` is nullable `jsonb`, and the group auth-cache trigger function compares both columns.
- Exercise one dedicated probe API Key after deploy, then verify its hashed Redis `apikey:auth:` entry reports snapshot `version: 20` and carries `long_context_pricing_enabled` plus `model_pricing`. Never print or store the raw API Key or the complete cache document.
- Confirm an omitted `long_context_pricing_enabled` field on a disposable admin group create defaults to `true`, while an explicit `false` remains false; delete the disposable group afterward.
- For any enabled group-level model card, compare the configured price with one low-cost usage record. Include a long-context boundary check and, when Batch Image or Model Plaza is enabled, verify group-card precedence and an explicit zero-price tier without using a production customer key.
- `GET https://api.01yapi.com/` returns the React page; `POST /v1/messages` reaches API authentication rather than HTML.
- The public-settings release gate passes, and `/admin/settings` shows `frontend_url=https://app.01yapi.com`.
- `GET` and `HEAD https://app.01yapi.com/` return a non-cacheable `307` to `https://api.01yapi.com/`; `POST /` and `GET /login` still reach Vue/Sub2API, and administrator and User redirects remain role-correct.
- SSE sends its first event promptly and continues without buffering; `/responses` and administrator operations WebSockets upgrade successfully.
- `api.01yapi.cc` accepts the same API Key, while its root returns no-store backup metadata.
- Apex and `www` return `308` while preserving the path and query string.
- Administrator creates a test Redeem Code, a User redeems it once, and a second redemption fails.
