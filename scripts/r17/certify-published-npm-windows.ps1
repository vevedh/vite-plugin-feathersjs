# Certify the actually published npm CLI, not the local source templates.
# Does not overwrite existing projects. Intentionally runs real REST + Edge E2E.
[CmdletBinding()]
param(
  [ValidateSet('koa','express')][string]$Adapter = 'koa',
  [string]$Package = '@vevedh/create-feathers-app@0.1.0-rc.1',
  [switch]$WithSocket
)
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$generated=Join-Path $root 'examples\r17\generated'
$runner=Join-Path $root 'examples\r17\scripts\certify-r17.mjs'
# Keep every run isolated. A second adapter or a second run must not reuse
# generated files from an earlier certification. No project is overwritten.
$runId=[guid]::NewGuid().ToString('N').Substring(0,12)
$cases=@(
  @{Suffix='quasar-spa';Ui='quasar2';Render='spa';Case='quasar-spa'},
  @{Suffix='daisyui-spa';Ui='daisyui';Render='spa';Case='daisyui-spa'},
  @{Suffix='daisyui-ssr';Ui='daisyui';Render='ssr';Case='daisyui-ssr'},
  @{Suffix='daisyui-ssg';Ui='daisyui';Render='ssg';Case='daisyui-ssg'}
)
$reportPaths=@()
if ($Package -notmatch '^@vevedh/create-feathers-app@(?:0\.1\.0-rc\.[0-9]+|next)$') {
  throw 'Choose a pinned, reviewed @vevedh/create-feathers-app release candidate'
}
Push-Location $generated
try {
  foreach($item in $cases){
    $projectName="npm-${Adapter}-${runId}-$($item.Suffix)"
    $folder=Join-Path $generated $projectName
    if(Test-Path $folder){throw "Existing destination $folder. Refusing overwrite or reuse of unverified code"}
    Write-Host "=== ${projectName}: generating from published npm $Package ==="
    $transport=if($WithSocket -and $item.Render -eq 'spa'){'both'}else{'rest'}
    & npm exec --yes "--package=$Package" -- create-feathers-app $projectName --ui $item.Ui --render $item.Render --adapter $Adapter --transport $transport
    if($LASTEXITCODE -ne 0){throw "npm CLI generation failed: $projectName"}
    Push-Location $folder
    try {
      & corepack pnpm install
      if($LASTEXITCODE -ne 0){throw "Install failed: $projectName"}
      & corepack pnpm run typecheck
      if($LASTEXITCODE -ne 0){throw "Typecheck failed: $projectName"}
      & corepack pnpm run build
      if($LASTEXITCODE -ne 0){throw "Build failed: $projectName"}
    }finally{Pop-Location}
    $params=@('--case',$item.Case,'--project',$projectName,'--adapter',$Adapter)
    if($WithSocket -and $item.Render -eq 'spa'){$params+='--socket'}
    & node $runner @params
    if($LASTEXITCODE -ne 0){throw "HTTP/Edge certification failed: $projectName"}
    $reportPaths+=$folder
  }
  Write-Host 'PASS: published npm CLI - all selected projects build and pass HTTP + Edge.' -ForegroundColor Green
  Write-Host "Isolated run: adapter=$Adapter id=$runId"
  foreach($folder in $reportPaths){Write-Host "Certified project: $folder"}
}finally{Pop-Location}
