import { vi } from 'vitest';
import type { ToolbarHandle } from '@/src/controller/session';
import { HOST_ATTR } from '@/src/adapters/youtube/selectors';

/** Let MutationObserver callbacks and scheduled scans run. */
export async function flush(): Promise<void> {
  for (let i = 0; i < 3; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

export const timeoutSchedule = (callback: () => void) => {
  const id = setTimeout(callback, 0);
  return () => clearTimeout(id);
};

export function fakeToolbar() {
  const removed = vi.fn();
  const mount = vi.fn((): ToolbarHandle => ({ remove: removed }));
  return { mount, removed };
}

export function rowHosts(doc: Document = document): HTMLElement[] {
  return [...doc.querySelectorAll<HTMLElement>(`[${HOST_ATTR}="row"]`)];
}

export function checkboxOf(host: HTMLElement): HTMLInputElement {
  return host.shadowRoot!.querySelector('input')!;
}

export function clickRow(index: number, init: MouseEventInit = {}): void {
  const input = checkboxOf(rowHosts()[index]!);
  input.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, ...init }));
}

export function checkedStates(): boolean[] {
  return rowHosts().map((host) => checkboxOf(host).checked);
}
