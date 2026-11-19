export const CHANNEL_ID = 'UCmLSYJkWLEbcrF4By3StTvQ';
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

function decodeEntities(text) {
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/giu, (entity, value) => {
    if (value === 'amp') return '&';
    if (value === 'lt') return '<';
    if (value === 'gt') return '>';
    if (value === 'quot') return '"';
    if (value === 'apos') return "'";
    const isHex = value[1]?.toLowerCase() === 'x';
    const codepoint = Number.parseInt(value.slice(isHex ? 2 : 1), isHex ? 16 : 10);
    return Number.isInteger(codepoint) && codepoint > 0 && codepoint <= 0x10ffff && !(codepoint >= 0xd800 && codepoint <= 0xdfff) ? String.fromCodePoint(codepoint) : entity;
  });
}

function xmlText(source) {
  return source.split(/(<!\[CDATA\[[\s\S]*?\]\]>)/u).map((chunk) => chunk.startsWith('<![CDATA[') ? chunk.slice(9, -3) : decodeEntities(chunk)).join('');
}

function element(source, name) {
  const match = source.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}\\s*>`, 'u'));
  return match ? xmlText(match[1]).trim() : '';
}

export function parseFeed(xml, expectedChannelId = CHANNEL_ID) {
  if (typeof xml !== 'string' || xml.length > 6_000_000 || !/<feed(?:\s|>)/u.test(xml) || !/<\/feed\s*>/u.test(xml) || /<!DOCTYPE|<!ENTITY|<parsererror/iu.test(xml)) {
    throw new Error('Неверный формат ленты YouTube');
  }
  const header = xml.split(/<entry(?:\s|>)/u, 1)[0];
  if (!header.includes(expectedChannelId)) throw new Error('Лента другого канала');
  const entries = [...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry\s*>/gu)];
  if (!entries.length) throw new Error('В ленте нет выпусков');
  const result = [];
  const ids = new Set();
  for (const [, entry] of entries) {
    const id = element(entry, 'yt:videoId');
    const channelId = element(entry, 'yt:channelId');
    const title = element(entry, 'title');
    const published = element(entry, 'published');
    if (channelId !== expectedChannelId || !YOUTUBE_ID.test(id) || !title || !/^\d{4}-\d{2}-\d{2}T/u.test(published) || !Number.isFinite(Date.parse(published)) || ids.has(id)) continue;
    ids.add(id);
    result.push({
      id,
      title,
      date: published.slice(0, 10),
      durationSeconds: null,
      description: element(entry, 'media:description') || null,
      url: `https://www.youtube.com/watch?v=${id}`,
      image: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    });
  }
  if (!result.length) throw new Error('Лента не содержит проверенных выпусков канала');
  return result;
}
