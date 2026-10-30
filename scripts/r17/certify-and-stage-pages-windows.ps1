# Validate the public VitePress sources and prepare a docs-only branch in an
# isolated Git checkout. Default: review only, no push or remote mutation.
[CmdletBinding()]
param(
 [switch]$Push,
 [string]$Branch='docs/vitepress-postcss-isolation-r17-r3-r6'
)
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Push-Location $root
try {
 & node scripts/check-r16-freeze.mjs
 if($LASTEXITCODE -ne 0){throw 'R16 source freeze FAILED'}
 & node scripts/check-r17-docs.mjs
 if($LASTEXITCODE -ne 0){throw 'VitePress docs validation FAILED'}
 & node scripts/r17/check-pages-publication.mjs
 if($LASTEXITCODE -ne 0){throw 'VitePress publication guard FAILED'}
 Push-Location (Join-Path $root 'docs\cli')
 try {
  & corepack pnpm install
  if($LASTEXITCODE -ne 0){throw 'Docs dependencies FAILED'}
  $env:VITEPRESS_BASE='/vite-plugin-feathersjs/'
  try {
   & corepack pnpm run build
   if($LASTEXITCODE -ne 0){throw 'VitePress Pages build FAILED'}
  }finally{Remove-Item Env:VITEPRESS_BASE -ErrorAction SilentlyContinue}
 }finally{Pop-Location}
 if($Push){
   & powershell -NoProfile -ExecutionPolicy Bypass -File scripts/r17/prepare-gh-pages-branch.ps1 -Branch $Branch -Push
 }else{
   & powershell -NoProfile -ExecutionPolicy Bypass -File scripts/r17/prepare-gh-pages-branch.ps1 -Branch $Branch
 }
 if($LASTEXITCODE -ne 0){throw 'Docs Git branch preparation FAILED'}
 Write-Host 'PASS: Docs checks and build; branch prepared (check whether Push was selected)' -ForegroundColor Green
}finally{Pop-Location}
