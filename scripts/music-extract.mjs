import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const catalogPath = resolve(process.argv[2] ?? 'src/data/channel-catalog.json');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));

if (!Array.isArray(catalog.videos)) {
  throw new TypeError(`Expected a videos array in ${catalogPath}`);
}

const urlPattern = /https?:\/\/[^\s<>"']+/giu;
const musicCue = /(?:🎵|\bmusic\b|\bsong\b|\btrack\b|\bost\b|музык|песн|трек|саундтрек|soundtrack|d\.?\s*j\.?\s*lunin)/iu;
const musicUrl = /(?:suno\.com\/(?:s|song)\/|open\.spotify\.com\/(?:track|album)\/|music\.youtube\.com\/watch\?|music\.apple\.com\/[^\s]*\/(?:song|album)\/)/iu;
const youtubeUrl = /(?:youtube\.com\/watch\?|youtu\.be\/)/iu;
const timestamp = /(?:^|\s)(\d{1,2}:\d{2}(?::\d{2})?)(?=\s|$)/u;
const namedCredit = /^\s*\d{1,2}:\d{2}(?::\d{2})?\s+🎵\s+(.+?)\s*$/u;

function cleanUrl(value) {
  return value.replace(/[),.;!?\]}]+$/u, '');
}

function canonicalMusicUrl(value) {
  if (!youtubeUrl.test(value)) return value;

  try {
    const parsed = new URL(value);
    const videoId = parsed.searchParams.get('v')
      ?? parsed.pathname.split('/').filter(Boolean).at(-1);
    return videoId ? `https://www.youtube.com/watch?v=${videoId}` : value;
  } catch {
    return value;
  }
}

function getLinks(line) {
  return [...line.matchAll(urlPattern)].map((match) => ({
    url: cleanUrl(match[0]),
    index: match.index ?? 0,
  }));
}

function contextAt(lines, index) {
  return lines.slice(Math.max(0, index - 1), Math.min(lines.length, index + 2))
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, 400);
}

const items = [];
const unresolvedMentions = [];
const namedTracks = new Map();
const groupedItems = new Map();
let descriptionsAvailable = 0;

