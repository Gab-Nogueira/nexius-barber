$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $ProjectRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Instale Node.js 22.13 ou superior e abra novamente.' }
if ([version]((& node --version).TrimStart('v')) -lt [version]'22.13.0') { throw 'Atualize o Node.js para 22.13 ou superior.' }
if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot '.env.local'))) {
  Copy-Item -LiteralPath (Join-Path $ProjectRoot '.env.demo.example') -Destination (Join-Path $ProjectRoot '.env.local')
}
if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot 'node_modules'))) { & npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar dependencias.' } }
& npm.cmd run db:migrate
if ($LASTEXITCODE -ne 0) { throw 'A migracao falhou. Nao inicie antes de revisar o banco.' }
Write-Host 'Demonstracao local: http://localhost:3000 — os horarios nao sao reservas reais.'
& npm.cmd run dev
