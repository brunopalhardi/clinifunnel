#!/bin/sh
set -eu

log() {
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  printf '{"ts":"%s","level":"%s","scope":"entrypoint","msg":"%s"}\n' "$ts" "$1" "$2"
}

log info "starting docker-entrypoint"

# Migrations sao idempotentes (prisma migrate deploy aplica so as pendentes).
# Se falhar, sai com codigo 1: o Swarm restartara e tentara de novo (na maior
# parte dos casos, falha = banco indisponivel ainda subindo).
log info "applying prisma migrations"
if ! npx prisma migrate deploy; then
  log error "prisma migrate deploy failed"
  exit 1
fi
log info "migrations applied"

log info "exec runtime: $*"
exec "$@"
