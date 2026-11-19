import musicIcon from '@iconify-icons/bx/music';
import playIcon from '@iconify-icons/bx/play-circle';
import linkIcon from '@iconify-icons/bx/link-external';
import youtubeIcon from '@iconify-icons/bxl/youtube';
import { getVideoMusic } from '../data/music-by-video.js';
import '../video-music.css';

const Icon = ({ icon }) => <svg className="box-icon" viewBox={`0 0 ${icon.width || 24} ${icon.height || 24}`} aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: icon.body }} />;
const secondsFromTime = (time = '0') => time.split(':').reduce((sum, part) => sum * 60 + Number(part), 0);

export default function VideoMusicDialog({ video, onOpenVideo }) {
  const { tracks, cues } = getVideoMusic(video.id, video);
  const groups = new Map();
  for (const { track, mention } of tracks) {
    if (!groups.has(track.id)) groups.set(track.id, { track, mentions: [] });
    groups.get(track.id).mentions.push(mention);
  }
  const groupedTracks = [...groups.values()].sort((a, b) => secondsFromTime(a.mentions[0].time || '999:59:59') - secondsFromTime(b.mentions[0].time || '999:59:59'));
  return <div className="video-music-dialog">
    <div className="video-music-heading"><span className="video-music-heading-icon"><Icon icon={musicIcon} /></span><div><h2 id="dialog-title">Музыка в выпуске</h2><p>{video.title}</p></div></div>
    {(tracks.length > 0 || cues.length > 0) ? <>
      <p className="video-music-explainer">Собрали ссылки и отметки из описания этого видео.</p>
      {groupedTracks.length > 0 && <ul className="video-music-list">{groupedTracks.map(({ track, mentions }) => {
        const isYouTube = track.platform === 'YouTube' || track.platform === 'YouTube search';
        const isSearch = track.platform === 'YouTube search';
        const isCompilation = track.musicTargetStatus?.includes('compilation');
        const label = isSearch ? 'Найти на YouTube' : isCompilation ? 'Подборка на YouTube' : `Слушать на ${track.platform}`;
        return <li key={track.id}>
          <div className="video-music-track"><strong>{track.title || 'Музыка из выпуска'}</strong>{track.artist && <span>{track.artist}</span>}{isCompilation && <small>Ссылка ведёт на подборку; совпадение композиции не подтверждено.</small>}</div>
          <div className="video-music-links"><a href={track.listenUrl} target="_blank" rel="noopener noreferrer"><span className={`video-music-platform ${isYouTube ? 'youtube' : 'suno'}`}>{isYouTube ? <Icon icon={youtubeIcon} /> : track.platform}</span>{label}<Icon icon={linkIcon} /></a>{mentions.filter((mention) => mention.time).map((mention, index) => <button key={`${mention.time}-${index}`} type="button" onClick={() => onOpenVideo(video, secondsFromTime(mention.time))}><Icon icon={playIcon} />{mention.timeIsApproximate ? 'Около ' : 'В выпуске · '}{mention.time}</button>)}</div>
        </li>;
      })}</ul>}
      {cues.length > 0 && <div className="video-music-cues"><h3>Ещё моменты с музыкой</h3><p>В описании отмечена музыка, но её название не указано.</p><div>{cues.map((cue, index) => <button key={`${cue.time || index}-${index}`} type="button" onClick={() => onOpenVideo(video, secondsFromTime(cue.time))}><Icon icon={playIcon} /> {cue.time ? `${cue.timeIsApproximate ? 'Около ' : ''}${cue.time}` : 'Открыть выпуск'}</button>)}</div></div>}
    </> : <div className="video-music-empty"><p>В описании этого выпуска мы пока не нашли отдельной ссылки на песню или отметки с её названием.</p><button type="button" onClick={() => onOpenVideo(video)}><Icon icon={playIcon} /> Открыть выпуск</button></div>}
  </div>;
}
