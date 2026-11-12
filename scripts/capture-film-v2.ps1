$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$localDir = "c:\FESTFLOW\film-screenshots"
$artifactDir = "C:\Users\Vamshi krishna\.gemini\antigravity\brain\d059a623-dcff-42e9-8e75-a739969611e7"

New-Item -ItemType Directory -Force -Path $localDir | Out-Null

$captures = @(
  # 5 Scenes at primary mobile viewport (390x844)
  @{ name = "film-v2-scene01-brand-390.png"; url = "http://localhost:4173/#scene-01-brand"; size = "390,844" },
  @{ name = "film-v2-scene02-discover-390.png"; url = "http://localhost:4173/#scene-02-discover"; size = "390,844" },
  @{ name = "film-v2-scene03-journey-390.png"; url = "http://localhost:4173/#scene-03-journey"; size = "390,844" },
  @{ name = "film-v2-scene04-organizer-390.png"; url = "http://localhost:4173/#scene-04-organizer"; size = "390,844" },
  @{ name = "film-v2-scene05-final-390.png"; url = "http://localhost:4173/#scene-05-final"; size = "390,844" },

  # Viewport compliance checks for the film experience
  @{ name = "film-v2-mobile-320x568.png"; url = "http://localhost:4173/"; size = "320,568" },
  @{ name = "film-v2-mobile-320x720.png"; url = "http://localhost:4173/"; size = "320,720" },
  @{ name = "film-v2-mobile-360x800.png"; url = "http://localhost:4173/"; size = "360,800" },
  @{ name = "film-v2-mobile-375x812.png"; url = "http://localhost:4173/"; size = "375,812" },
  @{ name = "film-v2-mobile-414x896.png"; url = "http://localhost:4173/"; size = "414,896" },
  @{ name = "film-v2-mobile-430x932.png"; url = "http://localhost:4173/"; size = "430,932" },

  # Desktop presentation
  @{ name = "film-v2-desktop-1440x900.png"; url = "http://localhost:4173/"; size = "1440,900" }
)

foreach ($c in $captures) {
  $targetLocal = Join-Path $localDir $c.name
  Write-Host "Capturing $($c.name) at $($c.size)..."
  Start-Process -FilePath $edge -ArgumentList @(
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--virtual-time-budget=3200",
    "--window-size=$($c.size)",
    "--screenshot=$targetLocal",
    $c.url
  ) -Wait

  if (Test-Path $targetLocal) {
    Copy-Item -Path $targetLocal -Destination $artifactDir -Force
    Write-Host "  -> Saved and mirrored to artifact: $($c.name)"
  } else {
    Write-Warning "  -> Failed $($c.name)"
  }
}
Write-Host "Film capture suite completed."

