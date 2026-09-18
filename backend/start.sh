#!/usr/bin/env sh
# Usado pelo Railway/Railpack como comando de start quando o "Root Directory"
# do serviço de backend está configurado como "backend".
set -e
exec npx tsx src/server.ts
