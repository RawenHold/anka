import { CHANNEL_ID } from './feed.mjs';

function jsonObjectAt(text, start) {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let i = start; i < Math.min(text.length, start + 500_000); i++) {
    const char = text[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) {
      try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

export function parseSubscriberText(input) {
  if (typeof input !== 'string') return null;
  const normalized = input.replace(/[\u00a0\u202f]/g, ' ').trim();
  const match = normalized.match(/^(\d{1,3}(?:,\d{3})+|\d+(?:[.,]\d{1,2})?)\s*(K|M|B|тыс\.?|млн|млрд)?\s*(?:subscribers?|подписчик(?:ов|а|и)?)$/iu);
  if (!match) return null;
  const suffix = (match[2] || '').toLowerCase();
  const raw = suffix ? match[1].replace(',', '.') : match[1].replaceAll(',', '');
  const multiplier = ({ k: 1_000, m: 1_000_000, b: 1_000_000_000, 'тыс': 1_000, 'тыс.': 1_000, 'млн': 1_000_000, 'млрд': 1_000_000_000 })[suffix] || 1;
  const value = Number(raw) * multiplier;
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function parseSubscriberPage(html, expectedChannelId = CHANNEL_ID) {
  if (typeof html !== 'string' || html.length > 6_000_000) return null;
  const marker = '"aboutChannelViewModel"';
  let position = 0;
  while ((position = html.indexOf(marker, position)) !== -1) {
    const start = html.indexOf('{', position + marker.length);
    if (start < 0 || start - position > 60) { position += marker.length; continue; }
    const model = jsonObjectAt(html, start);
    position = start + 1;
    if (!model || typeof model.canonicalChannelUrl !== 'string') continue;
    let canonical;
    try { canonical = new URL(model.canonicalChannelUrl); } catch { continue; }
    if (!['www.youtube.com', 'youtube.com'].includes(canonical.hostname)) continue;
    if (model.channelId !== expectedChannelId && canonical.pathname !== `/channel/${expectedChannelId}`) continue;
    const countText = typeof model.subscriberCountText === 'string' ? model.subscriberCountText : model.subscriberCountText?.simpleText;
    return parseSubscriberText(countText);
  }
  return null;
}
