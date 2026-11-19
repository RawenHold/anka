import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import AskAI from './components/AskAI.jsx';
import searchIcon from '@iconify-icons/bx/search';
import playIcon from '@iconify-icons/bx/play';
import bookmarkIcon from '@iconify-icons/bx/bookmark';
import menuIcon from '@iconify-icons/bx/menu';
import sunIcon from '@iconify-icons/bx/sun';
import mapPinIcon from '@iconify-icons/bx/map-pin';
import arrowIcon from '@iconify-icons/bx/right-arrow-alt';
import carIcon from '@iconify-icons/bx/car';
import wrenchIcon from '@iconify-icons/bx/wrench';
import closeIcon from '@iconify-icons/bx/x';
import shuffleIcon from '@iconify-icons/bx/shuffle';
import plusIcon from '@iconify-icons/bx/plus';
import musicIcon from '@iconify-icons/bx/music';
import savedListIcon from '@iconify-icons/bx/list-ul';
import linkIcon from '@iconify-icons/bx/link-external';
import youtubeIcon from '@iconify-icons/bxl/youtube';
import telegramIcon from '@iconify-icons/bxl/telegram';
import instagramIcon from '@iconify-icons/bxl/instagram';
import groupIcon from '@iconify-icons/bx/group';
import tachometerIcon from '@iconify-icons/bx/tachometer';
import { personalities, places, routeMatrix } from '../js/data.js';
import { buildVideoRecords, categories } from './data/archive.js';
import { matchesVideo } from './data/search.js';
import embedAvailability from './data/embed-availability.json';
import { useChannelData } from './hooks/useChannelData.js';
import { usePhotoParallax } from './hooks/usePhotoParallax.js';
import musicSources from './data/music-sources.json';
import PullCord from './components/PullCord.jsx';
import TravelMap from './components/TravelMap.jsx';
import MusicSection from './components/MusicSection.jsx';
import PersonDialog from './components/PersonDialog.jsx';
import TruckSection from './components/TruckSection.jsx';
import VideoMusicDialog from './components/VideoMusicDialog.jsx';

const BASE = import.meta.env.BASE_URL;
const THEME_KEY = 'anka-theme-v1';
const SAVED_KEY = 'anka-archive-saved-v1';
const pageSize = 12;
const design = 'neon';
const categoryIcons = { all: musicIcon, road: playIcon, home: plusIcon, entertainment: sunIcon, tech: wrenchIcon, travel: mapPinIcon };
const socialItems = [
  { name: 'YouTube', handle: 'ANKA — Дальнобойщица', href: 'https://www.youtube.com/@anka-dalnoboi', icon: youtubeIcon, className: 'youtube' },
  { name: 'Telegram', handle: '@AnkaDalnoboi', detail: 'Заметки и новости с дороги', href: 'https://t.me/AnkaDalnoboi', icon: telegramIcon, className: 'telegram' },
  { name: 'Instagram Ани', handle: '@alice.fox1', detail: 'Личный профиль Ани', href: 'https://instagram.com/alice.fox1', icon: instagramIcon, className: 'instagram' },
  { name: 'Instagram Сергея', handle: '@sergo_top1', detail: 'Личный профиль Сергея', href: 'https://instagram.com/sergo_top1', icon: instagramIcon, className: 'instagram' },
];

const imagePath = (path = '') => path.startsWith('http') ? path : `${BASE}${path.replace(/^\/+/, '')}`;
const normalize = (value = '') => String(value).toLocaleLowerCase('ru').replace(/[ё]/g, 'е').replace(/[.,/#!$%^&*;:{}=\-_`~()?"'«»]/g, ' ').replace(/\s+/g, ' ').trim();
const musicRecords = [
  ...musicSources.items,
  ...(musicSources.namedUnlinkedTracks || []).map((track) => ({ ...track, platform: 'YouTube search', listenUrl: track.searchUrl })),
];
const secondsFromTime = (time = '0') => time.split(':').reduce((sum, part) => sum * 60 + Number(part), 0);
const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
const numericDateFormatter = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
const monthFormatter = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const milesFormatter = new Intl.NumberFormat('ru-RU');
const numberFormatter = new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 });

function initialTheme() {
  const preview = new URLSearchParams(window.location.search).get('theme');
  if (preview === 'day' || preview === 'night') return preview;
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === 'day' || saved === 'night') return saved;
  } catch { /* The theme still works when storage is unavailable. */ }
  return 'night';
}

