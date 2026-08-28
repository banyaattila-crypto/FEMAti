import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  // A `vite.config.ts` build-időben állítja be ezt a két konstanst (docxExport
  // jegyzőkönyv-fejléce, P15) — teszt alatt is elérhetőnek kell lennie, mert
  // `docxExport.test.ts` a TELJES `buildDerivationExportData` útvonalat futtatja.
  define: {
    __APP_VERSION__: JSON.stringify('test'),
    __GIT_COMMIT__: JSON.stringify('test'),
  },
});
