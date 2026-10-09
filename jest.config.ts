import type {Config} from 'jest';

const config: Config = {
  clearMocks: true,
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.ts$": "@swc/jest",
  },
  collectCoverage: false,
  coverageDirectory: "coverage",
  coverageProvider: "v8",
};

export default config;
