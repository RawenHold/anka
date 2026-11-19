import { categories, videos as curatedVideos, places, music, personalities, routeMatrix, archiveVideos } from './data.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const icon = (name, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const normalize = (value = '') => String(value).toLocaleLowerCase('ru').replace(/[ё]/g, 'е').replace(/[.,/#!$%^&*;:{}=\-_`~()?"'«»]/g, ' ').replace(/\s+/g, ' ').trim();
const timeToSeconds = time => time.split(':').reduce((sum, part) => sum * 60 + Number(part), 0);
const categoryById = id => categories.find(category => category.id === id) || categories[0];
const exactDateIds = new Set(['WNpJC4op3Mw','c67MP7GkZTQ','LtPcCPDdO38','3YePZZ47k2w','pm4vMrrPUYE','AgAbY3alNxI','8gdv8SR-K2o','nwihQC-9s7Q','xgSCZg6C3kc','RENYc8EGDcY','ID4CgbtakW8','rtS1yT7v5GQ','Obnw_tJCcxI','shbEN82bCyY','YFvp0XyZljs']);

// Entries beyond the RSS snapshot retain the channel playlist order, but no unverified publication dates.
const videos = [
  ...curatedVideos.map((video, index) => ({...video, date: exactDateIds.has(video.id) ? video.date : '', sourceOrder: index, curated: true})),
  ...archiveVideos.map(([id, title, category, date, duration], index) => ({
    id, title, category, date: '', duration, views: 0,
    description: 'Выпуск официального канала ANKA — Дальнобойщица. Подробные главы для этого ролика ещё не добавлены в архив.',
    chapters: [], image: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, places: [], tags: [], sourceOrder: curatedVideos.length + index, curated: false
  }))
];
const videoById = id => videos.find(video => video.id === id);
const uniqueVideos = new Map(videos.map(video => [video.id, video]));
videos.splice(0, videos.length, ...uniqueVideos.values());

const state = { category: 'all', query: '', sort: 'new', shown: 9, savedOnly: false, selectedPlace: null, musicFilter: 'all' };
const SAVED_KEY = 'anka-archive-saved-v1';
let saved = new Set();
try {
  const parsed = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
  if (Array.isArray(parsed)) saved = new Set(parsed.filter(id => typeof id === 'string'));
} catch { /* Storage may be unavailable in a private or restricted browser. */ }
const persistSaved = () => {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify([...saved])); return true; }
  catch { toast('Не удалось сохранить в этом браузере'); return false; }
};

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {day:'numeric', month:'short', year:'numeric'});
const formatDate = date => {
  if (!date) return 'Из архива канала';
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? 'Из архива канала' : dateFormatter.format(parsed).replace(' г.', '');
};
const formatViews = views => views ? `${new Intl.NumberFormat('ru-RU',{notation:'compact',maximumFractionDigits:1}).format(views)} просм.` : 'YouTube';
const videoSearchText = video => normalize([
  video.title, video.description, categoryById(video.category).name, video.tags.join(' '),
  video.places.map(id => places.find(place => place.id === id)?.ru || id).join(' '),
  ...video.chapters.map(chapter => `${chapter.time} ${chapter.text}`)
].join(' '));

