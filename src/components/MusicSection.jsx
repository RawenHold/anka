import { useMemo, useState } from 'react';
import musicIcon from '@iconify-icons/bx/music';
import linkIcon from '@iconify-icons/bx/link-external';
import arrowIcon from '@iconify-icons/bx/right-arrow-alt';
import playCircleIcon from '@iconify-icons/bx/play-circle';
import youtubeIcon from '@iconify-icons/bxl/youtube';
import musicSources from '../data/music-sources.json';
import { extractLiveMusic } from '../data/live-music.js';
import '../music-redesign.css';

const savedRecords = [
  ...musicSources.items,
  ...(musicSources.namedUnlinkedTracks || []).map((track) => ({ ...track, platform: 'YouTube search', listenUrl: track.searchUrl })),
];
const normalize = (value = '') => String(value).toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/[.,/#!$%^&*;:{}=\-_`~()?"'«»]/g, ' ').replace(/\s+/g, ' ').trim();
const secondsFromTime = (time = '0') => time.split(':').reduce((sum, part) => sum * 60 + Number(part), 0);
const plural = (count) => count % 10 === 1 && count % 100 !== 11 ? 'композиция' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'композиции' : 'композиций';
const Icon = ({ icon }) => <svg className="box-icon" viewBox={`0 0 ${icon.width || 24} ${icon.height || 24}`} aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: icon.body }} />;

function MusicRow({ track, onOpen, videoRecords }) {
  const mentions = track.mentions || [];
  const first = mentions[0];
  const coverUrl = track.artwork?.url || (first ? `https://i.ytimg.com/vi/${first.videoId}/hqdefault.jpg` : '');
  const coverLabel = track.artwork?.url ? (track.platform === 'YouTube' ? 'Превью музыкального видео' : 'Изображение композиции') : 'Кадр из выпуска';
  const searchLink = track.platform === 'YouTube search';
  const isCompilation = track.musicTargetStatus?.includes('compilation');
  const isYouTube = track.platform === 'YouTube' || searchLink;
  const listenLabel = searchLink ? 'Найти на YouTube' : isCompilation ? 'Подборка на YouTube' : `Слушать на ${track.platform}`;
  const openMention = (mention) => {
    const video = videoRecords.find((item) => item.id === mention.videoId);
    if (video) onOpen(video, mention.time ? secondsFromTime(mention.time) : 0);
  };

  return <li className="anka-music-row">
    <div className="anka-music-cover" title={coverLabel}>
      <Icon icon={musicIcon} />
      {coverUrl && <img src={coverUrl} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />}
    </div>
    <div className="anka-music-info">
      <span className="anka-music-label">{coverLabel} · {searchLink ? 'Поиск' : track.platform}</span>
      <h3>{track.title || 'Музыка из выпуска'}</h3>
      {track.artist && <p>{track.artist}</p>}
      {isCompilation && <p className="anka-music-note">Ссылка ведёт на подборку; совпадение композиции не подтверждено.</p>}
      {mentions.length > 1 && <details className="anka-music-mentions"><summary>Ещё моменты в выпусках ({mentions.length - 1})</summary>{mentions.slice(1).map((mention, index) => <button type="button" key={`${mention.videoId}-${mention.time || index}`} onClick={() => openMention(mention)}>{mention.videoTitle}{mention.time ? ` · ${mention.timeIsApproximate ? 'около ' : ''}${mention.time}` : ''}</button>)}</details>}
    </div>
    <div className="anka-music-actions">
      <a className="anka-music-listen" href={track.listenUrl} target="_blank" rel="noreferrer" aria-label={`${listenLabel}: ${track.title || 'музыка из выпуска'}`}>
        <span className={`anka-platform-mark ${isYouTube ? 'is-youtube' : 'is-suno'}`} aria-hidden="true">{isYouTube ? <Icon icon={youtubeIcon} /> : track.platform}</span>
        <span>{listenLabel}</span><Icon icon={linkIcon} />
      </a>
      {first && <button className="anka-music-scene" type="button" onClick={() => openMention(first)} aria-label={`Открыть выпуск${first.time ? `, ${first.timeIsApproximate ? 'примерно ' : ''}${first.time}` : ''}: ${first.videoTitle}`}>
        <Icon icon={playCircleIcon} /><span>Открыть выпуск</span>{first.time && <span className="anka-music-time">{first.timeIsApproximate ? 'около ' : ''}{first.time}</span>}
      </button>}
    </div>
  </li>;
}

export default function MusicSection({ onOpenVideo, videoRecords }) {
  const records = useMemo(() => [...savedRecords, ...videoRecords.flatMap(extractLiveMusic)], [videoRecords]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(12);
  const [cuesShown, setCuesShown] = useState(15);
  const filtered = records.filter((track) => (filter === 'all' || track.platform === filter) && normalize(`${track.title || ''} ${track.artist || ''} ${(track.mentions || []).map((mention) => mention.videoTitle).join(' ')}`).includes(normalize(query)));
  const openCue = (cue) => {
    const video = videoRecords.find((item) => item.id === cue.videoId);
    if (video) onOpenVideo(video, cue.time ? secondsFromTime(cue.time) : 0);
  };

  return <section className="anka-music" id="music" aria-labelledby="music-title">
    <div className="anka-music-inner">
      <div className="anka-music-heading"><div><h2 id="music-title">Песни из<br /><em>наших видео.</em></h2></div></div>
      <div className="anka-music-search"><label htmlFor="music-search">Найти композицию или исполнителя</label><input id="music-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setShown(12); }} placeholder="Название, исполнитель или выпуск" /></div>
      <div className="anka-music-toolbar"><div className="anka-music-filters" role="group" aria-label="Фильтр музыки">{[['all', 'Вся музыка'], ['Suno', 'Suno'], ['YouTube', 'YouTube'], ['YouTube search', 'Поиск на YouTube'], ...['Spotify', 'Apple Music'].filter((platform) => records.some((track) => track.platform === platform)).map((platform) => [platform, platform])].map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => { setFilter(value); setShown(12); }}>{label}</button>)}</div><span aria-live="polite">{filtered.length} {plural(filtered.length)}</span></div>
      <ul className="anka-music-list">{filtered.slice(0, shown).map((track) => <MusicRow key={track.id} track={track} onOpen={onOpenVideo} videoRecords={videoRecords} />)}</ul>
      {!filtered.length && <div className="anka-music-empty"><h3>Ничего не нашли</h3><p>Попробуйте другое название или выберите все площадки.</p><button type="button" onClick={() => { setQuery(''); setFilter('all'); setShown(12); }}>Показать всю музыку</button></div>}
      {shown < filtered.length && <button className="anka-music-more" type="button" onClick={() => setShown((count) => count + 12)}>Показать ещё <span>({Math.min(12, filtered.length - shown)} из {filtered.length - shown})</span></button>}
      <details className="anka-music-cues"><summary>Другие упоминания музыки в выпусках <span>{musicSources.unresolvedMentions.length}</span></summary><p>В описаниях есть и такие моменты — без названия композиции. Можно открыть выпуск с нужного места.</p><div>{musicSources.unresolvedMentions.slice(0, cuesShown).map((cue, index) => <button key={`${cue.videoId}-${cue.time || index}-${index}`} type="button" onClick={() => openCue(cue)}><strong>{cue.mention}</strong><span>{cue.videoTitle}</span><Icon icon={arrowIcon} /></button>)}</div>{cuesShown < musicSources.unresolvedMentions.length && <button className="anka-music-cues-more" type="button" onClick={() => setCuesShown((count) => count + 15)}>Показать ещё моменты</button>}</details>
    </div>
  </section>;
}
