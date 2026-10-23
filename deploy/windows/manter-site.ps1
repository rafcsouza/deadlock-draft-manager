# Mantém o site no ar no Windows (para quem hospeda no próprio PC): sobe o `npm start` e, se o
# processo cair, sobe de novo em alguns segundos. Roda escondido pelo iniciar-site.vbs, que fica
# na pasta Inicializar do Windows (veja instalar-inicio.ps1).
#
# Para atualizar o site sem este script religar no meio do build, crie o arquivo data\site-pausado:
# enquanto ele existir, o site não é religado. O log fica em data\site.log.

$ErrorActionPreference = "Continue"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$data = Join-Path $root "data"
$log = Join-Path $data "site.log"
$pause = Join-Path $data "site-pausado"
New-Item -ItemType Directory -Force $data | Out-Null

function Port-Busy {
  [bool](Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)
}

# Já tem um site rodando (outra cópia deste script ou um npm start manual): não sobe outro.
if (Port-Busy) { exit 0 }

Set-Location $root
while ($true) {
  if (Test-Path $pause) {
    Start-Sleep -Seconds 5
    continue
  }
  if (Port-Busy) {
    Start-Sleep -Seconds 10
    continue
  }
  Add-Content $log "[$(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')] subindo o site"
  & cmd.exe /c "npm.cmd start >> `"$log`" 2>&1"
  Add-Content $log "[$(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')] o site parou (codigo $LASTEXITCODE); religando em 5 s"
  Start-Sleep -Seconds 5
}
