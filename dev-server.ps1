# Minimal static file server for local development.
#
#   powershell -ExecutionPolicy Bypass -File .\dev-server.ps1
#
# Then open http://localhost:5173. Ctrl+C to stop.
#
# It sends the same security headers as the live site (see _headers), so a
# Content Security Policy problem shows up here before it reaches production.
# Folders that are never deployed are refused, and no path can climb out of
# the project folder.

param(
  [string]$Root = $PSScriptRoot,
  [int]$Port = 5173
)

$Root = [System.IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try { $listener.Start() } catch {
  Write-Host "Could not start on port $Port. Something else may be using it."
  exit 1
}

Write-Host "Leoside Equity is serving from $Root"
Write-Host "Open http://localhost:$Port/  (Ctrl+C to stop)"

$types = @{
  ".html" = "text/html; charset=utf-8"; ".css" = "text/css; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"; ".mjs" = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"; ".webmanifest" = "application/manifest+json; charset=utf-8"
  ".svg" = "image/svg+xml"; ".png" = "image/png"; ".jpg" = "image/jpeg"; ".webp" = "image/webp"
  ".ico" = "image/x-icon"; ".woff2" = "font/woff2"; ".xml" = "application/xml; charset=utf-8"
  ".txt" = "text/plain; charset=utf-8"
}

$csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
       "font-src 'self'; connect-src 'self' https://karzpemgpmrlaaflghpk.supabase.co wss://karzpemgpmrlaaflghpk.supabase.co; " +
       "manifest-src 'self'; worker-src 'self'; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; " +
       "base-uri 'self'; form-action 'self'"

$blocked = '^(\.(?!well-known/)|_source|supabase|scripts|node_modules|dist|package|README|dev-server|netlify\.toml|vercel\.json|_headers)'

function Send($ctx, [int]$status, [byte[]]$bytes, [string]$ctype) {
  $r = $ctx.Response
  $r.StatusCode = $status
  $r.ContentType = $ctype
  $r.Headers.Add("Cache-Control", "no-store")
  $r.Headers.Add("Content-Security-Policy", $csp)
  $r.Headers.Add("X-Content-Type-Options", "nosniff")
  $r.Headers.Add("Referrer-Policy", "strict-origin-when-cross-origin")
  $r.Headers.Add("X-Frame-Options", "DENY")
  $r.Headers.Add("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()")
  $r.Headers.Add("Cross-Origin-Opener-Policy", "same-origin")
  # Compress text the way every real host does, so local audits are honest.
  $accept = $ctx.Request.Headers["Accept-Encoding"]
  if ($accept -and $accept.Contains("gzip") -and $ctype -match '^(text/|application/(json|javascript|manifest|xml)|image/svg)') {
    $ms = New-Object System.IO.MemoryStream
    $gz = New-Object System.IO.Compression.GZipStream($ms, [System.IO.Compression.CompressionLevel]::Optimal)
    $gz.Write($bytes, 0, $bytes.Length); $gz.Close()
    $bytes = $ms.ToArray()
    $r.Headers.Add("Content-Encoding", "gzip")
    $r.Headers.Add("Vary", "Accept-Encoding")
  }
  $r.ContentLength64 = $bytes.Length
  $r.OutputStream.Write($bytes, 0, $bytes.Length)
  $r.OutputStream.Close()
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "index.html" }
    $full = [System.IO.Path]::GetFullPath((Join-Path $Root ($rel -replace '/', '\')))
    if (Test-Path -LiteralPath $full -PathType Container) { $full = Join-Path $full "index.html" }

    $inside = $full.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)
    $isBlocked = $rel -match $blocked
    if ($inside -and -not $isBlocked -and (Test-Path -LiteralPath $full -PathType Leaf)) {
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $ctype = $types[$ext]; if (-not $ctype) { $ctype = "application/octet-stream" }
      Send $ctx 200 ([System.IO.File]::ReadAllBytes($full)) $ctype
    } else {
      $nf = Join-Path $Root "404.html"
      if (Test-Path -LiteralPath $nf) { Send $ctx 404 ([System.IO.File]::ReadAllBytes($nf)) "text/html; charset=utf-8" }
      else { Send $ctx 404 ([System.Text.Encoding]::UTF8.GetBytes("Not found")) "text/plain; charset=utf-8" }
    }
  } catch {
    Write-Host "error: $_"
  }
}
