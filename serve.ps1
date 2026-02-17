param(
  [int]$Port = 4500
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "Serving $root on http://localhost:$Port" -ForegroundColor Green
Write-Host "Proxying /api/* -> http://cademeupsi.com.br/api/*" -ForegroundColor Green

$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if ($null -ne $pythonCmd) {
  python "$root\server.py" $Port
  exit $LASTEXITCODE
}

$pyCmd = Get-Command py -ErrorAction SilentlyContinue
if ($null -ne $pyCmd) {
  py "$root\server.py" $Port
  exit $LASTEXITCODE
}

Write-Host "Python nao encontrado. Instale o Python ou execute com o launcher py." -ForegroundColor Red
exit 1
