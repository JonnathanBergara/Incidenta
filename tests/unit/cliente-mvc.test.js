/**
 * Pruebas unitarias — capas del cliente MVC (modelo, API, sesión, controlador).
 * Se usan dobles simples (fetch falso, almacenamiento falso): sin navegador.
 */
const { describe, test, beforeAll } = require('@jest/globals');
const assert = require('node:assert/strict');

let Api, Inc, Ses, Ctl, Html;
beforeAll(async () => {
  Api = await import('../../public/js/model/api.mjs');
  Inc = await import('../../public/js/model/incidentes.model.mjs');
  Ses = await import('../../public/js/model/sesion.model.mjs');
  Ctl = await import('../../public/js/controller/app.controller.mjs');
  Html = await import('../../public/js/view/html.mjs');
});

const respuesta = (estado, cuerpo) => ({ status: estado, ok: estado >= 200 && estado < 300, json: async () => cuerpo });
const almacen = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
const respuestaPagina = (data, page = 1) => ({
  data,
  pagination: { page, limit: 50, total: data.length, totalPages: data.length ? 1 : 0 },
  estadisticas: { total: data.length, abiertos: data.length, criticos: 0, resueltos: 0 }
});

describe('escapeHtml', () => {
  test('escapa los cinco caracteres peligrosos', () => {
    assert.equal(Html.escapeHtml(`<img src=x onerror="a('b')">&`), '&lt;img src=x onerror=&quot;a(&#039;b&#039;)&quot;&gt;&amp;');
  });
  test('convierte números y null en texto', () => { assert.equal(Html.escapeHtml(5), '5'); assert.equal(Html.escapeHtml(null), 'null'); });
});

describe('Cliente de la API', () => {
  test('envía Authorization: Bearer solo si hay token', async () => {
    const vistos = [];
    const fetchFn = async (url, op) => { vistos.push(op.headers); return respuesta(200, []); };
    let token = null;
    const { api } = Api.crearClienteApi({ fetchFn, obtenerToken: () => token });
    await api('GET');
    token = 'abc';
    await api('GET');
    assert.equal(vistos[0].Authorization, undefined);
    assert.equal(vistos[1].Authorization, 'Bearer abc');
  });
  test('401 avisa a la sesión y lanza ErrorApi', async () => {
    let avisos = 0;
    const { api } = Api.crearClienteApi({ fetchFn: async () => respuesta(401, { error: 'x' }), alSesionInvalida: () => { avisos += 1; } });
    await assert.rejects(api('GET'), (e) => e instanceof Api.ErrorApi && e.estado === 401);
    assert.equal(avisos, 1);
  });
  test('204 devuelve null; fallo de red → estado 0', async () => {
    const { api } = Api.crearClienteApi({ fetchFn: async () => respuesta(204) });
    assert.equal(await api('DELETE', '/1'), null);
    const { api: caido } = Api.crearClienteApi({ fetchFn: async () => { throw new Error('red'); } });
    await assert.rejects(caido('GET'), (e) => e.estado === 0);
  });
  test('mensajes: 403 genérico, detalles por campo y error inesperado', () => {
    assert.equal(Api.mensajeDeError(new Api.ErrorApi(403, 'x')), 'No tiene permisos para realizar esta acción.');
    assert.equal(Api.mensajeDeError(new Api.ErrorApi(400, 'Datos inválidos.', [{ campo: 'title', mensaje: 'Muy corto.' }])), 'Datos inválidos. title: Muy corto.');
    assert.equal(Api.mensajeDeError(new Error('boom')), 'Ocurrió un error inesperado.');
  });
  test('login: 429 muestra el mensaje de espera', async () => {
    const { login } = Api.crearClienteApi({ fetchFn: async () => respuesta(429, {}) });
    await assert.rejects(login('a', 'b'), /Demasiados intentos/);
  });
});

describe('Sesión', () => {
  test('guarda, recupera y calcula la expiración', () => {
    const a = almacen();
    const s = new Ses.SesionModel(a, () => 1000);
    s.guardar({ token: 't', usuario: { role: 'analista' }, expiraEn: 60 });
    assert.equal(s.actual.expiraEn, 61000);
    assert.equal(new Ses.SesionModel(a, () => 2000).activa, true);
    assert.equal(new Ses.SesionModel(a, () => 61000).activa, false, 'expirada');
  });
  test('JSON corrupto en el almacenamiento no rompe: sesión nula', () => {
    const a = almacen(); a.setItem('incidenta-sesion', '{no es json');
    assert.equal(new Ses.SesionModel(a).activa, false);
  });
  test('cerrar borra todo; puede() respeta el rol', () => {
    const s = new Ses.SesionModel(almacen(), () => 0);
    assert.equal(s.puede('crear'), false);
    s.guardar({ token: 't', usuario: { role: 'lector' }, expiraEn: 10 });
    assert.equal(s.puede('crear'), false);
    s.cerrar();
    assert.equal(s.token, null);
  });
});

