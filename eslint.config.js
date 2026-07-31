import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import eslintPluginVue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '.agents/**',
      '.codex/**',
      '.vercel/**',
      'coverage/**',
      'dist/**',
      'node_modules/**',
      'playwright-report/**',
      'qa/**',
      'storybook-static/**',
      'supabase/.temp/**',
      'test-results/**',
      'public/sw.js',
      'public/workbox-*.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...eslintPluginVue.configs['flat/recommended'],
  {
    files: ['src/**/*.{ts,vue}', 'tests/**/*.ts', 'e2e/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        extraFileExtensions: ['.vue'],
        parser: tseslint.parser,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  {
    files: ['api/**/*.ts', 'scripts/**/*.{js,mjs}', '*.{js,ts}'],
    languageOptions: {
      globals: globals.node,
    },
  },
  eslintConfigPrettier,
);
