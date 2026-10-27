/**
 * Pure keyboard navigation over the loaded entry order. Returns what the
 * session should do for a key pressed while a row checkbox has focus, or null
 * when the key is not a navigation key here.
 */
export type NavTarget = { kind: 'focus'; key: string } | { kind: 'toggle-all' } | null;

export interface KeyInput {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export function isSelectAll(input: KeyInput): boolean {
  return (input.ctrlKey || input.metaKey) && !input.shiftKey && !input.altKey && input.key.toLowerCase() === 'a';
}

export function navigate(input: KeyInput, current: string, order: readonly string[], isSelected: (key: string) => boolean): NavTarget {
  const index = order.indexOf(current);
  if (index === -1 || input.altKey) return null;
  const ctrl = input.ctrlKey || input.metaKey;

  if (isSelectAll(input)) return { kind: 'toggle-all' };

  if (ctrl && !input.shiftKey && (input.key === 'ArrowLeft' || input.key === 'ArrowRight')) {
    const step = input.key === 'ArrowRight' ? 1 : -1;
    // Walk from the focused row to the end, then wrap around to the other end.
    for (let n = 1; n < order.length; n++) {
      const key = order[(index + step * n + order.length * n) % order.length]!;
      if (isSelected(key)) return { kind: 'focus', key };
    }
    return null;
  }

  if (ctrl || input.shiftKey) return null;
  switch (input.key) {
    case 'ArrowDown':
      return { kind: 'focus', key: order[Math.min(index + 1, order.length - 1)]! };
    case 'ArrowUp':
      return { kind: 'focus', key: order[Math.max(index - 1, 0)]! };
    case 'Home':
      return { kind: 'focus', key: order[0]! };
    case 'End':
      return { kind: 'focus', key: order[order.length - 1]! };
    default:
      return null;
  }
}