for (const video of catalog.videos) {
  if (typeof video.description !== 'string' || !video.description.trim()) continue;
  descriptionsAvailable += 1;

  const lines = video.description.replace(/\r\n?/gu, '\n').split('\n');
  const videoUrl = video.url || `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`;

  const getTime = (lineIndex, line, position = line.length) => {
    const beforeCue = line.slice(0, position);
    const sameLineMatches = [...beforeCue.matchAll(/(?:^|\s)(\d{1,2}:\d{2}(?::\d{2})?)(?=\s|$)/gu)];
    const current = sameLineMatches.at(-1)?.[1];
    if (current) return { time: current, timeIsApproximate: false };

    const previous = lines[lineIndex - 1]?.trim() ?? '';
    const previousTime = previous.match(timestamp)?.[1];
    if (previousTime) return { time: previousTime, timeIsApproximate: true };

    return { time: null, timeIsApproximate: null };
  };

  const musicLinksForLine = (lineIndex) => {
    const line = lines[lineIndex]?.trim() ?? '';
    const cueContext = contextAt(lines, lineIndex);
    return getLinks(line).filter(({ url }) => {
      if (musicUrl.test(url)) return true;
      return youtubeUrl.test(url) && musicCue.test(cueContext);
    });
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex].trim();
    if (!line) continue;

    const links = getLinks(line);
    const cueContext = contextAt(lines, lineIndex);
    const cuePosition = line.search(musicCue);
    const { time, timeIsApproximate } = getTime(lineIndex, line, cuePosition >= 0 ? cuePosition : line.length);
    const qualifyingLinks = links.filter(({ url }) => musicUrl.test(url)
      || (youtubeUrl.test(url) && musicCue.test(cueContext)));

    for (const link of qualifyingLinks) {
      const platform = link.url.match(/suno\.com\/(?:s|song)\//iu) ? 'Suno'
        : link.url.match(/spotify\.com\//iu) ? 'Spotify'
          : link.url.match(/apple\.com\//iu) ? 'Apple Music' : 'YouTube';
      const canonicalUrl = canonicalMusicUrl(link.url);
      const key = `${platform}|${canonicalUrl}`;
      const linkTime = getTime(lineIndex, line, link.index);
      const mentionKey = `${video.id}|${linkTime.time ?? ''}|${linkTime.timeIsApproximate ?? ''}`;
      const group = groupedItems.get(key) ?? {
        id: `music-${groupedItems.size + 1}`,
        title: null,
        artist: null,
        listenUrl: canonicalUrl,
        sourceLinks: [],
        platform,
        artwork: null,
        mentions: [],
      };

      if (!group.sourceLinks.includes(link.url)) group.sourceLinks.push(link.url);

      if (!group.mentions.some((mention) => `${mention.videoId}|${mention.time ?? ''}|${mention.timeIsApproximate ?? ''}` === mentionKey)) {
        group.mentions.push({
          videoId: video.id,
          videoTitle: video.title,
          time: linkTime.time,
          timeIsApproximate: linkTime.timeIsApproximate,
          evidenceText: cueContext,
          sourceText: line,
          source: {
            type: 'video-description',
            url: videoUrl,
            descriptionLine: lineIndex + 1,
          },
        });
      }

      groupedItems.set(key, group);
    }

    const neighboringLinks = [lineIndex - 1, lineIndex + 1]
      .filter((index) => index >= 0 && index < lines.length)
      .some((index) => musicLinksForLine(index).length > 0);

    if (time && musicCue.test(line) && qualifyingLinks.length === 0 && !neighboringLinks) {
      const unresolved = {
        videoId: video.id,
        videoTitle: video.title,
        time,
        timeIsApproximate,
        mention: line.slice(0, 300),
        source: {
          type: 'video-description',
          url: videoUrl,
          descriptionLine: lineIndex + 1,
        },
      };
      const credit = line.match(namedCredit)?.[1];
      const separator = credit?.match(/\s[-–—]\s/u);

      if (credit && separator) {
        const separatorIndex = separator.index ?? -1;
        const artist = credit.slice(0, separatorIndex).trim();
        const title = credit.slice(separatorIndex + separator[0].length).trim();
        if (artist && title) {
          const key = `${artist.normalize('NFKC').toLocaleLowerCase()}|${title.normalize('NFKC').toLocaleLowerCase()}`;
          const track = namedTracks.get(key) ?? {
            id: `named-${namedTracks.size + 1}`,
            artist,
            title,
            creditText: credit,
            searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${artist} ${title}`)}`,
            artwork: null,
            listeningLinkStatus: 'search-only; no direct destination in the source description',
            mentions: [],
          };
          if (!track.mentions.some((mention) => mention.videoId === video.id && mention.time === time && mention.timeIsApproximate === timeIsApproximate)) {
            track.mentions.push({
              videoId: video.id,
              videoTitle: video.title,
              time,
              timeIsApproximate,
              sourceText: line,
              source: unresolved.source,
            });
          }
          namedTracks.set(key, track);
          continue;
        }
      }

      unresolvedMentions.push(unresolved);
    }
  }
}

items.push(...groupedItems.values());

process.stdout.write(`${JSON.stringify({
  schemaVersion: 1,
  generatedFrom: relative(process.cwd(), catalogPath).replaceAll('\\', '/'),
  coverage: {
    catalogVideos: catalog.videos.length,
    descriptionsAvailable,
    uniqueLinksFound: items.length,
    videoLinkMentions: items.reduce((total, item) => total + item.mentions.length, 0),
    namedTrackGroupsWithoutDirectLink: namedTracks.size,
    namedTrackMentionsWithoutDirectLink: [...namedTracks.values()].reduce((total, item) => total + item.mentions.length, 0),
    genericMusicMentionsWithoutDirectLink: unresolvedMentions.length,
  },
  items,
  namedUnlinkedTracks: [...namedTracks.values()],
  unresolvedMentions,
}, null, 2)}\n`);
