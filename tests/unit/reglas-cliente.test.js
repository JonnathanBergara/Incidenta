/**
 * Pruebas unitarias — reglas de negocio del cliente (public/js/model/reglas.mjs)
 * Funciones puras: no necesitan navegador ni servidor.
 */
process.env.TZ = 'America/Guayaquil';      // la zona del usuario; el defecto de fecha dependía de ella

const { describe, test, beforeAll } = require('@jest/globals');
const assert = require('node:assert/strict');

let R;
beforeAll(async () => { R = await import('../../public/js/model/reglas.mjs'); });

const INC = [
  { id: 1, title: 'Caída del correo', category: 'Infraestructura', priority: 'Alta', status: 'Abierto' },
  { id: 2, title: 'Fallo de inicio de sesión', category: 'Acceso', priority: 'Alta', status: 'Resuelto' },
  { id: 3, title: 'Certificado SSL', category: 'Seguridad', priority: 'Media', status: 'En progreso' },
  { id: 4, title: 'Reportes lentos', category: 'Aplicación', priority: 'Baja', status: 'Abierto' }
];

describe('Permisos por rol', () => {
  test('lector solo consulta', () => {
    for (const a of ['crear', 'actualizar', 'eliminar']) assert.equal(R.puede('lector', a), false);
  });
  test('analista crea y actualiza, pero no elimina', () => {
    assert.equal(R.puede('analista', 'crear'), true);
    assert.equal(R.puede('analista', 'actualizar'), true);
    assert.equal(R.puede('analista', 'eliminar'), false);
  });
  test('admin puede todo', () => {
    for (const a of ['crear', 'actualizar', 'eliminar']) assert.equal(R.puede('admin', a), true);
  });
  test('rol desconocido, vacío o con nombre de propiedad heredada no tiene permisos', () => {
    for (const rol of ['root', '', undefined, 'constructor', '__proto__', 'toString']) assert.equal(R.puede(rol, 'crear'), false);
  });
  test('acción desconocida se deniega', () => assert.equal(R.puede('admin', 'exportar'), false));
});

describe('Estadísticas', () => {
  test('total, requieren atención, alta prioridad vigente y resueltos', () => {
    assert.deepEqual(R.calcularEstadisticas(INC), { total: 4, abiertos: 3, criticos: 1, resueltos: 1 });
  });
  test('un incidente de prioridad Alta ya resuelto no cuenta como crítico', () => {
    assert.equal(R.calcularEstadisticas([INC[1]]).criticos, 0);
  });
  test('lista vacía → ceros', () => {
    assert.deepEqual(R.calcularEstadisticas([]), { total: 0, abiertos: 0, criticos: 0, resueltos: 0 });
  });
});

describe('Filtrado', () => {
  test('sin filtros devuelve todo', () => assert.equal(R.filtrarIncidentes(INC).length, 4));
  test('la búsqueda ignora mayúsculas y espacios, y mira título y categoría', () => {
    assert.deepEqual(R.filtrarIncidentes(INC, { busqueda: '  CORREO ' }).map((i) => i.id), [1]);
    assert.deepEqual(R.filtrarIncidentes(INC, { busqueda: 'seguridad' }).map((i) => i.id), [3]);
  });
  test('filtra por estado y por prioridad, y combina ambos', () => {
    assert.deepEqual(R.filtrarIncidentes(INC, { estado: 'Abierto' }).map((i) => i.id), [1, 4]);
    assert.deepEqual(R.filtrarIncidentes(INC, { prioridad: 'Alta' }).map((i) => i.id), [1, 2]);
    assert.deepEqual(R.filtrarIncidentes(INC, { estado: 'Abierto', prioridad: 'Alta' }).map((i) => i.id), [1]);
  });
  test('sin coincidencias → lista vacía', () => assert.deepEqual(R.filtrarIncidentes(INC, { busqueda: 'zzz' }), []));
  test('textoResultados usa singular y plural', () => {
    assert.equal(R.textoResultados(1), '1 resultado');
    assert.equal(R.textoResultados(0), '0 resultados');
    assert.equal(R.textoResultados(7), '7 resultados');
  });
});

describe('Fechas (defecto de zona horaria)', () => {
  // 20:30 en Guayaquil (UTC-5) del 16/10/2026 = 01:30 UTC del 17/10/2026
  const tarde = new Date('2026-10-17T01:30:00Z');

  test('fechaLocalISO mantiene el día local correcto al cruzar medianoche UTC', () => {
    assert.equal(R.fechaLocalISO(tarde), '2026-10-16');
  });
  test('fechaLocalISO rellena con ceros', () => assert.equal(R.fechaLocalISO(new Date(2026, 0, 5, 9)), '2026-01-05'));
  test('encabezadoFecha refleja la fecha real, no una fija', () => {
    assert.equal(R.encabezadoFecha(tarde), '16 octubre 2026');
    assert.equal(R.encabezadoFecha(new Date(2026, 8, 9)), '09 septiembre 2026');
  });
  test('formatearFecha usa mediodía local: no retrocede un día', () => {
    assert.match(R.formatearFecha('2026-10-16'), /16/);
  });
});

describe('Vigencia de la sesión', () => {
  const s = { token: 't', usuario: { role: 'admin' }, expiraEn: 2000 };
  test('vigente antes de expirar', () => assert.equal(R.sesionVigente(s, 1999), true));
  test('expirada en el instante exacto y después', () => {
    assert.equal(R.sesionVigente(s, 2000), false);
    assert.equal(R.sesionVigente(s, 5000), false);
  });
  test('sin token, sin usuario o nula → no vigente', () => {
    assert.equal(R.sesionVigente(null), false);
    assert.equal(R.sesionVigente({ ...s, token: '' }, 1), false);
    assert.equal(R.sesionVigente({ token: 't', expiraEn: 2000 }, 1), false);
  });
});

describe('Clases visuales', () => {
  test('estados y prioridades conocidos', () => {
    assert.equal(R.claseEstado('En progreso'), 'progress');
    assert.equal(R.clasePrioridad('Alta'), 'alta');
  });
  test('valores desconocidos caen al valor seguro por defecto', () => {
    assert.equal(R.claseEstado('hack'), 'abierto');
    assert.equal(R.claseEstado('constructor'), 'abierto');
    assert.equal(R.clasePrioridad('x'), 'baja');
  });
});
