param(
  [string]$Destination = "backups"
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$StatePath = Join-Path $ProjectRoot '.wrangler\state'
if (-not (Test-Path -LiteralPath $StatePath)) {
  throw 'Estado local não encontrado. Execute a aplicação e aplique as migrações antes do backup.'
}

$Timestamp = Get-Date -Format 'yyyy-MM-dd-HHmmss'
$DestinationPath = Join-Path $ProjectRoot $Destination
New-Item -ItemType Directory -Force -Path $DestinationPath | Out-Null
$TempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$StagePath = [System.IO.Path]::GetFullPath((Join-Path $TempRoot "nexius-backup-$([guid]::NewGuid())"))
if (-not $StagePath.StartsWith($TempRoot) -or (Split-Path -Leaf $StagePath) -notlike 'nexius-backup-*') { throw 'Pasta temporaria invalida.' }
New-Item -ItemType Directory -Force -Path (Join-Path $StagePath '.wrangler') | Out-Null
Copy-Item -LiteralPath $StatePath -Destination (Join-Path $StagePath '.wrangler\state') -Recurse
Copy-Item -LiteralPath (Join-Path $ProjectRoot 'drizzle') -Destination (Join-Path $StagePath 'drizzle') -Recurse
New-Item -ItemType Directory -Force -Path (Join-Path $StagePath 'public') | Out-Null
Copy-Item -LiteralPath (Join-Path $ProjectRoot 'public\nexius-concrete-x.png') -Destination (Join-Path $StagePath 'public\nexius-concrete-x.png')
$Manifest = @{
  created_at = (Get-Date).ToString('o')
  scope = 'D1 local, R2 local, migrações e ativo visual'
  project = 'Nexius Barber demonstração'
} | ConvertTo-Json
Set-Content -LiteralPath (Join-Path $StagePath 'backup-manifest.json') -Value $Manifest -Encoding UTF8
$ArchivePath = Join-Path $DestinationPath "nexius-demo-$Timestamp.zip"
Compress-Archive -Path (Join-Path $StagePath '*') -DestinationPath $ArchivePath -CompressionLevel Optimal
Remove-Item -LiteralPath $StagePath -Recurse -Force
Write-Output $ArchivePath
