import { bandPath, bezier, hash, rim, traceRim } from './geometry.js';
import { themeFor } from '../themes.js';

export class DispatchScene {
  constructor(canvas, telemetry) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.telemetry = telemetry;
    this.palette = themeFor(telemetry.current.theme);
    this.backdrop = document.createElement('canvas');
    this.atlas = document.createElement('canvas');
    this.particles = [];
    this.phase = 0;
    this.energy = 0;
    this.ambientSequence = 0;
    this.ambientBudget = 0;
    this.motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.lastTime = performance.now();
    this.frames = 0;
    this.fpsTime = this.lastTime;
    this.atlasTime = 0;
    this.resize = this.resize.bind(this);
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(canvas);
    this.visibility = () => {
      clearTimeout(this.timer); cancelAnimationFrame(this.animationFrame);
      if (!document.hidden) this.tick();
    };
    document.addEventListener('visibilitychange', this.visibility);
    this.resize();
    this.tick();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    this.quality = this.telemetry.current.quality;
    // Native HiDPI text, with a 4K pixel budget to bound GPU memory on larger displays.
    const scaleLimit = this.quality === 'high' ? Math.sqrt(3840 * 2160 / (this.width * this.height)) : 1.25;
    this.dpr = Math.min(window.devicePixelRatio || 1, scaleLimit);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.backdrop.width = this.canvas.width;
    this.backdrop.height = this.canvas.height;
    this.paintBackdrop();
    this.paintAtlas();
  }

  sourceY(index, total = 13) {
    return 252 + index * Math.max(23, Math.min(41, (this.height - 266) / Math.max(1, total)));
  }

  paintBackdrop() {
    const ctx = this.backdrop.getContext('2d');
    const w = this.width, h = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = this.palette.background; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = `rgba(${this.palette.trace},.035)`; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    bandPath(ctx, w, h); ctx.fillStyle = this.palette.band; ctx.fill();
    for (const outer of [false, true]) {
      for (const [offset, alpha, line] of [[-7,.08,3],[-3,.35,1],[0,.75,1.2],[3,.22,1],[7,.12,2]]) {
        ctx.strokeStyle = `rgba(${this.palette.accent},${alpha})`; ctx.lineWidth = line;
        traceRim(ctx, w, h, outer, offset);
      }
      for (let y = 0; y < h; y += 6) {
        const x = rim(y, w, h, outer);
        ctx.fillStyle = `rgba(${this.palette.accent},${y % 30 === 0 ? .6 : .25})`;
        ctx.fillRect(x + (outer ? -7 : 3), y, y % 30 === 0 ? 5 : 3, 1);
      }
    }
    this.paintConnections(ctx);
    this.paintPorts(ctx);
  }

  paintConnections(ctx) {
    const { data, provider } = this.telemetry.current;
    const sessions = (data?.sessions || []).filter(session => provider === 'all' || session.provider === provider);
    const w = this.width, h = this.height;
    for (let i = 0; i < Math.min(sessions.length, 14); i++) {
      const y = this.sourceY(i, 14);
      const seed = hash(sessions[i].id);
      for (let j = 0; j < 3; j++) {
        const targetY = h * [.19,.51,.84][j];
        const x = rim(targetY, w, h);
        ctx.beginPath(); ctx.moveTo(178, y);
        ctx.bezierCurveTo(w * (.23 + seed * .07), y, x - 95, targetY + (seed - .5) * 60, x, targetY);
        ctx.strokeStyle = `rgba(${j === i % 3 ? this.palette.accent : this.palette.ink},${j === i % 3 ? .3 : .12})`;
        ctx.lineWidth = .65; ctx.stroke();
      }
    }
    // Static topology; actual traffic and explicitly enabled display particles are separate.
    for (let i = 0; i < Math.min(sessions.length * 3, 100); i++) {
      const seed = hash(`${i}-lane`);
      const y = seed * h;
      ctx.beginPath(); ctx.moveTo(rim(y, w, h, true), y);
      ctx.lineTo(w + 50, y + (y - h / 2) * .45);
      ctx.strokeStyle = `rgba(${this.palette.ink},.045)`; ctx.lineWidth = .6; ctx.stroke();
    }
  }

  paintPorts(ctx) {
    const w = this.width, h = this.height;
    ['01 / PROMPT INGRESS', '02 / TOOL DISPATCH', '03 / RESPONSE EGRESS'].forEach((label, i) => {
      const y = h * [.19,.51,.84][i], x = rim(y, w, h);
      ctx.strokeStyle = `rgba(${this.palette.accent},.55)`;
      for (const r of [4, 8, 12]) { ctx.beginPath(); ctx.ellipse(x - 2, y, r * .5, r, -.1, 0, Math.PI * 2); ctx.stroke(); }
      if (w < 720) return;
      ctx.fillStyle = this.palette.surface; ctx.fillRect(x - 159, y - 20, 147, 15);
      ctx.strokeStyle = `rgba(${this.palette.accent},.3)`; ctx.strokeRect(x - 159, y - 20, 147, 15);
      ctx.fillStyle = `rgba(${this.palette.ink},.8)`; ctx.font = '8px "IBM Plex Mono", monospace';
      ctx.fillText(label, x - 153, y - 10);
    });
  }

  paintAtlas() {
    const { events: allEvents, replayEvents, replayStatus, immersive, provider } = this.telemetry.current;
    const source = immersive && replayEvents?.length ? replayEvents : allEvents;
    const events = source.filter(event => provider === 'all' || event.provider === provider).slice(-100);
    // Advance through cached history on each full revolution, without additional log reads.
    const ordered = events.slice().reverse();
    const start = immersive && ordered.length ? Math.floor(this.phase / 1800) * 12 % ordered.length : 0;
    const page = [...ordered.slice(start), ...ordered.slice(0, start)];
    const width = Math.max(100, this.width * .235 - 26);
    this.atlas.width = Math.ceil(width * this.dpr);
    this.atlas.height = Math.ceil(1800 * this.dpr);
    const ctx = this.atlas.getContext('2d');
    ctx.scale(this.dpr, this.dpr);
    ctx.font = '9px "IBM Plex Mono", monospace';
    if (!events.length) {
      ctx.fillStyle = `rgba(${this.palette.accent},.65)`;
      const label = !immersive ? 'AWAITING LOCAL TELEMETRY' : replayStatus === 'loading' ? 'LOADING LOCAL HISTORY' : replayStatus === 'error' ? 'HISTORY UNAVAILABLE' : 'NO LOCAL HISTORY';
      ctx.fillText(label, 12, 100);
      return;
    }
    let y = 12;
    const columns = Math.max(12, Math.floor(width * .54 / 5.4));
    for (const event of page) {
      if (y > 1780) break;
      ctx.fillStyle = `rgba(${this.palette.accent},.9)`;
      ctx.fillText(`${immersive ? 'REPLAY / ' : ''}${event.provider.toUpperCase()} / ${event.kind.toUpperCase()}`, 5, y);
      y += 16;
      const startY = y;
      ctx.save(); ctx.beginPath(); ctx.rect(0, startY - 11, width * .56, 160); ctx.clip();
      ctx.fillStyle = `rgba(${this.palette.ink},.9)`;
      const lines = event.preview.replace(/\t/g, '  ').split('\n').slice(0, 5);
      for (const line of lines) {
        for (let offset = 0; offset < Math.min(line.length || 1, columns * 2); offset += columns) {
          ctx.fillText(line.slice(offset, offset + columns), 5, y);
          y += 12;
        }
      }
      ctx.restore();
      this.paintByteMatrix(ctx, event, width, startY);
      y = Math.max(y, startY + 84) + 15;
    }
  }

  paintByteMatrix(ctx, event, width, y) {
    // Byte cells encode the actual event preview; they are not invented telemetry.
    const columns = width > 300 ? 8 : 5;
    const bytes = new TextEncoder().encode(event.preview).slice(0, columns * 8);
    const cell = width * .39 / columns;
    ctx.fillStyle = `rgba(${this.palette.accent},.6)`;
    ctx.font = '7px "IBM Plex Mono", monospace';
    ctx.fillText('UTF-8 / HEX', width * .6, y - 14);
    ctx.font = '8px "IBM Plex Mono", monospace';
    ctx.fillStyle = `rgba(${this.palette.ink},.92)`;
    for (let i = 0; i < bytes.length; i++) {
      const x = width * .6 + (i % columns) * cell;
      ctx.fillText(bytes[i].toString(16).padStart(2, '0').toUpperCase(), x, y + Math.floor(i / columns) * 10);
    }
    ctx.font = '9px "IBM Plex Mono", monospace';
  }

  spawn(events) {
    const { data, provider } = this.telemetry.current;
    const sessions = (data?.sessions || []).filter(session => provider === 'all' || session.provider === provider);
    for (const event of events) {
      if (provider !== 'all' && event.provider !== provider) continue;
      const index = Math.max(0, sessions.findIndex(session => session.id === event.sessionId)) % 14;
      const count = Math.min(120, Math.max(6, Math.ceil(Math.sqrt(event.bytes / 2))));
      const port = event.kind === 'input' ? 0 : event.kind.startsWith('tool') ? 1 : 2;
      for (let j = 0; j < count; j++) {
        const seed = hash(event.id + j);
        this.particles.push({ t: -hash(`${event.id}:delay:${j}`) * .6,
          speed: .14 + hash(`${event.id}:speed:${j}`) * .18, index, port, seed,
          color: event.provider === 'codex' ? this.palette.accent : this.palette.ink, width: j % 9 === 0 ? 1.5 : .65 });
      }
    }
    if (this.particles.length > 760) this.particles.splice(0, this.particles.length - 760);
  }

  updateImmersive(state, dt, reduced) {
    if (!state.immersive) {
      if (this.wasImmersive) this.particles = this.particles.filter(particle => !particle.ambient);
      this.wasImmersive = false;
      this.ambientBudget = 0;
      return;
    }
    if (state.paused || reduced) return;
    const prime = !this.wasImmersive;
    this.wasImmersive = true;
    this.ambientBudget += prime ? 220 : dt * (state.eco ? 72 : 112);
    const count = Math.min(Math.floor(this.ambientBudget), 760 - this.particles.length);
    this.ambientBudget -= Math.floor(this.ambientBudget);
    for (let i = 0; i < count; i++) {
      const id = `display:${this.ambientSequence++}`;
      const seed = hash(id);
      // Decorative particles never enter telemetry queues, event logs or counters.
      this.particles.push({ ambient: true, t: prime ? hash(id + ':phase') : 0,
        speed: .14 + hash(id + ':speed') * .18, index: Math.floor(hash(id + ':lane') * 14),
        port: Math.floor(hash(id + ':port') * 3), seed, color: seed > .25 ? this.palette.accent : this.palette.ink,
        width: seed > .9 ? 1.5 : .65 });
    }
  }

  paintBand(ctx) {
    const w = this.width, h = this.height;
    ctx.save(); bandPath(ctx, w, h); ctx.clip();
    const offset = Math.round((this.phase % 1800) * this.dpr) / this.dpr;
    // Sheared strips follow the curve continuously, avoiding sliced glyphs with fewer draw calls.
    for (let y = 0; y < h; y += 16) {
      const height = Math.min(16, h - y);
      const sourceY = (y + offset) % 1800;
      const strip = Math.min(height, 1800 - sourceY);
      const x = rim(y, w, h) + 13;
      const shear = (rim(y + height, w, h) + 13 - x) / height;
      ctx.setTransform(this.dpr, 0, shear * this.dpr, this.dpr, x * this.dpr, y * this.dpr);
      ctx.drawImage(this.atlas, 0, sourceY * this.dpr, this.atlas.width, strip * this.dpr,
        0, 0, this.atlas.width / this.dpr, strip);
      if (strip < height) ctx.drawImage(this.atlas, 0, 0, this.atlas.width, (height - strip) * this.dpr,
        0, strip, this.atlas.width / this.dpr, height - strip);
    }
    ctx.restore();
  }

  point(particle, t) {
    const w = this.width, h = this.height;
    const portY = h * [.19, .51, .84][particle.port];
    if (t < .48) {
      const u = Math.max(0, t / .48), y = this.sourceY(particle.index, 14);
      const end = rim(portY, w, h);
      return [bezier(178, w * .32, end - 100, end, u),
        bezier(y, y + (particle.seed - .5) * h * .5, portY + (particle.seed - .5) * 180, portY, u)];
    }
    const u = (t - .48) / .52;
    const y = (particle.seed * .84 + .08) * h;
    const x = rim(y, w, h, true);
    return [x + u * (w + 180 - x), y + u * (y - h / 2) * .55];
  }

  paintParticles(ctx, dt) {
    const alive = [];
    for (const particle of this.particles) {
      particle.t += dt * particle.speed;
      if (particle.t > 1) continue;
      alive.push(particle);
      if (particle.t < 0) continue;
      const head = this.point(particle, particle.t);
      const tail = this.point(particle, Math.max(particle.t < .48 ? 0 : .48, particle.t - (particle.t > .48 ? .12 : .025)));
      const opacity = Math.min(1, (1 - particle.t) * 4) * .8;
      ctx.beginPath(); ctx.moveTo(...tail); ctx.lineTo(...head);
      ctx.strokeStyle = `rgba(${particle.color},${opacity})`; ctx.lineWidth = particle.width; ctx.stroke();
      if (particle.width > 1) { ctx.fillStyle = `rgba(${this.palette.accent},.9)`; ctx.fillRect(head[0] - 1, head[1] - 1, 2, 2); }
    }
    this.particles = alive;
  }

  tick() {
    if (this.stopped || document.hidden) return;
    const now = performance.now();
    const dt = Math.min(.2, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const state = this.telemetry.current;
    if (this.palette.id !== themeFor(state.theme).id) {
      const previous = this.palette;
      this.palette = themeFor(state.theme);
      this.particles.forEach(particle => { particle.color = particle.color === previous.accent ? this.palette.accent : this.palette.ink; });
      this.paintAtlas(); this.paintBackdrop();
    }
    if (this.quality !== state.quality) this.resize();
    if (this.lastProvider !== state.provider) {
      this.lastProvider = state.provider;
      this.particles = [];
      this.paintAtlas(); this.paintBackdrop();
    }
    const arrival = state.queue.splice(0);
    if (!state.paused) this.spawn(arrival);
    const reduced = this.motionPreference.matches;
    this.updateImmersive(state, dt, reduced);
    const rate = state.provider === 'all' ? state.data?.rate : state.data?.providerRates?.[state.provider];
    const target = Math.max(state.immersive ? .7 : 0, Math.min(1, (rate || 0) / 8));
    this.energy += (target - this.energy) * (1 - Math.exp(-dt / (target > this.energy ? .7 : 4)));
    if (!state.paused && !reduced) this.phase += dt * (1.8 + this.energy * 32);
    const atlasKey = `${state.immersive}:${state.replayRevision}:${state.immersive ? Math.floor(this.phase / 1800) : state.events.at(-1)?.id}`;
    if (this.lastEvent !== atlasKey && (!this.lastEvent || state.replayRevision !== this.replayRevision || now - this.atlasTime > 2500)) {
      this.lastEvent = atlasKey; this.replayRevision = state.replayRevision; this.atlasTime = now;
      this.paintAtlas(); this.paintBackdrop();
    }
    const started = performance.now();
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.backdrop, 0, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.paintBand(ctx);
    this.paintParticles(ctx, state.paused || reduced ? 0 : dt);
    state.frameMs = performance.now() - started;
    this.frames++;
    if (now - this.fpsTime >= 1000) { state.fps = Math.round(this.frames * 1000 / (now - this.fpsTime)); this.frames = 0; this.fpsTime = now; }
    const active = this.energy > .08 || this.particles.length;
    const fps = state.paused || reduced ? 2 : state.eco ? (active ? 15 : 6) : active ? (state.quality === 'high' ? 60 : 30) : 10;
    this.schedule(fps, started);
  }

  schedule(fps, started) {
    if (fps < 60) {
      this.nextFrameAt = null;
      this.timer = setTimeout(() => this.tick(), Math.max(0, 1000 / fps - (performance.now() - started)));
      return;
    }
    const next = timestamp => {
      if (this.stopped || document.hidden) return;
      // Keep a fixed cadence across refresh rates; delivery jitter must not reset the deadline.
      if (this.nextFrameAt != null && timestamp + .5 < this.nextFrameAt) {
        this.animationFrame = requestAnimationFrame(next);
      } else {
        this.nextFrameAt = Math.max(this.nextFrameAt ?? timestamp, timestamp - 1000 / 60) + 1000 / 60;
        this.tick();
      }
    };
    this.animationFrame = requestAnimationFrame(next);
  }

  destroy() {
    this.stopped = true; clearTimeout(this.timer); cancelAnimationFrame(this.animationFrame); this.observer.disconnect();
    document.removeEventListener('visibilitychange', this.visibility);
  }
}
