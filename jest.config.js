module.exports = {
  collectCoverageFrom: [
    '**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**'
  ],
  verbose: true,
  // setupFilesAfterEnv: ['<rootDir>/setupTest.js'],
  testPathIgnorePatterns: ['/node_modules/', '__tests__/mock/', '/build/'],
  // transform: {
  //   '^.+\\.(js|jsx|ts|tsx)$': '<rootDir>/node_modules/babel-jest'
  // },
  // setupFiles: ['<rootDir>/setupTest.js'],
  globalSetup: "./src/__test__/config/globalSetup",
  globalTeardown: "./src/__test__/config/globalTeardown"
};
