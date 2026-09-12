import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/browser',
    use: { baseURL: 'http://127.0.0.1:3000', trace: 'off', screenshot: 'off' },
    webServer: {
        command: 'npx vite --host 127.0.0.1 --port 3000 --strictPort',
        url: 'http://127.0.0.1:3000',
        reuseExistingServer: !process.env.CI,
    },
});
