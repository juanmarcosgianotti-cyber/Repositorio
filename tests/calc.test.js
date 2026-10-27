const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../assets/calc.js');

const cerca = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);
const item = (r, prefijo) => r.items.find((i) => i.concepto.startsWith(prefijo));

test('parseNumero entiende formato argentino', () => {
  assert.equal(C.parseNumero('1.500.000,50'), 1500000.5);
  assert.equal(C.parseNumero('1.500'), 1500);
  assert.equal(C.parseNumero('1500.5'), 1500.5);
  assert.equal(C.parseNumero('$ 2.000'), 2000);
  assert.equal(C.parseNumero('35,5%'), 35.5);
  assert.ok(Number.isNaN(C.parseNumero('')));
  assert.ok(Number.isNaN(C.parseNumero('abc')));
});

test('sueldo neto descuenta 17% bajo el tope', () => {
  const r = C.sueldoNeto({ bruto: 1000000, tope: 5000000 });
  assert.equal(r.descuentos, 170000);
  assert.equal(r.neto, 830000);
  assert.equal(r.topeAplicado, false);
});

test('sueldo neto respeta el tope de la base imponible', () => {
  const r = C.sueldoNeto({ bruto: 10000000, tope: 4000000 });
  assert.equal(r.descuentos, 680000);
  assert.equal(r.topeAplicado, true);
});

test('sueldo neto con aporte sindical', () => {
  const r = C.sueldoNeto({ bruto: 1000000, tope: 0, sindicatoPct: 2 });
  assert.equal(r.neto, 810000);
});

test('aguinaldo completo y proporcional', () => {
  assert.equal(C.aguinaldo({ mejorSueldo: 1000000, anio: 2026, semestre: 2 }).bruto, 500000);
  const p = C.aguinaldo({ mejorSueldo: 1000000, diasTrabajados: 92, anio: 2026, semestre: 2 });
  assert.equal(p.bruto, 250000);
  assert.equal(C.diasSemestre(2028, 1), 182);
});

test('días de vacaciones según antigüedad', () => {
  assert.equal(C.diasVacaciones(0), 14);
  assert.equal(C.diasVacaciones(4), 14);
  assert.equal(C.diasVacaciones(5), 21);
  assert.equal(C.diasVacaciones(10), 21);
  assert.equal(C.diasVacaciones(11), 28);
  assert.equal(C.diasVacaciones(21), 35);
});

test('vacaciones: valor por día es sueldo/25', () => {
  const r = C.vacaciones({ sueldo: 1000000, antiguedadAnios: 2 });
  assert.equal(r.total, 560000);
  cerca(r.plus, 560000 - (1000000 / 30) * 14);
});

test('indemnización: 3 años y 4 meses cuenta 4 años, preaviso 1 mes', () => {
  const r = C.indemnizacion({ ingreso: '2023-06-01', egreso: '2026-10-15', sueldo: 1000000 });
  assert.equal(r.enPrueba, false);
  assert.equal(r.aniosIndemnizables, 4);
  assert.equal(r.mesesPreaviso, 1);
  assert.equal(item(r, 'Indemnización').monto, 4000000);
  assert.equal(item(r, 'Preaviso').monto, 1000000);
  cerca(item(r, 'Integración').monto, (1000000 / 31) * 16);
  cerca(item(r, 'Días trabajados').monto, (1000000 / 31) * 15);
});

test('indemnización: fracción de exactamente 3 meses no suma año', () => {
  const r = C.indemnizacion({ ingreso: '2023-07-15', egreso: '2026-10-15', sueldo: 1000000 });
  assert.equal(r.aniosIndemnizables, 3);
});

test('indemnización: más de 5 años da 2 meses de preaviso', () => {
  const r = C.indemnizacion({ ingreso: '2020-01-01', egreso: '2026-10-31', sueldo: 1000000 });
  assert.equal(r.mesesPreaviso, 2);
  assert.equal(item(r, 'Integración'), undefined);
});

test('indemnización: en período de prueba no hay indemnización ni preaviso', () => {
  const r = C.indemnizacion({ ingreso: '2026-06-01', egreso: '2026-10-15', sueldo: 1000000 });
  assert.equal(r.enPrueba, true);
  assert.equal(item(r, 'Indemnización').monto, 0);
  assert.equal(item(r, 'Preaviso'), undefined);
  assert.equal(item(r, 'Integración'), undefined);
});

test('indemnización: tope de convenio con piso del 67% (Vizzoti)', () => {
  const r = C.indemnizacion({ ingreso: '2020-01-01', egreso: '2026-10-31', sueldo: 3000000, tope: 1000000 });
  assert.equal(r.base, 2010000);
});

test('indemnización: rechaza fechas invertidas', () => {
  assert.throws(() => C.indemnizacion({ ingreso: '2026-01-01', egreso: '2025-01-01', sueldo: 1 }));
});

test('plazo fijo 30 días', () => {
  const r = C.plazoFijo({ capital: 1000000, tna: 36.5, dias: 30 });
  assert.equal(r.interes, 30000);
  assert.equal(r.total, 1030000);
  const real = C.plazoFijo({ capital: 1000000, tna: 36.5, dias: 30, inflacionMensual: 3 });
  cerca(real.rendimientoReal, 0, 1e-9);
});

test('cuotas vs contado', () => {
  const sinInteres = C.cuotasVsContado({ contado: 120000, cuotas: 12, montoCuota: 10000, tasaMensual: 3 });
  assert.equal(sinInteres.conviene, 'cuotas');
  assert.equal(sinInteres.tasaImplicitaMensual, 0);
  const caro = C.cuotasVsContado({ contado: 100000, cuotas: 6, montoCuota: 25000, tasaMensual: 2 });
  assert.equal(caro.conviene, 'contado');
  assert.ok(caro.tasaImplicitaMensual > 10);
});

test('IVA agregar y quitar', () => {
  assert.deepEqual(C.iva({ monto: 1000, alicuota: 21, modo: 'agregar' }), { neto: 1000, iva: 210, total: 1210 });
  assert.deepEqual(C.iva({ monto: 1210, alicuota: 21, modo: 'quitar' }), { neto: 1000, iva: 210, total: 1210 });
});
