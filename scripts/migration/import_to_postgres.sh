#!/usr/bin/env bash
set -euo pipefail

EXPORT_DIR="${1:-}"
TARGET_URL="${2:-${TARGET_DATABASE_URL:-}}"

if [ -z "$EXPORT_DIR" ] || [ -z "$TARGET_URL" ]; then
  echo "Uso: ./scripts/migration/import_to_postgres.sh ./database-export-YYYYMMDD-HHMMSS 'postgresql://usuario:senha@host:5432/banco'" >&2
  echo "Ou defina TARGET_DATABASE_URL e passe apenas a pasta exportada." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "Erro: psql não encontrado. Instale as ferramentas do PostgreSQL." >&2
  exit 1
fi

for file in 01_schema.sql 02_public_data.sql 03_auth_data.sql 04_storage_metadata.sql; do
  if [ ! -f "$EXPORT_DIR/$file" ]; then
    echo "Erro: arquivo ausente: $EXPORT_DIR/$file" >&2
    exit 1
  fi
done

echo "Importando schema..."
psql "$TARGET_URL" -v ON_ERROR_STOP=1 -f "$EXPORT_DIR/01_schema.sql"

echo "Importando dados públicos..."
psql "$TARGET_URL" -v ON_ERROR_STOP=1 -f "$EXPORT_DIR/02_public_data.sql"

echo "Importando usuários de autenticação..."
psql "$TARGET_URL" -v ON_ERROR_STOP=1 -f "$EXPORT_DIR/03_auth_data.sql"

echo "Importando metadados de storage..."
psql "$TARGET_URL" -v ON_ERROR_STOP=1 -f "$EXPORT_DIR/04_storage_metadata.sql"

echo "Importação concluída. Rode o checklist de validação antes de apontar o app para o novo backend."
