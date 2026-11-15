import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import { versionBefore } from '../src/version.js';

const event = () => ({ listeners: [], addListener(listener) { this.listeners.push(listener); } });
for (const target of ['chrome-mv3', 'firefox-mv2']) {
  test(`${target}: startup, toolbar, commands, URL validation, and update preferences`, async () => {
    const calls = [];
    const action = { disable: async () => calls.push('disable'), enable: async (id) => calls.push(['enable', id]), onClicked: event() };
    const api = {
      runtime: { id: 'fixture', onConnect: event(), onMessage: event(), onInstalled: event(),
        openOptionsPage: async () => calls.push('options'), getManifest: () => ({ version: '4.0.0' }) },
      commands: { onCommand: event() },
      tabs: { create: async (tab) => calls.push(tab), sendMessage: async (...args) => calls.push(args), query: async () => [{ id: 10 }] },
      storage: { local: { get: async () => ({ openOptionsOnUpdate: false }), set: async (values) => calls.push(values), remove: async (keys) => calls.push(['remove', keys]) } },
      ...(target === 'firefox-mv2' ? { browserAction: action } : { action }),
    };
    const code = await readFile(new URL(`../.output/${target}/background.js`, import.meta.url), 'utf8');
    vm.runInNewContext(code, { [target === 'firefox-mv2' ? 'browser' : 'chrome']: api, console });
    assert.equal(calls[0], 'disable');
    await api.runtime.onConnect.listeners[0]({ sender: { tab: { id: 42 } } });
    assert.deepEqual(calls.at(-1), ['enable', 42]);
    await action.onClicked.listeners[0]();
    assert.equal(calls.at(-1), 'options');
    await api.commands.onCommand.listeners[0]('toggleMultiSelectMode', { id: 42 });
    assert.equal(calls.at(-1)[1].value, 'toggleMultiSelectMode');
    const before = calls.length;
    api.runtime.onMessage.listeners[0]({ type: 'url', value: 'file:///private' }, { id: 'fixture' });
    assert.equal(calls.length, before);
    api.runtime.onMessage.listeners[0]({ type: 'url', value: 'chrome://extensions/shortcuts' }, { id: 'fixture' });
    assert.equal(calls.at(-1).url, 'chrome://extensions/shortcuts');
    calls.length = 0;
    await api.runtime.onInstalled.listeners[0]({ reason: 'update', previousVersion: '3.10.0' });
    assert.equal(calls.length, 0, '3.10 is newer than 3.4 and updates respect the settings-page preference');
    const manifest = JSON.parse(await readFile(new URL(`../.output/${target}/manifest.json`, import.meta.url), 'utf8'));
    assert.deepEqual(manifest.permissions, ['storage']);
    if (target === 'firefox-mv2') assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions.required, ['none']);
  });
}

test('version migrations compare numeric components', () => {
  assert.equal(versionBefore('3.10.0', '3.4'), false);
  assert.equal(versionBefore('3.3.9', '3.4'), true);
  assert.equal(versionBefore('3.4.0', '3.4'), false);
  assert.equal(versionBefore('10.0', '3.4'), false);
});
