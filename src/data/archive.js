import catalog from './channel-catalog.json' with { type: 'json' };
import { videos as curatedVideos, archiveVideos, categories as existingCategories } from '../../js/data.js';
import { editorialCategories } from './editorial-categories.js';
import captionMoments from './caption-moments.json' with { type: 'json' };

export const categories = [
  ...existingCategories,
  { id: 'uncategorized', name: 'Без рубрики', short: 'Без рубрики', color: '#ddd6ca', icon: 'play', description: 'Выпуски, для которых рубрика ещё не определена.' },
];

const curatedById = new Map(curatedVideos.map((video) => [video.id, video]));
const archiveById = new Map(archiveVideos.map(([id, , category]) => [id, category]));
// Тематические выпуски с мотоциклами, стрельбищем и другими развлечениями.
const entertainmentIds = new Set([
  'rtS1yT7v5GQ', 'jHeNcI0rdsI', 'FcMOxsOTTo0', 'rw4lBcWgmxY', 'D6SS7dpdf8Y',
  'eV0zZlrEJuA', 'DAXezO1__JU', 'XnAzEBVlVAo', 'v_xmPLXIZ0Y', 'T0w_3cwj32g',
  '_qi-UrZrqgE', 'Q23RjmqtHKY', 'CSF5_k7MpqA', '01WuZLIX3Fg', 'iICSermp-fs',
  'gyyD_eNFhMQ', 'raL1hFusLcY',
]);
// Точки добавлены по конкретным главам или названиям, где авторы говорят о визите.
const confirmedCityVisits = {
  'sX_H-WMKb_g': ['Las Vegas'], 'iICSermp-fs': ['Las Vegas'], '01WuZLIX3Fg': ['Las Vegas'], PjOE3eFL9n0: ['Sacramento'], tgZ8hG7AS8w: ['Cupertino'],
  XnFgjNKfEnw: ['Grand Canyon'],
  'nwihQC-9s7Q': ['Istanbul'], hMstmrlZtDY: ['Nassau'],
};
// Проверено по русским автосубтитрам выпуска; названия даны по сказанному в моменте.
const captionTopics = {
  LtPcCPDdO38: [
    { time: '00:02', text: 'Продолжаем строительство бассейна' },
    { time: '05:34', text: 'Говорим о заливке бетона' },
    { time: '11:03', text: 'Пошёл дождь' },
    { time: '16:34', text: 'Бетонная площадка и место для лежаков' },
    { time: '22:01', text: 'Как продвинулась стройка у соседей' },
    { time: '27:32', text: 'Возвращаемся к стройке после рейса' },
    { time: '33:02', text: 'Плитка у летней кухни' },
    { time: '38:39', text: 'Обсуждаем покрытие' },
  ],
};
// Эти отметки сверены по отдельным кадрам, а не по полной расшифровке видео.
const frameMoments = {
  '07J4_jChHTw': [
    { time: '00:03', text: 'Сергей показывает монетку' }, { time: '00:08', text: 'Монетка и дрель' },
    { time: '00:15', text: 'Монетка у шины' }, { time: '00:20', text: 'Монетка в кабине' },
  ],
  'LghJH-FrhzQ': [
    { time: '00:03', text: 'Комментарий зрителя' }, { time: '00:12', text: 'Трак и платформа' },
    { time: '00:24', text: 'Экскаватор на платформе' }, { time: '00:36', text: 'Аня и Сергей в касках' },
  ],
  q69VFTMpS0U: [
    { time: '00:02', text: 'Работа с патрубком' }, { time: '00:07', text: 'Прокладка у патрубка' },
  ],
  ZITd2UVRCQ4: [{ time: '00:01', text: 'Нас уже 100 тысяч' }],
  'yebMJT-EciY': [{ time: '00:02', text: 'Зарядка у трака' }, { time: '00:10', text: 'Продолжаем тренировку' }],
  raL1hFusLcY: [
    { time: '00:05', text: 'Трак на стоянке' }, { time: '03:00', text: 'Схема на бумаге' },
    { time: '06:00', text: 'В дороге' }, { time: '09:00', text: 'Аня на улице' },
    { time: '12:00', text: 'Дорожный знак' }, { time: '15:00', text: 'Ночная дорога' },
    { time: '18:00', text: 'В кабине трака' },
  ],
  '05p14LtxOrs': [
    { time: '03:00', text: 'В салоне' }, { time: '06:00', text: 'Разбираем вещи' },
    { time: '09:00', text: 'Планшет в кабине' }, { time: '12:00', text: 'Флаги в компании' },
    { time: '15:00', text: 'Еда в дороге' }, { time: '18:00', text: 'У входа' },
    { time: '21:00', text: 'Рядом с прицепом' },
  ],
  bBK3BlwBCOY: [
    { time: '00:05', text: 'Готовим радиоуправляемую машину' }, { time: '00:30', text: 'Машинка на дороге' },
    { time: '01:00', text: 'Машинка на пляже' }, { time: '01:30', text: 'На берегу' },
    { time: '02:00', text: 'По песку' }, { time: '02:30', text: 'Машинка у воды' },
  ],
  DCQrlIcxqj8: [
    { time: '00:05', text: 'Колонна грузовиков' }, { time: '00:30', text: 'Грузовики на дороге' },
    { time: '01:00', text: 'Выступление на улице' }, { time: '02:00', text: 'Продолжение выступления' },
  ],
};

