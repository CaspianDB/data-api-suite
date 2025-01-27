module.exports = {
  verbose: true,
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  collectCoverageFrom: [
    'packages/**/src/**/*.ts'
  ],
  globalSetup: '<rootDir>/jest/globalSetup.js',
}
