#!/usr/bin/env bash
#
# Local Postgres for development, in Docker.
#
# Off unless LOCAL_POSTGRES_DOCKER_FOR_DEV=true in backend/.env — nobody who
# points DATABASE_URL at Neon or Supabase should have a script quietly starting
# containers on them.
#
#   scripts/dev_db.sh              start it (creating it the first time)
#   scripts/dev_db.sh --dry-run    print what it resolved and would do
#
# See docs/local-development.md for why the image has to be a pgvector one and
# why the container dies when WSL has no live session.

set -euo pipefail

cd "$(dirname "$0")/.."
ENV_FILE=".env"

# Read one key out of .env. Deliberately not `source`: a real DATABASE_URL
# carries `?sslmode=require&channel_binding=...`, and an unquoted `&` in a
# sourced file backgrounds half the line.
env_get() {
	[ -f "$ENV_FILE" ] || return 0
	sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" "$ENV_FILE" |
		tail -n1 | tr -d '\r' | sed 's/^["'\'']//; s/["'\'']$//'
}

# Defaults match the container documented in docs/local-development.md, so this
# adopts an existing one rather than creating a second.
ENABLED=$(env_get LOCAL_POSTGRES_DOCKER_FOR_DEV)
NAME=$(env_get DEV_DB_CONTAINER); NAME=${NAME:-my-blog-pg}
IMAGE=$(env_get DEV_DB_IMAGE);    IMAGE=${IMAGE:-pgvector/pgvector:pg16}
PORT=$(env_get DEV_DB_PORT);      PORT=${PORT:-5432}
PGUSER=blog PGPASS=blog PGDB=blog
URL="postgresql://$PGUSER:$PGPASS@localhost:$PORT/$PGDB"

die() { echo "dev_db: $*" >&2; exit 1; }

if [ "${ENABLED,,}" != "true" ]; then
	echo "dev_db: disabled."
	echo "  Set LOCAL_POSTGRES_DOCKER_FOR_DEV=true in backend/.env to enable."
	if [ -f "$ENV_FILE" ]; then
		echo "  (currently ${ENABLED:-unset} in $(pwd)/$ENV_FILE)"
	else
		echo "  (no $(pwd)/$ENV_FILE — copy .env.example to .env first)"
	fi
	exit 0
fi

state=""
if [ "${1:-}" != "--dry-run" ]; then
	command -v docker >/dev/null 2>&1 || die "docker not found on PATH.
  On Windows the daemon usually lives inside WSL — run this from there:
    wsl -e bash -lc 'backend/scripts/dev_db.sh'"

	docker info >/dev/null 2>&1 || die "docker is installed but the daemon is not responding.
  Start Docker Desktop, or inside WSL: sudo service docker start
  Detail: $(docker info 2>&1 | tail -n3)"

	# Empty when no such container; "running" / "exited" / "created" otherwise.
	state=$(docker inspect -f '{{.State.Status}}' "$NAME" 2>/dev/null || true)
fi

if [ "${1:-}" = "--dry-run" ]; then
	echo "container : $NAME"
	echo "image     : $IMAGE"
	echo "port      : $PORT"
	echo "url       : $URL"
	echo "enabled   : $ENABLED"
	exit 0
fi

case "$state" in
running)
	echo "dev_db: $NAME already running."
	;;
"")
	echo "dev_db: no container named $NAME — creating it from $IMAGE."
	# The image must ship pgvector: the schema has Vector(384) columns and
	# migration b7e2f4a91c03 runs CREATE EXTENSION vector. Plain postgres:16
	# fails there.
	docker run -d --name "$NAME" -p "$PORT:5432" \
		-e POSTGRES_USER="$PGUSER" \
		-e POSTGRES_PASSWORD="$PGPASS" \
		-e POSTGRES_DB="$PGDB" \
		--restart unless-stopped \
		"$IMAGE" >/dev/null ||
		die "docker run failed — see the output above.
  Port $PORT already taken? Try: DEV_DB_PORT=5433 in backend/.env"
	echo "dev_db: created. First run, so the schema is still empty:"
	echo "    uv run alembic upgrade head"
	echo "    uv run python -m scripts.seed_owner"
	echo "    uv run python -m scripts.seed_data"
	;;
*)
	echo "dev_db: $NAME exists but is $state — starting it."
	docker start "$NAME" >/dev/null ||
		die "could not start $NAME.
  Detail: $(docker logs --tail 10 "$NAME" 2>&1)"
	;;
esac

# Postgres accepts connections a beat after the container reports running, so
# alembic straight after this would race it.
for _ in $(seq 30); do
	if docker exec "$NAME" pg_isready -U "$PGUSER" -d "$PGDB" >/dev/null 2>&1; then
		echo "dev_db: ready — $URL"
		exit 0
	fi
	sleep 1
done

die "$NAME is up but Postgres never became ready (30s).
  Detail: $(docker logs --tail 20 "$NAME" 2>&1)"
