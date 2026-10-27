#!/usr/bin/env bash
# Cambia la URL base del sitio (canonical, sitemap y robots) cuando tengas dominio propio.
# Uso: scripts/set-domain.sh https://www.tudominio.com.ar/
set -euo pipefail
NUEVA="${1:?Indicá la nueva URL base, terminada en /}"
ACTUAL=$(grep -o 'https://[^<]*' robots.txt | sed 's/sitemap\.xml$//')
grep -rl --include='*.html' --include='*.xml' --include='*.txt' "$ACTUAL" . | xargs sed -i "s#${ACTUAL}#${NUEVA}#g"
# GitHub Pages usa el archivo CNAME para servir el dominio propio.
echo "$NUEVA" | sed -E 's#https?://##; s#/.*##' > CNAME
echo "Listo: $ACTUAL -> $NUEVA (CNAME creado)"
