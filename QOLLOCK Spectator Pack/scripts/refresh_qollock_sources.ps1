param(
    [string]$QollockRoot = (Join-Path $PSScriptRoot "..\..\qollock-codex")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$packRoot = Split-Path -Parent $PSScriptRoot
$sourceRoot = (Resolve-Path -LiteralPath $QollockRoot).Path
$copies = @(
    @("panorama\scripts\ql_recent_purchases_data.js", "panorama\scripts\qollock\ql_recent_purchases_data.js"),
    @("panorama\scripts\ql_features\ql_feat_rejuvtimers.js", "panorama\scripts\qollock\ql_feat_rejuvtimers.js"),
    @("panorama\scripts\ql_features\ql_feat_urntimer.js", "panorama\scripts\qollock\ql_feat_urntimer.js"),
    @("panorama\scripts\ql_features\ql_feat_recentpurchases.js", "panorama\scripts\qollock\ql_feat_recentpurchases.js"),
    @("panorama\layout\hud_paused.xml", "panorama\layout\hud_paused.xml"),
    @("panorama\styles\base\citadel_hud_top_bar.css", "panorama\styles\base\citadel_hud_top_bar.css"),
    @("panorama\styles\base\citadel_hud_top_bar_chat.css", "panorama\styles\base\citadel_hud_top_bar_chat.css"),
    @("panorama\styles\base\citadel_hud_hero_shop.css", "panorama\styles\base\citadel_hud_hero_shop.css"),
    @("panorama\styles\base\hud.css", "panorama\styles\base\hud.css"),
    @("panorama\styles\base\hud_paused.css", "panorama\styles\base\hud_paused.css"),
    @("panorama\styles\citadel_hud_top_bar.css", "panorama\styles\qollock\citadel_hud_top_bar.css"),
    @("panorama\styles\citadel_hud_top_bar_chat.css", "panorama\styles\citadel_hud_top_bar_chat.css"),
    @("panorama\styles\hud_paused.css", "panorama\styles\qollock\hud_paused.css"),
    @("panorama\styles\objectives_map.css", "panorama\styles\objectives_map.css")
)

$tempParent = (Resolve-Path -LiteralPath $env:TEMP).Path
$tempLeaf = "qollock_spectator_refresh_" + [guid]::NewGuid().ToString("N")
$tempRoot = Join-Path $tempParent $tempLeaf
$nextRoot = Join-Path $tempRoot "next"
$backupRoot = Join-Path $tempRoot "backup"
$committed = New-Object System.Collections.Generic.List[string]

function Ensure-ParentDirectory {
    param([string]$Path)
    $parent = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
        [void](New-Item -ItemType Directory -Path $parent -Force)
    }
}