function initialSaved() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(SAVED_KEY) || '[]');
    if (Array.isArray(saved)) return new Set(saved.filter((id) => typeof id === 'string'));
  } catch { /* Start with an empty list when storage is unavailable. */ }
  return new Set();
}

function IconView({ icon, className = '', ...props }) {
  if (!icon?.body) return null;
  return <svg className={`box-icon ${className}`.trim()} viewBox={`0 0 ${icon.width || 24} ${icon.height || 24}`} focusable="false" aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon.body }} {...props} />;
}

function formatDate(date) {
  if (!date) return 'из архива канала';
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? 'из архива канала' : dateFormatter.format(parsed).replace(' г.', '');
}

function formatStatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : numericDateFormatter.format(date);
}

function formatMileageDate(value) {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? '' : monthFormatter.format(date).replace(' г.', '');
}

function formatViews(views) {
  return views ? `${numberFormatter.format(views)} просмотров` : 'YouTube';
}

function matchesQuery(video, query) {
  const placeNames = video.places.map((id) => places.find((place) => place.id === id)?.ru || id).join(' ');
  return matchesVideo(video, query, placeNames);
}

function hasMatchingChapter(video, query) {
  const terms = normalize(query).split(' ').filter((term) => term.length > 1);
  if (!terms.length) return [];
  return [...video.chapters, ...video.captionMoments].filter((chapter) => {
    const text = normalize(`${chapter.time} ${chapter.text}`);
    return terms.every((term) => text.includes(term));
  }).slice(0, 2);
}

