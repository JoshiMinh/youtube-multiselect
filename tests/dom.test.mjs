import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

test('page runtime builds DOM without HTML parsing sinks or trust policies', async () => {
  const directory = new URL('../src/polymer/', import.meta.url);
  for (const file of await readdir(directory)) {
    if (!file.endsWith('.js')) continue;
    const source = await readFile(new URL(file, directory), 'utf8');
    assert.doesNotMatch(source, /\b(?:innerHTML|outerHTML)\s*=|\.insertAdjacentHTML\s*\(|\.createPolicy\s*\(/, file);
  }
  const core = await readFile(new URL('core.js', directory), 'utf8');
  assert.doesNotMatch(core, /blacklisted|GET_ACCOUNT_MENU|activeAccountHeaderRenderer/);
});