describe('Modelo de incidentes', () => {
  test('crear inserta al inicio y avisa a los oyentes', async () => {
    let lecturas = 0;
    const m = new Inc.IncidentesModel(async (metodo) => {
      if (metodo === 'POST') return { id: 9, title: 'Nuevo' };
      lecturas += 1;
      return respuestaPagina([{ id: 9, title: 'Nuevo' }]);
    });
    m.items = [{ id: 1 }];
    let avisos = 0; m.suscribir(() => { avisos += 1; });
    await m.crear({ title: 'Nuevo' });
    assert.deepEqual(m.items.map((i) => i.id), [9]);
    assert.equal(avisos, 1);
    assert.equal(lecturas, 1);
  });
  test('DOBLE ENVÍO: la segunda llamada simultánea no llega a la API', async () => {
    let llamadas = 0;
    const m = new Inc.IncidentesModel(async (metodo) => {
      if (metodo === 'GET') return respuestaPagina([]);
      llamadas += 1;
      await new Promise((r) => setTimeout(r, 20));
      return { id: llamadas };
    });
    const [a, b] = await Promise.all([m.crear({}), m.crear({})]);
    assert.equal(llamadas, 1);
    assert.ok(a && b === null);
    assert.equal(m.enviando, false, 'la bandera se libera');
  });
  test('si la API falla, la bandera se libera y el dato no se agrega', async () => {
    const m = new Inc.IncidentesModel(async () => { throw new Api.ErrorApi(400, 'mal'); });
    await assert.rejects(m.crear({}));
    assert.equal(m.enviando, false);
    assert.equal(m.items.length, 0);
  });
  test('resolver cambia solo el incidente indicado; eliminar lo quita', async () => {
    const m = new Inc.IncidentesModel(async (metodo, ruta, cuerpo) => {
      if (metodo === 'PATCH') return { id: 2, status: cuerpo.status };
      if (metodo === 'GET') return respuestaPagina([{ id: 2, status: 'Resuelto' }]);
      return null;
    });
    m.items = [{ id: 1, status: 'Abierto' }, { id: 2, status: 'Abierto' }];
    await m.resolver(2);
    assert.deepEqual(m.items.map((i) => i.status), ['Resuelto']);
    await m.eliminar(1);
    assert.deepEqual(m.items.map((i) => i.id), [2]);
  });
  test('cargar envía paginación y filtros y conserva metadatos del servidor', async () => {
    const llamadas = [];
    const m = new Inc.IncidentesModel(async (metodo, ruta) => {
      llamadas.push({ metodo, ruta });
      return {
        data: [{ id: 4 }],
        pagination: { page: 2, limit: 50, total: 61, totalPages: 2 },
        estadisticas: { total: 61, abiertos: 50, criticos: 4, resueltos: 11 }
      };
    });
    await m.cargar({ pagina: 2, filtros: { estado: 'Abierto', busqueda: ' correo ', prioridad: 'Alta' } });
    assert.match(llamadas[0].ruta, /page=2/);
    assert.match(llamadas[0].ruta, /limit=50/);
    assert.match(llamadas[0].ruta, /status=Abierto/);
    assert.match(llamadas[0].ruta, /search=correo/);
    assert.match(llamadas[0].ruta, /priority=Alta/);
    assert.equal(m.pagina, 2);
    assert.equal(m.total, 61);
    assert.equal(m.totalPaginas, 2);
    assert.equal(m.estadisticas.criticos, 4);
  });
  test('cargar con error deja la lista vacía y relanza', async () => {
    const m = new Inc.IncidentesModel(async () => { throw new Api.ErrorApi(500, 'x'); });
    m.items = [{ id: 1 }];
    await assert.rejects(m.cargar());
    assert.deepEqual(m.items, []);
  });
});

describe('debounce (búsqueda)', () => {
  test('varias pulsaciones seguidas ejecutan una sola vez', () => {
    jest.useFakeTimers();
    let n = 0;
    const f = Ctl.debounce(() => { n += 1; }, 200);
    for (let i = 0; i < 8; i += 1) { f(); jest.advanceTimersByTime(50); }
    assert.equal(n, 0, 'aún dentro de la ventana de calma');
    jest.advanceTimersByTime(200);
    assert.equal(n, 1);
    jest.useRealTimers();
  });
});
