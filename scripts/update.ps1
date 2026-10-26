# Локальное обновление профиля, пока GitHub Actions недоступны.
# Запускается задачей планировщика «GitHub profile update» раз в сутки.
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
Set-Location $repo
$log = Join-Path $env:TEMP 'github-profile-update.log'
"--- $(Get-Date -Format s)" | Out-File $log -Append -Encoding utf8
try {
    git pull --quiet --rebase 2>&1 | Out-File $log -Append -Encoding utf8
    node scripts/build.mjs 2>&1 | Out-File $log -Append -Encoding utf8
    git add -A
    git diff --cached --quiet
    if ($LASTEXITCODE -ne 0) {
        git commit --quiet -m 'Обновить карточки, змейку и активность' 2>&1 | Out-File $log -Append -Encoding utf8
        git push --quiet 2>&1 | Out-File $log -Append -Encoding utf8
        'pushed' | Out-File $log -Append -Encoding utf8
    } else {
        'no changes' | Out-File $log -Append -Encoding utf8
    }
} catch {
    "error: $_" | Out-File $log -Append -Encoding utf8
    exit 1
}
