#!/bin/sh
set -e

node_modules/.bin/prisma migrate deploy
node dist/seed.js

exec "$@"
