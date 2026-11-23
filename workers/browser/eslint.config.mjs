import { defineConfig, globalIgnores } from 'eslint/config'
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

// Node code, so globals.node.
export default defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}'],
    ignores: ['scripts/**', '**/*.config.*'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['scripts/**', '**/*.config.*'],
    languageOptions: { globals: globals.node },
  },
  globalIgnores(['dist/**', 'build/**', 'out/**', 'coverage/**']),
])
