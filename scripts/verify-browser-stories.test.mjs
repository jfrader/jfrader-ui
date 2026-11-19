import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyBrowserStories } from './verify-browser-stories.mjs';

const entries = { 'games-cards--default': {}, 'games-cards--docs': {} };

test('checks literal ids in arrays, helpers, and iframe URLs', () => {
  const source = "['games-cards--default']; withStory('games-cards--docs'); page.goto(`${base}/iframe.html?id=games-cards--default&viewMode=story`);";
  assert.deepEqual(verifyBrowserStories(source, entries), { ids: 2, failures: [] });
});

test('fails for deleted stories and literal URL ids', () => {
  for (const source of ["['games-cards--deleted']", '`/iframe.html?id=games-cards--deleted&viewMode=story`']) {
    assert.deepEqual(verifyBrowserStories(source, entries).failures, ['Unknown Storybook id: games-cards--deleted']);
  }
});

test('rejects assembled fragments instead of silently skipping dynamic ids', () => {
  for (const source of ['`games-cards--${story}`', '`${id}--docs`', '`/iframe.html?id=games-cards--${story}&viewMode=story`']) {
    assert.match(verifyBrowserStories(source, entries).failures.join('\n'), /complete literal story ids/);
  }
});

test('accepts complete-id interpolation and ignores CSS variables and DOM story suffixes', () => {
  const source = "`/iframe.html?id=${story}&viewMode=story`; '--select-height'; 'story--games-cards--default--primary'; 'games-cards--default';";
  assert.deepEqual(verifyBrowserStories(source, entries), { ids: 1, failures: [] });
});
