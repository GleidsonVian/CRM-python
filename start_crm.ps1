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

    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $conns) {
        Write-OK "Porta $Port livre ($Label pronto)"
        return
    }

    Write-Warn "Porta $Port em uso. Encerrando processo(s)..."

    # Mata o processo direto na porta E todos os python/uvicorn (o --reload ressuscita o filho)
    $pidList = $conns | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique
    foreach ($p in $pidList) {
        if ($p -le 4) { continue }
        $proc = Get-Process -Id $p -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Info "Encerrando: $($proc.ProcessName) (PID $p)"
            Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
        }
        & taskkill /PID $p /F 2>$null | Out-Null
    }

    # Mata todo processo python/uvicorn que possa ser o reloader pai
    Get-Process python, uvicorn -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Info "Encerrando reloader: $($_.ProcessName) (PID $($_.Id))"
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }

    # Aguarda o kernel liberar o socket
    $waited = 0
    do {
        Start-Sleep -Milliseconds 1000
        $waited++
        $still = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($still) { Write-Host '.' -NoNewline -ForegroundColor DarkGray }
    } while ($still -and $waited -lt 12)
    Write-Host ""

    if ($still) {
        Write-Fail "Nao foi possivel liberar a porta $Port apos $waited segundos."
        Write-Info "Tente fechar outros terminais Python abertos e tente novamente."
        Read-Host "  Pressione Enter para sair"
        exit 1
    }

    Write-OK "Porta $Port liberada com sucesso"
}

# ---------------------------------------------------------------------------
function Wait-ForPort {
    param([int]$Port, [string]$Name, [int]$TimeoutSec = 40)

    $elapsed = 0
    while ($elapsed -lt $TimeoutSec) {
        $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($conn) { return $true }
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
    Write-Warn "Virtualenv nao encontrado. Instalando dependencias do backend..."
    Write-Host ""

    Write-Step "Criando ambiente virtual Python..."
    & python -m venv "$ROOT\backend\venv"
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Falha ao criar virtualenv. Verifique se o Python esta instalado e no PATH."
        Read-Host "Pressione Enter para sair"; exit 1
    }
    Write-OK "Virtualenv criado"

    Write-Step "Instalando dependencias Python (requirements.txt)..."
    & "$ROOT\backend\venv\Scripts\pip.exe" install -r "$ROOT\backend\requirements.txt"
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Falha ao instalar dependencias. Verifique o requirements.txt."
        Read-Host "Pressione Enter para sair"; exit 1
    }
    Write-OK "Dependencias Python instaladas"
    Write-Host ""
}

if (-not (Test-Path "$ROOT\frontend\node_modules")) {
    Write-Warn "node_modules nao encontrado. Instalando dependencias do frontend..."
    Write-Step "Executando npm install..."
    $npmProc = Start-Process "cmd.exe" -ArgumentList "/c cd /d `"$ROOT\frontend`" && npm install" -Wait -PassThru -WindowStyle Normal
    if ($npmProc.ExitCode -ne 0) {
        Write-Fail "Falha no npm install. Verifique se o Node.js esta instalado."
        Read-Host "Pressione Enter para sair"; exit 1
    }
    Write-OK "Dependencias frontend instaladas"
    Write-Host ""
}

Write-OK "Estrutura do projeto OK"
Write-Host ""

# --- Sincronizar dependencias Python ---
Write-Step "Sincronizando dependencias Python (requirements.txt)..."
& "$ROOT\backend\venv\Scripts\pip.exe" install -q -r "$ROOT\backend\requirements.txt"
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Falha ao instalar dependencias Python."
    Read-Host "Pressione Enter para sair"; exit 1
}
Write-OK "Dependencias Python OK"
Write-Host ""

# --- Liberar portas ---
Write-Step "Verificando portas em uso..."
Clear-Port -Port 8001 -Label "Backend"
Clear-Port -Port 5173 -Label "Frontend"
Write-Host ""

# --- Verificar sintaxe do backend antes de iniciar ---
$syntaxCheck = & "$ROOT\backend\venv\Scripts\python.exe" -m py_compile "$ROOT\backend\main.py" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Erro de sintaxe no backend/main.py:"
    Write-Host $syntaxCheck -ForegroundColor Red
    Read-Host "  Pressione Enter para sair"; exit 1
}

# --- Iniciar Backend ---
Write-Step "Iniciando Backend (FastAPI + Uvicorn na porta 8001)..."

$logFile = "$ROOT\backend.log"
"" | Set-Content $logFile  # limpa log anterior
Start-Process -FilePath "$ROOT\backend\venv\Scripts\uvicorn.exe" `
    -ArgumentList "main:app --host 0.0.0.0 --port 8001 --log-level info" `
    -WorkingDirectory "$ROOT\backend" `
    -RedirectStandardOutput $logFile `
    -RedirectStandardError "$ROOT\backend_err.log" `
    -WindowStyle Hidden

$backendOK = Wait-ForPort -Port 8001 -Name "Backend" -TimeoutSec 40
Write-Host ""
if (-not $backendOK) {
    Write-Fail "Backend nao respondeu em 40 segundos."
    Write-Warn "Verificando log..."
    if (Test-Path "$ROOT\backend_err.log") {
        Get-Content "$ROOT\backend_err.log" -Tail 20 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
    } elseif (Test-Path $logFile) {
        Get-Content $logFile -Tail 20 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
    }
    Read-Host "  Pressione Enter para sair"; exit 1
}
Write-OK "Backend online    ->  http://localhost:8001"
Write-Info "Docs da API:          http://localhost:8001/docs"
Write-Host ""

# --- Iniciar Frontend ---
Write-Step "Iniciando Frontend (React + Vite na porta 5173)..."

$frontendLog = "$ROOT\frontend.log"
$frontendCmd = "cd /d `"$ROOT\frontend`" & npm run dev > `"$frontendLog`" 2>&1"
Start-Process "cmd.exe" -ArgumentList "/c $frontendCmd" -WindowStyle Hidden

$frontendOK = Wait-ForPort -Port 5173 -Name "Frontend" -TimeoutSec 40
Write-Host ""
if (-not $frontendOK) {
    Write-Fail "Frontend nao respondeu em 40 segundos."
    Write-Warn "Verificando log..."
    if (Test-Path $frontendLog) {
        Get-Content $frontendLog -Tail 20 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
    }
    Read-Host "  Pressione Enter para sair"; exit 1
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
Write-Host "http://localhost:8001/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Login padrao:" -ForegroundColor DarkGray
Write-Host "    Email:   " -NoNewline -ForegroundColor DarkGray
Write-Host "admin@nexus.com" -ForegroundColor Yellow
Write-Host "    Senha:   " -NoNewline -ForegroundColor DarkGray
Write-Host "admin123" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Para encerrar: feche esta janela (os processos sao encerrados)." -ForegroundColor DarkGray
Write-Host ""
Write-Host "  ---------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

Start-Sleep -Milliseconds 800
Start-Process "http://localhost:5173"

Read-Host "  [Pressione Enter para fechar este painel]"

# Encerrar processos ao fechar o painel
Write-Step "Encerrando processos..."
Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique |
    ForEach-Object { if ($_ -gt 4) { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }
Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique |
    ForEach-Object { if ($_ -gt 4) { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }
Write-OK "Encerrado."
