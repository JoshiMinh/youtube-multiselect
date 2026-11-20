import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesDuration, parseDurationInput, sortedVideos, videoDuration } from '../src/polymer/sort-videos.js';

test('duration thresholds accept mm:ss and hh:mm:ss and compare strictly', () => {
  assert.equal(parseDurationInput('5:00'), 300);
  assert.equal(parseDurationInput('1:05:00'), 3900);
  assert.equal(parseDurationInput('5:60'), null);
  assert.equal(parseDurationInput('1:60:00'), null);
  assert.equal(matchesDuration(299, 300, false), true);
  assert.equal(matchesDuration(301, 300, false), false);
  assert.equal(matchesDuration(301, 300, true), true);
  assert.equal(matchesDuration(300, 300, true), false);
  assert.equal(matchesDuration(null, 300, false), false);
});

test('duration matching reuses playlist metadata and DOM duration fallback', () => {
  assert.equal(videoDuration({ lengthSeconds: '75' }), 75);
  assert.equal(videoDuration({}, { querySelectorAll: () => [{ textContent: '1:15' }] }), 75);
  assert.equal(videoDuration({}, { querySelectorAll: () => [{ textContent: 'LIVE' }] }), null);
});

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
