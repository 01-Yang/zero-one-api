# Zero One Deployment Overlay

This is an additive production overlay for 零一 API. It intentionally does not
modify the upstream Compose files or expose application, database, or cache
ports. The root `Dockerfile` builds the branded Sub2API image; `Dockerfile.edge`
builds `landing/` and packages its static output with Caddy.

## Local Preview

```bash
cp deploy/zero-one/.env.example deploy/zero-one/.env
chmod 600 deploy/zero-one/.env
docker compose --env-file deploy/zero-one/.env -f deploy/zero-one/compose.yml -f deploy/zero-one/compose.bootstrap.yml config
docker compose --env-file deploy/zero-one/.env -f deploy/zero-one/compose.yml -f deploy/zero-one/compose.bootstrap.yml up -d --build postgres redis sub2api
```

These build commands are for local evaluation only. Replace every placeholder
secret before the first start. The bootstrap override
publishes Sub2API only on `127.0.0.1:18080`; use an SSH tunnel when administering
a remote server. Keep public DNS unpointed until the required settings pass the
release gate.

After the administrator saves the required brand and feature settings from
`docs/TECHNICAL-PLAN.md`, run the release gate before public launch:

```bash
node deploy/zero-one/verify-public-settings.mjs http://127.0.0.1:18080/api/v1/settings/public
```

The upstream database defaults are deliberately unchanged, so this gate is
required for every fresh database. Verify the administrator-only `frontend_url`
value separately on `/admin/settings`. Node.js 20 or newer is required only on
the release workstation. Follow `docs/OPERATIONS.md` to remove the bootstrap
port, point DNS and start the public edge. Production first start follows the
same digest-pinned `pull` + `up --no-build` policy as every later release; it
must not use the local preview build commands above.

Only Caddy publishes `80`, `443/tcp`, and `443/udp`. `sub2api`, PostgreSQL,
and Redis remain on Docker networks. `RUN_MODE` is deliberately fixed to
`standard`; simple mode removes the Redeem Code user and administrator paths.

## Production Images

CI builds two images with source-revision tags: one from the root Dockerfile
and one from `Dockerfile.edge`. Promote their registry digests, not mutable
tags. Set `SUB2API_IMAGE`, `EDGE_IMAGE`, `POSTGRES_IMAGE`, and `REDIS_IMAGE`
to approved digest references in the production environment, pull them, then
start without building. `CADDY_IMAGE` and `NODE_IMAGE` are build inputs only;
the edge image already contains Caddy and the Vite build output:

```bash
docker compose --env-file deploy/zero-one/.env -f deploy/zero-one/compose.yml pull
docker compose --env-file deploy/zero-one/.env -f deploy/zero-one/compose.yml up -d --no-build
```

Keep the previous image digests in the release record for rollback. The full
settings, backup, monitoring, recovery and smoke-test procedure is in
[`../../docs/OPERATIONS.md`](../../docs/OPERATIONS.md).

The static repository check is available locally without Docker as
`sh deploy/zero-one/test-routing.sh`. When Docker is available, run
`sh deploy/zero-one/test-live-routing.sh IMAGE` against a built edge image.
CI validates the rendered Caddy configuration and runs that live contract
against a disposable upstream service.

## Encrypted Backups

Install [`age`](https://age-encryption.org/), `flock` and `mountpoint` (the last
two are normally provided by util-linux) on the deployment host and create an
offline recovery key. Put only its public recipient in the scheduler
environment; keep the corresponding private key outside the server. Schedule
the included script daily, for example:

```cron
30 2 * * * BACKUP_DIR=/mnt/offsite/zero-one BACKUP_AGE_RECIPIENT=age1... /srv/zero-one/deploy/zero-one/backup-postgres.sh /srv/zero-one/deploy/zero-one/.env >> /var/log/zero-one-backup.log 2>&1
```

It creates separate encrypted PostgreSQL and deployment-state archives, keeps
seven daily copies and promotes Sunday snapshots into four weekly copies.
`BACKUP_DIR` must be the off-host mount point itself. While that filesystem is
mounted, create `.offsite-mounted` inside it; the script requires both the mount
and sentinel before writing. `BACKUP_SENTINEL_FILE` can select another single
file name. A normal local `/srv` directory is not sufficient.

Run a quarterly isolated restore drill from a recovery host with the offline age
identity and an approved PostgreSQL image digest:

```bash
RESTORE_AGE_IDENTITY=/secure/offline/zero-one.agekey \
RESTORE_POSTGRES_IMAGE='postgres:18-alpine@sha256:REPLACE_WITH_APPROVED_DIGEST' \
sh deploy/zero-one/restore-drill.sh \
  /mnt/offsite/zero-one/daily/postgres-YYYY-MM-DD.dump.age \
  /mnt/offsite/zero-one/daily/zero-one-state-YYYY-MM-DD.tar.gz.age
```

The drill checks checksums, decrypts in a private temporary directory and runs
`pg_restore --exit-on-error` against a disposable PostgreSQL container with no
network or published ports. It never reads the production Compose environment
and removes its temporary container and volume on exit.
