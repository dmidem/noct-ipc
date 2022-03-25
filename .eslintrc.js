// https://typescript-eslint.io/docs/linting/
module.exports = {
  root: true,
  extends: ['standard', 'eslint:recommended', 'plugin:import/recommended'],
  overrides: [
    {
      files: ['*.ts'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      extends: [
        'plugin:@typescript-eslint/recommended',
        'plugin:prettier/recommended',
        'plugin:import/typescript'
      ],
      rules: {
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        camelcase: ['error', { ignoreImports: true }]
      }
    }
  ]
}