function highlight(text, query) {
  const safe = escapeHTML(text);
  const terms = normalize(query).split(' ').filter(term => term.length > 2).slice(0, 4);
  if (!terms.length) return safe;
  return terms.reduce((result, term) => {
    const escapedTerm = escapeHTML(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try { return result.replace(new RegExp(`(${escapedTerm})`, 'i'), '<mark>$1</mark>'); }
    catch { return result; }
  }, safe);
}

function matchesVideo(video, rawQuery) {
  const query = normalize(rawQuery);
  if (!query) return true;
  const text = videoSearchText(video);
  return query.split(' ').every(term => {
    if (text.includes(term)) return true;
    // A tolerant, read-only search for numeric milestones with spaces, dots or commas.
    if (/^\d+$/.test(term)) return text.replace(/\D/g, '').includes(term);
    return false;
  });
}

function getFilteredVideos() {
  let result = videos.filter(video => {
    const inCategory = state.category === 'all' || video.category === state.category;
    const inSaved = !state.savedOnly || saved.has(video.id);
    const inPlace = !state.selectedPlace || video.places.includes(state.selectedPlace);
    return inCategory && inSaved && inPlace && matchesVideo(video, state.query);
  });
  if (state.sort === 'old') result.reverse();
  if (state.sort === 'chapters') result.sort((a,b) => b.chapters.length - a.chapters.length || a.sourceOrder - b.sourceOrder);
  return result;
}

function renderCategories() {
  $('#category-total').textContent = `${videos.length} видео`;
  $('#category-list').innerHTML = categories.map(category => {
    const count = category.id === 'all' ? videos.length : videos.filter(video => video.category === category.id).length;
    return `<button class="category-button ${state.category === category.id ? 'active' : ''}" type="button" data-category="${category.id}" aria-pressed="${state.category === category.id}" style="--cat:${category.color}" title="${escapeHTML(category.description)}"><span class="category-icon">${icon(category.icon)}</span><strong>${category.short}</strong><span>${count}</span></button>`;
  }).join('');
}

function chapterHits(video) {
  if (!state.query || !video.chapters.length) return '';
  const hits = video.chapters.filter(chapter => matchesVideo({...video, title: chapter.text, description:'',tags:[],places:[],chapters:[]}, state.query)).slice(0,2);
  if (!hits.length) return '';
  return `<div class="chapter-hits">${hits.map(chapter => `<button class="chapter-hit" type="button" data-open-video="${video.id}" data-time="${timeToSeconds(chapter.time)}"><time>${chapter.time}</time><span>${highlight(chapter.text,state.query)}</span></button>`).join('')}</div>`;
}

function videoCard(video) {
  const category = categoryById(video.category);
  const isSaved = saved.has(video.id);
  return `<article class="video-card" style="--category:${category.color}">
    <div class="video-thumb">
      <button class="video-thumb-button" type="button" data-open-video="${video.id}" aria-label="Смотреть: ${escapeHTML(video.title)}"><img src="${video.image}" alt="Обложка видео: ${escapeHTML(video.title)}" loading="lazy" data-fallback-id="${video.id}"><span class="card-play">${icon('play')}</span></button>
      <span class="video-category">${category.short}</span><span class="video-duration">${video.duration}</span>
      <button class="bookmark-button ${isSaved ? 'saved' : ''}" type="button" data-save="${video.id}" aria-pressed="${isSaved}" aria-label="${isSaved ? 'Удалить из сохранённых' : 'Сохранить видео'}: ${escapeHTML(video.title)}">${icon('bookmark')}</button>
    </div>
    <div class="video-body"><div class="video-meta"><time>${formatDate(video.date)}</time><i></i><span>${formatViews(video.views)}</span></div>
      <button class="video-title-button" type="button" data-open-video="${video.id}"><h3>${highlight(video.title,state.query)}</h3></button>
      <p class="video-description">${escapeHTML(video.description)}</p>${chapterHits(video)}
      <div class="video-footer"><span>${icon('clock')} ${video.chapters.length ? `${video.chapters.length} глав с таймкодами` : 'Открыть на YouTube'}</span><span>${icon('youtube')}</span></div>
    </div></article>`;
}

function renderVideos({reset = false} = {}) {
  if (reset) state.shown = 9;
  const filtered = getFilteredVideos();
  const visible = filtered.slice(0,state.shown);
  $('#video-grid').innerHTML = visible.map(videoCard).join('');
  $('#results-count').textContent = `${filtered.length} ${plural(filtered.length,['выпуск','выпуска','выпусков'])}`;
  const active = [];
  if (state.category !== 'all') active.push(categoryById(state.category).name);
  if (state.selectedPlace) active.push(places.find(place => place.id === state.selectedPlace)?.ru);
  if (state.savedOnly) active.push('сохранённые');
  if (state.query) active.push(`запрос «${state.query}»`);
  $('#active-filter-note').textContent = active.join(' · ');
  $('#video-empty').hidden = filtered.length > 0;
  $('#load-more').hidden = filtered.length === 0 || visible.length >= filtered.length;
  $('#load-more span').textContent = `(${Math.min(9,filtered.length-visible.length)} из ${filtered.length-visible.length})`;
  $('#saved-count').textContent = saved.size;
  $('#saved-toggle').setAttribute('aria-pressed',String(state.savedOnly));
  $('#clear-search').hidden = !state.query;
  renderCategories();
  $$('img[data-fallback-id]').forEach(image => image.addEventListener('error', handleImageError, {once:true}));
}

function handleImageError(event) {
  const image = event.currentTarget;
  const id = image.dataset.fallbackId;
  if (id && !image.dataset.retried) {
    image.dataset.retried = 'true';
    image.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  }
}

function plural(number, words) {
  const n = Math.abs(number) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return words[2];
  if (n1 > 1 && n1 < 5) return words[1];
  if (n1 === 1) return words[0];
  return words[2];
}

function resetFilters() {
  state.category = 'all'; state.query = ''; state.sort = 'new'; state.savedOnly = false; state.selectedPlace = null;
  $('#video-search').value = ''; $('#sort-select').value = 'new';
  renderVideos({reset:true});
  $$('.map-marker,.state-shape').forEach(element => element.classList.remove('selected'));
  renderPlace(null);
}

function showToastMessage(message) { toast(message); }
let toastTimer;
function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('visible'),2800);
}

