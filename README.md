# Calculá Fácil

Sitio estático de calculadoras laborales y financieras para Argentina: sueldo neto, aguinaldo, vacaciones, indemnización, plazo fijo, cuotas o contado e IVA. Se monetiza con anuncios y donaciones.

HTML, CSS y JavaScript sin dependencias ni paso de build. Se publica gratis con GitHub Pages.

## Estructura

| Ruta | Qué es |
|---|---|
| `assets/calc.js` | Todas las fórmulas (funciones puras) y los valores que cambian (`CONFIG`). |
| `assets/site.js` | Cabecera, pie, anuncios, donaciones y helpers de formularios. Configuración en `SITE`. |
| `herramientas/*.html` | Una página por calculadora, con explicación y FAQ para SEO. |
| `tests/` | Tests de las fórmulas: `npm test` (Node 18+). |
| `scripts/set-domain.sh` | Cambia la URL base cuando haya dominio propio. |

## Lo que tiene que hacer el dueño (una sola vez)

1. **Publicar el sitio**: en GitHub, abrí *Settings → Pages → Build and deployment*, elegí *Deploy from a branch*, la rama `main` (o la rama de trabajo) y la carpeta `/ (root)`. Quedará en `https://juanmarcosgianotti-cyber.github.io/Repositorio/`.
2. **Google Search Console**: agregá la propiedad, verificala y enviá `sitemap.xml`. Sin esto, Google tarda mucho más en indexar.
3. **Dominio propio** (recomendado y necesario para AdSense): registrá un `.com.ar` en NIC Argentina, apuntalo a GitHub Pages y ejecutá `scripts/set-domain.sh https://www.tudominio.com.ar/`.
4. **Donaciones**: creá una cuenta en Cafecito (o similar) y pegá el link en `SITE.donacionUrl` de `assets/site.js`.
5. **AdSense**: cuando el sitio tenga tráfico y dominio propio, solicitá AdSense y pegá tu `ca-pub-...` en `SITE.adsenseClient`.
6. **Difusión inicial**: compartí las calculadoras en 2 o 3 lugares donde esté el público (grupos de trabajadores, foros, Reddit r/merval o r/argentina cuando sea pertinente).

## Mantenimiento

- `CONFIG.topeBaseImponible` cambia todos los meses (ANSES, por IPC). Actualizalo junto con `topeBaseImponibleVigencia` y `actualizado`.
- La reforma laboral (Ley 27.802) tiene artículos que fueron cuestionados judicialmente. Revisar novedades antes de cada actualización de la página de indemnización.
- Antes de publicar cambios: `npm test`.
