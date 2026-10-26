/**
 * Platform-independent selection state keyed by stable entry keys.
 *
 * The model never stores DOM nodes, so rows that YouTube re-renders or loads
 * later keep their selection as long as their key is unchanged.
 */
export interface ClickOptions {
  /** Extend the selection from the anchor to this key (Shift-click). */
  range?: boolean;
}

type Listener = () => void;

export class SelectionModel {
  private readonly selected = new Set<string>();
  private anchor: string | null = null;
  private readonly listeners = new Set<Listener>();
  private version = 0;

  get size(): number {
    return this.selected.size;
  }

  /** Monotonic counter, useful as an external-store snapshot. */
  get revision(): number {
    return this.version;
  }

  has(key: string): boolean {
    return this.selected.has(key);
  }

  keys(): string[] {
    return [...this.selected];
  }

  /**
   * Apply a checkbox interaction.
   *
   * @param key - The entry the user interacted with.
   * @param checked - The state the user requested for that entry.
   * @param order - Keys of the currently loaded entries in display order.
   */
  click(key: string, checked: boolean, order: readonly string[], options: ClickOptions = {}): void {
    const anchorIndex = this.anchor === null ? -1 : order.indexOf(this.anchor);
    const targetIndex = order.indexOf(key);

    if (options.range && anchorIndex !== -1 && targetIndex !== -1) {
      const [start, end] = anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
      for (const rangeKey of order.slice(start, end + 1)) {
        this.write(rangeKey, checked);
      }
    } else {
      this.write(key, checked);
    }

    this.anchor = key;
    this.emit();
  }

  /** Select every key in `keys` without disturbing existing selections. */
  selectAll(keys: Iterable<string>): void {
    for (const key of keys) this.selected.add(key);
    this.emit();
  }

  /**
   * Carry selection (and the range anchor) over when an entry's key changes,
   * e.g. when a positional key is upgraded to an occurrence key.
   */
  rename(from: string, to: string): void {
    if (from === to) return;
    let changed = false;
    if (this.selected.delete(from)) {
      this.selected.add(to);
      changed = true;
    }
    if (this.anchor === from) this.anchor = to;
    if (changed) this.emit();
  }

  clear(): void {
    if (this.selected.size === 0 && this.anchor === null) return;
    this.selected.clear();
    this.anchor = null;
    this.emit();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private write(key: string, checked: boolean): void {
    if (checked) this.selected.add(key);
    else this.selected.delete(key);
  }

  private emit(): void {
    this.version += 1;
    for (const listener of this.listeners) listener();
  }
}
