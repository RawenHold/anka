// Build source-linked navigation snippets from downloaded Russian WebVTT captions.
// Usage: node scripts/extract-caption-moments.mjs <captions-directory> <output.json>
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import catalog from '../src/data/channel-catalog.json' with { type: 'json' };

const [directory, target] = process.argv.slice(2);
if (!directory || !target) throw new Error('Укажите папку субтитров и файл результата');
const parseTime = (value) => value.split(':').reduce((total, part) => total * 60 + Number(part), 0);
const stamp = (seconds) => {
  const n = Math.floor(seconds), h = Math.floor(n / 3600), m = Math.floor(n % 3600 / 60), s = n % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};
function parseVtt(text) {
  const cues = [];
  for (const block of text.split(/\r?\n\s*\r?\n/u)) {
    const lines = block.split(/\r?\n/u);
    const timing = lines.findIndex((line) => /-->/u.test(line));
    if (timing < 0) continue;
    const match = lines[timing].match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}\.\d{3})/u);
    if (!match || parseTime(match[2]) - parseTime(match[1]) < 0.05) continue;
    const content = lines.slice(timing + 1).filter((line) => line.trim()).at(-1) || '';
    const value = content.replace(/<[^>]+>/gu, '').replace(/&amp;/gu, '&').replace(/&lt;/gu, '<').replace(/&gt;/gu, '>').replace(/\[(?:музыка|аплодисменты)\]/giu, '').replace(/\s+/gu, ' ').trim();
    if (value && /[а-яё]/iu.test(value) && cues.at(-1)?.text !== value) cues.push({ time: parseTime(match[1]), text: value });
  }
  return cues;
}

const output = {};
for (const video of catalog.videos) {
  let text;
  try { text = await readFile(path.join(directory, `${video.id}.ru.vtt`), 'utf8'); } catch { continue; }
  const cues = parseVtt(text);
  if (cues.length < 3) continue;
  const interval = Math.max(150, Math.ceil((video.durationSeconds || 0) / 8 / 30) * 30);
  const moments = [];
  for (let targetTime = 0; targetTime < (video.durationSeconds || cues.at(-1).time); targetTime += interval) {
    const index = cues.findIndex((cue) => cue.time >= targetTime);
    if (index < 0) break;
    const selected = [];
    for (let i = index; i < cues.length && cues[i].time < cues[index].time + 12 && selected.join(' ').length < 135; i++) selected.push(cues[i].text);
    let excerpt = selected.join(' ').replace(/\s+/gu, ' ').trim();
    if (excerpt.length > 145) excerpt = `${excerpt.slice(0, 140).replace(/\s+\S*$/u, '')}…`;
    if (excerpt.length >= 25) moments.push({ time: stamp(cues[index].time), text: excerpt });
  }
  if (moments.length) output[video.id] = moments;
}
await writeFile(target, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Собраны фрагменты субтитров для ${Object.keys(output).length} выпусков.`);
