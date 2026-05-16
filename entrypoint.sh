#!/bin/sh
set -e
node node_modules/prisma/build/index.js migrate resolve --rolled-back 20260515000000_project_refactor 2>/dev/null || true
node node_modules/prisma/build/index.js migrate deploy
exec node_modules/.bin/next start
