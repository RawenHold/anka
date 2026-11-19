import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = fileURLToPath(new URL('.', import.meta.url));
const extractorPath = resolve(scriptsDir, 'music-extract.mjs');
const catalogPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(scriptsDir, '../src/data/channel-catalog.json');
const extracted = spawnSync(process.execPath, [extractorPath, catalogPath], { encoding: 'utf8' });

if (extracted.status !== 0) {
  throw new Error(extracted.stderr || 'Music link extraction failed.');
}

const result = JSON.parse(extracted.stdout);
const pending = result.items.filter((item) => item.platform === 'Suno' || item.platform === 'YouTube');
const attempted = {
  suno: pending.filter((item) => item.platform === 'Suno').length,
  youtube: pending.filter((item) => item.platform === 'YouTube').length,
};
const concurrency = 3;
let nextIndex = 0;

function decodeHtml(value = '') {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function metaContent(html, key) {
  const tags = [...html.matchAll(/<meta\b[^>]*>/giu)].map((match) => match[0]);
  const tag = tags.find((candidate) =>
    candidate.includes(`property="${key}"`)
    || candidate.includes(`property='${key}'`)
    || candidate.includes(`name="${key}"`)
    || candidate.includes(`name='${key}'`));
  const value = tag?.match(/\bcontent="([^"]*)"/iu)?.[1]
    ?? tag?.match(/\bcontent='([^']*)'/iu)?.[1]
    ?? null;
  return value === null ? null : decodeHtml(value);
}

function parseCredit(text = '') {
  const withoutUrls = text.replace(/https?:\/\/\S+/giu, '');
  const chapterMusic = withoutUrls.match(/(?:^|\s)\d{1,2}:\d{2}(?::\d{2})?\s+🎵\s*(.+?)(?=\s+\d{1,2}:\d{2}(?::\d{2})?\s+|$)/u)?.[1];
  const clean = (chapterMusic ?? withoutUrls)
    .replace(/^\s*\d{1,2}:\d{2}(?::\d{2})?\s*/u, '')
    .replaceAll('🎵', '')
    .replace(/[：:]\s*$/u, '')
    .trim();
  const match = clean.match(/^(.+?)\s[-–—]\s(.+)$/u);
  if (!match) return null;

  return {
    artist: match[1].trim(),
    title: match[2].trim().replace(/\s*(?:\|.*|\((?:official|lyrics|no copyright|cover).*)$/iu, '').trim(),
    creditText: clean,
  };
}

function parsePlatformTitle(text = '') {
  const match = text.match(/^(.+?)\s+-\s+(.+)$/u);
  if (!match) return null;
  return {
    artist: match[1].trim(),
    title: match[2].trim().replace(/\s*(?:\|.*|\((?:official|lyrics|no copyright|cover).*)$/iu, '').trim(),
  };
}

function sourceArtistFromText(text = '') {
  return text.match(/(?:песня|song).*?(?:от|from)\s+(?:нашего\s+зрителя\s+)?([^@:\n]+)/iu)?.[1]?.trim() ?? null;
}

function isMusicTarget(platformTitle = '') {
  return /(?:music|song|audio|lyrics|soundtrack|remix|ncs|soblazn|official\s+(?:audio|music)|d\.?\s*j\.?)/iu.test(platformTitle);
}

async function resolveItem(item) {
  try {
    if (item.platform === 'YouTube') {
      const parsed = new URL(item.listenUrl);
      const videoId = parsed.searchParams.get('v') ?? parsed.pathname.split('/').filter(Boolean).at(-1);
      const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const oembedUrl = new URL('https://www.youtube.com/oembed');
      oembedUrl.searchParams.set('url', watchUrl);
      oembedUrl.searchParams.set('format', 'json');
      const response = await fetch(oembedUrl, {
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; ANKA-Music-Research/1.0)' },
        signal: AbortSignal.timeout(20000),
      });
      const metadata = response.ok ? await response.json() : null;
      const sourceCredit = item.mentions
        .map((mention) => parseCredit(mention.sourceText) ?? parseCredit(mention.evidenceText))
        .find(Boolean) ?? null;
      const platformCredit = parsePlatformTitle(metadata?.title ?? '');
      const simplePlatformTitle = metadata?.title?.replace(/\s*\([^)]*\)\s*$/u, '').trim() ?? null;
      const explicitArtist = item.mentions
        .map((mention) => sourceArtistFromText(mention.sourceText))
        .find(Boolean) ?? null;
      const musicTargetConfirmed = Boolean(sourceCredit || isMusicTarget(metadata?.title ?? ''));
      const compilationTarget = Boolean(metadata?.title && /(?:mix|compilation|playlist|gaming\s+music|streaming\s+music)/iu.test(metadata.title));

      return {
        ...item,
        title: sourceCredit?.title ?? platformCredit?.title ?? simplePlatformTitle,
        artist: sourceCredit?.artist ?? platformCredit?.artist ?? explicitArtist ?? (musicTargetConfirmed ? metadata?.author_name : null),
        sourceCredit: sourceCredit?.creditText ?? null,
        platformTitle: metadata?.title ?? null,
        platformAuthor: metadata?.author_name ?? null,
        creatorUrl: metadata?.author_url ?? null,
        canonicalUrl: watchUrl,
        musicTargetStatus: !musicTargetConfirmed ? 'not-a-confirmed-music-destination'
          : compilationTarget ? 'confirmed-music-compilation; exact-track-match-unverified'
            : 'confirmed-by-track-credit-or-oembed-title',
        metadataStatus: response.ok && metadata?.title ? 'resolved' : sourceCredit ? 'confirmed-by-description-credit; oEmbed unavailable' : 'page-unavailable-or-missing-title',
        artwork: metadata?.thumbnail_url ? {
          url: metadata.thumbnail_url,
          type: 'YouTube video thumbnail preview; not an album cover',
          sourceUrl: watchUrl,
        } : null,
      };
    }

    const response = await fetch(item.listenUrl, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; ANKA-Music-Research/1.0)' },
      signal: AbortSignal.timeout(20000),
    });
    const html = await response.text();
    const title = metaContent(html, 'og:title');
    const description = metaContent(html, 'description');
    const imageUrl = metaContent(html, 'og:image');
    const pageUrl = metaContent(html, 'og:url') ?? response.url;
    const creatorMatch = description?.match(/\bby\s+(.+?)\s+\(@([^)]+)\)/iu);
    const canonicalUrl = new URL(pageUrl);
    canonicalUrl.search = '';

    return {
      ...item,
      title,
      artist: creatorMatch?.[1] ?? null,
      creatorHandle: creatorMatch?.[2] ?? null,
      platformTitle: title,
      canonicalUrl: canonicalUrl.toString(),
      metadataStatus: response.ok && title ? 'resolved' : 'page-unavailable-or-missing-title',
      artwork: imageUrl ? {
        url: imageUrl,
        type: 'Suno track page image (og:image)',
        sourceUrl: response.url,
      } : null,
    };
  } catch (error) {
    return {
      ...item,
      metadataStatus: 'fetch-failed',
      metadataError: String(error),
      artwork: null,
    };
  }
}

