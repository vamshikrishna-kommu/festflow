$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$localDir = "c:\FESTFLOW\screenshots"
$artifactDir = "C:\Users\Vamshi krishna\.gemini\antigravity\brain\d059a623-dcff-42e9-8e75-a739969611e7"

$shots = @(
  @{ name = "cinematic-scene01-desktop-1440.png"; url = "http://localhost:4173/"; size = "1440,900" },
  @{ name = "cinematic-scene01-mobile-390.png"; url = "http://localhost:4173/"; size = "390,844" },
  @{ name = "cinematic-scene02-events-mobile-390.png"; url = "http://localhost:4173/#scene-events"; size = "390,844" },
  @{ name = "cinematic-scene03-discover-mobile-390.png"; url = "http://localhost:4173/#scene-discover"; size = "390,844" },
  @{ name = "cinematic-scene04-register-mobile-390.png"; url = "http://localhost:4173/#scene-register"; size = "390,844" },
  @{ name = "cinematic-scene05-payment-mobile-390.png"; url = "http://localhost:4173/#scene-payment"; size = "390,844" },
  @{ name = "cinematic-scene06-ticket-mobile-390.png"; url = "http://localhost:4173/#scene-ticket"; size = "390,844" },
  @{ name = "cinematic-scene07-organizer-mobile-390.png"; url = "http://localhost:4173/#scene-organizer"; size = "390,844" },
  @{ name = "cinematic-scene08-connected-mobile-390.png"; url = "http://localhost:4173/#scene-connected"; size = "390,844" },
  @{ name = "cinematic-scene09-final-mobile-390.png"; url = "http://localhost:4173/#scene-final"; size = "390,844" },
  @{ name = "cinematic-landing-mobile-360.png"; url = "http://localhost:4173/"; size = "360,780" },
  @{ name = "cinematic-landing-mobile-430.png"; url = "http://localhost:4173/"; size = "430,932" }
)

foreach ($s in $shots) {
  $localTarget = Join-Path $localDir $s.name
  Write-Host "Capturing $($s.name) at size $($s.size)..."
  Start-Process -FilePath $edge -ArgumentList @(
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--virtual-time-budget=3000",
    "--window-size=$($s.size)",
    "--screenshot=$localTarget",
    $s.url
  ) -Wait

  if (Test-Path $localTarget) {
    Copy-Item -Path $localTarget -Destination $artifactDir -Force
    Write-Host "  -> Saved and copied to artifact: $($s.name)"
  } else {
    Write-Warning "  -> Failed to capture $($s.name)"
  }
}
Write-Host "All screenshot processing completed."
