// Interfaz común: cabecera, pie, anuncios y utilidades para los formularios.
(function () {
  'use strict';

  // Completar cuando estén aprobadas las cuentas. Mientras estén vacíos no se carga nada externo.
  const SITE = {
    nombre: 'Calculá Fácil',
    adsenseClient: '', // ej.: 'ca-pub-1234567890123456'
    donacionUrl: '', // ej.: 'https://cafecito.app/tu-usuario'
  };

  const script = document.currentScript;
  const raiz = script.src.replace(/assets\/site\.js.*$/, '');

  const HERRAMIENTAS = [
    ['herramientas/sueldo-neto.html', 'Sueldo neto'],
    ['herramientas/aguinaldo.html', 'Aguinaldo'],
    ['herramientas/vacaciones.html', 'Vacaciones'],
    ['herramientas/indemnizacion.html', 'Indemnización'],
    ['herramientas/plazo-fijo.html', 'Plazo fijo'],
    ['herramientas/cuotas-o-contado.html', 'Cuotas o contado'],
    ['herramientas/iva.html', 'IVA'],
  ];

  function montarLayout() {
    const header = document.createElement('header');
    header.className = 'site-header';
    header.innerHTML =
      `<a class="logo" href="${raiz}index.html">${SITE.nombre}</a>` +
      '<nav>' + HERRAMIENTAS.map(([href, t]) => `<a href="${raiz}${href}">${t}</a>`).join('') + '</nav>';
    document.body.prepend(header);

    const footer = document.createElement('footer');
    footer.className = 'site-footer';
    footer.innerHTML =
      (SITE.donacionUrl ? `<p><a class="btn-donar" href="${SITE.donacionUrl}" rel="noopener" target="_blank">¿Te sirvió? Invitame un cafecito</a></p>` : '') +
      '<p>Los resultados son estimaciones orientativas y no reemplazan el asesoramiento de un contador o abogado.</p>' +
      `<p><a href="${raiz}acerca.html">Acerca de</a> · <a href="${raiz}privacidad.html">Privacidad</a></p>`;
    document.body.append(footer);

    if (SITE.adsenseClient) {
      const ads = document.createElement('script');
      ads.async = true;
      ads.crossOrigin = 'anonymous';
      ads.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${SITE.adsenseClient}`;
      document.head.append(ads);
    }
  }

  const formatoPesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
  const formatoNumero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

  const UI = {
    pesos: (n) => formatoPesos.format(n),
    pct: (n) => `${formatoNumero.format(n)}%`,
    num: (n) => formatoNumero.format(n),
    valor(id) {
      return Calc.parseNumero(document.getElementById(id).value);
    },
    // Tabla de resultados: filas [etiqueta, valor, destacado?].
    mostrar(contenedor, filas, nota) {
      const el = typeof contenedor === 'string' ? document.getElementById(contenedor) : contenedor;
      el.innerHTML =
        '<table class="resultado">' +
        filas.map(([k, v, d]) => `<tr${d ? ' class="total"' : ''}><th scope="row">${k}</th><td>${v}</td></tr>`).join('') +
        '</table>' +
        (nota ? `<p class="nota">${nota}</p>` : '');
    },
    error(contenedor, mensaje) {
      document.getElementById(contenedor).innerHTML = `<p class="error">${mensaje}</p>`;
    },
    // Recalcula al escribir y al enviar el formulario.
    vincular(formId, calcular) {
      const form = document.getElementById(formId);
      const correr = () => {
        try {
          calcular();
        } catch (e) {
          UI.error(form.dataset.resultado, e.message);
        }
      };
      form.addEventListener('input', correr);
      form.addEventListener('change', correr);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        correr();
      });
      correr();
    },
  };

  window.UI = UI;
  window.SITE = SITE;
  document.addEventListener('DOMContentLoaded', montarLayout);
})();
