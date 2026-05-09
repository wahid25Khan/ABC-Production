const { jestConfig } = require("@salesforce/sfdx-lwc-jest/config");

module.exports = {
  ...jestConfig,
  modulePathIgnorePatterns: ["<rootDir>/.localdevserver"],
  moduleNameMapper: {
    "^commerce/(.+)$": "<rootDir>/force-app/test/jest-mocks/commerce/$1.js",
    ...jestConfig.moduleNameMapper
  }
};
