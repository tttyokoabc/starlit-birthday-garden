const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const output = path.resolve(__dirname, '../test-results');
fs.mkdirSync(output, { recursive: true });
const file = pathToFileURL(path.resolve(__dirname, '../index.html')).href;
let browser;

async function setup(overrides = false) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [], network = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/^https?:/, route => { network.push(route.request().url()); return route.abort(); });
  await page.addInitScript(({ overrides }) => {
    // Observe real state and rendered coordinates without changing gameplay.
    Object.defineProperty(window, 'Journey', { configurable: true, set(Base) {
      Object.defineProperty(window, 'Journey', { configurable: true, value: class extends Base { constructor() { super(); window.__observedJourney = this; } } });
    } });
    const original = CanvasRenderingContext2D.prototype.ellipse;
    CanvasRenderingContext2D.prototype.ellipse = function (x, y, rx, ry, ...rest) {
      if (this.canvas.id === 'world' && rx === 14 && ry === 5) window.__observedPlayer = { x, y: y - 3 };
      return original.call(this, x, y, rx, ry, ...rest);
    };
    if (overrides) Object.defineProperty(window, 'BIRTHDAY_CONTENT', { configurable: true, set(content) {
      content.recipient = '小月亮'; content.sender = '小星星';
      content.chapters.forEach(c => { c.gift.enabled = false; });
      content.chapters[0].photos[0].src = 'assets/photos/intentionally-missing.jpg';
      content.chapters[0].photos[1].src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="900"><rect width="300" height="900" fill="#b1c6b6"/><text x="30" y="430" font-size="25">Portrait test</text></svg>');
      Object.defineProperty(window, 'BIRTHDAY_CONTENT', { configurable: true, value: content });
    } });
  }, { overrides });
  await page.goto(file); await page.waitForFunction(() => !!window.BIRTHDAY_CONTENT);
  return { context, page, errors, network };
}
const state = page => page.evaluate(() => ({ chapter: window.__observedJourney.chapter, stage: window.__observedJourney.stage, stars: [...window.__observedJourney.stars], ended: window.__observedJourney.ended, tasks: window.__observedJourney.tasks.map(t => t.size), choices: window.__observedJourney.choices }));
async function click(page, name) { await page.getByRole('button', { name, exact: true }).click(); }
async function walkAxis(page, axis, destination) {
  const current = await page.evaluate(axis => window.__observedPlayer[axis], axis);
  if (Math.abs(current - destination) < 7) return;
  const sign = destination > current ? 1 : -1;
  const key = axis === 'x' ? (sign > 0 ? 'd' : 'a') : (sign > 0 ? 's' : 'w');
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(({ axis, destination, sign }) => (window.__observedPlayer[axis] - destination) * sign >= -5, { axis, destination, sign }, { timeout: 15000, polling: 'raf' });
  } finally { await page.keyboard.up(key); }
}
async function walk(page, x, y) { await walkAxis(page, 'x', x); await walkAxis(page, 'y', y); }
async function interact(page, expected) {
  await page.waitForFunction(() => !document.getElementById('interact-button').hidden);
  if (expected) assert.match(await page.locator('#interact-button').innerText(), expected);
  await page.keyboard.press('e');
}
async function start(page) {
  await click(page, '打开这封邀请 ↗');
  assert.equal(await page.locator('#story-dialog').evaluate(el => el.open), true);
  await click(page, '沿着花香，出发吧 →');
  await page.waitForFunction(() => !!window.__observedPlayer);
}
async function flowers(page) {
  for (const [x, y] of [[285, 532], [385, 475], [420, 607]]) { await walk(page, x, y); await interact(page, /浇水/); }
  assert.deepEqual((await state(page)).tasks, [3, 0, 0]);
  await walk(page, 345, 570); await interact(page, /相遇之星/);
}
async function collect(page, gifts, index) {
  assert.equal((await state(page)).stage, 'memory');
  assert.equal(await page.locator('#dialog-note').isVisible(), false);
  if (gifts) {
    await page.waitForFunction(() => [...document.querySelectorAll('.photo-card img')].length === 2 && [...document.querySelectorAll('.photo-card img')].every(img => img.complete && img.naturalWidth > 0));
    assert.equal(await page.locator('.photo-fallback').count(), 0);
    await page.screenshot({ path: path.join(output, `memory-chapter-${index + 1}.png`), fullPage: true });
    await click(page, '看看星星带来的礼物 →');
    assert.equal((await state(page)).chapter, index);
    await click(page, '让它来到现实里 →');
    const before = await state(page);
    await page.keyboard.press('Escape'); await page.keyboard.press('e');
    assert.deepEqual(await state(page), before, 'Escape / E cannot bypass the handoff');
    assert.equal(await page.locator('#story-dialog').evaluate(el => el.open), true);
    if (index === 0) await page.screenshot({ path: path.join(output, '03-gift-pause.png') });
    await click(page, '收到啦，继续旅程 →');
  } else await click(page, '收下这颗星星，继续旅程 →');
  assert.equal((await state(page)).chapter, index + 1);
}
async function restOfStory(page, gifts, alt) {
  await walk(page, 699, 363); await interact(page, /信/);
  const companyChoice = await page.evaluate(alt => window.BIRTHDAY_CONTENT.chapters[1].choices[alt ? 1 : 0], alt);
  await click(page, companyChoice.label);
  assert.ok((await page.locator('#dialog-content').innerText()).includes(companyChoice.response));
  await click(page, '把这一刻收进回忆 →'); await collect(page, gifts, 1);
  await walk(page, 1000, 383); await interact(page, /湖灯/);
  await walk(page, 1000, 330); await walk(page, 1310, 330); await walk(page, 1310, 580); await walk(page, 1270, 512); await interact(page, /湖灯/);
  await walkAxis(page, 'y', 594); await walk(page, 1080, 594); await interact(page, /湖灯/);
  await walk(page, 1180, 635); await interact(page, /心愿/);
  const futureChoice = await page.evaluate(alt => window.BIRTHDAY_CONTENT.chapters[2].choices[alt ? 2 : 0], alt);
  await click(page, futureChoice.label);
  assert.ok((await page.locator('#dialog-content').innerText()).includes(futureChoice.response));
  await click(page, '把这一刻收进回忆 →'); await collect(page, gifts, 2);
  await walkAxis(page, 'y', 708); await walk(page, 745, 708); await interact(page, /生日/);
  assert.equal((await state(page)).ended, true);
  assert.deepEqual((await state(page)).stars, [0, 1, 2]);
}

