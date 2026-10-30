# Prepare the real GitHub Pages sources in an isolated checkout, without touching
# or committing any source code or private diagnostics from the development tree.
[CmdletBinding()]
param(
 [string]$Repository='https://github.com/vevedh/vite-plugin-feathersjs.git',
 [string]$Branch='docs/vitepress-postcss-isolation-r17-r3-r6',
 [switch]$Push
)
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$docs=Join-Path $root 'docs\cli'
$workflow=Join-Path $root '.github\workflows\cli-vitepress-pages.yml'
$tmp=Join-Path $env:TEMP ('create-feathers-pages-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $tmp | Out-Null
& git clone --depth 1 $Repository $tmp
if($LASTEXITCODE -ne 0){throw 'Git clone failed'}
Push-Location $tmp
try {
 & git switch -c $Branch
 if($LASTEXITCODE -ne 0){throw 'Could not create docs branch'}
 New-Item -ItemType Directory -Force '.github\workflows','docs\cli' | Out-Null
 Copy-Item -LiteralPath $workflow -Destination '.github\workflows\cli-vitepress-pages.yml' -Force
 # Whitelist: only public docs, no downloaded dependencies, private artifacts or logs.
 foreach($asset in @('index.md','guide','reference','maintenance','package.json','postcss.config.cjs','public')){
   Copy-Item -LiteralPath (Join-Path $docs $asset) -Destination (Join-Path 'docs\cli' $asset) -Recurse -Force
 }
 New-Item -ItemType Directory -Force 'docs\cli\.vitepress' | Out-Null
 Copy-Item (Join-Path $docs '.vitepress\config.mts') -Destination 'docs\cli\.vitepress\config.mts' -Force
 if(Test-Path 'docs\cli\node_modules'){throw 'Unexpected node_modules; refusing commit'}
 & git add -- .github/workflows/cli-vitepress-pages.yml docs/cli
 if($LASTEXITCODE -ne 0){throw 'Git add failed'}
 & git diff --cached --check
 if($LASTEXITCODE -ne 0){throw 'Git whitespace validation failed'}
 Write-Host 'Files prepared for the GitHub Pages documentation branch:'
 & git diff --cached --stat
 if($Push){
   & git commit -m 'fix(docs): isolate VitePress PostCSS from legacy root'
   if($LASTEXITCODE -ne 0){throw 'Git commit failed'}
   & git push --set-upstream origin $Branch
   if($LASTEXITCODE -ne 0){throw 'Git push failed'}
   Write-Host 'Create a pull request to main, then enable Settings > Pages > GitHub Actions.'
 }else{
   Write-Host 'Review-only by default. Re-run -Push to commit and push the documentation branch.'
 }
 Write-Host "Isolated checkout: $tmp"
}finally{Pop-Location}
