import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Presentational components take props only; their connected parent reads the store.
    files: [
      'src/components/ui/**/*.tsx',
      'src/components/sidebar/{SidebarTree,TreeRow,WorkspaceName,ArchivedSection}.tsx',
      'src/components/board/QuickAdd.tsx',
      'src/components/task/SubtaskList.tsx',
    ],
    ignores: ['src/components/ui/Toaster.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [{ group: ['@/store/*'], message: 'Presentational component: take data and callbacks as props.' }],
        },
      ],
    },
  },
);
