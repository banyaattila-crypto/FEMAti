import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** A gyökér package.json verziója — a jegyzőkönyv fejlécéhez (P15). */
function readAppVersion(): string {
  const path = fileURLToPath(new URL('../../package.json', import.meta.url));
  const pkg = JSON.parse(readFileSync(path, 'utf-8')) as { readonly version?: string };
  return pkg.version ?? '0.0.0';
}

/**
 * A mag rövid commit-hash-e build/dev időben — a jegyzőkönyv fejléce
 * (MASTER-PROMPT-TERV P15 prompt: "a mag commit-hash-e") megköveteli, hogy
 * a jegyzőkönyv visszavezethető legyen egy konkrét forrásállapotra. Ha nincs
 * git (pl. csomagolt build git nélkül), "ismeretlen" — SOSEM hamisítunk hasht.
 */
function readGitCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: fileURLToPath(new URL('.', import.meta.url)) })
      .toString()
      .trim();
  } catch {
    return 'ismeretlen';
  }
}

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: false },
  build: { target: 'es2022', sourcemap: true },
  define: {
    __APP_VERSION__: JSON.stringify(readAppVersion()),
    __GIT_COMMIT__: JSON.stringify(readGitCommit()),
  },
});
