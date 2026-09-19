/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    // 쿠키·document 를 쓰는 코드(getCookie, useAPI)가 있어서 jsdom 이 필요하다
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // 테스트 파일은 소스 옆이 아니라 src/**/*.test.ts(x) 어디에 둬도 잡힌다
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": "/src",
      container: "/src/container",
    },
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`,
      },
    },
  },
});
