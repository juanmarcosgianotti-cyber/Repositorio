// Funciones de cálculo puras. Sin dependencias del DOM para poder testearlas con Node.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Calc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Valores que cambian con el tiempo. Revisar y actualizar periódicamente.
  const CONFIG = {
    // Tope máximo de la base imponible de aportes (ANSES, se actualiza por IPC).
    topeBaseImponible: 4594798.23,
    topeBaseImponibleVigencia: 'agosto 2026',
    actualizado: '2026-10-27',
  };

  const APORTES = { jubilacion: 0.11, obraSocial: 0.03, pami: 0.03 };
  const DIA_MS = 86400000;

  // ---------- Utilidades ----------

  // Acepta "1.500.000,50", "1500000.50", "$ 1.500" y similares (formato argentino primero).
  function parseNumero(valor) {
    if (typeof valor === 'number') return valor;
    if (valor == null) return NaN;
    let s = String(valor).replace(/[\s$%]/g, '');
    if (s === '') return NaN;
    if (s.includes(',')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      const puntos = (s.match(/\./g) || []).length;
      if (puntos > 1 || /^\-?\d{1,3}\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
    }
    return /^-?\d*\.?\d+$/.test(s) ? Number(s) : NaN;
  }

  function redondear(n) {
    return Math.round(n * 100) / 100;
  }

  // Fechas como 'YYYY-MM-DD' interpretadas en UTC para evitar problemas de zona horaria.
  function fecha(valor) {
    if (valor instanceof Date) return new Date(Date.UTC(valor.getUTCFullYear(), valor.getUTCMonth(), valor.getUTCDate()));
    const [y, m, d] = String(valor).split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }

  function sumarMeses(f, meses) {
    const y = f.getUTCFullYear();
    const m = f.getUTCMonth() + meses;
    const ultimo = diasDelMes(y + Math.floor(m / 12), ((m % 12) + 12) % 12);
    return new Date(Date.UTC(y, m, Math.min(f.getUTCDate(), ultimo)));
  }

  function diasDelMes(anio, mes0) {
    return new Date(Date.UTC(anio, mes0 + 1, 0)).getUTCDate();
  }

  function diasEntre(desde, hasta) {
    return Math.round((hasta - desde) / DIA_MS);
  }

  function esBisiesto(anio) {
    return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
  }

  function diasSemestre(anio, semestre) {
    return semestre === 1 ? (esBisiesto(anio) ? 182 : 181) : 184;
  }

  // Años completos de servicio entre dos fechas.
  function aniosCompletos(ingreso, egreso) {
    let anios = egreso.getUTCFullYear() - ingreso.getUTCFullYear();
    if (sumarMeses(ingreso, anios * 12) > egreso) anios--;
    return Math.max(0, anios);
  }

  // ---------- Sueldo neto ----------

  function sueldoNeto({ bruto, tope = CONFIG.topeBaseImponible, sindicatoPct = 0 }) {
    const base = tope > 0 ? Math.min(bruto, tope) : bruto;
    const jubilacion = base * APORTES.jubilacion;
    const obraSocial = base * APORTES.obraSocial;
    const pami = base * APORTES.pami;
    const sindicato = bruto * (sindicatoPct / 100);
    const descuentos = jubilacion + obraSocial + pami + sindicato;
    return {
      base: redondear(base),
      jubilacion: redondear(jubilacion),
      obraSocial: redondear(obraSocial),
      pami: redondear(pami),
      sindicato: redondear(sindicato),
      descuentos: redondear(descuentos),
      neto: redondear(bruto - descuentos),
      topeAplicado: tope > 0 && bruto > tope,
    };
  }

  // ---------- Aguinaldo (SAC) ----------

  function aguinaldo({ mejorSueldo, diasTrabajados, anio, semestre }) {
    const total = diasSemestre(anio, semestre);
    const dias = Math.min(Math.max(diasTrabajados ?? total, 0), total);
    const bruto = (mejorSueldo / 2) * (dias / total);
    return { diasSemestre: total, dias, bruto: redondear(bruto) };
  }

  // ---------- Vacaciones (LCT arts. 150 y 155) ----------

  function diasVacaciones(antiguedadAnios) {
    if (antiguedadAnios < 5) return 14;
    if (antiguedadAnios <= 10) return 21;
    if (antiguedadAnios <= 20) return 28;
    return 35;
  }

  function vacaciones({ sueldo, antiguedadAnios }) {
    const dias = diasVacaciones(antiguedadAnios);
    const valorDia = sueldo / 25;
    const total = valorDia * dias;
    // Lo que se hubiese cobrado como sueldo normal por esos mismos días.
    const sueldoEquivalente = (sueldo / 30) * dias;
    return {
      dias,
      valorDia: redondear(valorDia),
      total: redondear(total),
      plus: redondear(total - sueldoEquivalente),
    };
  }

  // ---------- Indemnización por despido sin causa ----------

  function indemnizacion({
    ingreso,
    egreso,
    sueldo,
    tope = 0,
    periodoPruebaMeses = 6,
    preavisoOtorgado = false,
    incluirVacaciones = true,
  }) {
    const fi = fecha(ingreso);
    const fe = fecha(egreso);
    if (!(fe > fi)) throw new Error('La fecha de egreso debe ser posterior a la de ingreso.');

    const enPrueba = fe < sumarMeses(fi, periodoPruebaMeses);
    const anios = aniosCompletos(fi, fe);
    // Fracción mayor a tres meses cuenta como año completo.
    const fraccion = sumarMeses(fi, anios * 12 + 3) < fe ? 1 : 0;
    const aniosIndemnizables = enPrueba ? 0 : Math.max(1, anios + fraccion);

    // Si hay tope de convenio, la base no puede quedar por debajo del 67% del sueldo real (fallo Vizzoti).
    let base = sueldo;
    if (tope > 0 && sueldo > tope) base = Math.max(tope, sueldo * 0.67);

    const items = [];
    const add = (concepto, monto, tipo) => items.push({ concepto, monto: redondear(monto), tipo });

    add(`Indemnización por antigüedad (${aniosIndemnizables} ${aniosIndemnizables === 1 ? 'año' : 'años'})`, base * aniosIndemnizables, 'indemnizatorio');

    const mesesPreaviso = enPrueba ? 0 : fe > sumarMeses(fi, 60) ? 2 : 1;
    if (!preavisoOtorgado && mesesPreaviso > 0) {
      const preaviso = sueldo * mesesPreaviso;
      add(`Preaviso omitido (${mesesPreaviso} ${mesesPreaviso === 1 ? 'mes' : 'meses'})`, preaviso, 'indemnizatorio');
      add('SAC sobre preaviso', preaviso / 12, 'indemnizatorio');
    }

    const anio = fe.getUTCFullYear();
    const mes = fe.getUTCMonth();
    const dia = fe.getUTCDate();
    const diasMes = diasDelMes(anio, mes);
    const restantes = diasMes - dia;
    if (!enPrueba && !preavisoOtorgado && restantes > 0) {
      const integracion = (sueldo / diasMes) * restantes;
      add(`Integración mes de despido (${restantes} días)`, integracion, 'indemnizatorio');
      add('SAC sobre integración', integracion / 12, 'indemnizatorio');
    }

    add(`Días trabajados del mes (${dia})`, (sueldo / diasMes) * dia, 'remunerativo');

    const semestre = mes < 6 ? 1 : 2;
    const inicioSemestre = fecha(`${anio}-${semestre === 1 ? '01' : '07'}-01`);
    const desdeSac = fi > inicioSemestre ? fi : inicioSemestre;
    const diasSac = diasEntre(desdeSac, fe) + 1;
    const totalSemestre = diasSemestre(anio, semestre);
    add(`SAC proporcional (${diasSac} días del semestre)`, (sueldo / 2) * (diasSac / totalSemestre), 'remunerativo');

    if (incluirVacaciones) {
      const inicioAnio = fecha(`${anio}-01-01`);
      const desdeVac = fi > inicioAnio ? fi : inicioAnio;
      const diasAnio = diasEntre(desdeVac, fe) + 1;
      const antiguedadFinDeAnio = aniosCompletos(fi, fecha(`${anio}-12-31`));
      const diasVac = diasVacaciones(antiguedadFinDeAnio) * (diasAnio / (esBisiesto(anio) ? 366 : 365));
      const vac = (sueldo / 25) * diasVac;
      add(`Vacaciones no gozadas (${diasVac.toFixed(1).replace('.', ',')} días)`, vac, 'remunerativo');
      add('SAC sobre vacaciones no gozadas', vac / 12, 'remunerativo');
    }

    const total = items.reduce((s, i) => s + i.monto, 0);
    return {
      enPrueba,
      anios,
      aniosIndemnizables,
      base: redondear(base),
      mesesPreaviso,
      items,
      total: redondear(total),
    };
  }

  // ---------- Plazo fijo ----------

  function plazoFijo({ capital, tna, dias, inflacionMensual = null }) {
    const tasaPeriodo = (tna / 100) * (dias / 365);
    const interes = capital * tasaPeriodo;
    const tea = Math.pow(1 + tasaPeriodo, 365 / dias) - 1;
    const tem = Math.pow(1 + tea, 1 / 12) - 1;
    let rendimientoReal = null;
    if (inflacionMensual != null && !Number.isNaN(inflacionMensual)) {
      const inflacionPeriodo = Math.pow(1 + inflacionMensual / 100, dias / 30) - 1;
      rendimientoReal = (1 + tasaPeriodo) / (1 + inflacionPeriodo) - 1;
    }
    return {
      interes: redondear(interes),
      total: redondear(capital + interes),
      tea: tea * 100,
      tem: tem * 100,
      rendimientoReal: rendimientoReal == null ? null : rendimientoReal * 100,
    };
  }

  // ---------- Cuotas vs contado ----------

  function valorPresenteCuotas(cuota, n, tasa) {
    let vp = 0;
    for (let k = 1; k <= n; k++) vp += cuota / Math.pow(1 + tasa, k);
    return vp;
  }

  // Tasa mensual implícita que iguala el precio de contado con las cuotas (bisección).
  function tasaImplicita(contado, cuota, n) {
    if (cuota * n <= contado) return cuota * n === contado ? 0 : null;
    let lo = 0;
    let hi = 10;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (valorPresenteCuotas(cuota, n, mid) > contado) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }

  function cuotasVsContado({ contado, cuotas, montoCuota, tasaMensual }) {
    const totalCuotas = montoCuota * cuotas;
    const vp = valorPresenteCuotas(montoCuota, cuotas, tasaMensual / 100);
    const implicita = tasaImplicita(contado, montoCuota, cuotas);
    return {
      totalCuotas: redondear(totalCuotas),
      recargoPct: (totalCuotas / contado - 1) * 100,
      valorPresente: redondear(vp),
      diferencia: redondear(contado - vp),
      conviene: vp < contado ? 'cuotas' : vp > contado ? 'contado' : 'igual',
      tasaImplicitaMensual: implicita == null ? null : implicita * 100,
    };
  }

  // ---------- IVA ----------

  function iva({ monto, alicuota, modo }) {
    const a = alicuota / 100;
    const neto = modo === 'quitar' ? monto / (1 + a) : monto;
    const impuesto = neto * a;
    return { neto: redondear(neto), iva: redondear(impuesto), total: redondear(neto + impuesto) };
  }

  return {
    CONFIG,
    APORTES,
    parseNumero,
    diasSemestre,
    diasVacaciones,
    sueldoNeto,
    aguinaldo,
    vacaciones,
    indemnizacion,
    plazoFijo,
    cuotasVsContado,
    iva,
  };
});
