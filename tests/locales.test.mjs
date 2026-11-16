import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

test('movement and filter messages exist in every supported locale', async () => {
  for (const locale of await readdir(new URL('../src/_locales/', import.meta.url))) {
    const messages = JSON.parse(await readFile(new URL(`../src/_locales/${locale}/messages.json`, import.meta.url), 'utf8'));
    const moveKeys = ['moveUp', 'moveDown', 'moveToTop', 'moveToBottom'];
    for (const key of [...moveKeys, 'menuDuration', 'menuDate', 'menuFiles', 'menuMoveStep', 'menuMoveEnds', 'sortDurationAsc', 'sortDurationDesc', 'sortDateAsc', 'sortDateDesc', 'sortMissingData', 'filterApply', 'filterHelp', 'filterPattern', 'filterResult', 'filterSource', 'filterLoading']) assert.ok(messages[key]?.message, `${locale}: ${key}`);
    assert.equal(new Set(moveKeys.map((key) => messages[key].message)).size, 4, `${locale}: movement actions must be distinguishable`);
    assert.ok(messages.filterResult.message.includes('{count}'), `${locale}: result count placeholder`);
  }
});