const dialog = $('#content-dialog');
const dialogContent = $('#dialog-content');
let lastDialogTrigger = null;
let currentEmbed = null;

function openDialog(trigger = null) {
  lastDialogTrigger = trigger || document.activeElement;
  if (!dialog.open) dialog.showModal();
  document.body.classList.add('dialog-open');
}
function closeDialog() {
  if (dialog.open) dialog.close();
}
function resetDialog() {
  currentEmbed = null;
  dialogContent.innerHTML = '';
  document.body.classList.remove('dialog-open');
  if (lastDialogTrigger?.isConnected) lastDialogTrigger.focus({preventScroll:true});
}

function openVideo(id, start = 0, trigger = null) {
  const video = videoById(id);
  if (!video) return;
  const seconds = Number(start) || 0;
  currentEmbed = {id, seconds};
  const category = categoryById(video.category);
  dialogContent.innerHTML = `<div class="video-dialog-layout">
    <div class="video-player-wrap"><iframe class="video-player" id="video-player" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&start=${seconds}&rel=0" title="YouTube: ${escapeHTML(video.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
      <div class="video-dialog-info"><span class="video-category" style="background:${category.color}">${category.name}</span><h2 id="dialog-title">${escapeHTML(video.title)}</h2><p>${escapeHTML(video.description)}</p><div class="video-dialog-meta"><span>${formatDate(video.date)}</span><span>${video.duration}</span><span>${formatViews(video.views)}</span></div><a class="youtube-original" href="https://www.youtube.com/watch?v=${encodeURIComponent(id)}${seconds ? `&t=${seconds}s` : ''}" target="_blank" rel="noopener noreferrer">${icon('youtube')} Открыть оригинал на YouTube ${icon('arrow-up-right')}</a></div></div>
    <aside class="chapters-panel"><h3>${video.chapters.length ? 'Главы выпуска' : 'Навигатор по выпуску'}</h3><p>${video.chapters.length ? 'Нажмите на главу, чтобы перейти к моменту.' : 'Подробный разбор пока не добавлен.'}</p>
      ${video.chapters.length ? video.chapters.map(chapter => `<button class="dialog-chapter ${timeToSeconds(chapter.time) === seconds ? 'active' : ''}" type="button" data-chapter="${timeToSeconds(chapter.time)}"><time>${chapter.time}</time><span>${escapeHTML(chapter.text)}</span></button>`).join('') : `<div class="no-chapters">В архиве есть название и ссылка на этот ролик. Таймкоды можно посмотреть в описании на YouTube; их редакторская разметка появится здесь позже.</div>`}
    </aside></div>`;
  openDialog(trigger);
}

