import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import type { ContentStatus, GetStatusMessage } from '@/src/core/messages';
import { enabledSetting } from '@/src/core/settings';
import { describeStatus, type TabProbe } from './status';

async function probeActiveTab(): Promise<TabProbe> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) return { kind: 'no-tab' };
  try {
    const message: GetStatusMessage = { type: 'ytms:get-status' };
    const status = (await browser.tabs.sendMessage(tab.id, message)) as ContentStatus | undefined;
    return status ? { kind: 'status', status } : { kind: 'no-response', url: tab.url };
  } catch {
    return { kind: 'no-response', url: tab.url };
  }
}

export function App() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [probe, setProbe] = useState<TabProbe | null>(null);

  useEffect(() => {
    const refresh = () => void probeActiveTab().then(setProbe);
    void enabledSetting.getValue().then(setEnabled);
    refresh();
    const unwatch = enabledSetting.watch((value) => {
      setEnabled(value);
      // Give the content script a moment to react before re-reading status.
      setTimeout(refresh, 150);
    });
    return unwatch;
  }, []);

  const view = probe ? describeStatus(probe, enabled ?? true) : null;

  return (
    <main>
      <header>
        <h1>YouTube Multiselect</h1>
        <button
          type="button"
          role="switch"
          aria-checked={enabled ?? false}
          aria-label="Enable on YouTube"
          className="switch"
          disabled={enabled === null}
          onClick={() => void enabledSetting.setValue(!enabled)}
        >
          <span className="knob" aria-hidden="true" />
        </button>
      </header>
      <p className="enabled-label">{enabled === false ? 'Disabled — no controls are added to YouTube.' : 'Enabled on youtube.com'}</p>

      <section className={`status status-${view?.tone ?? 'neutral'}`} aria-live="polite">
        <h2>{view?.title ?? 'Checking this tab…'}</h2>
        {view?.lines.map((line) => <p key={line}>{line}</p>)}
      </section>

      <footer>
        Read-only prototype: selects and exports. It never changes your playlists.
      </footer>
    </main>
  );
}
