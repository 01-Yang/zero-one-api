#!/bin/sh
set -eu

usage() {
  echo "usage: RESTORE_AGE_IDENTITY=KEY RESTORE_POSTGRES_IMAGE=IMAGE@sha256:DIGEST $0 POSTGRES_DUMP.age [STATE_ARCHIVE.age]" >&2
  exit 2
}

[ "$#" -ge 1 ] && [ "$#" -le 2 ] || usage

database_backup=$1
state_backup=${2:-}
age_identity=${RESTORE_AGE_IDENTITY:?RESTORE_AGE_IDENTITY is required}
postgres_image=${RESTORE_POSTGRES_IMAGE:?RESTORE_POSTGRES_IMAGE must be an approved PostgreSQL image digest}

case "$postgres_image" in
  *@sha256:*) ;;
  *)
    echo "RESTORE_POSTGRES_IMAGE must be pinned by sha256 digest" >&2
    exit 1
    ;;
esac

for command in age docker grep sha256sum tar; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "required command is unavailable: $command" >&2
    exit 1
  fi
done

if [ ! -f "$age_identity" ]; then
  echo "age identity does not exist: $age_identity" >&2
  exit 1
fi

verify_checksum() (
  archive_path=$1
  checksum_path="$archive_path.sha256"
  if [ ! -f "$archive_path" ] || [ ! -f "$checksum_path" ]; then
    echo "backup or checksum is missing: $archive_path" >&2
    exit 1
  fi
  archive_dir=$(dirname -- "$archive_path")
  checksum_name=$(basename -- "$checksum_path")
  cd "$archive_dir"
  sha256sum -c "$checksum_name"
)

verify_checksum "$database_backup"
if [ -n "$state_backup" ]; then
  verify_checksum "$state_backup"
fi

umask 077
tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/zero-one-restore-drill.XXXXXX")
suffix=$(basename -- "$tmp_dir")
container_name="$suffix-postgres"
volume_name="$suffix-data"
container_created=false
volume_created=false

cleanup() {
  if [ "$container_created" = true ]; then
    docker rm -f "$container_name" >/dev/null 2>&1 || true
  fi
  if [ "$volume_created" = true ]; then
    docker volume rm -f "$volume_name" >/dev/null 2>&1 || true
  fi
  rm -rf -- "$tmp_dir"
}
trap cleanup EXIT HUP INT TERM

database_dump="$tmp_dir/postgres.dump"
age --decrypt -i "$age_identity" -o "$database_dump" "$database_backup"

if [ -n "$state_backup" ]; then
  state_archive="$tmp_dir/zero-one-state.tar.gz"
  state_listing="$tmp_dir/zero-one-state.files"
  age --decrypt -i "$age_identity" -o "$state_archive" "$state_backup"
  tar -tzf "$state_archive" > "$state_listing"
  grep -Fxq './config/runtime.env' "$state_listing"
  grep -Fxq './config/Caddyfile' "$state_listing"
  grep -Fxq './config/compose.yml' "$state_listing"
  grep -Eq '^\./state/sub2api(/|$)' "$state_listing"
fi

if docker container inspect "$container_name" >/dev/null 2>&1 ||
  docker volume inspect "$volume_name" >/dev/null 2>&1; then
  echo "temporary Docker resource name collision: $suffix" >&2
  exit 1
fi

docker volume create "$volume_name" >/dev/null
volume_created=true
container_created=true
docker run -d \
  --name "$container_name" \
  --network none \
  --label com.01yapi.purpose=restore-drill \
  --mount "type=volume,source=$volume_name,target=/var/lib/postgresql/data" \
  -e PGDATA=/var/lib/postgresql/data \
  -e POSTGRES_DB=restore_drill \
  -e POSTGRES_PASSWORD=restore-drill-only \
  -e POSTGRES_USER=restore_drill \
  "$postgres_image" >/dev/null

attempt=0
until docker exec -e PGPASSWORD=restore-drill-only "$container_name" \
  pg_isready -h 127.0.0.1 -U restore_drill -d restore_drill >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    docker logs "$container_name" >&2 2>/dev/null || true
    echo "isolated PostgreSQL did not become ready" >&2
    exit 1
  fi
  sleep 1
done

docker cp "$database_dump" "$container_name:/tmp/postgres.dump"
docker exec -e PGPASSWORD=restore-drill-only "$container_name" \
  pg_restore \
  --host=127.0.0.1 \
  --username=restore_drill \
  --dbname=restore_drill \
  --format=custom \
  --exit-on-error \
  --no-owner \
  --no-privileges \
  /tmp/postgres.dump

table_count=$(docker exec -e PGPASSWORD=restore-drill-only "$container_name" \
  psql -h 127.0.0.1 -U restore_drill -d restore_drill -Atv ON_ERROR_STOP=1 \
  -c "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname = 'public';")
case "$table_count" in
  ""|*[!0-9]*|0)
    echo "restore completed without any public tables" >&2
    exit 1
    ;;
esac

echo "isolated PostgreSQL restore drill OK: $table_count public tables"
if [ -n "$state_backup" ]; then
  echo "encrypted deployment-state archive integrity OK"
fi
