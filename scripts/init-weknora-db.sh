#!/bin/bash
# Create WeKnora database if not exists
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  SELECT 'CREATE DATABASE weknora' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'weknora')\gexec
  GRANT ALL PRIVILEGES ON DATABASE weknora TO $POSTGRES_USER;
EOSQL
