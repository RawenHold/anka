import { useEffect, useRef, useState } from 'react';
import './ask-ai.css';

const prompt = 'Расскажи об Анне и Сергее, авторах YouTube-канала «ANKA — Дальнобойщица»: https://www.youtube.com/@anka-dalnoboi. Используй доступные источники, укажи ссылки и не придумывай факты. Что стоит посмотреть на канале?';
const providers = [
  { name: 'ChatGPT', href: `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`, icon: 'openai.svg' },
  { name: 'Perplexity', href: `https://www.perplexity.ai/search?q=${encodeURIComponent(prompt)}`, icon: 'perplexity.svg' },
  { name: 'Gemini', href: 'https://gemini.google.com/app', icon: 'gemini.svg' },
  { name: 'Claude', href: `https://claude.ai/new?q=${encodeURIComponent(prompt)}`, icon: 'claude.svg' },
];

export default function AskAI() {
  const details = useRef(null);
  const [copyState, setCopyState] = useState('idle');
  useEffect(() => {
    const close = (event) => { if (details.current && !details.current.contains(event.target)) details.current.open = false; };
    const escape = (event) => { if (event.key === 'Escape' && details.current?.open) { details.current.open = false; details.current.querySelector('summary')?.focus(); } };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, []);
  return <details className="ask-ai" ref={details}>
    <summary className="ask-ai-button"><span className="ai-mascot" aria-hidden="true"><span className="ai-eyes"><i /><i /></span></span><span>Спросить о нас AI</span></summary>
    <div className="ask-ai-popover">
      <strong>Хотите узнать о нас больше?</strong>
      <div className="ask-ai-providers">{providers.map(({ name, href, icon }) => <a key={name} href={href} target="_blank" rel="noopener noreferrer"><span className="ask-ai-provider-icon"><img src={`${import.meta.env.BASE_URL}images/ai/${icon}`} alt="" /></span><span>{name}</span><span className="ask-ai-arrow" aria-hidden="true">↗</span></a>)}</div>
      <p className="ask-ai-copy-hint">Для Gemini скопируйте вопрос и вставьте его в чат.</p>
      <button className="ask-ai-copy" type="button" onClick={async () => { try { await navigator.clipboard.writeText(prompt); setCopyState('copied'); } catch { setCopyState('manual'); } }}>{copyState === 'copied' ? 'Вопрос скопирован' : 'Скопировать вопрос'}</button>
      {copyState === 'manual' && <label className="ask-ai-manual">Выделите и скопируйте вопрос<textarea value={prompt} readOnly onFocus={(event) => event.currentTarget.select()} /></label>}
    </div>
  </details>;
}
