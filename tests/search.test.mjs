import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesVideo } from '../src/data/search.js';

const video = {
  title: 'Поехали во Флориду на Volvo',
  description: 'Наш трак и 800.000 миль',
  sourceDescription: 'Рейс Amazon Relay',
  tags: ['дальнобой'],
  chapters: [{ text: 'Ремонт двигателя' }],
  captionMoments: [{ text: 'Заехали на заправку' }],
};

test('search finds aliases and numbers regardless of formatting', () => {
  for (const query of ['вольво флорида', 'волво 800000', 'амазон трак', 'ремонт двигателя', 'заправку', 'дальнобой']) {
    assert.equal(matchesVideo(video, query), true, query);
  }
});

test('search requires each meaningful word and includes map place names', () => {
  assert.equal(matchesVideo(video, 'volvo калифорния'), false);
  assert.equal(matchesVideo(video, 'эль пасо', 'Эль Пасо'), true);
});
