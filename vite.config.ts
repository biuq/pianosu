import { defineConfig } from 'vitest/config'

export default defineConfig({
    build: {
      target: 'esnext' //browsers can handle the latest ES features
    }
});
