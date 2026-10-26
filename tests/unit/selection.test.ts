import { describe, expect, it, vi } from 'vitest';
import { SelectionModel } from '@/src/core/selection';

const order = ['a', 'b', 'c', 'd', 'e'];

describe('SelectionModel', () => {
  it('toggles individual keys', () => {
    const model = new SelectionModel();
    model.click('b', true, order);
    model.click('d', true, order);
    model.click('b', false, order);
    expect(model.keys()).toEqual(['d']);
  });

  it('selects a range forward from the anchor with Shift', () => {
    const model = new SelectionModel();
    model.click('b', true, order);
    model.click('d', true, order, { range: true });
    expect(model.keys().sort()).toEqual(['b', 'c', 'd']);
  });

  it('selects a range backward from the anchor', () => {
    const model = new SelectionModel();
    model.click('e', true, order);
    model.click('b', true, order, { range: true });
    expect(model.keys().sort()).toEqual(['b', 'c', 'd', 'e']);
  });

  it('applies the clicked state to the whole range (range deselect)', () => {
    const model = new SelectionModel();
    model.selectAll(order);
    model.click('b', false, order);
    model.click('d', false, order, { range: true });
    expect(model.keys().sort()).toEqual(['a', 'e']);
  });

  it('falls back to a single toggle when the anchor is not loaded', () => {
    const model = new SelectionModel();
    model.click('x', true, ['x', ...order]);
    model.click('c', true, order, { range: true });
    expect(model.keys().sort()).toEqual(['c', 'x']);
  });

  it('uses the latest click as the next anchor', () => {
    const model = new SelectionModel();
    model.click('a', true, order);
    model.click('c', true, order, { range: true });
    model.click('e', true, order, { range: true });
    expect(model.keys().sort()).toEqual(order);
  });

  it('keeps selection when the loaded order grows', () => {
    const model = new SelectionModel();
    model.click('b', true, order);
    const grown = [...order, 'f', 'g'];
    model.click('g', true, grown, { range: true });
    expect(model.keys().sort()).toEqual(['b', 'c', 'd', 'e', 'f', 'g']);
  });

  it('selectAll adds without removing and clear resets the anchor', () => {
    const model = new SelectionModel();
    model.click('z', true, ['z']);
    model.selectAll(['a', 'b']);
    expect(model.size).toBe(3);
    model.clear();
    expect(model.size).toBe(0);
    model.click('c', true, order, { range: true });
    expect(model.keys()).toEqual(['c']);
  });

  it('rename carries selection and anchor', () => {
    const model = new SelectionModel();
    model.click('p:vid:2', true, ['p:vid:2', 'x']);
    model.rename('p:vid:2', 'o:SET2');
    expect(model.has('o:SET2')).toBe(true);
    expect(model.has('p:vid:2')).toBe(false);
    model.click('x', true, ['o:SET2', 'y', 'x'], { range: true });
    expect(model.keys().sort()).toEqual(['o:SET2', 'x', 'y']);
  });

  it('notifies subscribers and stops after unsubscribe', () => {
    const model = new SelectionModel();
    const listener = vi.fn();
    const unsubscribe = model.subscribe(listener);
    model.click('a', true, order);
    unsubscribe();
    model.click('b', true, order);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
