import { describe, expect, it } from 'vitest';
import { navigate, type KeyInput } from '@/src/core/keyboard';

const order = ['a', 'b', 'c', 'd', 'e'];
const key = (k: string, mods: Partial<KeyInput> = {}): KeyInput => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});
const none = () => false;

describe('navigate', () => {
  it('moves focus with arrows, clamping at the ends', () => {
    expect(navigate(key('ArrowDown'), 'b', order, none)).toEqual({ kind: 'focus', key: 'c' });
    expect(navigate(key('ArrowUp'), 'b', order, none)).toEqual({ kind: 'focus', key: 'a' });
    expect(navigate(key('ArrowUp'), 'a', order, none)).toEqual({ kind: 'focus', key: 'a' });
    expect(navigate(key('ArrowDown'), 'e', order, none)).toEqual({ kind: 'focus', key: 'e' });
  });

  it('jumps to the first and last entry with Home and End', () => {
    expect(navigate(key('Home'), 'c', order, none)).toEqual({ kind: 'focus', key: 'a' });
    expect(navigate(key('End'), 'c', order, none)).toEqual({ kind: 'focus', key: 'e' });
  });

  it('jumps between selected entries with Ctrl+Left/Right, wrapping around', () => {
    const selected = (k: string) => k === 'b' || k === 'd';
    expect(navigate(key('ArrowRight', { ctrlKey: true }), 'b', order, selected)).toEqual({ kind: 'focus', key: 'd' });
    expect(navigate(key('ArrowRight', { ctrlKey: true }), 'd', order, selected)).toEqual({ kind: 'focus', key: 'b' });
    expect(navigate(key('ArrowLeft', { ctrlKey: true }), 'b', order, selected)).toEqual({ kind: 'focus', key: 'd' });
    expect(navigate(key('ArrowLeft', { ctrlKey: true }), 'e', order, selected)).toEqual({ kind: 'focus', key: 'd' });
  });

  it('does nothing when no other entry is selected', () => {
    expect(navigate(key('ArrowRight', { ctrlKey: true }), 'b', order, (k) => k === 'b')).toBeNull();
    expect(navigate(key('ArrowRight', { ctrlKey: true }), 'b', order, none)).toBeNull();
  });

  it('maps Ctrl/Cmd+A to toggle-all and ignores other combinations', () => {
    expect(navigate(key('a', { ctrlKey: true }), 'b', order, none)).toEqual({ kind: 'toggle-all' });
    expect(navigate(key('A', { metaKey: true }), 'b', order, none)).toEqual({ kind: 'toggle-all' });
    expect(navigate(key('ArrowDown', { shiftKey: true }), 'b', order, none)).toBeNull();
    expect(navigate(key('ArrowDown', { altKey: true }), 'b', order, none)).toBeNull();
    expect(navigate(key('x'), 'b', order, none)).toBeNull();
  });

  it('ignores keys from an entry that is not in the order', () => {
    expect(navigate(key('ArrowDown'), 'zzz', order, none)).toBeNull();
  });
});
