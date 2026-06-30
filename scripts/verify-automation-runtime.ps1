param(
    [string]$BaseUrl = "https://www.simeonware.com",
    [string]$Secret = $env:INTERNAL_AUTOMATION_SECRET,
    [string]$OutDir = "C:\Users\simeo\Documents\Codex\2026-06-25\i\outputs"
)

$ErrorActionPreference = "Stop"

function Read-SecretValue {
    if ($Secret) { return $Secret }

    $secure = Read-Host "Paste INTERNAL_AUTOMATION_SECRET or CRON_SECRET" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

function Get-HttpStatus {
    param(
        [string]$Uri,
        [hashtable]$Headers
    )

    try {
        Invoke-WebRequest -Uri $Uri -Headers $Headers -Method GET | Out-Null
        return 200
    }
    catch {
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            return [int]$_.Exception.Response.StatusCode
        }
        throw
    }
}

$route = "$($BaseUrl.TrimEnd('/'))/api/internal/automation"
$secretValue = Read-SecretValue

Write-Host "Checking unauthorized request..."
$unauthorizedStatus = Get-HttpStatus -Uri $route -Headers @{ Authorization = "Bearer wrong-secret" }

Write-Host "Checking authorized request..."
$authorizedResponse = Invoke-RestMethod -Uri $route -Headers @{ Authorization = "Bearer $secretValue" } -Method GET

$repoRoot = Split-Path -Parent $PSScriptRoot
$vercelConfigPath = Join-Path $repoRoot "apps\web\vercel.json"
$vercelConfig = Get-Content -LiteralPath $vercelConfigPath -Raw | ConvertFrom-Json
$automationCron = $vercelConfig.crons | Where-Object { $_.path -eq "/api/internal/automation" } | Select-Object -First 1

$receipt = [ordered]@{
    checkedAt = (Get-Date).ToUniversalTime().ToString("o")
    route = $route
    unauthorizedStatus = $unauthorizedStatus
    authorizedOk = [bool]$authorizedResponse.ok
    responseHasSweep = $null -ne $authorizedResponse.sweep
    responseHasMailboxSync = $null -ne $authorizedResponse.mailboxSync
    responseHasDailyCsvExports = $null -ne $authorizedResponse.dailyCsvExports
    responseHasSummaryResults = $null -ne $authorizedResponse.summaryResults
    localCronPath = $automationCron.path
    localCronSchedule = $automationCron.schedule
}

if (!(Test-Path -LiteralPath $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir | Out-Null
}

$receiptPath = Join-Path $OutDir ("automation-runtime-proof-{0}.json" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
$receipt | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $receiptPath -Encoding UTF8

Write-Host ""
Write-Host "Automation runtime proof"
Write-Host "Unauthorized status: $unauthorizedStatus"
Write-Host "Authorized ok: $($receipt.authorizedOk)"
Write-Host "Cron path: $($receipt.localCronPath)"
Write-Host "Cron schedule: $($receipt.localCronSchedule)"
Write-Host "Receipt: $receiptPath"

if ($unauthorizedStatus -ne 401) {
    throw "Expected unauthorized request to return 401, got $unauthorizedStatus."
}

if (!$authorizedResponse.ok) {
    throw "Authorized automation call did not return ok: true."
}
