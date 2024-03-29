module.exports = {
  root: true,
  plugins: ['unicorn', 'react-hooks', 'prettier', 'jsx-a11y', 'promise'],
  env: {
    node: true,
    es6: true,
  },
  parserOptions: { ecmaVersion: 8 }, // to enable features such as async/await
  ignorePatterns: ['node_modules/*', '!.prettierrc.js'], // We don't want to lint generated files nor node_modules, but we want to lint .prettierrc.js (ignored by default by eslint)
  extends: [
    'eslint:recommended',
    'react-app', // create-react-app config
    'plugin:unicorn/recommended', // unicorn
    'plugin:prettier/recommended', // prettier overrides
    'prettier/react',
    'plugin:jsx-a11y/recommended',
    'plugin:promise/recommended',
  ],
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
        '@typescript-eslint/no-unused-vars': ['warn'],
        'unicorn/no-useless-undefined': 0,

        '@typescript-eslint/explicit-function-return-type': 0,
        '@typescript-eslint/explicit-module-boundary-types': 0,

        'prefer-const': 2,
        'arrow-body-style': [2, 'as-needed'],
        curly: [2, 'multi'],
        'padding-line-between-statements': [
          2,
          { blankLine: 'never', prev: 'import', next: 'import' },
        ],
        'no-useless-concat': 2,
        'prefer-template': 2,

        'prettier/prettier': ['warn', {}, { usePrettierrc: true }], // Includes .prettierrc.js rules
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
    'react-hooks/rules-of-hooks': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
  },
};
