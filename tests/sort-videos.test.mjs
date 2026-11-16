import test from 'node:test';
import assert from 'node:assert/strict';
import { sortedVideos } from '../src/polymer/sort-videos.js';

test('duration sorts stably in both directions with unknown and live items last', () => {
  const items = [{id:'a',data:{lengthSeconds:'90'}},{id:'b',data:{lengthText:{simpleText:'1:00'}}},{id:'c',data:{lengthText:{simpleText:'LIVE'}}},{id:'d',data:{lengthSeconds:90}}];
  assert.deepEqual(sortedVideos(items,'duration','asc').order, ['b','a','d','c']);
  assert.deepEqual(sortedVideos(items,'duration','desc').order, ['a','d','b','c']);
});

test('date sorts ISO and relative metadata while leaving unknown dates last', () => {
  const now = Date.parse('2026-11-16');
  const items = [{id:'a',data:{publishDate:'2026-01-01'}},{id:'b',data:{publishedTimeText:{simpleText:'2 days ago'}}},{id:'c',data:{}},{id:'d',data:{publishedTimeText:{simpleText:'1年前'}}}];
  assert.deepEqual(sortedVideos(items,'date','asc',now).order,['d','a','b','c']);
  assert.deepEqual(sortedVideos(items,'date','desc',now).order,['b','a','d','c']);
  assert.equal(sortedVideos([{id:'a',data:{}}],'date','asc').known,0);
});


test('reads updated badge renderer and playlist metadata DOM without raw data', () => {
  const row = (duration, date) => ({
    querySelector: () => null,
    querySelectorAll: (selector) => selector.includes('yt-thumbnail-overlay-badge-view-model')
      ? [{textContent:duration}] : selector.includes('#video-info') ? [{textContent:date}] : [],
  });
  const items = [
    {id:'a',row:row('2:27','Lessons in Meme Culture · 37万 回視聴 · 7 か月前')},
    {id:'b',row:row('2:16','Kotte Animation · 727万 回視聴 · 2 年前')},
    {id:'c',row:row('9:25','Shark Tank Global · 1383万 回視聴 · 1 か月前')},
  ];
  assert.deepEqual(sortedVideos(items,'duration','asc').order,['b','a','c']);
  assert.deepEqual(sortedVideos(items,'date','asc').order,['b','a','c']);
  assert.deepEqual(sortedVideos(items,'date','desc').order,['c','a','b']);
});
