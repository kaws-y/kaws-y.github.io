Add-Type -AssemblyName System.Drawing
$src = 'C:\Users\yys47699\AppData\Local\Temp\img.e340767cbb.png'
$bmp = New-Object System.Drawing.Bitmap($src)
Write-Output ("SIZE " + $bmp.Width + "x" + $bmp.Height + " " + $bmp.PixelFormat)
$pts = @(@(0,0), @(($bmp.Width-1),0), @(0,($bmp.Height-1)), @(5,5))
foreach ($p in $pts) {
    $c = $bmp.GetPixel($p[0], $p[1])
    Write-Output ("PIXEL ($($p[0]),$($p[1])) A=$($c.A) R=$($c.R) G=$($c.G) B=$($c.B)")
}
$trans = 0; $white = 0; $other = 0
for ($x = 0; $x -lt $bmp.Width; $x += 2) {
    for ($y = 0; $y -lt $bmp.Height; $y += 2) {
        $c = $bmp.GetPixel($x, $y)
        if ($c.A -lt 16) { $trans++ }
        elseif ($c.R -gt 245 -and $c.G -gt 245 -and $c.B -gt 245) { $white++ }
        else { $other++ }
    }
}
Write-Output ("COUNT transparent=$trans white=$white other=$other")
# Bounding box of non-white, non-transparent content
$minX = $bmp.Width; $maxX = -1; $minY = $bmp.Height; $maxY = -1
for ($x = 0; $x -lt $bmp.Width; $x++) {
    for ($y = 0; $y -lt $bmp.Height; $y++) {
        $c = $bmp.GetPixel($x, $y)
        if ($c.A -gt 16 -and -not ($c.R -gt 245 -and $c.G -gt 245 -and $c.B -gt 245)) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}
Write-Output ("BBOX " + $minX + "," + $minY + " - " + $maxX + "," + $maxY)
$bmp.Dispose()
