#!/bin/sh
set -e
node node_modules/prisma/build/index.js migrate deploy
exec node_modules/.bin/next start
