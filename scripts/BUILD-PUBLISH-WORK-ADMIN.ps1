# =============================================================================
# Build + Publish TrishWork + TrishAdmin v1.0.0
# =============================================================================
#
# Workflow tu dong hoa:
#   1. Build .exe ca 2 app qua Tauri
#   2. Compute SHA256 tung installer
#   3. Update website/public/apps-registry.json voi SHA256 that
#   4. (Optional) Upload .exe len GitHub Release qua `gh` CLI
#   5. (Optional) Redeploy website qua Vercel CLI
#
# Yeu cau truoc:
#   - Rust toolchain + MSVC build tools
#   - pnpm install o repo root
#   - (Optional) gh CLI auth: `gh auth login`
#   - (Optional) vercel CLI: `vercel login`
#
# Cach dung:
#   .\scripts\BUILD-PUBLISH-WORK-ADMIN.ps1
#   .\scripts\BUILD-PUBLISH-WORK-ADMIN.ps1 -SkipBuild  # neu da build
#   .\scripts\BUILD-PUBLISH-WORK-ADMIN.ps1 -OnlyApp work
#   .\scripts\BUILD-PUBLISH-WORK-ADMIN.ps1 -SkipDeploy # bo qua vercel
#
# LUU Y: TrishAdmin la app admin (whitelist email) - khong nam tren trang
# downloads cong khai. TrishWork co tren trang downloads nhung trang do
# HARDCODE trong app/downloads/page.tsx -> sau khi build phai sua tay
# size_mb + sha256 cho trishwork trong file do roi commit + vercel --prod.
# =============================================================================

param(
    [switch]$SkipBuild,
    [switch]$SkipUpload,
    [switch]$SkipDeploy,
    [ValidateSet('both', 'work', 'admin')]
    [string]$OnlyApp = 'both'
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$Apps = @()
if ($OnlyApp -in @('both', 'work')) {
    $Apps += @{
        Id = 'trishwork'
        Name = 'TrishWork'
        Filter = '@trishteam/trishwork'
        BundleDir = 'apps-desktop\trishwork\src-tauri\target\release\bundle'
        InstallerName = 'TrishWork_1.0.0_x64-setup.exe'
        Tag = 'trishwork-v1.0.0'
    }
}
if ($OnlyApp -in @('both', 'admin')) {
    $Apps += @{
        Id = 'trishadmin'
        Name = 'TrishAdmin'
        Filter = '@trishteam/trishadmin'
        BundleDir = 'apps-desktop\trishadmin\src-tauri\target\release\bundle'
        InstallerName = 'TrishAdmin_1.0.0_x64-setup.exe'
        Tag = 'trishadmin-v1.0.0'
    }
}

# ============================================================
# STEP 1: BUILD
# ============================================================
if (-not $SkipBuild) {
    Write-Host "`n=== STEP 1/5: Build .exe ===" -ForegroundColor Cyan
    foreach ($app in $Apps) {
        Write-Host "`n[$($app.Name)] Building..." -ForegroundColor Yellow
        $startTime = Get-Date
        pnpm --filter=$($app.Filter) tauri:build
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[$($app.Name)] BUILD FAILED" -ForegroundColor Red
            exit 1
        }
        $duration = (Get-Date) - $startTime
        Write-Host "[$($app.Name)] Built in $($duration.TotalMinutes.ToString('F1')) phut" -ForegroundColor Green
    }
} else {
    Write-Host "`n=== STEP 1/5: SKIPPED (--SkipBuild) ===" -ForegroundColor DarkGray
}

# ============================================================
# STEP 2: LOCATE INSTALLERS + SHA256
# ============================================================
Write-Host "`n=== STEP 2/5: Locate installers + compute SHA256 ===" -ForegroundColor Cyan
$Results = @()
foreach ($app in $Apps) {
    $nsisPath = Join-Path $RepoRoot "$($app.BundleDir)\nsis\$($app.InstallerName)"
    if (-not (Test-Path $nsisPath)) {
        Write-Host "[$($app.Name)] NSIS installer NOT FOUND: $nsisPath" -ForegroundColor Red
        Write-Host "  Check: $(Join-Path $RepoRoot $app.BundleDir)" -ForegroundColor Yellow
        Get-ChildItem (Join-Path $RepoRoot $app.BundleDir) -Recurse -Filter "*.exe" -ErrorAction SilentlyContinue |
            ForEach-Object { Write-Host "  Found: $($_.FullName)" -ForegroundColor DarkGray }
        exit 1
    }
    $sha = (Get-FileHash -Algorithm SHA256 -Path $nsisPath).Hash.ToLower()
    $size = (Get-Item $nsisPath).Length
    Write-Host "[$($app.Name)]" -ForegroundColor Green
    Write-Host "  Path:  $nsisPath" -ForegroundColor DarkGray
    Write-Host "  Size:  $([math]::Round($size / 1MB, 2)) MB ($size bytes)" -ForegroundColor DarkGray
    Write-Host "  SHA256: $sha" -ForegroundColor DarkGray
    $Results += @{
        App = $app
        Path = $nsisPath
        Sha256 = $sha
        Size = $size
    }
}

