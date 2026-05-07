#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${1:-./database-export-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUT_DIR"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "Erro: pg_dump não encontrado. Instale as ferramentas do PostgreSQL." >&2
  exit 1
fi

if [ -z "${SUPABASE_DB_URL:-}" ] && [ -z "${DATABASE_URL:-}" ]; then
  echo "Erro: defina SUPABASE_DB_URL ou DATABASE_URL com a conexão do banco atual." >&2
  exit 1
fi

SOURCE_URL="${SUPABASE_DB_URL:-$DATABASE_URL}"

echo "Exportando schema completo..."
pg_dump "$SOURCE_URL" \
  --schema=public \
  --schema=storage \
  --schema=auth \
  --schema-only \
  --no-owner \
  --no-privileges \
  --file="$OUT_DIR/01_schema.sql"

echo "Exportando dados públicos..."
pg_dump "$SOURCE_URL" \
  --schema=public \
  --data-only \
  --inserts \
  --column-inserts \
  --disable-triggers \
  --no-owner \
  --no-privileges \
  --file="$OUT_DIR/02_public_data.sql"

echo "Exportando usuários de autenticação..."
pg_dump "$SOURCE_URL" \
  --schema=auth \
  --data-only \
  --inserts \
  --column-inserts \
  --disable-triggers \
  --no-owner \
  --no-privileges \
  --file="$OUT_DIR/03_auth_data.sql"

echo "Exportando metadados de storage..."
pg_dump "$SOURCE_URL" \
  --schema=storage \
  --data-only \
  --inserts \
  --column-inserts \
  --disable-triggers \
  --no-owner \
  --no-privileges \
  --file="$OUT_DIR/04_storage_metadata.sql"

echo "Exportação concluída em: $OUT_DIR"
echo "Importante: arquivos físicos do storage precisam ser migrados separadamente."
