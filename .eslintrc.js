module.exports = {
  root: true,
  plugins: ['unicorn', 'react-hooks', 'prettier', 'jsx-a11y'],
  env: {
    node: true,
    es6: true,
  },
  parserOptions: { ecmaVersion: 8 }, // to enable features such as async/await
  ignorePatterns: ['node_modules/*', '.next/*', '.out/*', '!.prettierrc.js'], // We don't want to lint generated files nor node_modules, but we want to lint .prettierrc.js (ignored by default by eslint)
  extends: ['eslint:recommended'],
  overrides: [
    // This configuration will apply only to TypeScript files
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      settings: { react: { version: 'detect' } },
      env: {
        browser: true,
        node: true,
        es6: true,
      },
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended', // TypeScript rules
        'plugin:react/recommended', // React rules
        'plugin:react-hooks/recommended', // React hooks rules
        'plugin:jsx-a11y/recommended', // Accessibility rules
        'plugin:prettier/recommended', // Prettier recommended rules
        'prettier/@typescript-eslint', // Prettier plugin
        'prettier/react',
        'plugin:unicorn/recommended', // unicorn
      ],
      rules: {
        // We will use TypeScript's types for component props instead
        'react/prop-types': 'off',
        // No need to import React when using Next.js
        'react/react-in-jsx-scope': 'off',
        // This rule is not compatible with Next.js's <Link /> components
        'jsx-a11y/anchor-is-valid': 'off',
        '@typescript-eslint/no-unused-vars': ['error'],
        'unicorn/no-useless-undefined': 0,

        // I suggest this setting for requiring return types on functions only where useful
        '@typescript-eslint/explicit-function-return-type': [
          'warn',
          {
            allowExpressions: true,
            allowConciseArrowFunctionExpressionsStartingWithVoid: true,
          },
        ],

        'prettier/prettier': ['error', {}, { usePrettierrc: true }], // Includes .prettierrc.js rules
      },
    },
  ],
  // Rule Overrides
  rules: {
    'prefer-const': 2,
    'arrow-body-style': [2, 'as-needed'],
    curly: [2, 'multi'],
    'padding-line-between-statements': [
      2,
      { blankLine: 'never', prev: 'import', next: 'import' },
    ],
    'no-useless-concat': 2,
    'prefer-template': 2,

    // unicorn
    'unicorn/no-fn-reference-in-iterator': 0, // Allows [].map(func)
    'unicorn/catch-error-name': [2, { name: 'error' }],
    'unicorn/prevent-abbreviations': 'off',
    'unicorn/no-abusive-eslint-disable': 'off',
    'unicorn/no-useless-undefined': 0,

    'react/jsx-indent': 0,
    'react/jsx-curly-brace-presence': [2, 'never'],

    // React
    'react/prefer-stateless-function': 2,
    'react/destructuring-assignment': [2, 'always'],
    // hooks
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
}
