const aliases = [
  ['amazon', 'амазон'], ['volvo', 'вольво', 'волво'], ['usa', 'сша', 'америка', 'америке', 'америки'],
  ['truck', 'trucking', 'трак', 'грузовик', 'грузовики', 'тягач'],
  ['motorcycle', 'мотоцикл', 'мотоциклы', 'байк', 'байки'],
  ['florida', 'флорида', 'флориде', 'флориды', 'флориду', 'флоридой'], ['california', 'калифорния', 'калифорнии', 'калифорнию', 'калифорнией'],
  ['las', 'лас'], ['vegas', 'вегас'], ['youtube', 'ютуб'],
];
export const normalize = (value = '') => String(value).toLocaleLowerCase('ru').replace(/ё/gu, 'е').replace(/(?<=\d)[ .,\u00a0](?=\d{3}(?:\D|$))/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/gu, ' ');
const canonical = (word) => aliases.find((group) => group.includes(word))?.[0] || word;
const words = (value) => normalize(value).split(' ').filter(Boolean).map(canonical);
const stopWords = new Set(['где', 'как', 'они', 'там', 'это', 'видео', 'выпуск', 'про', 'для', 'что', 'когда', 'которые']);
export function matchesVideo(video, query, placeNames = '') {
  const terms = words(query).filter((word) => !stopWords.has(word));
  if (!terms.length) return true;
  const description = (video.sourceDescription || '').replace(/https?:\/\/\S+/giu, ' ');
  const source = `${video.title} ${video.description} ${description} ${(video.tags || []).join(' ')} ${placeNames} ${(video.chapters || []).map((c) => c.text).join(' ')} ${(video.captionMoments || []).map((c) => c.text).join(' ')}`;
  const index = words(source);
  return terms.every((term) => index.some((word) => word.includes(term) || (term.length >= 6 && word.length >= 6 && word.startsWith(term.slice(0, -2)))));
}
