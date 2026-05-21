module.exports = {
  setupFiles: ['<rootDir>/tests/setup.js'],
  testMatch: ['**/tests/**/*.test.js', '**/__tests__/**/*.test.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/integration/',
  ],
  collectCoverageFrom: [
    'services/**/*.js',
    'lib/deadStock.js',
    'middleware/role.js',
    '!**/*.test.js',
  ],
};
