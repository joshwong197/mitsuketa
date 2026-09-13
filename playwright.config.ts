import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/browser',
    use: { trace: 'off', screenshot: 'off' },
    projects: [
        {
            name: 'app',
            testIgnore: 'property-flow.spec.ts',
            use: { baseURL: 'http://127.0.0.1:3000' },
        },
        {
            name: 'password-property-flow',
            testMatch: 'property-flow.spec.ts',
            use: { baseURL: 'http://127.0.0.1:3010' },
        },
    ],
    webServer: [
        {
            command: 'npx vite --host 127.0.0.1 --port 3000 --strictPort',
            url: 'http://127.0.0.1:3000',
            reuseExistingServer: !process.env.CI,
        },
        {
            command: 'set "VITE_PROPERTY_AUTH_MODE=password" && npx vite --host 127.0.0.1 --port 3010 --strictPort',
            url: 'http://127.0.0.1:3010',
            reuseExistingServer: false,
        },
    ],
});
