// ESLint 9 flat config：typescript-eslint + eslint-plugin-vue + prettier 兼容
import js from '@eslint/js'
import configPrettier from 'eslint-config-prettier'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    { ignores: ['dist/', 'node_modules/', 'public/', 'scripts/'] },
    js.configs.recommended,
    tseslint.configs.recommended,
    pluginVue.configs['flat/recommended'],
    {
        files: ['**/*.vue'],
        languageOptions: {
            globals: globals.browser,
            parserOptions: { parser: tseslint.parser },
        },
    },
    {
        languageOptions: { globals: globals.browser },
        rules: {
            'vue/multi-word-component-names': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
        },
    },
    configPrettier,
)
