(() => {
  'use strict';

  const root = document.documentElement;
  const THEME_KEY = 'anka-theme-v1';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let lampOn = true;
  let animationFrame = 0;
  let previousFrame = 0;
  let roomVisible = true;
  const rooms = [];

  function readTheme() {
    const previewTheme = new URLSearchParams(window.location.search).get('theme');
    if (previewTheme === 'night' || previewTheme === 'day') return previewTheme;
    try {
      const value = localStorage.getItem(THEME_KEY);
      return value === 'night' || value === 'day' ? value : 'day';
    } catch {
      return 'day';
    }
  }

  function applyTheme(theme, persist = false) {
    const night = theme === 'night';
    root.dataset.theme = night ? 'night' : 'day';
    root.style.colorScheme = night ? 'dark' : 'light';
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(night));
      toggle.setAttribute('aria-label', night ? 'Включить дневной режим' : 'Включить ночной режим');
      const label = toggle.querySelector('.theme-label');
      if (label) label.textContent = night ? 'Ночь' : 'День';
    }
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = night ? '#111310' : '#f5f5f3';
    const roomTime = document.getElementById('room-time');
    if (roomTime) roomTime.textContent = night ? 'тихий вечер' : 'дневной свет';
    if (persist) {
      try { localStorage.setItem(THEME_KEY, night ? 'night' : 'day'); } catch { /* Theme still works without storage. */ }
    }
    rooms.forEach(room => drawRoom(room, performance.now()));
  }

  function rect(ctx, color, x, y, width, height) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
  }

  function line(ctx, color, x1, y1, x2, y2, width = 1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(Math.round(x1) + .5, Math.round(y1) + .5);
    ctx.lineTo(Math.round(x2) + .5, Math.round(y2) + .5);
    ctx.stroke();
  }

  function drawRoom(room, now) {
    const { ctx, canvas } = room;
    const night = root.dataset.theme === 'night';
    const t = reducedMotion.matches ? 0 : now / 1000;
    const flicker = lampOn ? .97 + Math.sin(t * 1.35) * .018 + Math.sin(t * 2.7) * .008 : 0;
    const p = night ? {
      wall: '#2c2b26', wallTop: '#242520', floor: '#40362c', floorLine: '#332c25', trim: '#595044',
      sky: '#172733', skyLight: '#243846', frame: '#6b5c49', curtain: '#777064', sofa: '#756e60',
      sofaDark: '#5e594e', cushion: '#a07a5b', cushion2: '#8b927a', wood: '#80634a', woodDark: '#574536',
      rug: '#615448', rugLine: '#8a715b', leaf: '#586b4d', leafLight: '#718361', pot: '#9a7051'
    } : {
      wall: '#ded8ca', wallTop: '#e8e3d8', floor: '#b7a086', floorLine: '#a48d74', trim: '#b4a68f',
      sky: '#acc8cd', skyLight: '#d6e2de', frame: '#f2eee4', curtain: '#c6bdae', sofa: '#b4ab98',
      sofaDark: '#968d7b', cushion: '#b77f5d', cushion2: '#87937a', wood: '#967553', woodDark: '#73573f',
      rug: '#c4ae91', rugLine: '#a58e70', leaf: '#6c8058', leafLight: '#879a70', pot: '#ad7956'
    };

    ctx.imageSmoothingEnabled = false;
    rect(ctx, p.wallTop, 0, 0, 192, 93);
    rect(ctx, p.wall, 0, 0, 192, 88);
    // Quiet wall panelling and tiny shadows keep the scene tactile at low resolution.
    for (let x = 0; x < 192; x += 24) rect(ctx, night ? '#2e2e28' : '#e2dccf', x, 0, 1, 88);
    rect(ctx, p.trim, 0, 86, 192, 3);
    rect(ctx, p.floor, 0, 89, 192, 55);
    for (let y = 99; y < 144; y += 12) line(ctx, p.floorLine, 0, y, 192, y);
    line(ctx, p.floorLine, 39, 89, 27, 144);
    line(ctx, p.floorLine, 118, 89, 132, 144);

    // Window and the view outside.
    rect(ctx, night ? '#171b19' : '#aaa392', 16, 15, 72, 65);
    rect(ctx, p.frame, 18, 17, 68, 61);
    rect(ctx, p.sky, 22, 21, 60, 53);
    rect(ctx, p.skyLight, 22, 21, 60, night ? 7 : 19);
    if (night) {
      [[29,27],[43,33],[67,25],[75,38],[53,22]].forEach(([x,y], index) => rect(ctx, index % 2 ? '#b9c6c5' : '#e0d4b2', x, y, 1, 1));
      rect(ctx, '#c5bda4', 70, 27, 4, 4);
      rect(ctx, p.sky, 69, 26, 3, 3);
      rect(ctx, '#1b2a2c', 22, 57, 60, 17);
      rect(ctx, '#26383a', 26, 49, 12, 25);
      rect(ctx, '#203033', 46, 54, 17, 20);
      rect(ctx, '#2c3d3c', 67, 46, 10, 28);
      [[29,54],[33,59],[50,59],[56,64],[70,51],[73,58]].forEach(([x,y]) => rect(ctx, '#c39e61', x, y, 2, 2));
    } else {
      rect(ctx, '#edf0e8', 29, 28, 20, 4);
      rect(ctx, '#edf0e8', 34, 25, 11, 3);
      rect(ctx, '#c3d6d4', 63, 35, 15, 3);
      rect(ctx, '#9caf8d', 22, 58, 60, 16);
      rect(ctx, '#7e987b', 22, 65, 60, 9);
      rect(ctx, '#667f65', 29, 51, 3, 15);
      rect(ctx, '#789071', 24, 48, 13, 9);
      rect(ctx, '#789071', 28, 44, 7, 7);
      rect(ctx, '#738b6e', 69, 55, 3, 12);
      rect(ctx, '#89a07e', 64, 51, 13, 9);
    }
    // Rain is clipped to the window area.
    ctx.save();
    ctx.beginPath();
    ctx.rect(22, 21, 60, 53);
    ctx.clip();
    const rainColor = night ? 'rgba(160,190,202,.42)' : 'rgba(103,139,151,.25)';
    for (let i = 0; i < 14; i++) {
      const x = 20 + ((i * 17 + 9) % 65);
      const speed = 9 + (i % 4) * 3;
      const y = 18 + ((i * 11 + t * speed) % 61);
      line(ctx, rainColor, x, y, x - 2, y + 5);
    }
    ctx.restore();
    rect(ctx, p.frame, 50, 20, 3, 55);
    rect(ctx, p.frame, 21, 46, 62, 3);
    rect(ctx, night ? '#4c453b' : '#d4ccbd', 14, 78, 76, 4);
    // Softly stepped curtains.
    rect(ctx, p.curtain, 10, 12, 8, 68);
    rect(ctx, p.curtain, 12, 12, 2, 68);
    rect(ctx, night ? '#696359' : '#b8ae9e', 15, 12, 2, 68);
    rect(ctx, p.curtain, 86, 12, 7, 68);
    rect(ctx, night ? '#696359' : '#b8ae9e', 87, 12, 2, 68);
    rect(ctx, p.woodDark, 8, 10, 87, 2);

    // A framed miniature highway landscape.
    rect(ctx, p.woodDark, 105, 20, 30, 34);
    rect(ctx, night ? '#aaa087' : '#f0e9da', 107, 22, 26, 30);
    rect(ctx, night ? '#56676a' : '#b7c9c4', 110, 25, 20, 12);
    rect(ctx, night ? '#7c8064' : '#99a47d', 110, 36, 20, 6);
    rect(ctx, night ? '#68675d' : '#b4ad99', 110, 42, 20, 7);
    rect(ctx, night ? '#c5b999' : '#e9dfc8', 119, 42, 2, 7);
    rect(ctx, '#52646a', 113, 38, 9, 3);
    rect(ctx, '#52646a', 115, 36, 5, 2);
    rect(ctx, '#313b3c', 114, 41, 2, 2);
    rect(ctx, '#313b3c', 120, 41, 2, 2);

    // Lamp light sits behind the furniture and spills across the floor.
    if (lampOn) {
      const glow = ctx.createRadialGradient(155, 54, 3, 151, 70, 68);
      glow.addColorStop(0, `rgba(255,218,145,${.46 * flicker})`);
      glow.addColorStop(.38, `rgba(246,188,103,${.23 * flicker})`);
      glow.addColorStop(1, 'rgba(238,164,73,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(82, 0, 110, 139);
      for (let i = 0; i < 6; i++) {
        rect(ctx, `rgba(255,213,135,${(.035 - i * .004) * flicker})`, 143 - i * 4, 118 + i * 3, 31 + i * 8, 2);
      }
    }

    // Sofa with deliberately blocky cushions.
    rect(ctx, night ? '#39372f' : '#958b78', 48, 112, 89, 5);
    rect(ctx, p.sofaDark, 51, 84, 82, 32);
    rect(ctx, p.sofa, 55, 80, 74, 28);
    rect(ctx, p.sofa, 50, 91, 10, 25);
    rect(ctx, p.sofa, 126, 91, 10, 25);
    rect(ctx, p.sofaDark, 58, 105, 68, 11);
    rect(ctx, p.sofa, 59, 101, 32, 12);
    rect(ctx, p.sofa, 94, 101, 31, 12);
    line(ctx, p.sofaDark, 92, 84, 92, 100);
    rect(ctx, p.woodDark, 55, 115, 4, 5);
    rect(ctx, p.woodDark, 127, 115, 4, 5);
    // Cushions.
    rect(ctx, p.cushion, 62, 88, 17, 15);
    rect(ctx, night ? '#b08969' : '#ca9977', 64, 89, 13, 2);
    rect(ctx, p.cushion2, 105, 87, 16, 16);
    rect(ctx, night ? '#9aa187' : '#a8b09a', 107, 89, 12, 2);

    // Rug and low coffee table.
    rect(ctx, p.rug, 42, 122, 102, 19);
    rect(ctx, p.rugLine, 45, 124, 96, 2);
    rect(ctx, p.rugLine, 45, 137, 96, 2);
    for (let x = 48; x < 140; x += 8) rect(ctx, p.rugLine, x, 128, 3, 1);
    rect(ctx, p.woodDark, 76, 115, 4, 16);
    rect(ctx, p.woodDark, 113, 115, 4, 16);
    rect(ctx, p.wood, 70, 112, 52, 7);
    rect(ctx, night ? '#9a7856' : '#b18d64', 73, 112, 46, 2);
    // Book and steaming cup.
    rect(ctx, night ? '#787d67' : '#7c8a70', 78, 109, 15, 3);
    rect(ctx, night ? '#c2b38f' : '#eee5d2', 79, 108, 13, 1);
    rect(ctx, '#d5c9ae', 103, 105, 8, 7);
    rect(ctx, '#86735d', 104, 106, 6, 4);
    rect(ctx, '#d5c9ae', 111, 107, 3, 3);
    rect(ctx, p.wood, 111, 108, 2, 1);
    if (lampOn) {
      const steamOffset = Math.round(Math.sin(t * 2) * 1);
      rect(ctx, 'rgba(240,225,195,.48)', 105 + steamOffset, 102, 1, 2);
      rect(ctx, 'rgba(240,225,195,.34)', 108 - steamOffset, 99, 1, 3);
      rect(ctx, 'rgba(240,225,195,.20)', 106 + steamOffset, 96, 1, 2);
    }

    // Plant on the left of the sofa.
    rect(ctx, p.pot, 28, 105, 17, 15);
    rect(ctx, night ? '#76543e' : '#926346', 30, 119, 13, 3);
    rect(ctx, p.woodDark, 36, 83, 2, 24);
    [[34,87,25,80],[37,91,48,81],[34,96,23,91],[38,98,51,91],[35,84,31,74],[38,86,44,75]].forEach(([x1,y1,x2,y2], index) => {
      line(ctx, index % 2 ? p.leafLight : p.leaf, x1, y1, x2, y2, 3);
      rect(ctx, index % 2 ? p.leafLight : p.leaf, x2 - 2, y2 - 2, 5, 4);
    });

    // Floor lamp: shade, glowing bulb, stem and base.
    const bulb = lampOn ? `rgba(255,231,167,${.95 * flicker})` : (night ? '#746c5a' : '#b7aa8e');
    const shade = lampOn ? (night ? '#d6ad72' : '#d2b083') : (night ? '#776b59' : '#b5a58c');
    const shadeLight = lampOn ? (night ? '#ebc58a' : '#e1c69d') : (night ? '#857663' : '#c4b499');
    rect(ctx, p.woodDark, 153, 56, 3, 58);
    rect(ctx, p.woodDark, 144, 113, 21, 3);
    rect(ctx, p.wood, 147, 111, 15, 2);
    rect(ctx, bulb, 150, 55, 9, 5);
    rect(ctx, shade, 143, 39, 23, 17);
    rect(ctx, shadeLight, 147, 36, 15, 3);
    rect(ctx, shadeLight, 141, 55, 27, 3);
    rect(ctx, night && lampOn ? '#b88d56' : '#9d896c', 143, 53, 23, 2);
    for (let x = 146; x < 165; x += 5) rect(ctx, night && lampOn ? '#c69a60' : '#b39a78', x, 40, 1, 12);

    // A few square dust motes become visible only in warm lamplight.
    if (lampOn && !reducedMotion.matches) {
      for (let i = 0; i < 5; i++) {
        const x = 132 + ((i * 13 + Math.round(t * (1 + i * .1))) % 47);
        const y = 27 + ((i * 17 + Math.round(t * 2)) % 65);
        rect(ctx, 'rgba(255,225,166,.25)', x, y, 1, 1);
      }
    }
  }

  function animate(now) {
    animationFrame = requestAnimationFrame(animate);
    if (!roomVisible || document.hidden || reducedMotion.matches || now - previousFrame < 80) return;
    previousFrame = now;
    rooms.forEach(room => drawRoom(room, now));
  }

  function syncLampControls() {
    document.querySelectorAll('[data-lamp-toggle]').forEach(button => {
      button.setAttribute('aria-pressed', String(lampOn));
      const status = button.querySelector('[data-lamp-status]');
      if (status) status.textContent = lampOn ? 'мягкий свет' : 'свет выключен';
    });
  }

  function init() {
    document.querySelectorAll('canvas.pixel-room').forEach(canvas => {
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;
      rooms.push({ canvas, ctx });
    });
    applyTheme(readTheme());
    syncLampControls();
    rooms.forEach(room => drawRoom(room, 0));

    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) themeToggle.addEventListener('click', () => applyTheme(root.dataset.theme === 'night' ? 'day' : 'night', true));
    document.querySelectorAll('[data-lamp-toggle]').forEach(button => button.addEventListener('click', () => {
      lampOn = !lampOn;
      syncLampControls();
      rooms.forEach(room => drawRoom(room, performance.now()));
    }));

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        roomVisible = entries.some(entry => entry.isIntersecting);
      }, { rootMargin: '150px' });
      rooms.forEach(room => observer.observe(room.canvas));
    }
    reducedMotion.addEventListener?.('change', () => rooms.forEach(room => drawRoom(room, 0)));
    animationFrame = requestAnimationFrame(animate);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