function jumpToChapter(seconds) {
  if (!currentEmbed) return;
  currentEmbed.seconds = seconds;
  const player = $('#video-player');
  if (player) {
    const url = new URL(player.src);
    url.searchParams.set('start',String(seconds));
    url.searchParams.set('autoplay','1');
    player.src = url.toString();
  }
  $$('.dialog-chapter').forEach(button => button.classList.toggle('active',Number(button.dataset.chapter) === seconds));
}

function openPerson(key, trigger = null) {
  const person = personalities[key];
  if (!person) return;
  dialogContent.innerHTML = `<div class="person-dialog-head"><div class="person-dialog-photo ${key}"><img src="${person.image}" alt="${person.name}"></div><div class="person-dialog-intro"><span class="aka">${escapeHTML(person.aka)}</span><h2 id="dialog-title">${escapeHTML(person.name)}</h2><div class="role">${escapeHTML(person.role)}</div><blockquote>${escapeHTML(person.quote)}</blockquote></div></div><div class="person-dialog-body"><div class="person-facts">${person.facts.map(([title,text]) => `<article class="person-fact"><strong>${escapeHTML(title)}</strong><p>${escapeHTML(text)}</p></article>`).join('')}</div><div class="person-dialog-footer"><div class="person-tags">${person.tags.map(tag => `<span>${escapeHTML(tag)}</span>`).join('')}</div><a class="button button-dark" href="${person.social}" target="_blank" rel="noopener noreferrer">${icon('instagram')} ${person.handle} ${icon('arrow-up-right')}</a></div></div>`;
  openDialog(trigger);
}

