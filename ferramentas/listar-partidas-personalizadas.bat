<# : Bloco do .bat: roda o resto deste arquivo no PowerShell.
@echo off
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ([IO.File]::ReadAllText('%~f0'))"
echo.
pause
exit /b
#>
# Lista as partidas personalizadas (lobby privado) de Deadlock deste PC.
# Nao instala nada e nao altera nenhum arquivo do jogo ou da Steam.
#  1. Le o cache da Steam, onde o Deadlock guarda as partidas que voce abriu no historico.
#  2. Pergunta a API publica do Deadlock (api.deadlock-api.com) quais dessas partidas,
#     e quais partidas das suas contas Steam, foram em lobby privado.
#     Sao enviados so os numeros das partidas e das contas Steam.
#  3. Mostra a lista, salva em partidas-personalizadas.txt na Area de Trabalho e copia.

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$DeadlockApp = "1422450"

Write-Host "Procurando partidas de Deadlock neste PC..." -ForegroundColor Cyan

$steam = (Get-ItemProperty "HKCU:\Software\Valve\Steam" -ErrorAction SilentlyContinue).SteamPath
if (-not $steam -or -not (Test-Path $steam)) {
  Write-Host "Steam nao encontrada neste PC." -ForegroundColor Red
  return
}
$steam = $steam -replace "/", "\"

# Partidas guardadas no cache HTTP da Steam (enderecos dos replays: /1422450/<partida>_<salt>.meta.bz2).
$matchIds = New-Object System.Collections.Generic.HashSet[long]
$latin1 = [Text.Encoding]::GetEncoding(28591)
$cache = Join-Path $steam "appcache\httpcache"
if (Test-Path $cache) {
  Get-ChildItem $cache -Recurse -File | Where-Object { $_.Length -lt 5MB } | ForEach-Object {
    $text = $latin1.GetString([IO.File]::ReadAllBytes($_.FullName))
    foreach ($m in [regex]::Matches($text, "/$DeadlockApp/(\d+)_\d+\.(meta|dem)\.bz2")) {
      [void]$matchIds.Add([long]$m.Groups[1].Value)
    }
  }
}

# Contas Steam deste PC que ja jogaram Deadlock (pastas userdata\<conta>\1422450).
$accounts = @()
$userdata = Join-Path $steam "userdata"
if (Test-Path $userdata) {
  $accounts = Get-ChildItem $userdata -Directory |
    Where-Object { $_.Name -match "^\d+$" -and (Test-Path (Join-Path $_.FullName $DeadlockApp)) } |
    ForEach-Object { $_.Name }
}

Write-Host ("Partidas no cache: {0}. Contas Steam com Deadlock: {1}." -f $matchIds.Count, $accounts.Count)
if ($matchIds.Count -eq 0 -and $accounts.Count -eq 0) {
  Write-Host "Nada encontrado. Abra o historico de partidas no Deadlock e rode de novo." -ForegroundColor Yellow
  return
}

# Pergunta a API quais sao de lobby privado.
$api = "https://api.deadlock-api.com/v1/matches/metadata?include_info=true&match_mode=private_lobby&limit=1000"
$found = @{}
$queries = @()
if ($matchIds.Count) { $queries += "$api&match_ids=$([string]::Join(',', $matchIds))" }
if ($accounts.Count) { $queries += "$api&account_ids=$([string]::Join(',', $accounts))" }
$apiOk = $false
foreach ($url in $queries) {
  try {
    foreach ($m in (Invoke-RestMethod -Uri $url -TimeoutSec 60)) { $found[[long]$m.match_id] = $m }
    $apiOk = $true
  } catch {
    Write-Host "Falha ao consultar a API: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

$lines = @()
if ($apiOk) {
  $list = $found.Values | Sort-Object { [datetime]$_.start_time }
  foreach ($m in $list) {
    $when = ([datetime]$m.start_time).ToLocalTime().ToString("dd/MM/yyyy HH:mm")
    $mode = if ($m.game_mode -eq "Normal") { "6v6" } else { $m.game_mode }
    $lines += "{0}  {1}  {2} min  {3}" -f $m.match_id, $when, [math]::Round($m.duration_s / 60), $mode
  }
  $ids = ($list | ForEach-Object { $_.match_id }) -join ","
  $title = "Partidas personalizadas encontradas: $($list.Count)"
} else {
  # Sem API: devolve tudo o que achou no cache, sem filtrar.
  $ids = ($matchIds | Sort-Object) -join ","
  $lines = $matchIds | Sort-Object | ForEach-Object { "$_" }
  $title = "Sem acesso a API: estas sao TODAS as partidas do cache (nao filtradas): $($matchIds.Count)"
}

$report = @($title, "") + $lines + @("", "IDs para colar:", $ids)
$out = Join-Path ([Environment]::GetFolderPath("Desktop")) "partidas-personalizadas.txt"
$report | Set-Content -Path $out -Encoding UTF8
try { $report -join "`r`n" | Set-Clipboard } catch {}

Write-Host ""
Write-Host $title -ForegroundColor Green
$lines | ForEach-Object { Write-Host "  $_" }
Write-Host ""
Write-Host "IDs: $ids"
Write-Host ""
Write-Host "Salvo em: $out" -ForegroundColor Cyan
Write-Host "A lista tambem foi copiada: e so colar (Ctrl+V) na conversa." -ForegroundColor Cyan
