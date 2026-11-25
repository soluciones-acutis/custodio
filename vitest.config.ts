import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      // El documento técnico pide cobertura de 85 % de líneas en el lenguaje (RNF-03).
      include: ['src/lenguaje/**/*.ts'],
      thresholds: { lines: 85 },
    },
  },
});
