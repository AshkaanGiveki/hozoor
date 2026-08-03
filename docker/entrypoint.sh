#!/bin/sh
set -eu
mkdir -p "${UPLOAD_DIR:-/app/data/uploads}" /app/data/attachments
node_modules/.bin/prisma migrate deploy
if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then node_modules/.bin/tsx prisma/seed.ts; fi
exec "$@"
