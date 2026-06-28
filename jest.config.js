/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Only treat *.test.ts(x) files as tests so shared helpers under
  // src/test-utils are imported but never executed as a suite.
  testMatch: ['**/?(*.)+(test).[jt]s?(x)'],
  clearMocks: true,
};