function showMatrix(trigger = null) {
  dialogContent.innerHTML = `<div class="simple-dialog"><div class="section-label">Распределение занятий</div><h2 id="dialog-title">Дела в экипаже и дома</h2><p>Обобщение повторяющихся занятий из видео. В разных рейсах и проектах обязанности могут пересекаться.</p><table class="matrix-table"><thead><tr><th>Сфера</th><th>Аня</th><th>Сергей</th></tr></thead><tbody>${routeMatrix.map(row => `<tr>${row.map(cell => `<td>${escapeHTML(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  openDialog(trigger);
}
function showSources(trigger = null) {
  dialogContent.innerHTML = `<div class="simple-dialog"><div class="section-label">Источники</div><h2 id="dialog-title">На чём основаны материалы</h2><p>В разделах используются опубликованные видео, их описания и предоставленные материалы о рейсах.</p><ul class="source-list"><li><strong>YouTube-канал ANKA</strong><p>Названия, обложки, главы, музыкальные ссылки и даты последних 15 выпусков взяты из открытого канала и RSS-снимка. Для остальных записей дата не показывается без отдельной проверки.</p><a href="https://www.youtube.com/@anka-dalnoboi" target="_blank" rel="noopener noreferrer">Открыть канал ↗</a></li><li><strong>Хроника рабочих будней и рейсов</strong><p>Предоставленная таблица использована для географии, грузов, сервисных событий и тематических меток.</p></li><li><strong>Фотографии и видео</strong><p>Кадры и обложки принадлежат авторам канала. Плеер загружается с YouTube только после нажатия.</p></li><li><strong>Ограничения данных</strong><p>Карта показывает места из разобранных эпизодов, а не точный GPS-маршрут. Безымянным ссылкам Suno даны описательные названия. Социальные сети открываются на внешних платформах.</p></li></ul></div>`;
  openDialog(trigger);
}

function renderPlace(placeId) {
  state.selectedPlace = placeId;
  const place = places.find(item => item.id === placeId);
  $$('.map-marker').forEach(marker => marker.classList.toggle('selected',marker.dataset.place === placeId));
  $$('.state-shape').forEach(shape => shape.classList.toggle('selected',shape.dataset.state === place?.state));
  if (!place) return;
  const related = videos.filter(video => video.places.includes(placeId));
  const display = related.slice(0,4);
  $('#place-content').innerHTML = `<h3>${escapeHTML(place.ru)}</h3><span class="place-city">${escapeHTML(place.city)}</span><p class="place-note">${escapeHTML(place.note)}</p><div class="place-videos">${display.length ? display.map(video => `<button class="place-video" type="button" data-open-video="${video.id}"><img src="${video.image}" alt="" loading="lazy" data-fallback-id="${video.id}"><span><strong>${escapeHTML(video.title)}</strong><small>${video.duration} · ${video.chapters.length ? `${video.chapters.length} глав` : 'смотреть выпуск'}</small></span></button>`).join('') : '<p>Связь с конкретным выпуском ещё не размечена.</p>'}</div><button class="place-all" type="button" data-filter-place="${placeId}">Все видео: ${escapeHTML(place.ru)} · ${related.length} ${icon('arrow-right')}</button>`;
  $$('img[data-fallback-id]',$('#place-content')).forEach(image => image.addEventListener('error',handleImageError,{once:true}));
}

async function initMap() {
  const container = $('#usa-map');
  if (!window.d3) { renderMapFallback(); return; }
  try {
    const response = await fetch('data/us-states.geojson');
    if (!response.ok) throw new Error('Map data unavailable');
    const geo = await response.json();
    const contiguous = {...geo,features:geo.features.filter(feature => !['Alaska','Hawaii','Puerto Rico'].includes(feature.properties.name))};
    const width = 820, height = 510;
    const projection = d3.geoAlbersUsa().fitSize([width-25,height-35],contiguous);
    const path = d3.geoPath(projection);
    const svg = d3.select(container).append('svg').attr('class','map-svg').attr('viewBox',`0 0 ${width} ${height}`).attr('role','group').attr('aria-label','Карта США с местами из видео Ани и Сергея');
    const visitedNames = new Set(places.map(place => place.state));
    svg.append('g').selectAll('path').data(contiguous.features).join('path').attr('d',path).attr('class',feature => `state-shape ${visitedNames.has(feature.properties.name) ? 'visited' : ''}`).attr('data-state',feature => feature.properties.name).attr('aria-hidden','true');
    const projectedPlaces = places.map(place => {
      const coords = projection([placeLon(place.state),placeLat(place.state)]);
      return coords ? {...place, px:coords[0], py:coords[1]} : null;
    }).filter(Boolean);
    const markers = svg.append('g').selectAll('g').data(projectedPlaces).join('g').attr('class','map-marker').attr('data-place',place => place.id).attr('transform',place => `translate(${place.px},${place.py})`).attr('role','button').attr('tabindex',0).attr('aria-label',place => `${place.ru}: ${place.city}. Показать связанные видео`);
    markers.append('circle').attr('class','marker-halo').attr('r',14);
    markers.append('circle').attr('class','marker-dot').attr('r',6);
    const labelPlaces = new Set(['Florida','California','Texas','Oklahoma','Oregon','Colorado','New York','Utah']);
    markers.filter(place => labelPlaces.has(place.id)).append('text').attr('x',place => ['California','Oregon','Utah','Colorado'].includes(place.id) ? 11 : -11).attr('y',3).attr('text-anchor',place => ['California','Oregon','Utah','Colorado'].includes(place.id) ? 'start' : 'end').text(place => place.ru);
    markers.on('click',(event,place) => renderPlace(place.id)).on('keydown',(event,place) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); renderPlace(place.id); } });
    $$('.state-shape.visited').forEach(shape => {
      const place = places.find(item => item.state === shape.dataset.state);
      if (place) shape.addEventListener('click',() => renderPlace(place.id));
    });
  } catch (error) {
    console.warn('Map fallback:',error.message);
    renderMapFallback();
  }
}

// City-level coordinates are only used to position editorial markers, never as GPS routes.
function placeLon(state) {
  return ({Florida:-80.35,California:-119.5,Oregon:-120.55,Washington:-120.7,Arizona:-111.9,Nevada:-116.4,'New Mexico':-106.1,Texas:-97.5,Oklahoma:-95.9,Colorado:-104.99,Utah:-111.9,Montana:-112.5,Tennessee:-86.7,Georgia:-84.4,'New Jersey':-74.2,'New York':-74.0,'North Carolina':-80.8,'South Carolina':-82.4,Louisiana:-91.1,Alabama:-86.8,Missouri:-94.6,Kansas:-98.4,Iowa:-93.6,Idaho:-116.2}[state]);
}
function placeLat(state) {
  return ({Florida:27.27,California:37.2,Oregon:45.52,Washington:47.45,Arizona:33.45,Nevada:36.17,'New Mexico':34.8,Texas:32.78,Oklahoma:36.15,Colorado:39.74,Utah:40.76,Montana:46.6,Tennessee:36.16,Georgia:33.75,'New Jersey':40.7,'New York':40.72,'North Carolina':35.23,'South Carolina':34.85,Louisiana:30.45,Alabama:33.52,Missouri:39.1,Kansas:38.5,Iowa:41.6,Idaho:43.58}[state]);
}
function renderMapFallback() {
  $('#usa-map').innerHTML = `<div class="map-fallback">${places.map(place => `<button type="button" data-place="${place.id}">${place.ru}</button>`).join('')}</div>`;
}

function renderMusic() {
  const namedIds = new Set(['big-cities','radio-waves','touch-time','remember']);
  const filtered = music.filter(track => state.musicFilter === 'all' || (state.musicFilter === 'named' ? namedIds.has(track.id) : track.platform === state.musicFilter));
  $('#music-count').textContent = `${filtered.length} ${plural(filtered.length,['находка','находки','находок'])}`;
  const tones = {night:'#d9ff68',sunset:'#ffc978',gold:'#ffd38f',rose:'#efb4c7',teal:'#a9dcd7',sky:'#b7dff2',lime:'#d9ff68',violet:'#b5b7f5'};
  $('#music-grid').innerHTML = filtered.map(track => `<article class="music-card" style="--tone:${tones[track.tone] || tones.lime}"><div class="music-art"><div class="vinyl">${icon('music')}</div><div class="equalizer" aria-hidden="true">${[12,25,18,34,22,38,15,29,20,10].map((height,index) => `<i style="--h:${height}px;--d:-${index*.08}s"></i>`).join('')}</div><span class="music-platform">${track.platform}</span></div><h3>${escapeHTML(track.title)}</h3><p class="music-original">${escapeHTML(track.original)}</p><p class="music-artist">${escapeHTML(track.artist)}</p><p class="music-card-note">${escapeHTML(track.note)}</p><div class="music-actions"><a class="listen-link" href="${track.url}" target="_blank" rel="noopener noreferrer"><span>${icon('play')}</span>Слушать на ${track.platform}</a><button class="scene-link" type="button" data-open-video="${track.videoId}" data-time="${timeToSeconds(track.time)}">Сцена · ${track.time}</button></div></article>`).join('');
}

function applyPlaceFilter(placeId) {
  resetFilters();
  state.selectedPlace = placeId;
  renderVideos({reset:true});
  $('#videos').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
}

// One delegated listener also covers cards rendered after filtering and map markers.
document.addEventListener('click', event => {
  const target = event.target.closest('button,a');
  if (!target) return;
  if (target.dataset.openVideo) openVideo(target.dataset.openVideo,target.dataset.time || 0,target);
  else if (target.dataset.person) openPerson(target.dataset.person,target);
  else if (target.dataset.save) {
    const id = target.dataset.save;
    if (saved.has(id)) { saved.delete(id); toast('Удалено из сохранённых'); }
    else { saved.add(id); toast('Выпуск сохранён в этом браузере'); }
    persistSaved(); renderVideos();
  } else if (target.dataset.category) {
    state.category = target.dataset.category; state.selectedPlace = null; renderVideos({reset:true});
  } else if (target.dataset.query !== undefined) {
    state.query = target.dataset.query; $('#video-search').value = state.query; state.selectedPlace = null; renderVideos({reset:true});
  } else if (target.dataset.place) renderPlace(target.dataset.place);
  else if (target.dataset.filterPlace) applyPlaceFilter(target.dataset.filterPlace);
  else if (target.dataset.chapter !== undefined) jumpToChapter(Number(target.dataset.chapter));
  else if (target.dataset.musicFilter) {
    state.musicFilter = target.dataset.musicFilter;
    $$('[data-music-filter]').forEach(button => { const active = button.dataset.musicFilter === state.musicFilter; button.classList.toggle('active',active); button.setAttribute('aria-pressed',String(active)); });
    renderMusic();
  }
});

$('#video-search').addEventListener('input',event => { state.query = event.target.value.trim(); state.selectedPlace = null; renderVideos({reset:true}); });
$('#clear-search').addEventListener('click',() => { state.query=''; $('#video-search').value=''; renderVideos({reset:true}); $('#video-search').focus(); });
$('#sort-select').addEventListener('change',event => { state.sort=event.target.value; renderVideos({reset:true}); });
$('#saved-toggle').addEventListener('click',() => { state.savedOnly=!state.savedOnly; renderVideos({reset:true}); });
$('#load-more').addEventListener('click',() => { state.shown+=9; renderVideos(); });
$('#reset-filters').addEventListener('click',resetFilters);
$('#show-matrix').addEventListener('click',event => showMatrix(event.currentTarget));
$('#show-sources').addEventListener('click',event => showSources(event.currentTarget));
$('.dialog-close').addEventListener('click',closeDialog);
dialog.addEventListener('close',resetDialog);
dialog.addEventListener('click',event => { if (event.target === dialog) { const box=dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeDialog(); } });
$('#random-video').addEventListener('click',event => {
  const pool = videos.filter(video => video.chapters.length);
  const video = pool[Math.floor(Math.random()*pool.length)];
  openVideo(video.id,0,event.currentTarget);
});
$$('[data-action="global-search"]').forEach(button => button.addEventListener('click',() => {
  $('#videos').scrollIntoView({behavior:'smooth'});
  setTimeout(() => $('#video-search').focus(),450);
}));

document.addEventListener('keydown',event => {
  if (event.key === '/' && !dialog.open && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
    event.preventDefault(); $('#videos').scrollIntoView({behavior:'smooth'}); setTimeout(() => $('#video-search').focus(),350);
  }
});

const menuToggle = $('#menu-toggle');
const mobileNav = $('#mobile-nav');
menuToggle.addEventListener('click',() => {
  const open = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded',String(!open));
  menuToggle.setAttribute('aria-label',open ? 'Открыть меню' : 'Закрыть меню');
  mobileNav.hidden = open;
  menuToggle.innerHTML = icon(open ? 'menu' : 'x');
});
$$('a',mobileNav).forEach(link => link.addEventListener('click',() => { mobileNav.hidden=true; menuToggle.setAttribute('aria-expanded','false'); menuToggle.setAttribute('aria-label','Открыть меню'); menuToggle.innerHTML=icon('menu'); }));

const header = $('.site-header');
addEventListener('scroll',() => header.classList.toggle('scrolled',scrollY>20),{passive:true});
const observedSections = ['about','videos','map','music','truck'];
if ('IntersectionObserver' in window) {
  const navObserver = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) $$('.desktop-nav a').forEach(link => link.classList.toggle('active',link.getAttribute('href') === `#${entry.target.id}`)); }),{rootMargin:'-25% 0px -65% 0px'});
  observedSections.forEach(id => { const section = document.getElementById(id); if (section) navObserver.observe(section); });
}

if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
  document.body.classList.add('motion-ready');
  const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('visible'); revealObserver.unobserve(entry.target); } }),{threshold:.08,rootMargin:'0px 0px -25px'});
  $$('.reveal').forEach(element => revealObserver.observe(element));
} else $$('.reveal').forEach(element => element.classList.add('visible'));

renderVideos();
renderMusic();
initMap();
