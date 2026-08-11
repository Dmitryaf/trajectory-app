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
    files: ['src/model/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'vue', message: 'Модель данных не должна зависеть от UI.' },
            { name: 'vue-router', message: 'Модель данных не должна зависеть от маршрутов.' },
            { name: 'pinia', message: 'Модель данных не должна зависеть от состояния UI.' },
            { name: 'dexie', message: 'Доступ к базе находится вне модели данных.' },
            { name: '@supabase/supabase-js', message: 'Сеть находится вне модели данных.' },
          ],
          patterns: [
            {
              group: [
                '../views/**',
                '../../views/**',
                '../components/**',
                '../../components/**',
                '../features/**',
                '../../features/**',
                '../services/**',
                '../../services/**',
                '../stores/**',
                '../../stores/**',
                '../db',
                '../../db',
              ],
              message: 'Модель данных не должна зависеть от UI, сценариев, состояния или инфраструктуры.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/features/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../views/**', '../../views/**', '../../../views/**'],
              message: 'Пользовательский сценарий не должен зависеть от страницы.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/services/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../views/**', '../../views/**', '../components/**', '../../components/**', '../stores/**', '../../stores/**'],
              message: 'Общий сервис не должен зависеть от UI или состояния страницы.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/stores/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../views/**', '../../views/**', '../components/**', '../../components/**'],
              message: 'Store не должен зависеть от UI.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/components/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../views/**', '../../views/**'],
              message: 'Компонент не должен зависеть от страницы.',
            },
          ],
        },
      ],
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
