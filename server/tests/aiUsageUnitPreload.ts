import { mock } from 'bun:test';

// Agent unit tests own stream behavior; aiUsage/integration.test.ts verifies real persistence.
mock.module('../aiUsage/repository', () => ({
  saveAiUsage: mock(async () => {}),
}));
