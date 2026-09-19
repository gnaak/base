import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";

// jsdom 에는 document.cookie 가 있지만 테스트 간에 남는다. 매번 비운다.
const clearCookies = () => {
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=;max-age=0;path=/`;
  }
};

beforeEach(() => {
  clearCookies();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  clearCookies();
});
