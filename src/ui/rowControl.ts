import type { PlaylistEntry, Theme } from '../adapters/types';
import { HOST_ATTR } from '../adapters/youtube/selectors';

/**
 * A lightweight per-row checkbox in its own shadow root. Plain DOM rather than
 * a React root per row, because long playlists render thousands of rows.
 */
export interface RowControlEvents {
  onToggle(key: string, checked: boolean, range: boolean): void;
  /** Called for every keydown on the checkbox, before it is contained in the shadow root. */
  onKeyDown?(key: string, event: KeyboardEvent): void;
}

const STYLE = `
:host { all: initial; display: flex; align-items: center; justify-content: center; flex: none; width: 40px; align-self: stretch; }
:host([data-theme="light"]) { --ytms-fg: #0f0f0f; --ytms-border: #606060; --ytms-accent: #065fd4; --ytms-check: #fff; --ytms-focus: #065fd4; --ytms-hover: rgba(0,0,0,.08); }
:host([data-theme="dark"]) { --ytms-fg: #f1f1f1; --ytms-border: #aaa; --ytms-accent: #3ea6ff; --ytms-check: #0f0f0f; --ytms-focus: #3ea6ff; --ytms-hover: rgba(255,255,255,.12); }
label { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; }
label:hover { background: var(--ytms-hover); }
input { appearance: none; -webkit-appearance: none; margin: 0; width: 20px; height: 20px; border: 2px solid var(--ytms-border); border-radius: 4px; background: transparent; cursor: pointer; display: grid; place-items: center; }
input:checked { background: var(--ytms-accent); border-color: var(--ytms-accent); }
input:checked::after { content: ""; width: 5px; height: 10px; border: solid var(--ytms-check); border-width: 0 2.5px 2.5px 0; transform: translateY(-1px) rotate(45deg); }
input:focus-visible { outline: 3px solid var(--ytms-focus); outline-offset: 3px; }
@media (forced-colors: active) { input { border-color: CanvasText; } input:checked { background: Highlight; border-color: Highlight; } input:checked::after { border-color: HighlightText; } }
`;

// Events YouTube's row handlers or global shortcuts would otherwise act on.
const CONTAINED_EVENTS = ['click', 'mousedown', 'pointerdown', 'dblclick', 'dragstart', 'keydown', 'keyup', 'keypress'] as const;

export class RowControl {
  readonly host: HTMLElement;
  private readonly input: HTMLInputElement;
  private key: string;
  private keyboardRange = false;

  constructor(doc: Document, entry: PlaylistEntry, events: RowControlEvents) {
    this.key = entry.key;
    this.host = doc.createElement('div');
    this.host.setAttribute(HOST_ATTR, 'row');
    const shadow = this.host.attachShadow({ mode: 'open' });
    const style = doc.createElement('style');
    style.textContent = STYLE;
    const label = doc.createElement('label');
    this.input = doc.createElement('input');
    this.input.type = 'checkbox';
    label.append(this.input);
    shadow.append(style, label);

    for (const type of CONTAINED_EVENTS) {
      shadow.addEventListener(type, (event) => event.stopPropagation());
    }
    this.input.addEventListener('keydown', (event) => {
      if (event.key === ' ') this.keyboardRange = event.shiftKey;
      events.onKeyDown?.(this.key, event);
    });
    this.input.addEventListener('click', (event) => {
      const range = event.shiftKey || this.keyboardRange;
      this.keyboardRange = false;
      events.onToggle(this.key, this.input.checked, range);
    });
    this.update(entry, false, 'light');
  }

  get currentKey(): string {
    return this.key;
  }

  update(entry: PlaylistEntry, checked: boolean, theme: Theme): void {
    this.key = entry.key;
    if (this.input.checked !== checked) this.input.checked = checked;
    const label = `Select: ${entry.title}`;
    if (this.input.getAttribute('aria-label') !== label) this.input.setAttribute('aria-label', label);
    if (this.host.getAttribute('data-theme') !== theme) this.host.setAttribute('data-theme', theme);
  }

  /** Exposed for tests and the controller's focus handling. */
  get checkbox(): HTMLInputElement {
    return this.input;
  }

  destroy(): void {
    this.host.remove();
  }
}
