const test = require('node:test');
const assert = require('node:assert/strict');
const Journey = require('../state.js');

function finishChapter(state, n) {
  const ids = [['flower-0', 'flower-1', 'flower-2'], ['letter'], ['lamp-0', 'lamp-1', 'lamp-2']];
  for (const id of ids[n]) assert.equal(state.doTask(n, id), true);
  assert.equal(state.openMemory(), true);
  assert.equal(state.openGift(), true);
  assert.equal(state.completeChapter(), true);
}
test('chapters cannot be skipped or completed before the gift handoff', () => {
  const s = new Journey();
  assert.equal(s.doTask(1, 'letter'), false);
  assert.equal(s.doTask(0, 'made-up'), false);
  assert.equal(s.openMemory(), false);
  assert.equal(s.completeChapter(), false);
  for (let i = 0; i < 3; i++) s.doTask(0, 'flower-' + i);
  assert.equal(s.openMemory(), true);
  assert.equal(s.completeChapter(), false);
  assert.equal(s.chapter, 0);
  assert.equal(s.openGift(), true);
  assert.equal(s.chapter, 0, 'gift reveal must remain paused until explicit completion');
  assert.equal(s.completeChapter(), true);
  assert.equal(s.completeChapter(), false);
  assert.deepEqual(s.stars, [0]);
});
test('repeated interactions do not grant duplicate tasks or stars', () => {
  const s = new Journey();
  assert.equal(s.doTask(0, 'flower-0'), true);
  assert.equal(s.doTask(0, 'flower-0'), false);
  assert.equal(s.ready(), false);
  s.doTask(0, 'flower-1'); s.doTask(0, 'flower-2');
  assert.equal(s.ready(), true);
  s.openMemory();
  assert.equal(s.openMemory(), false);
  assert.equal(s.doTask(0, 'flower-2'), false);
  s.openGift(); s.completeChapter();
  assert.equal(s.doTask(0, 'flower-1'), false);
  assert.equal(s.finish(), false);
});
test('every choice converges on the complete ending', () => {
  for (const company of ['walk', 'home']) for (const future of ['travel', 'everyday', 'secret']) {
    const s = new Journey(); finishChapter(s, 0);
    s.choose(1, company); finishChapter(s, 1);
    s.choose(2, future); finishChapter(s, 2);
    assert.deepEqual(s.stars, [0, 1, 2]);
    assert.equal(s.choices[1], company); assert.equal(s.choices[2], future);
    assert.equal(s.finish(), true); assert.equal(s.finish(), false);
  }
});
test('restart clears tasks, choices, gifts and the ending', () => {
  const s = new Journey(); for (let i = 0; i < 3; i++) finishChapter(s, i);
  s.finish(); s.reset();
  assert.equal(s.chapter, 0); assert.equal(s.stage, 'explore'); assert.equal(s.ended, false);
  assert.deepEqual(s.stars, []); assert.deepEqual(s.choices, {});
  assert.deepEqual(s.tasks.map(t => t.size), [0, 0, 0]);
  assert.equal(s.doTask(0, 'flower-0'), true);
});
