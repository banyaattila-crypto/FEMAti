// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/*.d.ts',
      'eslint.config.js',
      // A design/ a felhasználótól kapott forrásanyag (Claude Design canvas
      // export + prototípus-mag). Referenciaként őrizzük, nem a mi kódunk —
      // nem tartozik a projekt kódszabályai alá.
      'design/**',
      '.tmp/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // A terv 7. fejezete (K4) és a P0 prompt tiltásai.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  {
    // A számítási mag nem naplózhat és nem érhet el böngésző-globálokat.
    files: ['packages/fem-core/src/**/*.ts'],
    rules: {
      'no-console': 'error',
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'A fem-core nem függhet a DOM-tól.' },
        { name: 'document', message: 'A fem-core nem függhet a DOM-tól.' },
        { name: 'navigator', message: 'A fem-core nem függhet a DOM-tól.' },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/test/**/*.ts', '**/*.config.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // A `scripts/` alatt sima (nem TS-projekthez kötött) Node-szkriptek
    // futnak — nincs TS-lib-alapú globális-felismerés, ezért a Node
    // globálisokat itt kell explicit felvenni (nincs `globals` függőség,
    // csak a ténylegesen használt neveket soroljuk fel).
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
      },
    },
  },
);
