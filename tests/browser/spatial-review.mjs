import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const base = process.env.BASE_URL ?? 'http://127.0.0.1:5193';
const output = process.env.REVIEW_OUTPUT ?? '/tmp/fly-escape-spatial-review';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const parentServer = createServer((request, response) => { response.setHeader('Content-Type', 'text/html'); response.end(`<!doctype html><iframe style="width:1200px;height:900px" src="${base}/spatial-review.html"></iframe>`); });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
page.on('console', message => { if (message.type() === 'error') console.log('Browser:', message.text()); });
async function request(data) {
  return page.evaluate(data => new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timer = setTimeout(() => { window.removeEventListener('message', receive); reject(new Error(`No reply to ${data.type}`)); }, 30000);
    const receive = event => {
      if (event.data?.requestId !== requestId || event.data.type === data.type) return;
      clearTimeout(timer); window.removeEventListener('message', receive); resolve({ ...event.data, byteLength: event.data.bytes?.byteLength });
    };
    window.addEventListener('message', receive);
    window.postMessage({ ...data, requestId }, location.origin);
  }), data);
}
const catalogRequest = { type: 'alterno:spatial-review:request', profile: 'review', progressive: true, capabilities: ['scene-assemblies-v1'], geometryTransfer: { capability: 'geometry-transfer-v1', maxBytes: 64 * 1024 * 1024 } };
try {
  const discoveryResponse = await page.request.get(`${base}/.well-known/spatial-review.json`);
  assert.equal(discoveryResponse.status(), 200);
  assert.equal((await discoveryResponse.json()).schema, 'spatial-review-discovery/v1');
  assert.equal(discoveryResponse.headers()['access-control-allow-origin'], 'https://spatial-review.alterno.dev');
  for (const level of ['open-window', 'turn-the-corner']) {
    await page.goto(`${base}/spatial-review.html?level=${level}`);
    await page.waitForFunction(() => document.querySelector('#status')?.dataset.state === 'ready', { timeout: 90000 });
    const discovery = await request({ type: 'alterno:spatial-review:discovery-request' });
    assert.equal(new URL(discovery.discovery.liveCapture).searchParams.get('level'), level);
    const catalog = await request(catalogRequest);
    assert.equal(catalog.type, 'alterno:spatial-review:catalog');
    assert.equal(catalog.progressive, true);
    const payload = catalog.payload;
    assert.ok(payload.scene.actors.length > 25);
    assert.equal(payload.scene.assemblies.length, 1);
    const ids = payload.scene.actors.map(actor => actor.actorId);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.every(id => id.startsWith(level)));
    const assetId = `${level}-room-2-floor`;
    const assetReply = await request({ type: 'alterno:spatial-review:asset-request', buildId: payload.buildId, assetId, profile: 'review' });
    assert.equal(assetReply.ok, true, JSON.stringify(assetReply));
    assert.ok(assetReply.asset.geometries.length > 0);
    const maps = assetReply.asset.materials.flatMap(material => material.maps ?? []);
    assert.ok(maps.length > 0, 'Expected a textured tile floor');
    for (const map of maps) {
      const texture = await request({ type: 'alterno:spatial-review:resource-request', resourceId: map.resourceId });
      assert.equal(texture.ok, true, JSON.stringify(texture));
      assert.match(texture.contentType, /^image\//);
      assert.ok(texture.byteLength > 0);
    }
    await page.screenshot({ path: `${output}/${level}.png` });
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#status')?.dataset.state === 'ready', { timeout: 90000 });
    const refreshed = await request(catalogRequest);
    assert.deepEqual(refreshed.payload.scene.actors.map(actor => actor.actorId), ids);
    console.log(`${level}: ${ids.length} actors, textured floor transfer and reload passed`);
  }
  // Real cross-origin parent: a different loopback origin is deliberately unauthorized.
  await new Promise(resolve => parentServer.listen(0, '127.0.0.1', resolve));
  await page.goto(`http://127.0.0.1:${parentServer.address().port}/`);
  await page.frameLocator('iframe').locator('#status[data-state=ready]').waitFor({ timeout: 90000 });
  const rejection = await page.evaluate(() => new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const timer = setTimeout(() => reject(new Error('No origin rejection')), 10000);
    window.addEventListener('message', function receive(event) {
      if (event.data?.requestId !== requestId) return;
      clearTimeout(timer); window.removeEventListener('message', receive); resolve(event.data);
    });
    document.querySelector('iframe').contentWindow.postMessage({ type: 'alterno:spatial-review:request', requestId }, '*');
  }));
  assert.equal(rejection.type, 'spatial-review:connection-rejected');
  assert.equal(rejection.payload, undefined);
  console.log('Unauthorized loopback parent rejected');
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto(base);
  await page.waitForSelector('canvas', { timeout: 90000 });
  assert.ok(!requests.some(url => /spatial-review|\/review-/.test(url)), 'Normal game loaded review code');
  assert.deepEqual(errors, []);
  console.log('Normal game renders without review code; no browser errors');
} finally { parentServer.close(); await browser.close(); }
