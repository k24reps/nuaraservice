#!/usr/bin/env bash
# Buat ulang ikon Nuara Dashboard dari logo landing page (../assets/logo.jpg).
# Butuh ImageMagick (`convert`). Jalankan dari folder dashboard/.
# Potongan 420x420+430+344 = monogram "N" tanpa wordmark, latar navy logo.
set -euo pipefail
LOGO=../assets/logo.jpg
OUT=public
BG='#062036'
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
convert "$LOGO" -crop 420x420+430+344 +repage "$TMP/mark.png"
convert "$TMP/mark.png" -resize 256x256 "$OUT/logo-mark.png"
convert "$TMP/mark.png" -resize 64x64 "$OUT/favicon.png"
convert "$TMP/mark.png" -resize 180x180 "$OUT/apple-touch-icon.png"
convert "$TMP/mark.png" -resize 192x192 "$OUT/icon-192.png"
convert "$TMP/mark.png" -resize 512x512 "$OUT/icon-512.png"
# Maskable: monogram di dalam zona aman 80%, sisanya latar navy.
for s in 192 512; do
  convert "$TMP/mark.png" -resize 300x300 -background "$BG" -gravity center \
    -extent 420x420 -resize "${s}x${s}" "$OUT/icon-maskable-$s.png"
done
echo "Ikon ditulis ke $OUT/"
