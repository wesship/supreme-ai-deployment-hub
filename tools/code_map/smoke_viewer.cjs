// Synthetic fixtures only: never scan or upload a real checkout snapshot.
const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');

(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'code-map-smoke-'));
  let browser;
  try {
    const root = path.join(temp, 'fixture');
    fs.mkdirSync(path.join(root, 'pkg'), { recursive: true });
    fs.writeFileSync(path.join(root, 'pkg', '__init__.py'), '');
    const longName = 'module_with_a_deliberately_long_source_filename_for_mobile_layout';
    const imports = Array.from({ length: 42 }, (_, i) => 'import pkg.neighbor_' + i + '\n').join('');
    const source = imports + '\ndef fixture_symbol():\n    return "<script>globalThis.injected = true</script>"\n';
    fs.writeFileSync(path.join(root, 'pkg', longName + '.py'), source);
    for (let i = 0; i < 42; i++) fs.writeFileSync(path.join(root, 'pkg', 'neighbor_' + i + '.py'), 'VALUE = ' + i + '\n');
    const output = path.join(temp, 'snapshot.html');
    execFileSync('python', ['tools/code_map/code_map.py', '--root', root, 'build', '--output', output], { stdio: 'pipe' });
    browser = await chromium.launch({ headless: true });
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, offline: true });
      const page = await context.newPage();
      const errors = [], outbound = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('request', request => { if (/^https?:|^wss?:/.test(request.url())) outbound.push(request.url()); });
      await context.route(/^https?:/, route => route.abort());
      await page.goto(pathToFileURL(output).href);
      await page.locator('#search').fill('fixture_symbol');
      await page.locator('#files button').click();
      assert.match(await page.locator('#selected').innerText(), /deliberately_long/);
      assert.match(await page.locator('#graph-note').innerText(), /Showing 40 of 42/);
      assert.equal(await page.locator('#relations button').count(), 42);
      await page.locator('#symbols').selectOption('1');
      assert.match(await page.locator('#source').innerText(), /fixture_symbol/);
      assert.match(await page.locator('#source').innerText(), /<script>/);
      assert.equal(await page.evaluate(() => globalThis.injected), undefined);
      await page.locator('#relations button').first().click();
      assert.match(await page.locator('#source').innerText(), /SHA-256:/);
      await page.locator('#graph g').first().focus();
      await page.keyboard.press('Enter');
      assert.match(await page.locator('#selected').innerText(), /neighbor_/);
      await page.locator('#search').fill('fixture_symbol');
      await page.locator('#files button').click();
      const dimensions = await page.evaluate(() => ({
        viewport: innerWidth, document: document.documentElement.scrollWidth,
        graph: document.getElementById('graph').getBoundingClientRect().width
      }));
      assert.ok(dimensions.graph > 0, 'Graph must render');
      assert.ok(dimensions.document <= dimensions.viewport + 1,
        'Horizontal overflow at ' + viewport.width + ': ' + JSON.stringify(dimensions));
      await page.locator('#search').fill('no-such-fixture-symbol');
      assert.equal(await page.locator('#files button').count(), 0);
      assert.match(await page.locator('#files').innerText(), /0 matches/);
      assert.deepEqual(errors, [], 'Viewer page errors');
      assert.deepEqual(outbound, [], 'Viewer attempted an outbound request');
      console.log(JSON.stringify({ viewport, dimensions, errors, outbound, result: 'passed' }));
      await context.close();
    }
    const empty = path.join(temp, 'empty');
    fs.mkdirSync(empty);
    execFileSync('python', ['tools/code_map/code_map.py', '--root', empty, 'build', '--output', output]);
    const context = await browser.newContext({ offline: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(output).href);
    assert.match(await page.locator('#summary').innerText(), /0 source files/);
    assert.equal(await page.locator('#files button').count(), 0);
    assert.deepEqual(errors, []);
    await context.close();
    console.log('Empty snapshot: passed; browser ' + browser.version());
  } finally {
    if (browser) await browser.close();
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
