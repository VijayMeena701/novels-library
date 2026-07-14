/// <reference types="node" />

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: [
      'src/**/*.ts',
      'scripts/**/*.ts',
      'migrations/**/*.ts',
      'migrate.ts',
      'eslint.config.ts',
      'prettier.config.ts',
    ],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.all.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Project has many explicit `any` types and legacy patterns.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      'no-unused-vars': 'off',
      'no-console': 'off',
      'no-empty': 'off',
      'no-constant-condition': 'off',
      'no-undef': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unsafe-declaration-merging': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'coverage/', '**/*.js', 'scripts/build.ts'],
  },
);
