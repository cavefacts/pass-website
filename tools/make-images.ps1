# Draws the site icon (favicon.ico, apple-touch-icon.png) and the link preview
# image (og-image.png) in the site's colours and type. Needs Windows with the
# Book Antiqua and Segoe UI Symbol fonts.
# Usage: powershell -ExecutionPolicy Bypass -File tools\make-images.ps1
param([string]$OutDir = (Split-Path -Parent $PSScriptRoot))

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$Dark   = '#2a2a2a' # nav bar
$Page   = '#474747' # page background
$Title  = '#d4d4d4' # title text
$Muted  = '#a6a6a6' # a little lighter than the site's #999, for small previews
$Accent = '#ff7722' # orange accent
$Serif  = 'Book Antiqua'

$Measure = [System.Drawing.Graphics]::FromImage((New-Object System.Drawing.Bitmap(1, 1)))

function Get-Brush([string]$hex) {
  New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($hex))
}

function New-Canvas([int]$w, [int]$h) {
  $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  return @{ Bitmap = $bmp; Graphics = $g }
}

# Text as a vector path with its baseline at y = 0, optionally letter-spaced.
function New-TextPath([string]$text, [string]$family, [System.Drawing.FontStyle]$style, [single]$emPx, [single]$tracking = 0) {
  $fam = New-Object System.Drawing.FontFamily($family)
  $ascent = $emPx * $fam.GetCellAscent($style) / $fam.GetEmHeight($style)
  $fmt = New-Object System.Drawing.StringFormat([System.Drawing.StringFormat]::GenericTypographic)
  $fmt.FormatFlags = $fmt.FormatFlags -bor [System.Drawing.StringFormatFlags]::MeasureTrailingSpaces
  $font = New-Object System.Drawing.Font($fam, $emPx, $style, [System.Drawing.GraphicsUnit]::Pixel)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $x = 0.0
  foreach ($ch in $text.ToCharArray()) {
    $s = [string]$ch
    $path.AddString($s, $fam, [int]$style, $emPx, (New-Object System.Drawing.PointF($x, -$ascent)), $fmt)
    $x += $Measure.MeasureString($s, $font, (New-Object System.Drawing.PointF(0, 0)), $fmt).Width + $tracking
  }
  return $path
}

# Orange serif P on the dark nav-bar grey; rounded corners for browser tabs,
# square for Apple devices (which round the corners themselves).
function New-Icon([int]$size, [bool]$rounded) {
  $c = New-Canvas $size $size
  if ($rounded) {
    $d = [single]($size * 0.4)
    $shape = New-Object System.Drawing.Drawing2D.GraphicsPath
    $shape.AddArc(0, 0, $d, $d, 180, 90)
    $shape.AddArc($size - $d, 0, $d, $d, 270, 90)
    $shape.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
    $shape.AddArc(0, $size - $d, $d, $d, 90, 90)
    $shape.CloseFigure()
    $c.Graphics.FillPath((Get-Brush $Dark), $shape)
  } else {
    $c.Graphics.FillRectangle((Get-Brush $Dark), 0, 0, $size, $size)
  }
  $p = New-TextPath 'P' $Serif 'Bold' 100
  $b = $p.GetBounds()
  # in the smallest size the P is larger and heavier, so it stays legible in a browser tab
  $small = $size -le 16
  $height = 0.7
  if ($small) { $height = 0.8 }
  $scale = ($size * $height) / $b.Height
  $m = New-Object System.Drawing.Drawing2D.Matrix
  $m.Translate(-($b.X + $b.Width / 2), -($b.Y + $b.Height / 2))
  $m.Scale($scale, $scale, [System.Drawing.Drawing2D.MatrixOrder]::Append)
  # nudged right: the P's bowl leaves its right side lighter than its left
  $m.Translate($size / 2 + $size * 0.03, $size / 2, [System.Drawing.Drawing2D.MatrixOrder]::Append)
  $p.Transform($m)
  $c.Graphics.FillPath((Get-Brush $Accent), $p)
  if ($small) {
    $pen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml($Accent), 0.6)
    $c.Graphics.DrawPath($pen, $p)
  }
  $c.Graphics.Dispose()
  return $c.Bitmap
}

function Get-PngBytes($bmp) {
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  return , $ms.ToArray()
}

# An .ico file holding PNG images, one per size.
function Write-Ico([string]$path, $frames, [int[]]$sizes) {
  $ms = New-Object System.IO.MemoryStream
  $w = New-Object System.IO.BinaryWriter($ms)
  $w.Write([UInt16]0); $w.Write([UInt16]1); $w.Write([UInt16]$frames.Count)
  $offset = 6 + 16 * $frames.Count
  for ($i = 0; $i -lt $frames.Count; $i++) {
    $w.Write([byte]$sizes[$i]); $w.Write([byte]$sizes[$i])
    $w.Write([byte]0); $w.Write([byte]0)
    $w.Write([UInt16]1); $w.Write([UInt16]32)
    $w.Write([UInt32]$frames[$i].Length); $w.Write([UInt32]$offset)
    $offset += $frames[$i].Length
  }
  foreach ($f in $frames) { $w.Write($f) }
  [System.IO.File]::WriteAllBytes($path, $ms.ToArray())
}

# Site icon
$sizes = 16, 32, 48
$frames = New-Object 'System.Collections.Generic.List[byte[]]'
foreach ($s in $sizes) {
  $bmp = New-Icon $s $true
  $frames.Add((Get-PngBytes $bmp))
  $bmp.Dispose()
}
Write-Ico (Join-Path $OutDir 'favicon.ico') $frames $sizes

$bmp = New-Icon 180 $false
$bmp.Save((Join-Path $OutDir 'apple-touch-icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

# Link preview image, laid out like the site's header
$W = 1200; $H = 630
$c = New-Canvas $W $H
$c.Graphics.Clear([System.Drawing.ColorTranslator]::FromHtml($Page))
$lines = @(
  @{ Path = (New-TextPath 'Pass' $Serif 'Bold' 230); Color = $Title; Gap = 44 },
  @{ Path = (New-TextPath 'A NOVEL' $Serif 'Regular' 36 12); Color = $Muted; Gap = 36 },
  @{ Path = (New-TextPath ([string][char]0x269C) 'Segoe UI Symbol' 'Regular' 58); Color = $Accent; Gap = 36 },
  @{ Path = (New-TextPath 'by Duncan Sabien' $Serif 'Italic' 44); Color = $Muted; Gap = 0 }
)
$total = 0
foreach ($l in $lines) { $total += $l.Path.GetBounds().Height + $l.Gap }
$y = ($H - $total) / 2
foreach ($l in $lines) {
  $b = $l.Path.GetBounds()
  $m = New-Object System.Drawing.Drawing2D.Matrix
  $m.Translate(($W - $b.Width) / 2 - $b.X, $y - $b.Y)
  $l.Path.Transform($m)
  $c.Graphics.FillPath((Get-Brush $l.Color), $l.Path)
  $y += $b.Height + $l.Gap
}
$c.Graphics.Dispose()
$c.Bitmap.Save((Join-Path $OutDir 'og-image.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$c.Bitmap.Dispose()

"Wrote favicon.ico, apple-touch-icon.png and og-image.png to $OutDir"
