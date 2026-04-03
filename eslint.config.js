const { defineConfig } = require('eslint/config');
const eslintJs = require('@eslint/js');
const jestPlugin = require('eslint-plugin-jest');
const auraConfig = require('@salesforce/eslint-plugin-aura');
const lwcConfig = require('@salesforce/eslint-config-lwc/recommended');
const globals = require('globals');

module.exports = defineConfig([
    // Global settings — tells eslint-plugin-jest which version is in use
    // (required for Code Analyzer's bundled copy which cannot resolve it from node_modules)
    {
        settings: {
            jest: { version: 29 }
        }
    },

    // Aura configuration
    {
        files: ['**/aura/**/*.js'],
        extends: [
            ...auraConfig.configs.recommended,
            ...auraConfig.configs.locker
        ]
    },

    // LWC configuration
    {
        files: ['**/lwc/**/*.js'],
        extends: [lwcConfig]
    },

    // Allow async operations (setInterval, setTimeout, requestAnimationFrame) where explicitly needed
    {
        files: ['**/lwc/customResults/*.js', '**/lwc/similarProductsBySubject/*.js'],
        rules: {
            '@lwc/lwc/no-async-operation': 'off'
        }
    },

    // stateCountyMapbox requires @api reassignment (state from events), document.querySelector
    // (to check if external scripts are already loaded), and requestAnimationFrame (map resize)
    {
        files: ['**/lwc/stateCountyMapbox/*.js'],
        rules: {
            '@lwc/lwc/no-api-reassignments': 'off',
            '@lwc/lwc/no-async-operation': 'off',
            '@lwc/lwc/no-document-query': 'off'
        }
    },

    // productDetailComponent tries multiple API endpoint shapes sequentially in a loop
    {
        files: ['**/lwc/productDetailComponent/productDetailComponent.js'],
        rules: {
            'no-await-in-loop': 'off'
        }
    },

    // cartActionButtons uses document.createElement/appendChild for PDF download trigger
    // and setTimeout and to clear the success message
    {
        files: ['**/lwc/cartActionButtons/*.js'],
        rules: {
            '@lwc/lwc/no-document-query': 'off',
            '@lwc/lwc/no-async-operation': 'off'
        }
    },

    // checkoutLoginGate uses document.createElement for POST-based login form (C4 security fix)
    {
        files: ['**/lwc/checkoutLoginGate/*.js'],
        rules: {
            '@lwc/lwc/no-document-query': 'off'
        }
    },

    // LWC configuration with override for LWC test files
    {
        files: ['**/lwc/**/*.test.js'],
        extends: [lwcConfig],
        rules: {
            '@lwc/lwc/no-unexpected-wire-adapter-usages': 'off'
        },
        languageOptions: {
            globals: {
                ...globals.node
            }
        }
    },

    // Jest mocks configuration
    {
        files: ['**/jest-mocks/**/*.js'],
        languageOptions: {
            sourceType: 'module',
            ecmaVersion: 'latest',
            globals: {
                ...globals.node,
                ...globals.es2021,
                ...jestPlugin.environments.globals.globals
            }
        },
        plugins: {
            eslintJs
        },
        extends: ['eslintJs/recommended']
    }
]);