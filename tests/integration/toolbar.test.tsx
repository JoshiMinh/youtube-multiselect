import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { youtubeAdapter } from '@/src/adapters/youtube/adapter';
import { PageSession } from '@/src/controller/session';
import { Toolbar } from '@/src/ui/Toolbar';
import { loadPlaylistPage, sampleRows } from '../fixtures/playlist';
import { clickRow, timeoutSchedule } from './helpers';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let mountPoint: HTMLDivElement;
let session: PageSession;

function button(name: string): HTMLButtonElement {
  const found = [...mountPoint.querySelectorAll('button')].find((b) => b.textContent?.trim() === name);
  if (!found) throw new Error(`No button "${name}"`);
  return found;
}

beforeEach(async () => {
  loadPlaylistPage(document, 'PL1', sampleRows(3));
  mountPoint = document.createElement('div');
  session = new PageSession({
    adapter: youtubeAdapter,
    doc: document,
    page: { kind: 'playlist', playlistId: 'PL1', title: 'Fixture' },
    schedule: timeoutSchedule,
    mountToolbar: (store) => {
      document.documentElement.append(mountPoint);
      root = createRoot(mountPoint);
      act(() => root.render(<Toolbar store={store} />));
      return { remove: () => act(() => root.unmount()) };
    },
  });
  await session.start();
});

afterEach(() => {
  session.dispose();
  mountPoint.remove();
});

describe('Toolbar', () => {
  it('shows the count and drives select loaded / clear', () => {
    expect(mountPoint.textContent).toContain('0 selected');
    expect(button('Clear').disabled).toBe(true);
    act(() => button('Select loaded').click());
    expect(mountPoint.textContent).toContain('3 selected');
    act(() => button('Clear').click());
    expect(mountPoint.textContent).toContain('0 selected');
  });

  it('reflects row checkbox clicks and announces via a live region', () => {
    act(() => clickRow(1));
    expect(mountPoint.querySelector('[role="status"]')!.textContent).toBe('1 selected');
  });

  it('opens an accessible export menu that closes on Escape', () => {
    act(() => clickRow(0));
    const exportButton = button('Export ▾');
    act(() => exportButton.click());
    expect(exportButton.getAttribute('aria-expanded')).toBe('true');
    const menu = mountPoint.querySelector('[role="menu"]')!;
    expect(menu.querySelectorAll('[role="menuitem"]')).toHaveLength(4);
    act(() => menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(mountPoint.querySelector('[role="menu"]')).toBeNull();
  });
});
