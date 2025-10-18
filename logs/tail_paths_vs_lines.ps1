$host.UI.RawUI.WindowTitle = 'TXTvsPATH Console'
$p = 'C:/Users/abdoh/Downloads/testScript/logs/paths_vs_lines_live.log'
Write-Host ('Tailing: ' + $p)
Get-Content -Path $p -Wait -Tail 50