const rules = {
  road: /дальнобо[йяищ]|тракдрайвер|рейс|груз|автовоз|брокер|контракт|работ[а-яё]*\s+на\s+амазон/iu,
  home: /бассейн|дом|квартир|стройк|строительств|летн[а-яё]*\s+кухн/iu,
  life: /рецепт|готовим|готовлю|приготов|закупка продуктов|посылк|друзья|друзей|вопрос/iu,
  tech: /ремонт[а-яё]*\s+трак|ремонт[а-яё]*\s+грузовик|ремонт[а-яё]*\s+двигател|замен[а-яё]*\s+коробк|колес|volvo|вольво|техник/iu,
  entertainment: /стрельбищ|стрельб|постреля|(?:^|\s)тире(?:\s|$)|байкер|эндуро|мотоцикл|rockville|родео|горн[а-яё]*\s+лыж|рыбалк/iu,
  travel: /круиз|отпуск|путешестви|гавай|аляс[кч]/iu,
};

function inferCategory(title) {
  const firstTopic = title.split(/\s*\/\s*|\.(?!\d)/u)[0];
  const matches = Object.entries(rules).filter(([, pattern]) => pattern.test(firstTopic));
  return matches.length === 1 ? matches[0][0] : 'uncategorized';
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remainder = String(seconds % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${remainder}` : `${minutes}:${remainder}`;
}

function extractChapters(description, duration) {
  const chapters = [];
  for (const line of (description || '').split(/\r?\n/)) {
    const match = line.trim().match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/u);
    if (!match) continue;
    const parts = match[1].split(':').map(Number);
    if (parts.slice(1).some((part) => part >= 60)) continue;
    const seconds = parts.reduce((total, part) => total * 60 + part, 0);
    const text = match[2].trim();
    if ((Number.isFinite(duration) && seconds >= duration) || !/[\p{L}\p{N}]/u.test(text) || /https?:\/\//iu.test(text)) continue;
    if (chapters.some((chapter) => chapter.time === match[1])) continue;
    chapters.push({ time: match[1], text });
  }
  return chapters;
}

function shortDescription(description) {
  const lines = description.split(/\r?\n/u).map((line) => line.trim());
  const opening = lines.slice(0, Math.max(1, lines.findIndex((line, index) => index > 0 && (!line || /^\d{1,2}:\d{2}/u.test(line))))).filter((line) => line && !/https?:\/\//iu.test(line)).join(' ');
  return opening.length > 240 ? `${opening.slice(0, 237).trimEnd()}…` : opening || 'Выпуск нашего канала.';
}

// These are explicit mentions, not proof of a route or a visited location.
const placePatterns = {
  Florida: /флорид[а-яё]*/iu, California: /калифорни[а-яё]*/iu,
  Oregon: /орегон[а-яё]*/iu, Washington: /штат[а-яё]*\s+вашингтон|вашингтон[а-яё]*\s*[,—-]?\s*штат|сиэтл[а-яё]*|спокан[а-яё]*/iu,
  Arizona: /аризон[а-яё]*/iu, Nevada: /невад[а-яё]*/iu,
  'New Mexico': /нью[-\s]мексико/iu, Texas: /техас[а-яё]*/iu,
  Oklahoma: /оклахом[а-яё]*/iu, Colorado: /колорадо/iu,
  Utah: /(?<![а-яё])ют(?:а|е|у|ы|ой)(?![а-яё])/iu, Montana: /монтан[а-яё]*/iu,
  Tennessee: /теннесси/iu, Georgia: /джорджи[а-яё]*/iu,
  'New Jersey': /нью[-\s]джерси/iu, 'New York': /нью[-\s]йорк[а-яё]*/iu,
  'North Carolina': /северн[а-яё]*\s+каролин[а-яё]*/iu,
  'South Carolina': /южн[а-яё]*\s+каролин[а-яё]*/iu,
  Louisiana: /луизиан[а-яё]*/iu, Alabama: /алабам[а-яё]*/iu,
  Missouri: /миссури/iu, Kansas: /канзас[а-яё]*/iu,
  Iowa: /айов[а-яё]*/iu, Idaho: /айдахо/iu,
};

// Исключаем разговоры о месте и одноимённые объекты, чтобы не выдавать их за посещение.
function locationEvidence(video, chapters) {
  const times = {};
  const rejected = /факт[а-яё]*\s+(?:о|про)|отел[ьяеюь]*\s+нью[-\s]?йорк|маршрут[а-яё]*\s+калифорни[а-яё]*[-–—]\s*нью[-\s]?йорк|переход к работе полицейского|песн|музык|вспомина|раньше|когда[-\s]то|хотим (?:поехать|посетить)/iu;
  const sources = [...chapters.map((chapter) => ({ text: chapter.text, time: chapter.time.split(':').reduce((n, part) => n * 60 + Number(part), 0) })), { text: video.title, time: 0 }];
  for (const [place, pattern] of Object.entries(placePatterns)) {
    const hit = sources.find(({ text }) => pattern.test(text) && !rejected.test(text));
    if (hit) times[place] = hit.time;
  }
  for (const place of confirmedCityVisits[video.id] || []) times[place] = 0;
  return times;
}

/** Merge the live additions into the bundled archive without losing curated data. */
export function buildVideoRecords(liveVideos = []) {
  const combined = new Map(catalog.videos.map((video) => [video.id, video]));
  for (const video of liveVideos) {
    if (!video || !/^[\w-]{11}$/u.test(video.id) || typeof video.title !== 'string' || !video.title.trim()) continue;
    const previous = combined.get(video.id) || {};
    combined.set(video.id, {
      ...previous,
      id: video.id,
      title: video.title.trim(),
      date: /^\d{4}-\d{2}-\d{2}$/u.test(video.date || '') ? video.date : previous.date || null,
      durationSeconds: Number.isFinite(video.durationSeconds) && video.durationSeconds >= 0 ? video.durationSeconds : previous.durationSeconds ?? null,
      description: typeof video.description === 'string' && video.description.trim() ? video.description : previous.description ?? null,
      url: `https://www.youtube.com/watch?v=${video.id}`,
      image: previous.image || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
    });
  }
  const ordered = [...combined.values()].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return ordered.map((video, index) => {
  const curated = curatedById.get(video.id);
  const sourceDescription = video.description || '';
  const parsedChapters = extractChapters(sourceDescription, video.durationSeconds);
  const chapters = parsedChapters.length ? parsedChapters : curated?.chapters || [];
  const placeTimes = locationEvidence(video, chapters);
  const mentionedPlaces = Object.keys(placeTimes);
  const sourceCategory = entertainmentIds.has(video.id) ? 'entertainment' : (curated?.category || archiveById.get(video.id) || editorialCategories[video.id] || inferCategory(video.title));
  return {
    id: video.id,
    title: video.title,
    category: sourceCategory === 'life' ? 'home' : sourceCategory,
    categoryPreliminary: !curated?.category && !archiveById.has(video.id),
    date: video.date || '',
    duration: formatDuration(video.durationSeconds),
    views: 0,
    description: curated?.description || shortDescription(sourceDescription),
    sourceDescription,
    chapters,
    captionMoments: chapters.length ? [] : (captionTopics[video.id] || captionMoments[video.id] || frameMoments[video.id] || []),
    captionTopics: Boolean(!chapters.length && captionTopics[video.id]),
    frameMoments: Boolean(!chapters.length && frameMoments[video.id]),
    image: curated?.image || video.image,
    places: mentionedPlaces,
    placeTimes,
    mentionedPlaces,
    tags: curated?.tags || [],
    featured: curated?.featured || false,
    sourceOrder: index,
    curated: Boolean(curated),
  };
  });
}

export const videoRecords = buildVideoRecords();

export const catalogInfo = { ...catalog.source, channel: catalog.channel, count: videoRecords.length };
