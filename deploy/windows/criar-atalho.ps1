# Cria o atalho "Tatinuanga Draft" na área de trabalho: um clique sobe o site (sem janela) e avisa
# quando ele estiver no ar. Para ligar junto com o Windows, copie o atalho para shell:startup.

$vbs = Join-Path $PSScriptRoot "iniciar-site.vbs"
$desktop = [Environment]::GetFolderPath("Desktop")
$link = Join-Path $desktop "Tatinuanga Draft.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($link)
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = "`"$vbs`""
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.IconLocation = Join-Path $PSScriptRoot "tatinuanga.ico"
$shortcut.Description = "Inicia o servidor do Tatinuanga Draft"
$shortcut.Save()

Write-Output "Atalho criado: $link"
