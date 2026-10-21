// Configuración de ESLint 9 (formato "flat config").
// Uso:  npm run lint          → muestra el reporte en consola
//       npm run lint:reporte  → guarda evidencias/lint/eslint-reporte.{json,txt}
const js = require('@eslint/js');

const globalsNode = {
  require: 'readonly', module: 'writable', exports: 'writable', process: 'readonly', console: 'readonly',
  __dirname: 'readonly', __filename: 'readonly', Buffer: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
  setInterval: 'readonly', clearInterval: 'readonly', URL: 'readonly', URLSearchParams: 'readonly',
  fetch: 'readonly', performance: 'readonly'
};
const globalsNavegador = {
  window: 'readonly', document: 'readonly', fetch: 'readonly', sessionStorage: 'readonly', localStorage: 'readonly',
  FormData: 'readonly', Intl: 'readonly', URLSearchParams: 'readonly', setTimeout: 'readonly',
  clearTimeout: 'readonly', console: 'readonly', globalThis: 'readonly'
};

// Los scripts de Playwright ejecutan funciones DENTRO del navegador (page.evaluate).
const globalsEnPagina = {
  window: 'readonly', document: 'readonly', sessionStorage: 'readonly', MutationObserver: 'readonly', Image: 'readonly', FormData: 'readonly'
};

const reglasComunes = {
  eqeqeq: ['error', 'always'],
  'no-var': 'error',
  'prefer-const': 'error',
  'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'all', caughtErrorsIgnorePattern: '^_' }],
  'no-empty': 'error',
  'no-shadow': 'warn',
  'no-implicit-coercion': 'warn',
  'no-throw-literal': 'error',
  curly: ['error', 'multi-line']
};

module.exports = [
  { ignores: ['node_modules/**', 'data/**', 'evidencias/**', 'docs/**'] },
  js.configs.recommended,
  // Servidor, pruebas y scripts: Node (CommonJS)
  {
    files: ['server.js', 'src/**/*.js', 'tests/**/*.js', 'scripts/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: globalsNode },
    rules: { ...reglasComunes, 'no-console': 'off' }
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: { globals: { ...globalsNode, ...globalsEnPagina } }
  },
  // Cliente: módulos ES en el navegador
  {
    files: ['public/js/**/*.mjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globalsNavegador },
    rules: { ...reglasComunes, 'no-console': 'warn' }
  },
  {
    files: ['tests/unit/**/*.test.js'],
    languageOptions: { globals: { jest: 'readonly' } }
  },
  {
    files: ['scripts/transcripcion.js', 'src/utils/sanitize.js', 'tests/seguridad.test.js'],
    rules: { 'no-control-regex': 'off' }
  }
];
