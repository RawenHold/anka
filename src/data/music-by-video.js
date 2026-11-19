import musicSources from './music-sources.json' with { type: 'json' };
import { extractLiveMusic } from './live-music.js';

const musicByVideo = new Map();
const entryFor = (id) => {
  if (!musicByVideo.has(id)) musicByVideo.set(id, { tracks: [], cues: [] });
  return musicByVideo.get(id);
};

const tracks = [
  ...musicSources.items,
  ...(musicSources.namedUnlinkedTracks || []).map((track) => ({
    ...track, platform: 'YouTube search', listenUrl: track.searchUrl,
  })),
];

for (const track of tracks) {
  for (const mention of track.mentions || []) {
    if (mention.videoId) entryFor(mention.videoId).tracks.push({ track, mention });
  }
}
for (const cue of musicSources.unresolvedMentions || []) {
  if (cue.videoId) entryFor(cue.videoId).cues.push(cue);
}

export const getVideoMusic = (videoId, video) => {
  const saved = musicByVideo.get(videoId) || { tracks: [], cues: [] };
  const live = extractLiveMusic(video).map((track) => ({ track, mention: track.mentions[0] }));
  return { tracks: [...saved.tracks, ...live], cues: saved.cues };
};
