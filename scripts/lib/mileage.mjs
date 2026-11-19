import { getRussianCaptions } from './transcripts.mjs';

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const MIN_DATE = '2026-09-27';
const MIN_MILES = 800_000;
const MAX_MILES = 5_000_000;

const words = new Map(Object.entries({
  ноль: 0, один: 1, одна: 1, одно: 1, два: 2, две: 2, три: 3, четыре: 4,
  пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10,
  одиннадцать: 11, двенадцать: 12, тринадцать: 13, четырнадцать: 14,
  пятнадцать: 15, шестнадцать: 16, семнадцать: 17, восемнадцать: 18,
  девятнадцать: 19, двадцать: 20, тридцать: 30, сорок: 40,
  пятьдесят: 50, шестьдесят: 60, семьдесят: 70, восемьдесят: 80,
  девяносто: 90, сто: 100, двести: 200, триста: 300, четыреста: 400,
  пятьсот: 500, шестьсот: 600, семьсот: 700, восемьсот: 800, девятьсот: 900,
}));
const scales = new Map(Object.entries({ тысяча: 1000, тысячи: 1000, тысяч: 1000, тыс: 1000, миллион: 1_000_000, миллиона: 1_000_000, миллионов: 1_000_000, млн: 1_000_000 }));
const mileageWord = /(?<![\p{L}\p{N}])(?:миль|мили|миля|miles?)(?![\p{L}\p{N}])/giu;
const volvo = /(?<![\p{L}\p{N}])(?:volvo|вольво|vnl\s*[- ]?860)(?![\p{L}\p{N}])/iu;
const ownedVehicle = /(?<![\p{L}\p{N}])(?:наш|нашего|нашему|нашим|наших|нашем|нашей|наша|наши|нашу|наше|нашими|свой|своего|своему|своим|своих|своем|своём|своей|своя|свою|мой|моя|моего|моему|моим|моих|моем|моём|моей|мою|мое|моё)(?:\s+[а-яё-]+){0,2}\s+(?:трак[а-яё]*|тягач[а-яё]*|грузовик[а-яё]*|volvo|вольво|vnl)(?![\p{L}\p{N}])/iu;
const odometer = /пробег[а-яё]*|одометр[а-яё]*/iu;
const uncertain = /(?<![\p{L}\p{N}])(?:не|от|до|около|примерно|приблизительно|почти|где[-\s]?то|свыше|более|менее|больше|меньше|может|возможно|наверное|предположительно|планируем|планирую|собираемся|хотим|скоро|наверно|ожидаем|будет|будут|будем|было|была|были|раньше|ранее)(?![\p{L}\p{N}])/iu;
const wrongContext = /(?<![\p{L}\p{N}])(?:стар(?:ый|ого|ом|ую|ая|ой|ым)|прежн[а-яё]*|предыдущ[а-яё]*|прошл(?:ый|ого|ом|ую|ая|ой)|друг(?:ой|ого|ом|ая|ую)|чуж[а-яё]*|нов(?:ый|ого|ом|ую)\s+(?:трак|тягач|volvo|вольво)|прода[а-яё]*|продал[а-яё]*|продан[а-яё]*|продадим|купим|сменили\s+(?:трак|тягач|volvo|вольво))(?![\p{L}\p{N}])/iu;
const componentOrTrip = /(?<![\p{L}\p{N}])(?:кол[её]с[а-яё]*|шин[а-яё]*|покрыш[а-яё]*|резин[а-яё]*|двигател[а-яё]*|мотор[а-яё]*|коробк[а-яё]*|трейлер[а-яё]*|прицеп[а-яё]*|контракт[а-яё]*|маршрут[а-яё]*|за\s+(?:этот|один|прошлый)\s+рейс)(?![\p{L}\p{N}])/iu;

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function timeSeconds(value) {
  const parts = value.split(':').map(Number);
  return parts.length >= 2 && parts.length <= 3 && parts.slice(1).every((part) => part < 60)
    ? parts.reduce((sum, part) => sum * 60 + part, 0) : null;
}

function parseWords(tokens) {
  if (!tokens.length) return null;
  let total = 0;
  let group = 0;
  let previousCategory = 4;
  let previousScale = Infinity;
  let seen = false;
  for (const token of tokens) {
    if (scales.has(token)) {
      const scale = scales.get(token);
      if (scale >= previousScale || group > 999) return null;
      total += (group || 1) * scale;
      group = 0;
      previousCategory = 4;
      previousScale = scale;
      seen = true;
      continue;
    }
    if (!words.has(token)) return null;
    const value = words.get(token);
    const category = value >= 100 ? 3 : value >= 20 ? 2 : 1;
    if (category >= previousCategory || (value === 0 && (seen || tokens.length > 1))) return null;
    group += value;
    previousCategory = category;
    seen = true;
  }
  return seen ? total + group : null;
}

