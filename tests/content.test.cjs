const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'content.js'), 'utf8'), context);
const content = JSON.parse(JSON.stringify(context.window.BIRTHDAY_CONTENT));

test('public content has six local illustrations and stable progression identifiers', () => {
  assert.deepEqual(content.chapters.map(chapter => chapter.id), ['meeting', 'company', 'future']);
  const photos = content.chapters.flatMap(chapter => chapter.photos);
  assert.deepEqual(photos.map(photo => photo.id), Array.from({ length: 6 }, (_, i) => `photo-${i + 1}`));
  for (const photo of photos) {
    assert.match(photo.src, /^assets\/photos\/\d{2}\.svg$/);
    const svg = fs.readFileSync(path.join(root, photo.src), 'utf8');
    assert.match(svg, /<svg /);
    assert.doesNotMatch(svg, /<image\b|<script\b|(?:href|src)\s*=/i, 'placeholder contains no embedded or external assets');
    assert.ok(photo.caption && photo.alt);
  }
  assert.deepEqual(content.chapters[1].choices.map(choice => choice.id), ['walk', 'home']);
  assert.deepEqual(content.chapters[2].choices.map(choice => choice.id), ['travel', 'everyday', 'secret']);
});

test('template tokens resolve and all chapters provide complete memories and gifts', () => {
  for (const token of JSON.stringify(content).matchAll(/\{([a-z]+)\}/g)) {
    assert.ok(['recipient', 'sender'].includes(token[1]), `unknown template token: ${token[1]}`);
  }
  for (const chapter of content.chapters) {
    assert.equal(chapter.photos.length, 2);
    assert.ok(chapter.memory.length > 0);
    assert.equal(typeof chapter.gift.enabled, 'boolean');
    for (const field of ['symbol', 'token', 'realName', 'reveal', 'message']) assert.ok(chapter.gift[field]);
  }
  assert.ok(content.ending.letter.length > 0);
});
