import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { youtubeAdapter } from '@/src/adapters/youtube/adapter';
import { PageSession } from '@/src/controller/session';
import { loadPlaylistPage, sampleRows } from '../fixtures/playlist';
import { checkboxOf, checkedStates, clickRow, fakeToolbar, rowHosts, timeoutSchedule } from './helpers';

let session: PageSession;

beforeEach(async () => {
  loadPlaylistPage(document, 'PLkeys', sampleRows(5));
  session = new PageSession({
    adapter: youtubeAdapter,
    doc: document,
    page: { kind: 'playlist', playlistId: 'PLkeys', title: 'Fixture' },
    mountToolbar: fakeToolbar().mount,
    schedule: timeoutSchedule,
    livenessIntervalMs: 1,
  });
  await session.start();
});

afterEach(() => {
  session.dispose();
  document.body.innerHTML = '';
});

function press(target: EventTarget, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

// happy-dom's ShadowRoot.activeElement throws for unfocused roots, so record focus events instead.
let lastFocused = -1;

function focusedIndex(): number {
  return lastFocused;
}

beforeEach(() => {
  lastFocused = -1;
  rowHosts().forEach((host, i) => checkboxOf(host).addEventListener('focus', () => (lastFocused = i)));
});

describe('keyboard layer', () => {
  it('moves focus between rows with arrows, Home and End', () => {
    const box = (i: number) => checkboxOf(rowHosts()[i]!);
    box(1).focus();
    expect(press(box(1), 'ArrowDown').defaultPrevented).toBe(true);
    expect(focusedIndex()).toBe(2);
    press(box(2), 'ArrowUp');
    press(box(1), 'ArrowUp');
    expect(focusedIndex()).toBe(0);
    press(box(0), 'End');
    expect(focusedIndex()).toBe(4);
    press(box(4), 'Home');
    expect(focusedIndex()).toBe(0);
  });

  it('jumps between selected rows with Ctrl+Right / Ctrl+Left', () => {
    clickRow(1);
    clickRow(3);
    const box = (i: number) => checkboxOf(rowHosts()[i]!);
    box(1).focus();
    press(box(1), 'ArrowRight', { ctrlKey: true });
    expect(focusedIndex()).toBe(3);
    press(box(3), 'ArrowLeft', { ctrlKey: true });
    expect(focusedIndex()).toBe(1);
  });

  it('Ctrl+A on a row selects all loaded entries, then deselects them', () => {
    const box = checkboxOf(rowHosts()[0]!);
    box.focus();
    press(box, 'a', { ctrlKey: true });
    expect(checkedStates()).toEqual([true, true, true, true, true]);
    press(box, 'a', { ctrlKey: true });
    expect(checkedStates()).toEqual([false, false, false, false, false]);
  });

  it('Ctrl+A on the page selects all, but not while typing in a field', () => {
    expect(press(document.body, 'a', { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(session.getSnapshot().selected).toBe(5);
    session.clear();
    const field = document.createElement('input');
    document.body.append(field);
    expect(press(field, 'a', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(session.getSnapshot().selected).toBe(0);
  });

  it('leaves unrelated keys and Space toggling alone', () => {
    const box = checkboxOf(rowHosts()[2]!);
    expect(press(box, 'x').defaultPrevented).toBe(false);
    expect(press(box, 'ArrowDown', { shiftKey: true }).defaultPrevented).toBe(false);
  });
});
