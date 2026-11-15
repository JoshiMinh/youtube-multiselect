import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSelectionFile, selectionHtml } from '../src/polymer/selection-files.js';
import { allowedExtensionUrl, validPagePreference } from '../src/bridge.js';

const ids = ['aaaaaaaaaaa', 'bbbbbbbbbbb'];
test('JSON, text, and HTML selections round-trip, including files with no MIME type', () => {
  assert.deepEqual(parseSelectionFile(JSON.stringify(ids), '', 'selection.json'), ids);
  assert.deepEqual(parseSelectionFile(` ${ids[0]}\r\n${ids[1]}\r\n`, '', 'selection.txt'), ids);
  const html = selectionHtml(ids.map((id) => ({ id, title: '<script>"&</script>', thumbnail: 'https://i.ytimg.com/image.jpg' })));
  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('&lt;script&gt;'), true);
  assert.deepEqual(parseSelectionFile(html, 'text/html'), ids);
  assert.deepEqual(parseSelectionFile('<a href="/shorts/aaaaaaaaaaa">Short</a>', 'text/html'), [ids[0]]);
  assert.equal(selectionHtml([{ id: ids[0], thumbnail: 'javascript:alert(1)' }]).includes('<img'), false);
});

test('invalid, empty, and unsupported files are rejected before any playlist action', () => {
  for (const content of ['[]', '["short"]', '["aaaaaaaaaa!"]', '{}', 'null', '[null]', '[123]']) {
    assert.throws(() => parseSelectionFile(content, 'application/json'));
  }
  assert.throws(() => parseSelectionFile('', 'text/plain'));
  assert.throws(() => parseSelectionFile('aaaaaaaaaaa', 'image/png'));
  assert.throws(() => selectionHtml([{ id: '"onclick="bad' }]));
});

test('the page bridge accepts only supported values and shortcut URLs', () => {
  assert.equal(allowedExtensionUrl('chrome://extensions/shortcuts'), true);
  for (const url of ['javascript:alert(1)', 'file:///private', 'https://example.com', null]) assert.equal(allowedExtensionUrl(url), false);
  assert.equal(validPagePreference('barPosition', { x: 10, y: 20 }), true);
  assert.equal(validPagePreference('barPosition', { x: '10', y: 20 }), false);
  assert.equal(validPagePreference('callout', -1), false);
  assert.equal(validPagePreference('callout', 7), true);
  assert.equal(validPagePreference('preserveSelection', true), false);
  assert.equal(validPagePreference('blacklisted', true), false);
  assert.equal(validPagePreference('handle', '@w-regner'), false);
  assert.equal(validPagePreference('counts', { copy: 1, cut: 2, paste: 3, move: 0 }), true);
  assert.equal(validPagePreference('counts', { copy: -1, cut: 0, paste: 0, move: 0 }), false);
});
