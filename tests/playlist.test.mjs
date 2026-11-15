import assert from 'node:assert/strict';
import test from 'node:test';
import { playlistContents, playlistSetVideoId, playlistTab, stepMove } from '../src/polymer/playlist.js';

test('reads selected Shorts tab instead of the first Videos tab', () => {
  const items = [{ richItemRenderer: { content: { shortsLockupViewModel: { contentId: 'short-id', menu: { playlistSetVideoId: 'set-short' } } } } }];
  const data = { contents: { twoColumnBrowseResultsRenderer: { tabs: [
    { tabRenderer: { content: { richGridRenderer: { contents: [] } } } },
    { tabRenderer: { selected: true, endpoint: { browseEndpoint: { params: 'shorts' } }, content: { richGridRenderer: { contents: items } } } },
  ] } } };
  assert.equal(playlistContents(data), items);
  assert.equal(playlistTab(data).endpoint.browseEndpoint.params, 'shorts');
  assert.equal(playlistSetVideoId(items, 'short-id'), 'set-short');
  assert.equal(playlistSetVideoId(items, 'missing'), undefined);
});

test('reads legacy playlist rows and modern item sections', () => {
  for (const contents of [
    { playlistVideoListRenderer: { contents: [{ playlistVideoRenderer: { videoId: 'v', setVideoId: 's' } }] } },
    { lockupViewModel: { contentId: 'v', menu: { setVideoId: 's' } } },
  ]) {
    const data = { contents: { twoColumnBrowseResultsRenderer: { tabs: [{ tabRenderer: {
      content: { sectionListRenderer: { contents: [{ itemSectionRenderer: { contents: [contents] } }] } },
    } }] } } };
    assert.equal(playlistSetVideoId(playlistContents(data), 'v'), 's');
  }
});

test('step moves preserve selection order and emit the matching server actions', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];
  for (let mask = 0; mask < 32; mask++) {
    const selected = new Set(ids.filter((_, i) => mask & (1 << i)));
    for (const direction of ['up', 'down']) {
      const { order, actions } = stepMove(ids, selected, direction);
      const server = ids.slice();
      for (const action of actions) {
        server.splice(server.indexOf(action.setVideoId), 1);
        const predecessor = action.movedSetVideoIdPredecessor;
        server.splice(predecessor ? server.indexOf(predecessor) + 1 : 0, 0, action.setVideoId);
      }
      assert.deepEqual(server, order);
      assert.deepEqual(order.filter((id) => selected.has(id)), [...selected]);
      assert.deepEqual(ids, ['a', 'b', 'c', 'd', 'e']);
    }
  }
  assert.deepEqual(stepMove(ids, new Set(['b', 'c', 'e']), 'up').order, ['b', 'c', 'a', 'e', 'd']);
  assert.deepEqual(stepMove(ids, new Set(['a', 'c', 'd']), 'down').order, ['b', 'a', 'e', 'c', 'd']);
});