try {
    [void](New-Item -ItemType Directory -Path $nextRoot -Force)
    [void](New-Item -ItemType Directory -Path $backupRoot -Force)

    # Validate and stage every source before changing the pack. A failed future
    # QOL refactor therefore cannot leave a half-refreshed observer install.
    foreach ($copy in $copies) {
        $source = Join-Path $sourceRoot $copy[0]
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
            throw "Required QOL Lock source is missing: $source"
        }
        $staged = Join-Path $nextRoot $copy[1]
        Ensure-ParentDirectory -Path $staged
        Copy-Item -LiteralPath $source -Destination $staged -Force
    }

    # QOL Lock currently carries a stale 12:00 assertion after its Rift initial
    # delay moved to 12:20. Keep its behavior and make the self-test follow its
    # own constant so a refresh cannot reintroduce a false startup error.
    $riftPath = Join-Path $nextRoot "panorama\scripts\qollock\ql_feat_urntimer.js"
    $riftSource = [System.IO.File]::ReadAllText($riftPath)
    $staleAssertion = 'if (EstimateAccumulatorFromGameTime(600) !== 720) throw new Error("Accum est bad");'
    $fixedAssertion = 'if (EstimateAccumulatorFromGameTime(600) !== RIFT_INITIAL_DELAY_SEC) throw new Error("Accum est bad");'
    if ($riftSource.Contains($staleAssertion)) {
        $riftSource = $riftSource.Replace($staleAssertion, $fixedAssertion)
        [System.IO.File]::WriteAllText($riftPath, $riftSource, (New-Object System.Text.UTF8Encoding($false)))
        Write-Host "Applied local Rift self-test correction"
    }

    # The compact pause is a QOL layout/CSS pair rather than a JavaScript
    # feature. Validate its required nodes and selector before committing it.
    $pauseLayoutPath = Join-Path $nextRoot "panorama\layout\hud_paused.xml"
    $pauseCssPath = Join-Path $nextRoot "panorama\styles\qollock\hud_paused.css"
    $pauseLayoutSource = [System.IO.File]::ReadAllText($pauseLayoutPath)
    $pauseCssSource = [System.IO.File]::ReadAllText($pauseCssPath)
    if (-not $pauseLayoutSource.Contains('id="PausedLabel"') -or
        -not $pauseLayoutSource.Contains('text="II"') -or
        -not $pauseLayoutSource.Contains('id="QLPausedText"')) {
        throw "QOL Lock compact pause layout contract changed"
    }
    if (-not $pauseCssSource.Contains('.minimal_pause_active CitadelPaused') -or
        -not $pauseCssSource.Contains('.minimal_pause_active #PausedLabel')) {
        throw "QOL Lock compact pause CSS contract changed"
    }

    # Execute the staged modules against the pack's bridge before committing
    # them. This catches syntax errors and newly added QOL.import dependencies.
    $node = (Get-Command node -ErrorAction Stop).Source
    $recentDataPath = Join-Path $nextRoot "panorama\scripts\qollock\ql_recent_purchases_data.js"
    $rejuvPath = Join-Path $nextRoot "panorama\scripts\qollock\ql_feat_rejuvtimers.js"
    $recentPurchasesPath = Join-Path $nextRoot "panorama\scripts\qollock\ql_feat_recentpurchases.js"
    foreach ($scriptPath in @($recentDataPath, $rejuvPath, $riftPath, $recentPurchasesPath)) {
        & $node --check $scriptPath
        if ($LASTEXITCODE -ne 0) { throw "JavaScript syntax check failed: $scriptPath" }
    }
    $contractTest = Join-Path $packRoot "tests\observer_core_smoke.cjs"
    & $node $contractTest $recentDataPath $rejuvPath $riftPath $recentPurchasesPath
    if ($LASTEXITCODE -ne 0) { throw "Staged QOL module contract check failed" }

    # Keep backups until all staged files have committed successfully.
    foreach ($copy in $copies) {
        $relative = $copy[1]
        $destination = Join-Path $packRoot $relative
        $backup = Join-Path $backupRoot $relative
        if (Test-Path -LiteralPath $destination -PathType Leaf) {
            Ensure-ParentDirectory -Path $backup
            Copy-Item -LiteralPath $destination -Destination $backup -Force
        }

        Ensure-ParentDirectory -Path $destination
        Copy-Item -LiteralPath (Join-Path $nextRoot $relative) -Destination $destination -Force
        $committed.Add($relative)
        Write-Host "Refreshed $relative"
    }

    if (Test-Path -LiteralPath (Join-Path $sourceRoot ".git")) {
        $commit = (& git -C $sourceRoot rev-parse HEAD).Trim()
        if ($LASTEXITCODE -ne 0) { throw "Could not read the QOL Lock source commit" }
        Write-Host "QOL Lock source commit: $commit"

        $readmePath = Join-Path $packRoot "README.md"
        $readme = [System.IO.File]::ReadAllText($readmePath)
        $pattern = '(?m)^- QOL Lock source commit: `[0-9a-fA-F]{40}`$'
        $replacement = '- QOL Lock source commit: `' + $commit + '`'
        if ([regex]::IsMatch($readme, $pattern)) {
            $readme = [regex]::Replace($readme, $pattern, $replacement)
            [System.IO.File]::WriteAllText($readmePath, $readme, (New-Object System.Text.UTF8Encoding($false)))
        } else {
            Write-Warning "README source-commit line was not recognized and was not updated"
        }
    }

    Write-Host "Observer CSS, runtime bridge, and trimmed layouts were left untouched."
}
catch {
    # Roll back only files already replaced during the commit phase.
    foreach ($relative in $committed) {
        $destination = Join-Path $packRoot $relative
        $backup = Join-Path $backupRoot $relative
        if (Test-Path -LiteralPath $backup -PathType Leaf) {
            Copy-Item -LiteralPath $backup -Destination $destination -Force
        } elseif (Test-Path -LiteralPath $destination -PathType Leaf) {
            Remove-Item -LiteralPath $destination -Force
        }
    }
    throw
}
finally {
    $cleanupParent = Split-Path -Parent $tempRoot
    $cleanupLeaf = Split-Path -Leaf $tempRoot
    if ($cleanupParent -ne $tempParent -or -not $cleanupLeaf.StartsWith("qollock_spectator_refresh_")) {
        throw "Refusing unsafe temporary cleanup target: $tempRoot"
    }
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}
