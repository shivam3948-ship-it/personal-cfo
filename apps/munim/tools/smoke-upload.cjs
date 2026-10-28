// Smoke test for the one-button upload (D-068): four kinds of file chosen together, each recognised on its own.
//   node tools/smoke-upload.cjs [base-url]      default http://localhost:3000; works against the live site too
// Uses only made-up data: a synthetic HDFC statement (from tests/banks.test.ts), the sample CAS and SMS, and a loan letter
// that Munim can't read (it must say so). Nothing real is uploaded; everything is read in the test browser.
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os');
const { chromium } = require('playwright');
const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const root = path.join(__dirname, '..'), data = path.join(root, '../../packages/core/data');
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'munim-upload-'));
  const hdfc = eval(/const HDFC = (\[[\s\S]*?\]);/.exec(fs.readFileSync(path.join(root, 'tests/banks.test.ts'), 'utf8'))[1]);
  fs.writeFileSync(path.join(dir, 'hdfc_sep.txt'), hdfc.join('\n'));
  for (const f of ['demo-cas/sample_cas_rohan.txt', 'demo/sms_alerts_oct-2026.txt', 'demo/loan_car_kestrel.txt']) fs.copyFileSync(path.join(data, f), path.join(dir, path.basename(f)));
  const files = ['hdfc_sep.txt', 'sample_cas_rohan.txt', 'sms_alerts_oct-2026.txt', 'loan_car_kestrel.txt'].map((f) => path.join(dir, f));
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(`${base}/invest/add`, { waitUntil: 'networkidle', timeout: 120000 });
  await p.setInputFiles('input[type=file]', files);
  await p.waitForSelector('text=files added', { timeout: 60000 });
  const text = await p.innerText('body');
  const want = { '3 of 4 files added': /3 of 4 files added/, 'HDFC read and checked': /HDFC Bank ••5678[\s\S]*balances to the paisa/, 'CAS read': /Mutual fund CAS[\s\S]*5 funds/,
    'SMS read': /Bank SMS[\s\S]*payments read/, 'loan letter refused honestly': /loan_car_kestrel\.txt[\s\S]*Can’t read this one yet/, 'SMS offered': /Paste your bank SMS/ };
  const failed = Object.entries(want).filter(([, re]) => !re.test(text)).map(([k]) => k);
  await p.screenshot({ path: path.join(dir, 'result.png'), fullPage: true }); await b.close();
  console.log(failed.length || errors.length ? `FAIL: ${[...failed, ...errors].join('; ')}` : 'PASS: one upload, four files, each recognised', `\nscreenshot: ${path.join(dir, 'result.png')}`);
  process.exit(failed.length || errors.length ? 1 : 0);
})();
