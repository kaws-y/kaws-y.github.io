Add-Type -AssemblyName System.Drawing

$root = 'f:/StoreHouse/kaws-y.github.io'
$srcPath = 'C:\Users\yys47699\AppData\Local\Temp\img.e340767cbb.png'

# Tight crop around the actual artwork, then downscale for nav-bar usage.
# nav mark box is ~26px tall; export at 2x-3x for HiDPI sharpness.
$cropX = 80; $cropY = 114; $cropW = 922; $cropH = 477
$outH = 96   # 2x-4x of the rendered size
$outW = [int][Math]::Round($outH * ($cropW / $cropH))

$src = [System.Drawing.Image]::FromFile($srcPath)
$cropRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)

$dst = New-Object System.Drawing.Bitmap($outW, $outH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($dst)
$g.Clear([System.Drawing.Color]::Transparent)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

$destRect = New-Object System.Drawing.Rectangle(0, 0, $outW, $outH)
$g.DrawImage($src, $destRect, $cropRect, [System.Drawing.GraphicsUnit]::Pixel)

$g.Dispose()
$outPath = Join-Path $root 'img/logo-mark.png'
$dst.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$dst.Dispose()
$src.Dispose()
Write-Output ("GEN " + $outPath + " " + $outW + "x" + $outH)
