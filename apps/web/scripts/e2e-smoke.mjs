#!/usr/bin/env node
// Browser smoke test against a running app: node scripts/e2e-smoke.mjs http://localhost:3000
// Needs Playwright (npx playwright install chromium, or a preinstalled copy). Voice output is switched off.
const base = process.argv[2] || 'http://localhost:3000';
const pw = await import('playwright').catch(() => null);
if (!pw) { console.log('Playwright not installed: npm i -D playwright && npx playwright install chromium'); process.exit(1); }
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base);
await page.getByLabel(/Speak replies|जवाब बोलकर/).uncheck();
await page.getByRole('button', { name: /Sunday Money Call|संडे मनी कॉल/ }).click();
await page.locator('.msg.bot .bubble').first().waitFor({ timeout: 30000 });
await page.getByPlaceholder(/type here|यहाँ लिखें/).fill('haan');
await page.getByRole('button', { name: /Send|भेजें/ }).click();
await page.locator('.action').first().waitFor({ timeout: 30000 });
console.log('First answer:', (await page.locator('.msg.bot .bubble').first().innerText()).slice(0, 200));
console.log('Actions:', await page.locator('.action .title').allInnerTexts());
await page.screenshot({ path: 'e2e.png', fullPage: true });
await browser.close();
if (errors.length) { console.log('Page errors:', errors); process.exit(1); }
console.log('PASS');
