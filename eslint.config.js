// Analyse statique (npm run lint) : règles recommandées de JavaScript et TypeScript, règles des hooks React.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', '.claude', 'site', 'src-tauri', 'node_modules', 'public', '_site'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Règles des hooks : une violation casse React, c'est une erreur.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Déjà vérifié par TypeScript (noUnusedLocals / noUnusedParameters) ; « _x » = volontairement ignoré.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
    },
  },
  {
    files: ['test/**/*.ts'],
    languageOptions: { globals: { ...globals.vitest } },
  },
);