function plural(count, forms) {
  const n = Math.abs(count) % 100;
  const last = n % 10;
  if (n > 10 && n < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

function VideoCard({ video, saved, query, onOpen, onSave }) {
  const category = categories.find((item) => item.id === video.category) || categories[0];
  const [image, setImage] = useState(imagePath(video.image));
  const [imageFallback, setImageFallback] = useState(0);
  const chapterHits = hasMatchingChapter(video, query);

  function handleImageError() {
    if (imageFallback === 0) {
      setImageFallback(1);
      setImage(`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`);
    } else if (imageFallback === 1) {
      setImageFallback(2);
      setImage(imagePath('images/channel-avatar.png'));
    }
  }

  return (
    <article className="video-card" style={{ '--category': category.color }}>
      <div className="video-thumb">
        <button className="video-thumb-button" type="button" onClick={() => onOpen(video)} aria-label={`Смотреть: ${video.title}`}>
          <img src={image} alt={`Обложка видео: ${video.title}`} loading="lazy" onError={handleImageError} />
          <span className="card-play"><IconView icon={playIcon} /></span>
        </button>
        <span className="video-category">{category.short}</span>
        {video.duration && <span className="video-duration">{video.duration}</span>}
        <button className={`bookmark-button${saved ? ' saved' : ''}`} type="button" aria-pressed={saved} aria-label={`${saved ? 'Убрать из сохранённых' : 'Добавить в сохранённые'}: ${video.title}`} onClick={() => onSave(video.id)}>
          <IconView icon={bookmarkIcon} />
        </button>
      </div>
      <div className="video-body">
        <div className="video-meta"><time>{formatDate(video.date)}</time><i /><span>{formatViews(video.views)}</span></div>
        <button className="video-title-button" type="button" onClick={() => onOpen(video)}><h3>{video.title}</h3></button>
        <p className="video-description">{video.description}</p>
        {chapterHits.length > 0 && <div className="chapter-hits">{chapterHits.map((chapter) => (
          <button className="chapter-hit" type="button" key={`${video.id}-${chapter.time}`} onClick={() => onOpen(video, secondsFromTime(chapter.time))}>
            <time>{chapter.time}</time><span>{chapter.text}</span>
          </button>
        ))}</div>}
      </div>
    </article>
  );
}

function App() {
  usePhotoParallax();
  const channelData = useChannelData();
  const videoRecords = useMemo(() => buildVideoRecords(channelData.videos), [channelData.videos]);
  const [theme, setTheme] = useState(initialTheme);
  const [saved, setSaved] = useState(initialSaved);
  const [savedOnly, setSavedOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('new');
  const [shown, setShown] = useState(pageSize);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [placeFilter, setPlaceFilter] = useState(null);
  const [modal, setModal] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState('');
  const searchRef = useRef(null);
  const dialogRef = useRef(null);
  const toastTimer = useRef(0);

  useEffect(() => {
    document.documentElement.classList.remove('anka-booting');
    const elapsed = performance.now() - (window.ankaStartupTime || 0);
    const timer = window.setTimeout(() => document.getElementById('anka-startup')?.remove(), Math.max(0, 2000 - elapsed));
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.design = design;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === 'night' ? 'dark' : 'light';
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = theme === 'night' ? '#111310' : '#f5f5f3';
    try { window.localStorage.setItem(THEME_KEY, theme); } catch { /* Theme remains active for this visit. */ }
  }, [theme]);

  useEffect(() => {
    try { window.localStorage.setItem(SAVED_KEY, JSON.stringify([...saved])); }
    catch {
      if (saved.size) showToast('Не удалось сохранить список в этом браузере');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (modal && !dialog.open) dialog.showModal();
    if (!modal && dialog.open) dialog.close();
  }, [modal]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        event.preventDefault();
        searchRef.current?.focus();
        document.getElementById('videos')?.scrollIntoView({ behavior: 'smooth' });
      }
      if (event.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const selectPlace = useCallback((placeId) => setSelectedPlace(placeId), []);

  const filteredVideos = useMemo(() => {
    let result = videoRecords.filter((video) => (
      (category === 'all' || video.category === category)
      && (!savedOnly || saved.has(video.id))
      && (!placeFilter || video.places.includes(placeFilter))
      && matchesQuery(video, query)
    ));
    if (sort === 'old') result = [...result].reverse();
    if (sort === 'chapters') result = [...result].sort((a, b) => b.chapters.length - a.chapters.length || a.sourceOrder - b.sourceOrder);
    return result;
  }, [category, query, saved, savedOnly, placeFilter, sort, videoRecords]);

  const visibleVideos = filteredVideos.slice(0, shown);
  const relatedVideos = selectedPlace ? videoRecords.filter((video) => video.places.includes(selectedPlace)) : [];
  const currentPlace = places.find((place) => place.id === selectedPlace);

  function toggleTheme(button) {
    const change = () => flushSync(() => setTheme((value) => value === 'day' ? 'night' : 'day'));
    if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !button) { change(); return; }
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transition = document.startViewTransition(change);
    transition.ready.then(() => document.documentElement.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] }, { duration: 700, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' })).catch(() => {});
  }

  function showToast(message) {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2600);
  }

  function saveVideo(id) {
    setSaved((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openVideo(video, start = 0) {
    setModal({ type: 'video', video, start });
  }

  function openPerson(key) {
    setModal({ type: 'person', personKey: key });
  }

  function clearFilters() {
    setCategory('all');
    setQuery('');
    setSort('new');
    setSavedOnly(false);
    setSelectedPlace(null);
    setPlaceFilter(null);
    setShown(pageSize);
  }

  function filterByPlace(placeId) {
    setCategory('all');
    setQuery('');
    setSavedOnly(false);
    setSelectedPlace(placeId);
    setPlaceFilter(placeId);
    setShown(pageSize);
    setModal(null);
    requestAnimationFrame(() => document.getElementById('videos')?.scrollIntoView({ behavior: 'smooth' }));
  }

  function randomVideo() {
    const pool = filteredVideos.length ? filteredVideos : videoRecords;
    openVideo(pool[Math.floor(Math.random() * pool.length)]);
  }

  const activeFilters = [
    category !== 'all' ? categories.find((item) => item.id === category)?.name : null,
    places.find((place) => place.id === placeFilter)?.ru,
    savedOnly ? 'сохранённые' : null,
    query ? `«${query}»` : null,
  ].filter(Boolean);

  const nav = [['videos', 'Видео', playIcon], ['map', 'Карта', mapPinIcon], ['music', 'Музыка', musicIcon], ['about', 'О нас', groupIcon], ['truck', 'Наш Volvo', carIcon], ['social', 'Мы на связи', linkIcon]];

  return (
    <>
      <header className="site-header" id="top">
        <div className="header-inner">
          <a className="brand" href="#top" aria-label="ANKA — на главную">
            <span className="brand-symbol" aria-hidden="true">A</span>
            <span className="brand-word">ANKA<small>дорога и дом</small></span>
          </a>
          <picture className="header-coin" aria-hidden="true"><source media="(prefers-reduced-motion: reduce)" srcSet={imagePath('images/anka-coin-still.png')} /><img src={imagePath('images/anka-loading.gif')} alt="" /></picture>
          <nav className="desktop-nav" aria-label="Основные разделы">
            {nav.slice(0, 4).map(([id, label, icon]) => <a href={`#${id}`} key={id}><IconView icon={icon} />{label}</a>)}
          </nav>
          <div className="header-actions">
            <button className="round-control global-search-button" type="button" aria-label="Перейти к поиску видео" title="Поиск по видео (/)" onClick={() => { document.getElementById('videos')?.scrollIntoView({ behavior: 'smooth' }); window.setTimeout(() => searchRef.current?.focus(), 450); }}><IconView icon={searchIcon} /></button>
            <PullCord compact isNight={theme === 'night'} onToggle={toggleTheme} />
            <a className="header-channel" href="https://www.youtube.com/@anka-dalnoboi" target="_blank" rel="noreferrer"><IconView icon={youtubeIcon} /><span>YouTube</span></a>
            <button className="round-control menu-button" type="button" aria-expanded={menuOpen} aria-controls="mobile-nav" aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'} onClick={() => setMenuOpen((value) => !value)}><IconView icon={menuIcon} /></button>
          </div>
        </div>
        <nav className="mobile-nav" id="mobile-nav" aria-label="Разделы сайта" hidden={!menuOpen}>
          {nav.map(([id, label]) => <a href={`#${id}`} key={id} onClick={() => setMenuOpen(false)}>{label}</a>)}
        </nav>
      </header>

      <main id="main">
        <section className="cover-hero" aria-labelledby="hero-title">
          <img className="cover-image" src={imagePath('images/research/anya-sergey-home.jpg')} alt="Аня и Сергей дома — кадр из видео" fetchPriority="high" />
          <div className="cover-overlay" aria-hidden="true" />
          <div className="cover-inner">
            <div className="cover-intro">
              <span className="hero-intro-label">Аня и Сергей · дальнобойщики в Америке</span>
              <h1 id="hero-title">Привет!<em>Мы — Аня и Сергей</em></h1>
              <p>Делимся нашей жизнью в дороге: рейсы, новые места, музыка и обычные дни дома.</p>
              <div className="cover-actions"><a className="hero-watch" href="#videos"><IconView icon={playIcon} /> Смотреть видео</a><a className="hero-map" href="#map"><IconView icon={mapPinIcon} /> Открыть карту</a><AskAI /></div>
            </div>
          </div>
        </section>

        <div className="cover-stats" aria-label="О канале и наших поездках">
          <a className="cover-stat" href="https://www.youtube.com/@anka-dalnoboi" target="_blank" rel="noreferrer"><IconView icon={youtubeIcon} /><strong>{channelData.subscribers ? numberFormatter.format(channelData.subscribers.count) : 'YouTube'}</strong><span>подписчиков<small>{channelData.subscribers ? `на ${formatStatDate(channelData.subscribers.observedAt)}` : 'число скрыто'}</small></span></a>
          <a className="cover-stat" href="#map"><IconView icon={mapPinIcon} /><strong>{places.length}</strong><span>{plural(places.length, ['место', 'места', 'мест'])} на карте<small>по материалам видео</small></span></a>
          <a className="cover-stat" href="#truck"><IconView icon={tachometerIcon} /><strong>{milesFormatter.format(channelData.mileage.miles)}</strong><span>миль на одометре<small>Volvo · {formatMileageDate(channelData.mileage.asOf)}</small></span></a>
        </div>

        <div className="room-navigation" aria-label="Разделы сайта">
          <article className="route-tile route-video" style={{ '--route-photo': `url("${imagePath('images/video-homecoming.jpg')}")` }}><div className="route-content"><h2>Видео</h2><p>Выпуски из нашей жизни<br />в рейсах по Америке.</p><a href="#videos"><IconView icon={playIcon} /> К видео <IconView icon={arrowIcon} /></a></div></article>
          <article className="route-tile route-map"><div className="route-content"><h2>Карта</h2><p>Места из наших<br />выпусков на одной карте.</p><img className="route-map-mark" src={imagePath('images/us-states-outline.svg')} alt="" /><a href="#map"><IconView icon={mapPinIcon} /> Открыть карту <IconView icon={arrowIcon} /></a></div></article>
          <article className="route-tile route-music"><div className="route-content"><h2>Музыка</h2><p>Песни из наших выпусков.</p><ul className="route-track-list">{musicRecords.filter((track) => track.artwork?.url).slice(0, 3).map((track) => <li key={track.id}><img src={track.artwork.url} alt="" loading="lazy" /><a href={track.listenUrl} target="_blank" rel="noreferrer"><span>{track.title}</span><IconView icon={playIcon} /></a></li>)}</ul><a className="route-all-music" href="#music">Вся музыка <IconView icon={arrowIcon} /></a></div></article>
          <article className="route-tile route-about" style={{ '--route-photo': `url("${imagePath('images/research/pacific-road.jpg')}")` }}><div className="route-content"><h2>О нас</h2><p>Кто мы и как живём<br />между дорогой и домом.</p><a href="#about"><IconView icon={groupIcon} /> Узнать больше <IconView icon={arrowIcon} /></a></div></article>
        </div>

        <section className="people section-pad" id="about" aria-labelledby="about-title">
          <div className="wrap">
            <div className="section-heading">
              <div><h2 id="about-title">Мы — Аня и Сергей.<br /><span>Рады знакомству.</span></h2></div>
              <p>Вместе ездим в рейсы и снимаем видео. А когда возвращаемся домой во Флориду, показываем, чем занимаемся между поездками.</p>
            </div>
            <div className="people-grid">
              {['anya', 'sergey'].map((key) => {
                const person = personalities[key];
                const isAnya = key === 'anya';
                return (
                  <article className="person-card" key={key}>
                    <button className={`person-photo person-photo-${key}`} type="button" onClick={() => openPerson(key)} aria-label={`Подробнее: ${person.name}`}>
                      <img src={imagePath(isAnya ? 'images/creators/anya.jpg' : 'images/creators/sergey.jpg')} alt={isAnya ? 'Аня у воды' : 'Сергей у воды'} loading="lazy" />
                      <span className="person-badge">{person.name}<i>{isAnya ? 'вторая смена · съёмка' : 'руль · техника · дом'}</i></span>
                      <span className="person-plus"><IconView icon={plusIcon} /></span>
                    </button>
                    <div className="person-caption">
                      <p>{isAnya ? 'В поездках я снимаю и монтирую, помогаю с навигацией, а в рейс стараюсь собрать что-нибудь домашнее.' : 'Я чаще за рулём, слежу за траком, стройкой и садом. Если что-то просит инструмента — обычно иду в гараж.'}</p>
                      <div>{person.tags.slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}</div>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="people-meta"><button type="button" onClick={() => setModal({ type: 'matrix' })}>Как делим дела в экипаже <IconView icon={arrowIcon} /></button></div>
          </div>
        </section>

        <section className="video-archive section-pad" id="videos" aria-labelledby="videos-title">
          <div className="wrap">
            <div className="section-heading">
              <div><h2 id="videos-title">Видео, к которым<br /><span>можно вернуться.</span></h2></div>
            </div>
            <div className="search-panel">
              <IconView icon={searchIcon} />
              <label className="sr-only" htmlFor="video-search">Найти выпуск по теме, названию или месту</label>
              <input id="video-search" ref={searchRef} type="search" value={query} onChange={(event) => { setQuery(event.target.value); setCategory('all'); setPlaceFilter(null); setSavedOnly(false); setShown(pageSize); }} placeholder="Например: бассейн, пирожки, Флорида…" autoComplete="off" />
              {query ? <button className="clear-search" type="button" onClick={() => { setQuery(''); setShown(pageSize); searchRef.current?.focus(); }} aria-label="Очистить поиск"><IconView icon={closeIcon} /></button> : <kbd aria-hidden="true">/</kbd>}
            </div>
            <div className="category-scroller"><div id="category-list" role="group" aria-label="Категории выпусков">
              {categories.map((item) => {
                const count = item.id === 'all' ? videoRecords.length : videoRecords.filter((video) => video.category === item.id).length;
                if (item.id === 'uncategorized' && count === 0) return null;
                const CategoryIcon = categoryIcons[item.id] || playIcon;
                return <button key={item.id} className={`category-button${category === item.id && !placeFilter ? ' active' : ''}`} type="button" aria-pressed={category === item.id && !placeFilter} title={item.description} style={{ '--cat': item.color }} onClick={() => { setCategory(item.id); setPlaceFilter(null); setQuery(''); setSavedOnly(false); setShown(pageSize); }}><span className="category-icon"><IconView icon={CategoryIcon} /></span><strong>{item.short}</strong><span>{count}</span></button>;
              })}
              {placeFilter && <button className="category-button active place-filter-chip" type="button" onClick={() => { setPlaceFilter(null); setCategory('all'); setQuery(''); setSavedOnly(false); setShown(pageSize); }} aria-label={`Убрать фильтр: ${places.find((place) => place.id === placeFilter)?.ru}`}><IconView icon={mapPinIcon} /><strong>{places.find((place) => place.id === placeFilter)?.ru}</strong><IconView icon={closeIcon} /></button>}
            </div></div>
            <div className="catalog-toolbar">
              <div><strong>{filteredVideos.length} {plural(filteredVideos.length, ['выпуск', 'выпуска', 'выпусков'])}</strong><span id="active-filter-note" aria-live="polite">{activeFilters.join(' · ')}</span></div>
              <div className="toolbar-controls">
                <label className="sort-label">Сначала
                  <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Порядок выпусков">
                    <option value="new">новые</option><option value="old">старые</option><option value="chapters">с главами</option>
                  </select>
                </label>
                <label className={`saved-filter${savedOnly ? ' is-active' : ''}`}>
                  <span className="saved-filter-copy"><IconView icon={savedListIcon} /><span>Сохранённые</span><b>{saved.size}</b></span>
                  <span className="uiverse-switch">
                    <input className="uiverse-switch-input" type="checkbox" role="switch" aria-label="Показывать только сохранённые выпуски" checked={savedOnly} onChange={() => { setSavedOnly((value) => !value); setShown(pageSize); }} />
                    <span className="uiverse-switch-face" data-on="ТОЛЬКО" data-off="ВСЕ" aria-hidden="true" />
                  </span>
                </label>
              </div>
            </div>
            {visibleVideos.length > 0 ? <div className="video-grid" id="video-grid">
              {visibleVideos.map((video) => <VideoCard key={video.id} video={video} saved={saved.has(video.id)} query={query} onOpen={openVideo} onSave={saveVideo} />)}
            </div> : <div className="empty-state" id="video-empty"><span><IconView icon={searchIcon} /></span><h3>{savedOnly && saved.size === 0 ? 'Вы ещё ничего не сохранили' : 'Пока ничего не нашли'}</h3><p>{savedOnly && saved.size === 0 ? 'Поставьте закладку на выпуск — он появится в этой подборке.' : 'Попробуйте другое слово или сбросьте фильтры.'}</p><button className="button button-quiet" type="button" onClick={clearFilters}>{savedOnly && saved.size === 0 ? 'Показать все выпуски' : 'Сбросить поиск'}</button></div>}
            {visibleVideos.length < filteredVideos.length && <button className="button button-quiet load-more" type="button" onClick={() => setShown((count) => count + pageSize)}>Показать ещё <span>({Math.min(pageSize, filteredVideos.length - visibleVideos.length)} из {filteredVideos.length - visibleVideos.length})</span></button>}
          </div>
        </section>

        <section className="map-section section-pad" id="map" aria-labelledby="map-title">
          <div className="wrap">
            <div className="section-heading">
              <div><h2 id="map-title">Места из наших<br /><span>выпусков.</span></h2></div>
            </div>
            <div className="map-shell">
              <div className="map-main">
                <div className="map-topline"><span>Места, упомянутые в видео</span><span>{places.length} {plural(places.length, ['точка', 'точки', 'точек'])}</span></div>
                <TravelMap places={places} selectedId={selectedPlace} onSelect={selectPlace} theme={theme} />
              </div>
              <aside className="place-panel" aria-live="polite">
                <div className="place-panel-top"><span className="section-label">Из дорожных историй</span><IconView icon={mapPinIcon} /></div>
                {currentPlace ? <>
                  <h3>{currentPlace.ru}</h3>
                  <span className="place-city">{currentPlace.id === currentPlace.state ? `Штат ${currentPlace.ru}` : currentPlace.city}</span>
                  <p className="place-note">{currentPlace.note}</p>
                  <div className="place-videos">
                    {relatedVideos.length ? relatedVideos.slice(0, 4).map((video) => <button className="place-video" type="button" key={video.id} onClick={() => openVideo(video, video.placeTimes[selectedPlace] ?? 0)}><img src={imagePath(video.image)} alt="" loading="lazy" /><span><strong>{video.title}</strong><small>{video.placeTimes[selectedPlace] ? `Момент · ${Math.floor(video.placeTimes[selectedPlace] / 60)}:${String(video.placeTimes[selectedPlace] % 60).padStart(2, '0')}` : 'Смотреть выпуск'}</small></span></button>) : <p>Связанный выпуск пока не размечен.</p>}
                  </div>
                  {!!relatedVideos.length && <button className="place-all" type="button" onClick={() => filterByPlace(currentPlace.id)}>Выпуски с упоминанием «{currentPlace.ru}» · {relatedVideos.length} <IconView icon={arrowIcon} /></button>}
                  <button className="place-reset" type="button" onClick={() => setSelectedPlace(null)}>Сбросить выбранное место</button>
                </> : <>
                  <h3>С чего начнём?</h3>
                  <p>Можно выбрать точку на карте или начать с мест, которые чаще всего появляются в наших историях.</p>
                  <div className="featured-places">
                    {['Florida', 'California', 'Oklahoma'].map((id) => {
                      const place = places.find((item) => item.id === id);
                      return <button key={id} type="button" onClick={() => selectPlace(id)}>{place.ru}<span>Штат США</span><IconView icon={arrowIcon} /></button>;
                    })}
                  </div>
                </>}
                <details className="place-index"><summary>Все места <span>({places.length})</span></summary><div>{places.map((place) => <button key={place.id} type="button" aria-pressed={selectedPlace === place.id} onClick={() => selectPlace(place.id)}>{place.ru}</button>)}</div></details>
              </aside>
            </div>
          </div>
        </section>

        <MusicSection onOpenVideo={openVideo} videoRecords={videoRecords} />

        <TruckSection mileage={channelData.mileage} />

        <section className="cozy-break section-pad" aria-labelledby="home-title">
          <div className="wrap cozy-break-inner">
            <div className="cozy-copy"><h2 id="home-title">А потом мы дома.<br /><span>Дел тоже хватает.</span></h2><p>Строим бассейн, обустраиваем летнюю кухню, ухаживаем за растениями и готовим еду для следующего рейса.</p><a className="button button-quiet" href="#videos" onClick={() => { setCategory('home'); setQuery(''); setPlaceFilter(null); setSelectedPlace(null); setSavedOnly(false); setShown(pageSize); }}>Найти домашние выпуски <IconView icon={arrowIcon} /></a></div>
            <button className="home-photo-card" type="button" onClick={() => openVideo(videoRecords.find((video) => video.id === 'LtPcCPDdO38'))} aria-label="Открыть видео о стройке дома">
              <img src={imagePath('images/video-capsule.jpg')} alt="Строительство бассейна у дома во Флориде" loading="lazy" /><span><small>Наш дом во Флориде</small><strong>Всё делается по шагу</strong></span><span className="photo-play"><IconView icon={playIcon} /></span>
            </button>
          </div>
        </section>

        <section className="social-section section-pad" id="social" aria-labelledby="social-title">
          <div className="wrap">
            <div className="section-heading">
              <div><h2 id="social-title">Оставайтесь<br /><span>с нами на связи.</span></h2></div>
            </div>
          </div>
          <a className="channel-banner" href="https://www.youtube.com/@anka-dalnoboi" target="_blank" rel="noopener noreferrer" aria-label="Открыть канал ANKA — Дальнобойщица на YouTube"><img src={imagePath('images/creators/channel-banner.jpg')} alt="" loading="lazy" /></a>
          <div className="wrap">
            <div className="social-links">
              {socialItems.map((item) => <a href={item.href} target="_blank" rel="noreferrer" key={item.href}>
                <span className={`social-link-icon ${item.className}`}><IconView icon={item.icon} /></span><span><strong>{item.name}</strong><small>{item.handle} · {item.name === 'YouTube' ? `${videoRecords.length} ${plural(videoRecords.length, ['выпуск', 'выпуска', 'выпусков'])} в каталоге` : item.detail}</small></span><IconView className="social-arrow" icon={linkIcon} />
              </a>)}
            </div>
          </div>
        </section>

        <section className="random-section" aria-label="Случайный выпуск">
          <div className="wrap random-inner"><p>Если пока не знаете, что выбрать</p><h2>Откройте случайный выпуск.</h2><button className="button button-primary" type="button" onClick={randomVideo}><IconView icon={shuffleIcon} /> Выбрать выпуск</button></div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="wrap footer-main"><a className="brand" href="#top"><span className="brand-symbol" aria-hidden="true">A</span><span className="brand-word">ANKA<small>дорога и дом</small></span></a><nav aria-label="Ссылки в подвале">{nav.slice(0, 5).map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}</nav></div>
        <div className="wrap footer-bottom"><span>Аня и Сергей · ANKA</span><span>Спасибо, что заглянули к нам.</span></div>
      </footer>

      <dialog className="content-dialog" ref={dialogRef} onClose={() => setModal(null)} onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }} aria-label="Подробности">
        {modal && <>
          <button className="round-control dialog-close" type="button" aria-label="Закрыть окно" onClick={() => dialogRef.current?.close()}><IconView icon={closeIcon} /></button>
          {modal.type === 'video' && <VideoDialog modal={modal} onChapter={(seconds) => setModal((current) => ({ ...current, start: seconds }))} onMusic={(video) => setModal({ type: 'videoMusic', video })} />}
          {modal.type === 'videoMusic' && <VideoMusicDialog video={modal.video} onOpenVideo={openVideo} />}
          {modal.type === 'person' && <PersonDialog person={personalities[modal.personKey]} personKey={modal.personKey} />}
          {modal.type === 'matrix' && <MatrixDialog />}
        </>}
      </dialog>
      <div className={`toast${toast ? ' visible' : ''}`} role="status" aria-live="polite">{toast}</div>
    </>
  );
}

function VideoDialog({ modal, onChapter, onMusic }) {
  const { video, start } = modal;
  const playerRef = useRef(null);
  const [playerError, setPlayerError] = useState(false);
  useEffect(() => {
    setPlayerError(false);
    const onMessage = (event) => {
      if (event.origin !== 'https://www.youtube-nocookie.com' || event.source !== playerRef.current?.contentWindow) return;
      let data = event.data;
      try { if (typeof data === 'string') data = JSON.parse(data); } catch { return; }
      if (data?.event === 'onError' && [2, 5, 100, 101, 150, 153].includes(Number(data.info))) setPlayerError(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [video.id, start]);
  const category = categories.find((item) => item.id === video.category) || categories[0];
  const youtubeUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}${start ? `&t=${start}s` : ''}`;
  const blocked = embedAvailability.blocked.includes(video.id) || playerError;
  return <div className="video-dialog-layout">
    <div className="video-player-wrap">
      {blocked ? <div className="video-player video-external"><IconView icon={youtubeIcon} /><strong>Смотрите этот выпуск на YouTube</strong><p>Автор ограничил просмотр на других сайтах или плеер не загрузился.</p><a href={youtubeUrl} target="_blank" rel="noopener noreferrer">Открыть на YouTube <IconView icon={linkIcon} /></a></div> : <iframe ref={playerRef} key={`${video.id}-${start}`} className="video-player" src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}?autoplay=1&start=${start}&rel=0&enablejsapi=1`} title={`YouTube: ${video.title}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" onLoad={() => { const target = playerRef.current?.contentWindow; target?.postMessage(JSON.stringify({ event: 'listening', id: video.id }), 'https://www.youtube-nocookie.com'); target?.postMessage(JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onError'] }), 'https://www.youtube-nocookie.com'); }} allowFullScreen />}
      <div className="video-dialog-info"><span className="video-category" style={{ background: category.color }}>{category.name}</span><h2 id="dialog-title">{video.title}</h2><p>{video.description}</p><div className="video-dialog-meta"><span>{formatDate(video.date)}</span>{video.duration && <span>{video.duration}</span>}<span>{formatViews(video.views)}</span></div><div className="video-dialog-actions"><a className="video-action video-action--youtube" href={youtubeUrl} target="_blank" rel="noopener noreferrer"><span className="video-action-mark"><IconView icon={youtubeIcon} /></span><span>Смотреть на YouTube</span><IconView className="video-action-end" icon={linkIcon} /></a><button className="video-action video-action--music" type="button" onClick={() => onMusic(video)}><span className="video-action-mark"><IconView icon={musicIcon} /></span><span>Музыка из выпуска</span><IconView className="video-action-end" icon={arrowIcon} /></button></div></div>
    </div>
    <aside className="chapters-panel"><h3>{video.chapters.length ? 'Главы выпуска' : video.frameMoments ? 'Отмеченные кадры' : video.captionMoments.length ? (video.captionTopics ? 'Темы выпуска' : 'Фрагменты выпуска') : 'Этот выпуск'}</h3><p>{video.chapters.length ? 'Нажмите на главу, чтобы перейти к моменту.' : video.frameMoments ? 'Отдельные кадры из выпуска; подробная разметка ещё не готова.' : video.captionMoments.length ? 'По автоматическим субтитрам; возможны ошибки.' : 'Подробной разметки для этого выпуска пока нет.'}</p>
      {!video.chapters.length && <button className={`dialog-chapter${start === 0 ? ' active' : ''}`} type="button" onClick={() => onChapter(0)}><time>00:00</time><span>Начало выпуска</span></button>}
      {(video.chapters.length ? video.chapters : video.captionMoments).map((chapter) => <button className={`dialog-chapter${secondsFromTime(chapter.time) === start ? ' active' : ''}`} key={`${video.id}-${chapter.time}`} type="button" onClick={() => onChapter(secondsFromTime(chapter.time))}><time>{chapter.time}</time><span>{chapter.text}</span></button>)}
    </aside>
  </div>;
}

function MatrixDialog() {
  return <div className="simple-dialog"><p>Как у нас обычно распределены занятия. В разных рейсах роли могут пересекаться.</p><h2 id="dialog-title">Дела в экипаже и дома</h2><table className="matrix-table"><thead><tr><th>Сфера</th><th>Аня</th><th>Сергей</th></tr></thead><tbody>{routeMatrix.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

export default App;
