import { useEffect } from 'react';

const selector = '.video-thumb-button img, .person-photo img, .home-photo-card img, .cover-image, .truck-gallery-image';

export function usePhotoParallax() {
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let images = [];
    const update = () => {
      frame = 0;
      if (reducedMotion.matches) {
        images.forEach((image) => image.style.removeProperty('translate'));
        return;
      }
      const height = window.innerHeight;
      for (const image of images) {
        const rect = image.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > height || !rect.height) continue;
        const progress = Math.max(-1, Math.min(1, ((rect.top + rect.height / 2) - height / 2) / (height / 2 + rect.height / 2)));
        image.style.translate = `0 ${(-progress * 1.5).toFixed(2)}%`;
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const refresh = () => { images = [...document.querySelectorAll(selector)]; schedule(); };
    const observer = new MutationObserver(refresh);
    observer.observe(document.getElementById('root'), { childList: true, subtree: true });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    reducedMotion.addEventListener('change', schedule);
    refresh();
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      reducedMotion.removeEventListener('change', schedule);
      cancelAnimationFrame(frame);
      images.forEach((image) => image.style.removeProperty('translate'));
    };
  }, []);
}
