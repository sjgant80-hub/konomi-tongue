# tools/render.ps1 — draw the picture channel's images (glue, Windows GDI+). Reads a JSON list of jobs and writes PNGs.
#   glyphs  a grid of characters, one per square cell, centred, black on white
#   dots    a grid of square dots (1 = black, 0 = white); every `group` dots a wider gap, so 3×3 cells (and cells of
#           cells) read as blocks — the nesting
#   text    a string wrapped to a width, for the combined channel
# Usage: powershell -File tools/render.ps1 <jobs.json>
param([string]$Jobs)
Add-Type -AssemblyName System.Drawing
$list = Get-Content -Raw -Encoding UTF8 $Jobs | ConvertFrom-Json
foreach ($j in $list) {
  if ($j.kind -eq 'glyphs') {
    $w = [int]($j.cols * $j.cell + 2 * $j.pad); $h = [int]($j.rows * $j.cell + 2 * $j.pad)
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::White)
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $font = New-Object System.Drawing.Font($j.font, [single]($j.cell * $j.scale), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = [System.Drawing.StringAlignment]::Center; $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
    for ($k = 0; $k -lt $j.glyphs.Count; $k++) {
      $r = [math]::Floor($k / $j.cols); $c = $k % $j.cols
      $rect = New-Object System.Drawing.RectangleF ([single]($j.pad + $c * $j.cell)), ([single]($j.pad + $r * $j.cell)), ([single]$j.cell), ([single]$j.cell)
      $g.DrawString([string]$j.glyphs[$k], $font, [System.Drawing.Brushes]::Black, $rect, $fmt)
    }
  } elseif ($j.kind -eq 'dots') {
    $n = $j.cols; $rows = [math]::Ceiling($j.bits.Count / $n)
    $step = $j.dot + $j.gap
    # nested gaps: a gap after every `group` dots, another after every group², and so on — cells of cells
    $gapAt = { param($i) $e = 0; $lv = $j.group; while ($lv -le $i) { $e += [math]::Floor($i / $lv) * $j.groupGap; $lv *= $j.group }; $e }
    $w = [int]($n * $step + (& $gapAt ($n - 1)) + 2 * $j.pad); $h = [int]($rows * $step + (& $gapAt ($rows - 1)) + 2 * $j.pad)
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::White)
    for ($k = 0; $k -lt $j.bits.Count; $k++) {
      $r = [math]::Floor($k / $n); $c = $k % $n
      $x = [int]($j.pad + $c * $step + (& $gapAt $c))
      $y = [int]($j.pad + $r * $step + (& $gapAt $r))
      if ($j.bits[$k] -eq 1) { $g.FillRectangle([System.Drawing.Brushes]::Black, $x, $y, $j.dot, $j.dot) }
      else { $g.DrawRectangle([System.Drawing.Pens]::LightGray, $x, $y, $j.dot - 1, $j.dot - 1) }
    }
  } else {
    $font = New-Object System.Drawing.Font($j.font, [single]$j.size, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $probe = New-Object System.Drawing.Bitmap 1, 1
    $pg = [System.Drawing.Graphics]::FromImage($probe)
    $sz = $pg.MeasureString([string]$j.text, $font, [int]$j.width)
    $w = [int]$j.width + 2 * $j.pad; $h = [int][math]::Ceiling($sz.Height) + 2 * $j.pad
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::White)
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $rect = New-Object System.Drawing.RectangleF ([single]$j.pad), ([single]$j.pad), ([single]$j.width), ([single]($h - 2 * $j.pad))
    $g.DrawString([string]$j.text, $font, [System.Drawing.Brushes]::Black, $rect)
  }
  $bmp.Save($j.out, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
Write-Output ("rendered " + $list.Count)
