import type {Config} from 'jest';
import { config as loadEnv } from "dotenv";

const testEnv = loadEnv({ path: ".env.test", quiet: true });
const testDatabaseUrl = testEnv.parsed?.DATABASE_URL;

if (!testDatabaseUrl || new URL(testDatabaseUrl).pathname !== "/labsafe_test") {
  throw new Error("Configure DATABASE_URL no arquivo .env.test para usar o banco labsafe_test.");
}

process.env.DATABASE_URL = testDatabaseUrl;

const config: Config = {
  clearMocks: true,
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.ts$": ["@swc/jest", {
      jsc: {
        parser: {
          syntax: "typescript",
        },
      },
      module: {
        type: "commonjs",
      },
    }],
  },
  collectCoverage: false,
  coverageDirectory: "coverage",
  coverageProvider: "v8",
};

export default config;