# ============================================================
# STEP 3: UPDATE apps-registry.json
# ============================================================
Write-Host "`n=== STEP 3/5: Update apps-registry.json ===" -ForegroundColor Cyan
$registryPath = Join-Path $RepoRoot "website\public\apps-registry.json"
$registry = Get-Content $registryPath -Raw | ConvertFrom-Json
$updated = $false
foreach ($r in $Results) {
    foreach ($entry in $registry.apps) {
        if ($entry.id -eq $r.App.Id) {
            $oldSha = $entry.download.windows_x64.sha256
            $entry.download.windows_x64.sha256 = $r.Sha256
            $entry.size_bytes = $r.Size
            Write-Host "  [$($r.App.Name)] SHA256 $oldSha -> $($r.Sha256)" -ForegroundColor Yellow
            $updated = $true
        }
    }
}
if ($updated) {
    $registry.updated_at = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')
    $registry | ConvertTo-Json -Depth 10 | Set-Content $registryPath -Encoding UTF8
    Write-Host "  Updated: $registryPath" -ForegroundColor Green
} else {
    Write-Host "  Khong tim thay entry trong registry de update" -ForegroundColor Red
}

# ============================================================
# STEP 4: GITHUB RELEASE UPLOAD
# ============================================================
if (-not $SkipUpload) {
    Write-Host "`n=== STEP 4/5: Upload to GitHub Release ===" -ForegroundColor Cyan
    $ghAvailable = $null -ne (Get-Command gh -ErrorAction SilentlyContinue)
    if (-not $ghAvailable) {
        Write-Host "  gh CLI khong co. Install: https://cli.github.com/" -ForegroundColor Yellow
        Write-Host "  Hoac upload manual len https://github.com/hosytri07/trishnexus-monorepo/releases" -ForegroundColor Yellow
        Write-Host "  Skip upload, tiep tuc..." -ForegroundColor Yellow
    } else {
        $prevEAP = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        foreach ($r in $Results) {
            $tag = $r.App.Tag
            Write-Host "`n  [$($r.App.Name)] Checking release $tag..." -ForegroundColor Yellow
            gh release view $tag --repo hosytri07/trishnexus-monorepo *> $null
            if ($LASTEXITCODE -ne 0) {
                Write-Host "  Tao release moi $tag..." -ForegroundColor Yellow
                gh release create $tag --repo hosytri07/trishnexus-monorepo `
                    --title "$($r.App.Name) v1.0.0" `
                    --notes "$($r.App.Name) v1.0.0`n`n- SHA256: $($r.Sha256)`n- Size: $([math]::Round($r.Size / 1MB, 2)) MB"
            }
            Write-Host "  Upload asset: $($r.App.InstallerName)..." -ForegroundColor Yellow
            gh release upload $tag $r.Path --repo hosytri07/trishnexus-monorepo --clobber
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  [$($r.App.Name)] Uploaded OK" -ForegroundColor Green
            } else {
                Write-Host "  [$($r.App.Name)] Upload FAILED" -ForegroundColor Red
            }
        }
        $ErrorActionPreference = $prevEAP
    }
} else {
    Write-Host "`n=== STEP 4/5: SKIPPED (--SkipUpload) ===" -ForegroundColor DarkGray
}

# ============================================================
# STEP 5: REDEPLOY WEBSITE
# ============================================================
if (-not $SkipDeploy) {
    Write-Host "`n=== STEP 5/5: Redeploy website ===" -ForegroundColor Cyan
    $vercelAvailable = $null -ne (Get-Command vercel -ErrorAction SilentlyContinue)
    if (-not $vercelAvailable) {
        Write-Host "  vercel CLI khong co. Install: npm i -g vercel" -ForegroundColor Yellow
        Write-Host "  Hoac deploy manual via vercel.com dashboard" -ForegroundColor Yellow
    } else {
        Write-Host "  Deploying website (prod)..." -ForegroundColor Yellow
        vercel --prod
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  Website deployed" -ForegroundColor Green
        } else {
            Write-Host "  Deploy FAILED -- check vercel CLI output" -ForegroundColor Red
        }
    }
} else {
    Write-Host "`n=== STEP 5/5: SKIPPED (--SkipDeploy) ===" -ForegroundColor DarkGray
}

# ============================================================
# DONE
# ============================================================
Write-Host "`n=========================================================" -ForegroundColor Green
Write-Host "DONE!" -ForegroundColor Green
Write-Host "=========================================================" -ForegroundColor Green
foreach ($r in $Results) {
    Write-Host "  $($r.App.Name) v1.0.0" -ForegroundColor White
    Write-Host "    URL: https://github.com/hosytri07/trishnexus-monorepo/releases/tag/$($r.App.Tag)" -ForegroundColor DarkGray
    Write-Host "    SHA: $($r.Sha256)" -ForegroundColor DarkGray
    Write-Host "    Size: $([math]::Round($r.Size / 1MB, 2)) MB" -ForegroundColor DarkGray
}
Write-Host ""
Write-Host "NHO: Cap nhat tay trishwork trong app/downloads/page.tsx (size_mb + sha256) roi commit + vercel --prod" -ForegroundColor Cyan
