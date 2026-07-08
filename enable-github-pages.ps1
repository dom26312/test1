param(
    [string]$Owner = "dom26312",
    [string]$Repo = "test1",
    [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"

Write-Host "GitHub Pages setup for $Owner/$Repo" -ForegroundColor Cyan
Write-Host "Create a GitHub token with Administration: Read and write, Pages: Read and write." -ForegroundColor Yellow
Write-Host "Paste the token below. It will not be saved." -ForegroundColor Yellow

$secureToken = Read-Host "GitHub token" -AsSecureString
$token = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
)

$headers = @{
    "Accept"               = "application/vnd.github+json"
    "Authorization"        = "Bearer $token"
    "X-GitHub-Api-Version" = "2022-11-28"
}

$body = @{
    source = @{
        branch = $Branch
        path   = "/"
    }
} | ConvertTo-Json -Depth 5

$pagesUrl = "https://api.github.com/repos/$Owner/$Repo/pages"

try {
    Write-Host "Checking current Pages settings..."
    Invoke-RestMethod -Method Get -Uri $pagesUrl -Headers $headers | Out-Null

    Write-Host "Pages already exists. Updating source to $Branch / ..."
    Invoke-RestMethod -Method Put -Uri $pagesUrl -Headers $headers -Body $body -ContentType "application/json" | Out-Null
}
catch {
    $statusCode = $_.Exception.Response.StatusCode.value__

    if ($statusCode -eq 404) {
        Write-Host "Pages is not enabled yet. Creating Pages site..."
        Invoke-RestMethod -Method Post -Uri $pagesUrl -Headers $headers -Body $body -ContentType "application/json" | Out-Null
    }
    else {
        throw
    }
}
finally {
    if ($token) {
        Remove-Variable token -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "Done. Wait 1-5 minutes, then open:" -ForegroundColor Green
Write-Host "https://$Owner.github.io/$Repo/" -ForegroundColor Green