(async () => {
  browser = await chromium.launch(process.env.BROWSER_PATH
    ? { executablePath: process.env.BROWSER_PATH, headless: true }
    : process.argv.includes('--chromium') ? { headless: true } : { channel: 'msedge', headless: true });
  const normal = await setup(), { page } = normal;
  assert.equal(await page.locator('#demo-badge').count(), 0);
  await page.screenshot({ path: path.join(output, '01-invitation.png'), fullPage: true });
  await start(page);
  await page.screenshot({ path: path.join(output, '02-garden.png'), fullPage: true });
  // Blur must release movement even if keyup occurs in another window.
  await page.keyboard.down('a'); await page.waitForTimeout(130); await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.keyboard.up('a');
  const atBlur = await page.evaluate(() => window.__observedPlayer.x);
  await page.waitForTimeout(160); assert.equal(await page.evaluate(() => window.__observedPlayer.x), atBlur);
  assert.equal(await page.evaluate(() => window.scrollY), 0);
  await click(page, '♫ 音乐开'); assert.equal(await page.locator('#sound-button').getAttribute('aria-pressed'), 'false');
  await click(page, '♫ 音乐关'); assert.equal(await page.locator('#sound-button').getAttribute('aria-pressed'), 'true');
  await click(page, '⛶ 全屏'); assert.equal(await page.evaluate(() => !!document.fullscreenElement), true); await click(page, '⛶ 退出全屏');
  await page.waitForFunction(() => !document.fullscreenElement && document.getElementById('fullscreen-button').textContent === '⛶ 全屏');
  await page.locator('#world').focus();
  await flowers(page);
  const location = await page.evaluate(() => ({ ...window.__observedPlayer }));
  await page.keyboard.down('d'); await page.waitForTimeout(130); await page.keyboard.up('d');
  assert.deepEqual(await page.evaluate(() => window.__observedPlayer), location, 'dialog freezes movement');
  await page.locator('.photo-card button').first().click();
  assert.equal(await page.locator('#photo-dialog').evaluate(el => el.open), true);
  await page.waitForFunction(() => { const img = document.querySelector('#photo-view img'); return img?.complete && img.naturalWidth > 0; });
  const landscape = await page.locator('#photo-view img').evaluate(img => ({ width: img.naturalWidth, height: img.naturalHeight, fit: getComputedStyle(img).objectFit }));
  assert.deepEqual(landscape, { width: 480, height: 360, fit: 'contain' }, 'landscape illustration is shown without cropping');
  await page.screenshot({ path: path.join(output, 'illustration-full-view.png') });
  await click(page, '关闭照片');
  await collect(page, true, 0); await restOfStory(page, true, false);
  await page.screenshot({ path: path.join(output, '04-birthday-letter.png'), fullPage: true });
  await click(page, '翻翻我们的回忆相册'); assert.equal(await page.locator('.photo-card').count(), 6);
  await click(page, '重读生日信'); await click(page, '再在花园里待一会儿');
  await page.screenshot({ path: path.join(output, '05-lit-courtyard.png'), fullPage: true });
  for (const size of [{ width: 1280, height: 800 }, { width: 1920, height: 1080 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(size);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal overflow');
    await page.screenshot({ path: path.join(output, `garden-${size.width}.png`), fullPage: true });
  }
  await click(page, '重新开始'); await click(page, '留在这段旅程'); assert.equal((await state(page)).ended, true);
  await click(page, '重新开始'); await click(page, '重新打开邀请');
  assert.deepEqual(await state(page), { chapter: 0, stage: 'explore', stars: [], ended: false, tasks: [0, 0, 0], choices: {} });
  assert.equal(await page.locator('#landing').isVisible(), true);
  assert.deepEqual(normal.errors, []); assert.deepEqual(normal.network, []);
  console.log('PASS: real keyboard playthrough, pauses, photos, audio/fullscreen, blur, ending, replay, desktop layouts, zero network.');
  await normal.context.close();

  const alternate = await setup(true), p2 = alternate.page;
  assert.match(await p2.locator('#cover-recipient').innerText(), /小月亮/);
  assert.equal(await p2.locator('#demo-badge').count(), 0);
  await start(p2); await flowers(p2);
  await p2.waitForSelector('.photo-fallback');
  assert.equal(await p2.locator('.photo-fallback').count(), 1);
  await p2.locator('.photo-card button').nth(1).click();
  const image = await p2.locator('#photo-view img').evaluate(img => ({ width: img.naturalWidth, height: img.naturalHeight, fit: getComputedStyle(img).objectFit }));
  assert.deepEqual(image, { width: 300, height: 900, fit: 'contain' }); await click(p2, '关闭照片');
  await p2.screenshot({ path: path.join(output, '06-photo-fallback-and-portrait.png') });
  await collect(p2, false, 0); await restOfStory(p2, false, true);
  assert.match(await p2.locator('#dialog-title').innerText(), /小月亮/);
  assert.match(await p2.locator('.letter-signature').innerText(), /小星星/);
  assert.equal((await state(p2)).choices[1], 'home'); assert.equal((await state(p2)).choices[2], 'secret');
  assert.deepEqual(alternate.errors, []); assert.deepEqual(alternate.network, []);
  console.log('PASS: alternate choices, no physical gifts, custom names, missing image, portrait photo, ending.');
  await alternate.context.close();
})().catch(async error => {
  console.error(error);
  if (browser) for (const context of browser.contexts()) for (const page of context.pages()) {
    try { await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }); console.error('Last observed state:', await state(page)); console.error('Last observed position:', await page.evaluate(() => window.__observedPlayer)); } catch {}
  }
  process.exitCode = 1;
}).finally(async () => { if (browser) await browser.close(); });
