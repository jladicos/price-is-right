import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll } from "vitest";

// Mock ResizeObserver for tests
beforeAll(() => {
  (
    globalThis as typeof globalThis & { ResizeObserver: unknown }
  ).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// Cleanup after each test
afterEach(() => {
  cleanup();
});
