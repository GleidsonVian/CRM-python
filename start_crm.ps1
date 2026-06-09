#Requires -Version 5.1
$ErrorActionPreference = 'SilentlyContinue'
$ROOT = $PSScriptRoot

# ---------------------------------------------------------------------------
function Write-Header {
    Clear-Host
    Write-Host ""
    Write-Host "  *** NEXUS CRM ***" -ForegroundColor Cyan
    Write-Host "  Painel de inicializacao" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  ---------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host ""
}

function Write-Step { param([string]$msg) Write-Host "  >>  $msg" -ForegroundColor White }
function Write-OK   { param([string]$msg) Write-Host "  OK  $msg" -ForegroundColor Green }
function Write-Warn { param([string]$msg) Write-Host "  **  $msg" -ForegroundColor Yellow }
function Write-Fail { param([string]$msg) Write-Host "  !!  $msg" -ForegroundColor Red }
function Write-Info { param([string]$msg) Write-Host "      $msg" -ForegroundColor DarkGray }

# ---------------------------------------------------------------------------
function Clear-Port {
    param([int]$Port, [string]$Label)

    $inUse = netstat -ano 2>$null | Select-String "\s:$Port\s"
    if (-not $inUse) {
        Write-OK "Porta $Port livre ($Label pronto)"
        return
    }

    Write-Warn "Porta $Port ocupada. Encerrando processo anterior..."

    $pids = $inUse | ForEach-Object {
        ($_ -split '\s+') | Where-Object { $_ -match '^\d+$' } | Select-Object -Last 1
    } | Sort-Object -Unique

    foreach ($pid in $pids) {
        if ($pid -and [int]$pid -gt 0) {
            $proc = Get-Process -Id ([int]$pid) -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Info "Encerrando: $($proc.ProcessName) (PID $pid)"
                Stop-Process -Id ([int]$pid) -Force -ErrorAction SilentlyContinue
            }
        }
    }

    Start-Sleep -Milliseconds 800

    $stillInUse = netstat -ano 2>$null | Select-String "\s:$Port\s"
    if ($stillInUse) {
        Write-Fail "Nao foi possivel liberar a porta $Port. Feche o processo manualmente e tente novamente."
        Read-Host "  Pressione Enter para sair"
        exit 1
    }
    Write-OK "Porta $Port liberada com sucesso"
}

# ---------------------------------------------------------------------------
function Wait-ForPort {
    param([int]$Port, [string]$Name, [int]$TimeoutSec = 25)

    $elapsed = 0
    while ($elapsed -lt $TimeoutSec) {
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $ar  = $tcp.BeginConnect('127.0.0.1', $Port, $null, $null)
            $ok  = $ar.AsyncWaitHandle.WaitOne(400)
            if ($ok) { $tcp.EndConnect($ar); $tcp.Close(); return $true }
            $tcp.Close()
        } catch {}
        Start-Sleep -Milliseconds 500
        $elapsed += 0.5
        Write-Host '.' -NoNewline -ForegroundColor DarkGray
    }
    Write-Host ""
    return $false
}

# ===========================================================================
Write-Header

# --- Verificar estrutura ---
Write-Step "Verificando estrutura do projeto..."

if (-not (Test-Path "$ROOT\backend\main.py")) {
    Write-Fail "Pasta 'backend' nao encontrada em: $ROOT"
    Read-Host "Pressione Enter para sair"; exit 1
}
if (-not (Test-Path "$ROOT\frontend\package.json")) {
    Write-Fail "Pasta 'frontend' nao encontrada em: $ROOT"
    Read-Host "Pressione Enter para sair"; exit 1
}
if (-not (Test-Path "$ROOT\backend\venv\Scripts\uvicorn.exe")) {
    Write-Fail "Virtualenv nao encontrado."
    Write-Info "Execute: cd backend && python -m venv venv && pip install -r requirements.txt"
    Read-Host "Pressione Enter para sair"; exit 1
}
Write-OK "Estrutura do projeto OK"
Write-Host ""

# --- Liberar portas ---
Write-Step "Verificando portas em uso..."
Clear-Port -Port 8000 -Label "Backend"
Clear-Port -Port 5173 -Label "Frontend"
Write-Host ""

# --- Iniciar Backend ---
Write-Step "Iniciando Backend (FastAPI + Uvicorn na porta 8000)..."

$backendCmd = "cd /d `"$ROOT\backend`" & .\venv\Scripts\uvicorn main:app --reload --port 8000 --log-level warning"
Start-Process "cmd.exe" -ArgumentList "/k $backendCmd" -WindowStyle Normal

$backendOK = Wait-ForPort -Port 8000 -Name "Backend"
Write-Host ""
if (-not $backendOK) {
    Write-Fail "Backend nao respondeu em 25 segundos. Verifique a janela do terminal."
    Read-Host "Pressione Enter para sair"; exit 1
}
Write-OK "Backend online    ->  http://localhost:8000"
Write-Info "Docs da API:          http://localhost:8000/docs"
Write-Host ""

# --- Iniciar Frontend ---
Write-Step "Iniciando Frontend (React + Vite na porta 5173)..."

$frontendCmd = "cd /d `"$ROOT\frontend`" & npm run dev"
Start-Process "cmd.exe" -ArgumentList "/k $frontendCmd" -WindowStyle Normal

$frontendOK = Wait-ForPort -Port 5173 -Name "Frontend"
Write-Host ""
if (-not $frontendOK) {
    Write-Fail "Frontend nao respondeu em 25 segundos. Verifique a janela do terminal."
    Read-Host "Pressione Enter para sair"; exit 1
}
Write-OK "Frontend online   ->  http://localhost:5173"
Write-Host ""

# --- Status final ---
Write-Host "  ---------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Nexus CRM esta rodando!" -ForegroundColor Green
Write-Host ""
Write-Host "  Acesse o sistema:   " -NoNewline -ForegroundColor White
Write-Host "http://localhost:5173" -ForegroundColor Cyan
Write-Host "  API (Swagger):      " -NoNewline -ForegroundColor White
Write-Host "http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Para encerrar: feche as duas janelas de terminal que foram abertas." -ForegroundColor DarkGray
Write-Host ""
Write-Host "  ---------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

Start-Sleep -Milliseconds 800
Start-Process "http://localhost:5173"

Read-Host "  [Pressione Enter para fechar este painel]"
