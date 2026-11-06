import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e', workers:1, timeout:45000,
  use:{baseURL:'http://127.0.0.1:8919',viewport:{width:1440,height:1000},launchOptions:{args:['--no-sandbox']}},
  webServer:{command:'.venv/bin/python tests/serve_fixture.py --port 8919',url:'http://127.0.0.1:8919/media_library/gallery',reuseExistingServer:true,timeout:30000},
});
