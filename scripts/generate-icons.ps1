# Original geometric UI icons; no font, network service or third-party asset required.
# Run with Windows PowerShell. Render at 4x resolution for smooth transparent PNGs.
Add-Type -AssemblyName System.Drawing
$outputDir = Join-Path $PSScriptRoot '../assets/icons'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
function Line([float[]]$coords) {
  $points = for ($i=0; $i -lt $coords.Length; $i+=2) { [System.Drawing.PointF]::new($coords[$i], $coords[$i+1]) }
  $script:g.DrawLines($script:pen, [System.Drawing.PointF[]]$points)
}
function Circle([float]$x,[float]$y,[float]$w,[float]$h) { $script:g.DrawEllipse($script:pen,$x,$y,$w,$h) }
function Draw-Icon($name,$color,$file) {
  $large = [System.Drawing.Bitmap]::new(324,324)
  $script:g = [System.Drawing.Graphics]::FromImage($large)
  $g.SmoothingMode = 'AntiAlias'
  $g.ScaleTransform(13.5,13.5)
  $script:pen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml($color),1.65)
  $pen.StartCap = 'Round'; $pen.EndCap = 'Round'; $pen.LineJoin = 'Round'
  switch ($name) {
    home { Line @(3,10,12,3,21,10); Line @(5,9,5,21,10,21,10,15,14,15,14,21,19,21,19,9) }
    trip { Line @(3,5,8,3,16,6,21,4,21,19,16,21,8,18,3,20,3,5); Line @(8,3,8,18); Line @(16,6,16,21) }
    diary { Line @(12,6,9,4,3,4,3,19,9,19,12,21,15,19,21,19,21,4,15,4,12,6,12,21); Line @(6,8,9,8); Line @(15,8,18,8); Line @(6,12,9,12); Line @(15,12,18,12) }
    profile { Circle 8 3 8 8; $g.DrawArc($pen,[single]4,[single]13,[single]16,[single]15,[single]180,[single]180); Line @(4,20.5,20,20.5) }
    edit { Line @(4,16,15,5,19,9,8,20,3,21,4,16,8,20); Line @(15,5,17,3,21,7,19,9) }
    calendar { Line @(4,5,20,5,20,21,4,21,4,5); Line @(8,3,8,7); Line @(16,3,16,7); Line @(4,10,20,10); Line @(8,14,10,14); Line @(14,14,16,14); Line @(8,17,10,17) }
    wallet { Line @(20,7,4,7,4,20,21,20,21,7); Line @(4,7,4,5,17,3,17,7); Line @(21,11,15,11,15,16,21,16); Circle 17 13 0.5 0.5 }
    bag { Line @(5,7,19,7,19,20,5,20,5,7); Line @(9,7,9,3,15,3,15,7); Line @(9,11,9,16); Line @(15,11,15,16); Line @(8,20,8,22); Line @(16,20,16,22) }
    food { Line @(4,3,4,9,10,9,10,3); Line @(7,3,7,21); Line @(19,21,19,3,16,6,16,12,19,12) }
    pin { Circle 9 6 6 6; $g.DrawArc($pen,[single]5,[single]2,[single]14,[single]14,[single]180,[single]180); Line @(5,9,6,13,12,22,18,13,19,9) }
    plus { Line @(12,5,12,19); Line @(5,12,19,12) }
    route { Circle 3 3 5 5; Circle 16 16 5 5; Line @(10,5.5,17,5.5,20,9,17,12,7,12,4,15,7,18.5,13,18.5) }
  }
  $small = [System.Drawing.Bitmap]::new(81,81)
  $resize = [System.Drawing.Graphics]::FromImage($small)
  $resize.InterpolationMode = 'HighQualityBicubic'
  $resize.DrawImage($large,0,0,81,81)
  $small.Save((Join-Path $outputDir ($file+'.png')),[System.Drawing.Imaging.ImageFormat]::Png)
  $resize.Dispose(); $small.Dispose(); $pen.Dispose(); $g.Dispose(); $large.Dispose()
}
foreach ($name in @('home','trip','diary','profile')) {
  Draw-Icon $name '#788496' $name
  Draw-Icon $name '#079D69' "$name-active"
}
foreach ($name in @('edit','calendar','wallet','bag','food','diary','pin','route')) {
  Draw-Icon $name '#079D69' "action-$name"
}
foreach ($name in @('plus','route','pin')) { Draw-Icon $name '#FFFFFF' "$name-white" }
