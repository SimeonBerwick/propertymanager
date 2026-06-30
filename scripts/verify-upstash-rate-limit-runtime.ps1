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

$route = "$($BaseUrl.TrimEnd('/'))/api/internal/rate-limit-proof"
$secretValue = Read-SecretValue

Write-Host "Checking unauthorized request..."
$unauthorizedStatus = Get-HttpStatus -Uri $route -Headers @{ Authorization = "Bearer wrong-secret" }

Write-Host "Checking authorized Upstash rate-limit proof..."
$authorizedResponse = Invoke-RestMethod -Uri $route -Headers @{ Authorization = "Bearer $secretValue" } -Method GET

$receipt = [ordered]@{
    checkedAt = (Get-Date).ToUniversalTime().ToString("o")
    route = $route
    unauthorizedStatus = $unauthorizedStatus
    authorizedOk = [bool]$authorizedResponse.ok
    backend = $authorizedResponse.backend
    firstHitOk = [bool]$authorizedResponse.firstHit.ok
    secondHitOk = [bool]$authorizedResponse.secondHit.ok
    blockedStatusOk = [bool]$authorizedResponse.blockedStatus.ok
    blocked = [bool]$authorizedResponse.blocked
}

if (!(Test-Path -LiteralPath $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir | Out-Null
}

$receiptPath = Join-Path $OutDir ("upstash-rate-limit-runtime-proof-{0}.json" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
$receipt | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $receiptPath -Encoding UTF8

Write-Host ""
Write-Host "Upstash rate-limit runtime proof"
Write-Host "Unauthorized status: $unauthorizedStatus"
Write-Host "Authorized ok: $($receipt.authorizedOk)"
Write-Host "Backend: $($receipt.backend)"
Write-Host "Blocked after limit: $($receipt.blocked)"
Write-Host "Receipt: $receiptPath"

if ($unauthorizedStatus -ne 401) {
    throw "Expected unauthorized request to return 401, got $unauthorizedStatus."
}

if (!$authorizedResponse.ok -or $authorizedResponse.backend -ne 'upstash' -or !$authorizedResponse.blocked) {
    throw "Upstash rate-limit runtime proof failed."
}
