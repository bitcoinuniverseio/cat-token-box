module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/routes/healthCheck/healthCheck.controller.spec.ts',
    '<rootDir>/src/services/tx/tx.native-order.spec.ts',
  ],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  moduleNameMapper: { '^src/(.*)$': '<rootDir>/src/$1' },
};