function numberBeforeMile(prefix) {
  const tail = prefix.slice(-200).trimEnd();
  // Requiring a consistent separator and at most seven digits prevents the
  // model designation in "VNL 860 855.555 миль" from becoming part of the mileage.
  const digits = tail.match(/(?<![\p{L}\p{N}])((?:\d([ .,\u00a0])\d{3}\2\d{3}|\d{1,3}([ .,\u00a0])\d{3}|\d{5,7})|\d{1,3}\s*(?:тыс\.?|тысяч(?:а|и)?|млн\.?|миллион(?:а|ов)?))\s*$/iu);
  if (digits) {
    const before = tail.slice(0, digits.index);
    // Do not turn a fragment of a longer grouped number into an odometer value.
    // The well-known model number immediately preceding it is not a number group.
    if (/(?<![\p{L}\p{N}])\d{1,3}[ .,\u00a0]$/u.test(before) && !/(?:vnl|volvo|вольво)\s*[- ]?860[ .,\u00a0]$/iu.test(before)) return null;
    const value = digits[1];
    const number = Number(value.replace(/[^\d]/gu, ''));
    if (/тыс|тысяч/iu.test(value)) return number * 1000;
    if (/млн|миллион/iu.test(value)) return number * 1_000_000;
    return number;
  }
  const sequence = tail.match(/([\p{L}.\s-]+)$/u)?.[1]?.trim();
  if (!sequence) return null;
  const tokens = sequence.toLocaleLowerCase('ru').replace(/ё/gu, 'е').split(/[\s-]+/u).map((token) => token.replace(/\.$/u, ''));
  let start = tokens.length;
  while (start > 0 && (words.has(tokens[start - 1]) || scales.has(tokens[start - 1]))) start -= 1;
  return parseWords(tokens.slice(start));
}

function mentionsInText(text) {
  const found = [];
  for (const match of text.matchAll(mileageWord)) {
    const amount = numberBeforeMile(text.slice(0, match.index));
    if (Number.isSafeInteger(amount) && amount >= 100_000 && amount <= MAX_MILES) found.push(amount);
  }
  return found;
}

function matchEvidence(text, titleContext) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const snippet = text.replace(/\s+/gu, ' ').trim();
  if (snippet.length > 1000 || !ownedVehicle.test(snippet) || !odometer.test(snippet)) return null;
  if (!volvo.test(snippet) && !volvo.test(titleContext)) return null;
  if (uncertain.test(snippet) || wrongContext.test(snippet) || componentOrTrip.test(snippet)) return null;
  const amounts = mentionsInText(snippet);
  if (amounts.length !== 1) return null;
  return { miles: amounts[0], evidence: snippet };
}

function descriptionCandidates(video) {
  const title = String(video.title || '').replace(/\s+/gu, ' ').trim();
  const safeTitle = wrongContext.test(title) ? '' : title;
  const output = [];
  const titleHit = matchEvidence(title, '');
  if (titleHit) output.push({ ...titleHit, timeSeconds: null, source: 'title' });
  for (const line of String(video.description || '').split(/\r?\n/u)) {
    const timestamp = line.trim().match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+/u);
    const hit = matchEvidence(line, safeTitle);
    if (hit) output.push({ ...hit, timeSeconds: timestamp ? timeSeconds(timestamp[1]) : null, source: 'description' });
  }
  return output;
}

function captionCandidates(cues, title) {
  const safeTitle = wrongContext.test(title) ? '' : title;
  const output = [];
  // A sentence can be split across several short caption events. Limit the window
  // to 15 seconds and 8 events so unrelated parts of a video are not combined.
  for (let start = 0; start < cues.length; start += 1) {
    const first = cues[start];
    if (!first || !Number.isFinite(first.timeSeconds)) continue;
    const fragments = [];
    for (let end = start; end < Math.min(start + 8, cues.length); end += 1) {
      const cue = cues[end];
      if (!cue || !Number.isFinite(cue.timeSeconds) || cue.timeSeconds < first.timeSeconds || cue.timeSeconds - first.timeSeconds > 15) break;
      const fragment = typeof cue.text === 'string' ? cue.text.trim() : '';
      if (fragment && fragments[fragments.length - 1] !== fragment) fragments.push(fragment);
      const snippet = fragments.join(' ');
      if (snippet.length > 1000) break;
    }
    // Include the following nearby cues before accepting a number: a later phrase
    // may qualify it as a different vehicle, a past reading or a trip distance.
    const hit = matchEvidence(fragments.join(' '), safeTitle);
    if (hit) output.push({ ...hit, timeSeconds: first.timeSeconds, source: 'captions' });
  }
  return output;
}

/** Return a source-linked, unambiguous new odometer reading or null. */
export async function extractMileageCandidate(video, options = {}) {
  if (!video || !VIDEO_ID.test(video.id || '') || !validDate(video.date) || video.date <= (options.minDate || MIN_DATE)) return null;
  const title = String(video.title || '').replace(/\s+/gu, ' ').trim();
  // A vehicle purchase/sale/change in the title makes ownership ambiguous.
  if (wrongContext.test(title)) return null;
  const candidates = descriptionCandidates(video);
  if (options.includeCaptions !== false) {
    const cues = await getRussianCaptions(video.id, options);
    candidates.push(...captionCandidates(cues, title));
  }
  const distinct = [...new Set(candidates.map((candidate) => candidate.miles))];
  if (distinct.length !== 1) return null;
  const miles = distinct[0];
  const minimumMiles = Number.isSafeInteger(options.minimumMiles) ? options.minimumMiles : MIN_MILES;
  if (miles <= minimumMiles || miles > MAX_MILES) return null;
  // Prefer a timestamp from an original chapter; otherwise use the start of the spoken phrase.
  candidates.sort((a, b) => {
    const score = (entry) => (entry.source === 'description' && entry.timeSeconds !== null ? 0 : entry.source === 'captions' ? 1 : entry.source === 'description' ? 2 : 3);
    return score(a) - score(b) || a.evidence.length - b.evidence.length;
  });
  const best = candidates[0];
  return { miles, asOf: video.date, videoId: video.id, timeSeconds: best.timeSeconds, source: best.source, evidence: best.evidence };
}