async function worker() {
  while (nextIndex < pending.length) {
    const index = nextIndex;
    nextIndex += 1;
    result.items[result.items.indexOf(pending[index])] = await resolveItem(pending[index]);
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));

const metadataResolved = {
  suno: result.items.filter((item) => item.platform === 'Suno' && item.metadataStatus === 'resolved').length,
  youtube: result.items.filter((item) => item.platform === 'YouTube' && item.metadataStatus === 'resolved').length,
};

const rejectedYouTubeLinks = result.items.filter((item) => item.platform === 'YouTube'
  && item.musicTargetStatus === 'not-a-confirmed-music-destination');
for (const item of rejectedYouTubeLinks) {
  for (const mention of item.mentions) {
    result.unresolvedMentions.push({
      videoId: mention.videoId,
      videoTitle: mention.videoTitle,
      time: mention.time,
      timeIsApproximate: mention.timeIsApproximate,
      mention: `🎵 ссылка ведёт на обычное видео «${item.platformTitle ?? 'без подтверждённого названия'}», музыкальный источник не установлен`,
      unresolvedReason: 'YouTube oEmbed title did not identify a song or music destination.',
      source: mention.source,
      candidateUrl: item.listenUrl,
    });
  }
}
result.items = result.items.filter((item) => item.musicTargetStatus !== 'not-a-confirmed-music-destination');
result.coverage.genericMusicMentionsWithoutDirectLink += rejectedYouTubeLinks.reduce((total, item) => total + item.mentions.length, 0);
result.rejectedYouTubeLinks = rejectedYouTubeLinks.map((item) => ({
  url: item.listenUrl,
  title: item.platformTitle,
  reason: 'Target metadata does not identify this as a music recording; retained as unresolved context, not a track.',
  mentions: item.mentions,
}));

const merged = new Map();
for (const item of result.items) {
  const canonicalUrl = item.canonicalUrl ?? item.listenUrl;
  const key = `${item.platform}|${canonicalUrl}`;
  const existing = merged.get(key);
  if (!existing) {
    merged.set(key, {
      ...item,
      listenUrl: item.platform === 'Suno' ? canonicalUrl : item.listenUrl,
      sourceLinks: [...new Set(item.sourceLinks)],
    });
    continue;
  }

  existing.sourceLinks = [...new Set([...existing.sourceLinks, ...item.sourceLinks])];
  for (const mention of item.mentions) {
    if (!existing.mentions.some((entry) => entry.videoId === mention.videoId
      && entry.time === mention.time
      && entry.timeIsApproximate === mention.timeIsApproximate)) {
      existing.mentions.push(mention);
    }
  }
}
result.items = [...merged.values()];
result.items.forEach((item, index) => { item.id = `music-${index + 1}`; });
result.coverage.uniqueLinksFound = result.items.length;
result.coverage.videoLinkMentions = result.items.reduce((total, item) => total + item.mentions.length, 0);

result.sourceMetadata = {
  sunoSharePagesAttempted: attempted.suno,
  sunoSharePagesResolved: metadataResolved.suno,
  youtubeOembedPagesAttempted: attempted.youtube,
  youtubeOembedPagesResolved: metadataResolved.youtube,
  fetchedAt: new Date().toISOString(),
  method: 'Read public Suno page og:title/description/og:image and YouTube oEmbed metadata.',
};
result.coverageNotes = [
  'Catalog-wide coverage covers the 232 videos in channel-catalog.json; 230 descriptions were non-empty.',
  'Direct share-page links are grouped by canonical music target and retain every video/time mention.',
  'Suno artwork URLs come from each public Suno page og:image metadata.',
  'YouTube artwork URLs are video thumbnail previews, not verified album covers.',
  'Rights to rehost or republish platform artwork were not assessed.',
  'Unlinked named tracks are recorded separately with YouTube search URLs, not direct recordings.',
  'YouTube URLs with oEmbed titles that identify ordinary videos rather than music are excluded and retained under rejectedYouTubeLinks/unresolvedMentions.',
  'Generic music cues without a named track remain unresolved and are not presented as separate songs.',
];

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exit(0);
