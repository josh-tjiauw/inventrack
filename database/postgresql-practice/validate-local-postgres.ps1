# Validate the Inventrack PostgreSQL practice dataset against a local Postgres server.
# Default connection assumes the local practice install used by Clawie:
#   host: localhost
#   port: 5432
#   user: postgres
#   database: inventrack_practice
#
# Usage from repo root:
#   .\database\postgresql-practice\validate-local-postgres.ps1
#
# Optional environment variables:
#   PGHOST, PGPORT, PGUSER, PGDATABASE, PGPASSWORD

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$SchemaFile = Join-Path $PSScriptRoot "inventrack_enterprise_schema_seed.sql"
$ViewsFile = Join-Path $PSScriptRoot "reporting-views.sql"
$TransactionsFile = Join-Path $PSScriptRoot "transaction-practice.sql"

$env:PGHOST = if ($env:PGHOST) { $env:PGHOST } else { "localhost" }
$env:PGPORT = if ($env:PGPORT) { $env:PGPORT } else { "5432" }
$env:PGUSER = if ($env:PGUSER) { $env:PGUSER } else { "postgres" }
$env:PGDATABASE = if ($env:PGDATABASE) { $env:PGDATABASE } else { "inventrack_practice" }

if (-not $env:PGPASSWORD) {
  Write-Warning "PGPASSWORD is not set. psql may prompt for a password."
}

function Invoke-Psql {
  param(
    [Parameter(Mandatory = $true)]
    [string[]] $Arguments
  )

  & psql @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "psql failed with exit code $LASTEXITCODE"
  }
}

Write-Host "Checking psql..."
& psql --version
if ($LASTEXITCODE -ne 0) {
  throw "psql is not available on PATH. Install PostgreSQL or add psql to PATH."
}

Write-Host "Checking Postgres readiness..."
& pg_isready -h $env:PGHOST -p $env:PGPORT
if ($LASTEXITCODE -ne 0) {
  throw "Postgres is not accepting connections at $($env:PGHOST):$($env:PGPORT)."
}

Write-Host "Ensuring database '$($env:PGDATABASE)' exists..."
$exists = (& psql -h $env:PGHOST -p $env:PGPORT -U $env:PGUSER -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$($env:PGDATABASE)';").Trim()
if ($exists -ne "1") {
  Invoke-Psql -Arguments @("-h", $env:PGHOST, "-p", $env:PGPORT, "-U", $env:PGUSER, "-d", "postgres", "-c", "CREATE DATABASE $($env:PGDATABASE);")
}

Write-Host "Loading schema + seed data..."
Invoke-Psql -Arguments @("-h", $env:PGHOST, "-p", $env:PGPORT, "-U", $env:PGUSER, "-d", $env:PGDATABASE, "-v", "ON_ERROR_STOP=1", "-f", $SchemaFile)

Write-Host "Loading reporting views..."
Invoke-Psql -Arguments @("-h", $env:PGHOST, "-p", $env:PGPORT, "-U", $env:PGUSER, "-d", $env:PGDATABASE, "-v", "ON_ERROR_STOP=1", "-f", $ViewsFile)

Write-Host "Running transaction practice previews..."
Invoke-Psql -Arguments @("-h", $env:PGHOST, "-p", $env:PGPORT, "-U", $env:PGUSER, "-d", $env:PGDATABASE, "-v", "ON_ERROR_STOP=1", "-f", $TransactionsFile)

Write-Host "Running smoke-check queries..."
Invoke-Psql -Arguments @("-h", $env:PGHOST, "-p", $env:PGPORT, "-U", $env:PGUSER, "-d", $env:PGDATABASE, "-v", "ON_ERROR_STOP=1", "-c", "SELECT COUNT(*) AS companies FROM companies; SELECT COUNT(*) AS skus FROM skus; SELECT COUNT(*) AS stock_movements FROM stock_movements; SELECT COUNT(*) AS low_stock_rows FROM v_low_stock_skus;")

Write-Host "Inventrack PostgreSQL practice validation passed."
