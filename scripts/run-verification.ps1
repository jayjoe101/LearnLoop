param(
  [string]$Scratch = "C:\Users\jay\AppData\Local\Temp\grok-goal-9fc042d16ef5\implementer"
)

$Worktree = Split-Path -Parent $PSScriptRoot
$OneDrive = "C:\Users\jay\OneDrive\Desktop\IDEs & Drivers\Code Workspace\LearnLoop"
$CdCmd = "cd `"$OneDrive`""

New-Item -ItemType Directory -Force -Path $Scratch | Out-Null

function Write-LogHeader {
  param([string]$Path, [string]$Command)
  @(
    "# verification log"
    "# command: $CdCmd; $Command"
    "# worktree: $Worktree"
    "# target: $OneDrive"
    ""
  ) | Set-Content -Path $Path -Encoding utf8
}

function Invoke-Logged {
  param([string]$LogPath, [string]$Command)
  Write-LogHeader $LogPath $Command
  Push-Location $OneDrive
  try {
    Invoke-Expression "$Command *>> '$LogPath'" | Out-Null
    return $LASTEXITCODE
  } finally {
    Pop-Location
  }
}

Write-Host "Syncing theme artifacts from worktree to OneDrive..."
$syncFiles = @(
  "src\app\globals.css",
  "src\app\palette.css",
  "src\app\theme-tokens.css",
  "src\lib\theme.ts",
  "src\lib\night-now-toggle.ts",
  "src\lib\theme-button.ts",
  "src\components\app-sidebar.tsx",
  "src\components\feed.tsx",
  "src\components\night-now-button.tsx",
  "src\components\post-card.tsx",
  "src\components\action-tooltip-label.tsx",
  "src\components\icons.tsx",
  "scripts\verify-theme.test.mjs",
  "scripts\verify-premium-buttons.test.mjs"
)
foreach ($rel in $syncFiles) {
  $src = Join-Path $Worktree $rel
  $dst = Join-Path $OneDrive $rel
  if (Test-Path $src) {
    $dstDir = Split-Path $dst -Parent
    if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Force -Path $dstDir | Out-Null }
    Copy-Item $src $dst -Force
    Write-Host "  synced $rel"
  }
}

$pkgPath = Join-Path $OneDrive "package.json"
$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
$pkgChanged = $false
if (-not $pkg.scripts.'test:theme') {
  $pkg.scripts | Add-Member -NotePropertyName 'test:theme' -NotePropertyValue 'node --test scripts/verify-theme.test.mjs' -Force
  $pkgChanged = $true
}
if (-not $pkg.scripts.'test:premium-buttons') {
  $pkg.scripts | Add-Member -NotePropertyName 'test:premium-buttons' -NotePropertyValue 'node --test scripts/verify-premium-buttons.test.mjs' -Force
  $pkgChanged = $true
}
if ($pkgChanged) {
  $pkg | ConvertTo-Json -Depth 10 | Set-Content $pkgPath -Encoding utf8
  Write-Host "  updated package.json test scripts"
}

$exitBuild1 = Invoke-Logged (Join-Path $Scratch "build1.log") "npm run build"
$exitBuild2 = Invoke-Logged (Join-Path $Scratch "build2.log") "npm run build"
$exitLint = Invoke-Logged (Join-Path $Scratch "lint.log") "node ./node_modules/next/dist/bin/next lint"
$exitTest = Invoke-Logged (Join-Path $Scratch "theme-test.log") "npm run test:theme"
$exitPremium = Invoke-Logged (Join-Path $Scratch "premium-buttons-test.log") "npm run test:premium-buttons"
Invoke-Logged (Join-Path $Scratch "playwright-check.txt") "npx playwright --version" | Out-Null

Write-Host "Verification logs written to $Scratch"
Write-Host "exit codes: build1=$exitBuild1 build2=$exitBuild2 lint=$exitLint theme=$exitTest premium=$exitPremium"
if ($exitBuild1 -ne 0 -or $exitBuild2 -ne 0 -or $exitTest -ne 0 -or $exitPremium -ne 0) { exit 1 }