/**
 * Pruebas unitarias — reglas de negocio del servidor:
 * validación de incidentes, filtros, usuarios, saneado de texto y modelo (BD en memoria).
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'x'.repeat(48);

const { describe, test, beforeAll, afterAll } = require('@jest/globals');
const assert = require('node:assert/strict');
const V = require('../../src/utils/validators');
const { limpiarTexto, escaparLike } = require('../../src/utils/sanitize');

const valido = { title: 'Caída del correo', category: 'Infraestructura', priority: 'Alta' };
const campos = (r) => r.errores.map((e) => e.campo);

describe('Incidente: título', () => {
  test('3 caracteres es el mínimo y 80 el máximo', () => {
    assert.deepEqual(campos(V.validarIncidente({ ...valido, title: 'ab' }, 'crear')), ['title']);
    assert.equal(V.validarIncidente({ ...valido, title: 'abc' }, 'crear').errores.length, 0);
    assert.equal(V.validarIncidente({ ...valido, title: 'a'.repeat(80) }, 'crear').errores.length, 0);
    assert.deepEqual(campos(V.validarIncidente({ ...valido, title: 'a'.repeat(81) }, 'crear')), ['title']);
  });
  test('se limpia ANTES de medir: solo etiquetas HTML = título vacío', () => {
    assert.deepEqual(campos(V.validarIncidente({ ...valido, title: '<b></b>' }, 'crear')), ['title']);
  });
  test('el XSS se elimina del valor guardado', () => {
    const r = V.validarIncidente({ ...valido, title: 'Aviso <script>alert(1)</script> de red' }, 'crear');
    assert.ok(!/[<>]/.test(r.valor.title));
  });
});

describe('Incidente: listas y obligatoriedad', () => {
  test('categoría, prioridad y estado solo admiten valores del dominio', () => {
    assert.deepEqual(campos(V.validarIncidente({ ...valido, category: 'Otra' }, 'crear')), ['category']);
    assert.deepEqual(campos(V.validarIncidente({ ...valido, priority: 'Urgente' }, 'crear')), ['priority']);
    assert.deepEqual(campos(V.validarIncidente({ ...valido, status: 'Cerrado' }, 'crear')), ['status']);
    for (const s of V.ESTADOS) assert.equal(V.validarIncidente({ ...valido, status: s }, 'crear').errores.length, 0);
  });
  test('crear y reemplazar exigen título, categoría y prioridad', () => {
    for (const modo of ['crear', 'reemplazar']) assert.deepEqual(campos(V.validarIncidente({}, modo)).sort(), ['category', 'priority', 'title']);
  });
  test('parcial: acepta un solo campo y rechaza el cuerpo vacío', () => {
    assert.deepEqual(V.validarIncidente({ status: 'Resuelto' }, 'parcial').valor, { status: 'Resuelto' });
    assert.deepEqual(campos(V.validarIncidente({}, 'parcial')), ['body']);
  });
});

describe('Incidente: fecha, email, descripción', () => {
  test('la fecha debe existir de verdad', () => {
    for (const d of ['2026-02-30', '2026-13-01', '1999-12-31', '2101-01-01', '16/10/2026', '2026-1-1']) {
      assert.deepEqual(campos(V.validarIncidente({ ...valido, date: d }, 'crear')), ['date'], d);
    }
    assert.equal(V.validarIncidente({ ...valido, date: '2028-02-29' }, 'crear').errores.length, 0, 'bisiesto válido');
    assert.deepEqual(campos(V.validarIncidente({ ...valido, date: '2027-02-29' }, 'crear')), ['date'], 'no bisiesto');
  });
  test('email: vacío → null; válido en minúsculas; inválido rechazado', () => {
    assert.equal(V.validarIncidente({ ...valido, email: '' }, 'crear').valor.email, null);
    assert.equal(V.validarIncidente({ ...valido, email: 'Ana@Incidenta.EC' }, 'crear').valor.email, 'ana@incidenta.ec');
    for (const e of ['ana', 'ana@', '@x.ec', 'a b@x.ec', 'a@x', `${'a'.repeat(121)}@x.ec`]) {
      assert.deepEqual(campos(V.validarIncidente({ ...valido, email: e }, 'crear')), ['email'], e);
    }
  });
  test('descripción: hasta 500 caracteres; vacía → null', () => {
    assert.equal(V.validarIncidente({ ...valido, description: 'a'.repeat(500) }, 'crear').errores.length, 0);
    assert.deepEqual(campos(V.validarIncidente({ ...valido, description: 'a'.repeat(501) }, 'crear')), ['description']);
    assert.equal(V.validarIncidente({ ...valido, description: '' }, 'crear').valor.description, null);
  });
});

describe('Incidente: forma del cuerpo (mass assignment)', () => {
  test('campos no permitidos y tipos incorrectos se rechazan', () => {
    assert.deepEqual(campos(V.validarIncidente({ ...valido, role: 'admin' }, 'crear')), ['role']);
    assert.deepEqual(campos(V.validarIncidente({ ...valido, id: '1' }, 'crear')), ['id']);
    assert.deepEqual(campos(V.validarIncidente({ ...valido, priority: ['Alta'] }, 'crear')), ['priority']);
  });
  test('un cuerpo que no es objeto se rechaza', () => {
    for (const b of [null, [], 'texto', 5]) assert.deepEqual(campos(V.validarIncidente(b, 'crear')), ['body']);
  });
});

describe('Filtros del listado', () => {
  test('"all" equivale a sin filtro; valores fuera de la lista se rechazan', () => {
    assert.deepEqual(V.validarFiltros({ status: 'all', priority: 'all' }).valor, { page: 1, limit: 50 });
    assert.deepEqual(V.validarFiltros({ status: 'Abierto', priority: 'Alta' }).valor, { status: 'Abierto', priority: 'Alta', page: 1, limit: 50 });
    assert.deepEqual(campos(V.validarFiltros({ status: "x' OR 1=1" })), ['status']);
    assert.deepEqual(campos(V.validarFiltros({ priority: ['Alta'] })), ['priority']);
  });
  test('búsqueda: se limpia, máximo 60 caracteres', () => {
    assert.equal(V.validarFiltros({ search: '<b>correo</b>' }).valor.search, 'correo');
    assert.deepEqual(campos(V.validarFiltros({ search: 'a'.repeat(61) })), ['search']);
  });
  test('paginación: valores por defecto, enteros positivos y límite máximo', () => {
    assert.deepEqual(V.validarFiltros({}).valor, { page: 1, limit: 50 });
    assert.deepEqual(V.validarFiltros({ page: '3', limit: '100' }).valor, { page: 3, limit: 100 });
    for (const page of ['0', '-1', '1.5', 'abc', ['2']]) {
      assert.deepEqual(campos(V.validarFiltros({ page })), ['page']);
    }
    for (const limit of ['0', '101', '1.5', 'abc', ['2']]) {
      assert.deepEqual(campos(V.validarFiltros({ limit })), ['limit']);
    }
  });
});

describe('Usuarios nuevos', () => {
  const u = { username: 'ana.perez', password: 'Clave-Segura-2026', role: 'analista' };
  test('caso válido', () => assert.equal(V.validarNuevoUsuario(u).errores.length, 0));
  test('contraseña: mínimo 10, con letras y números', () => {
    for (const p of ['corta1A', 'soloLetrasLargas', '1234567890123']) assert.deepEqual(campos(V.validarNuevoUsuario({ ...u, password: p })), ['password'], p);
  });
  test('usuario en minúsculas 3-32 y rol del dominio', () => {
    assert.deepEqual(campos(V.validarNuevoUsuario({ ...u, username: 'AB' })), ['username']);
    assert.deepEqual(campos(V.validarNuevoUsuario({ ...u, role: 'root' })), ['role']);
  });
});

describe('Saneado de texto', () => {
  test('quita etiquetas, controla espacios y conserva texto legítimo', () => {
    assert.equal(limpiarTexto('  <b>Hola</b>   mundo  '), 'Hola mundo');
    assert.equal(limpiarTexto('Caída 2 > 1'), 'Caída 2 > 1', 'un > suelto no es una etiqueta');
  });
  test('escaparLike neutraliza %, _ y la barra', () => {
    assert.equal(escaparLike('50%_a\\b'), '50\\%\\_a\\\\b');
  });
});

describe('Modelo de incidentes (PostgreSQL embebido)', () => {
  let M;
  beforeAll(async () => {
    await require('../../src/db/migrate').runMigrations({ silent: true });
    M = require('../../src/models/incidente.model');
  });

  afterAll(async () => {
    await require('../../src/db/connection').close();
  });
  test('crear asigna estado Abierto y fecha de hoy por defecto', async () => {
    const i = await M.create({ title: 'Prueba uno', category: 'Otro', priority: 'Baja' });
    assert.equal(i.status, 'Abierto');
    assert.match(i.date, /^\d{4}-\d{2}-\d{2}$/);
  });
  test('actualizar parcialmente conserva el resto de campos', async () => {
    const i = await M.create({ title: 'Prueba dos', category: 'Seguridad', priority: 'Alta', email: 'a@b.ec' });
    const u = await M.update(i.id, { status: 'Resuelto' });
    assert.equal(u.status, 'Resuelto');
    assert.equal(u.title, 'Prueba dos');
    assert.equal(u.email, 'a@b.ec');
  });
  test('actualizar o eliminar un id inexistente → null / false', async () => {
    assert.equal(await M.update(99999, { status: 'Resuelto' }), null);
    assert.equal(await M.remove(99999), false);
  });
  test('el listado va del más reciente al más antiguo y desempata por id', async () => {
    const ids = (await M.getAll()).map((i) => i.id);
    assert.deepEqual([...ids], [...ids].sort((a, b) => b - a));
  });
  test('los filtros se combinan y la búsqueda trata % como texto literal', async () => {
    await M.create({ title: 'Descuento 50% error', category: 'Otro', priority: 'Media' });
    assert.equal((await M.getAll({ search: '50%' })).length, 1);
    assert.equal((await M.getAll({ search: '%' })).length, 1, '% no actúa como comodín');
    assert.ok((await M.getAll({ status: 'Resuelto', priority: 'Alta' })).every((i) => i.status === 'Resuelto' && i.priority === 'Alta'));
  });
  test('getPagina limita filas, cuenta resultados y normaliza páginas fuera de rango', async () => {
    for (let i = 1; i <= 5; i += 1) {
      await M.create({ title: `Paginar caso ${i}`, category: 'Otro', priority: 'Baja' });
    }
    const primera = await M.getPagina({ search: 'Paginar caso', page: 1, limit: 2 });
    const segunda = await M.getPagina({ search: 'Paginar caso', page: 2, limit: 2 });
    const fueraDeRango = await M.getPagina({ search: 'Paginar caso', page: 99, limit: 2 });
    assert.equal(primera.data.length, 2);
    assert.equal(primera.pagination.total, 5);
    assert.equal(primera.pagination.totalPages, 3);
    assert.equal(primera.pagination.page, 1);
    assert.equal(segunda.data.length, 2);
    assert.notEqual(primera.data[0].id, segunda.data[0].id);
    assert.equal(fueraDeRango.pagination.page, 3);
    assert.equal(fueraDeRango.data.length, 1);
  });
  test('la base rechaza una prioridad fuera del dominio (segunda defensa)', async () => {
    await assert.rejects(M.create({ title: 'Mala', category: 'Otro', priority: 'Urgente' }), /constraint/i);
  });
});
