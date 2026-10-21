import {defineConfig, devices} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const PORT=+process.env.TEST_PORT||8123;

/* Every spec runs twice: against the ES-module source served over http, and against the
   single-file build opened from disk, which is how most people use the editor. A third project,
   docs, rebuilds the documentation's pictures with the app (tests/docs). */
export default defineConfig({
  testDir:'tests/e2e',
  fullyParallel:true,
  forbidOnly:!!process.env.CI,
  retries:process.env.CI?1:0,
  reporter:process.env.CI?[['list'],['html',{open:'never'}]]:'list',
  use:{...devices['Desktop Chrome'],viewport:{width:1400,height:900},trace:'retain-on-failure'},
  projects:[
    {name:'modules',use:{appUrl:`http://localhost:${PORT}/index.html`}},
    {name:'bundle',use:{appUrl:pathToFileURL(resolve('dist/DesignRoutes-editor.html')).href}},
    {name:'docs',testDir:'tests/docs',use:{appUrl:`http://localhost:${PORT}/index.html`,viewport:{width:1440,height:810}}},
  ],
  webServer:{command:`npx vite --port ${PORT} --strictPort`,url:`http://localhost:${PORT}/index.html`,reuseExistingServer:!process.env.CI},
});
