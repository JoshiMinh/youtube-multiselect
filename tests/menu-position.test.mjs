import assert from 'node:assert/strict';
import test from 'node:test';
import { toolbarMenuPosition } from '../src/polymer/menu-position.js';

test('toolbar menu aligns to the actual toolbar with an eight-pixel gap', () => {
  const anchor = { top:820, bottom:870, right:780 };
  const result = toolbarMenuPosition(anchor, { width:260, height:600 }, { width:1280, height:900 });
  assert.equal(result.placement, 'above');
  assert.equal(result.left, 520);
  assert.equal(anchor.top - (result.top + 600), 8);
});

test('tall menus scroll within the available space instead of clipping', () => {
  const result = toolbarMenuPosition({ top:820, bottom:870, right:780 }, { width:260, height:1000 }, { width:1280, height:900 });
  assert.equal(result.top, 8);
  assert.equal(result.maxHeight, 804);
});

test('a toolbar near the top opens its menu below and narrow windows clamp horizontally', () => {
  const result = toolbarMenuPosition({ top:20, bottom:70, right:200 }, { width:280, height:500 }, { width:320, height:900 });
  assert.equal(result.placement, 'below');
  assert.equal(result.top, 78);
  assert.equal(result.left, 8);
  assert.ok(result.left + 280 <= 312);
});
