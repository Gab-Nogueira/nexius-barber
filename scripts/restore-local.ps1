param(
  [Parameter(Mandatory = $true)][string]$Archive,
  [switch]$ConfirmRestore
)

$ErrorActionPreference = 'Stop'
if (-not $ConfirmRestore) {
  throw 'Restauração não executada. Use -ConfirmRestore depois de parar o servidor local.'
}
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ArchivePath = (Resolve-Path -LiteralPath $Archive).Path
$StagePath = Join-Path ([System.IO.Path]::GetTempPath()) "nexius-restore-$([guid]::NewGuid())"
$StagePath = [System.IO.Path]::GetFullPath($StagePath)
if (-not $StagePath.StartsWith([System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())) -or (Split-Path -Leaf $StagePath) -notlike 'nexius-restore-*') { throw 'Pasta temporaria invalida.' }
Expand-Archive -LiteralPath $ArchivePath -DestinationPath $StagePath
$IncomingState = Join-Path $StagePath '.wrangler\state'
if (-not (Test-Path -LiteralPath $IncomingState) -or -not (Test-Path -LiteralPath (Join-Path $StagePath 'backup-manifest.json'))) {
  Remove-Item -LiteralPath $StagePath -Recurse -Force
  throw 'Pacote inválido: estado ou manifesto ausente.'
}
$CurrentState = Join-Path $ProjectRoot '.wrangler\state'
if ([System.IO.Path]::GetFullPath($CurrentState) -ne [System.IO.Path]::GetFullPath((Join-Path $ProjectRoot '.wrangler\state'))) { throw 'Destino de restauracao invalido.' }
$SafetyRoot = Join-Path $ProjectRoot 'backups\pre-restore'
New-Item -ItemType Directory -Force -Path $SafetyRoot | Out-Null
if (Test-Path -LiteralPath $CurrentState) {
  $SafetyCopy = Join-Path $SafetyRoot "state-$((Get-Date).ToString('yyyy-MM-dd-HHmmss'))"
  if (-not [System.IO.Path]::GetFullPath($SafetyCopy).StartsWith([System.IO.Path]::GetFullPath($SafetyRoot) + [System.IO.Path]::DirectorySeparatorChar)) { throw 'Destino de seguranca invalido.' }
  Move-Item -LiteralPath $CurrentState -Destination $SafetyCopy
}
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $CurrentState) | Out-Null
Copy-Item -LiteralPath $IncomingState -Destination $CurrentState -Recurse
Remove-Item -LiteralPath $StagePath -Recurse -Force
Write-Output 'Restauração concluída. Reinicie a aplicação e execute os testes de integração.'
