// ESLint flat config — enfocado en la regla de FRONTERAS entre features.
// Objetivo: ninguna feature importa de otra feature (evita el "monolito con
// carpetas"). Correr con: npx eslint  (no bloquea `ng build`).
//
// NOTA: al correrlo por primera vez saldrán violaciones que YA existen
// (interceptores de core que importan de features/seg, y algún adm→org/seg).
// Son justo las que hay que ir corrigiendo (mover lo compartido a core/).
// Si molestan de golpe, baja los 'error' a 'warn' mientras se limpian.

import boundaries from 'eslint-plugin-boundaries';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    files: ['src/app/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'core', pattern: 'src/app/core/*' },
        { type: 'layout', pattern: 'src/app/layout/*' },
        { type: 'shared', pattern: 'src/app/shared/*' },
        { type: 'feature', pattern: 'src/app/features/*', capture: ['feature'] },
      ],
      'boundaries/ignore': ['src/app/app.*.ts', 'src/app/**/*.spec.ts'],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            // Una feature solo puede importar de core, shared y de SÍ MISMA.
            { from: 'feature', allow: ['core', 'shared', ['feature', { feature: '${from.feature}' }]] },
            // El shell puede orquestar features.
            { from: 'layout', allow: ['core', 'shared', 'feature'] },
            // core y shared no dependen de features.
            { from: 'core', allow: ['core', 'shared'] },
            { from: 'shared', allow: ['core', 'shared'] },
          ],
        },
      ],
    },
  },
);
