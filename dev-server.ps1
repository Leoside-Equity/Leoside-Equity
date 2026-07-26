# Minimal static file server for local development.
#
#   powershell -ExecutionPolicy Bypass -File .\dev-server.ps1
#
# Then open http://localhost:5173 in a browser. Ctrl+C to stop.
#
# You need this rather than opening index.html directly because browsers block
# localStorage and some script behaviour on file:// URLs, which breaks sign in.

param(
  [string]$Root = $PSScriptRoot,
  [int]$Port = 5173
)

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try {
  $listener.Start()
} catch {
  Write-Host "Could not start on port $Port. Something else may be using it."
  exit 1
}

Write-Host "Leoside Equity is serving from $Root"
Write-Host "Open http://localhost:$Port/  (Ctrl+C to stop)"

$types = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".svg"  = "image/svg+xml"
  ".json" = "application/json; charset=utf-8"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".webp" = "image/webp"
  ".ico"  = "image/x-icon"
  ".woff2" = "font/woff2"
  ".txt"  = "text/plain; charset=utf-8"
  ".md"   = "text/plain; charset=utf-8"
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "index.html" }
    $path = Join-Path $Root ($rel -replace '/', '\')

    if (Test-Path -LiteralPath $path -PathType Container) { $path = Join-Path $path "index.html" }

    if (Test-Path -LiteralPath $path -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($path).ToLower()
      $ctype = $types[$ext]
      if (-not $ctype) { $ctype = "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($path)
      $ctx.Response.ContentType = $ctype
      $ctx.Response.Headers.Add("Cache-Control", "no-store")
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 not found: $rel")
      $ctx.Response.ContentType = "text/plain; charset=utf-8"
      $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
    }
    $ctx.Response.OutputStream.Close()
  } catch {
    Write-Host "error: $_"
  }
}
