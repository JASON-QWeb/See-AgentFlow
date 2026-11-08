import { program, ringVertex, ringFragment, lineVertex, lineFragment, packetVertex } from './mobiusShaders.js';
import { packetMesh, routeMesh, ringMesh } from './mobiusGeometry.js';
import { themeFor, rgb, hexRGB } from '../themes.js';
import { innerMeshes, innerVertex, INNER_PACKETS, OUTER_PACKETS } from './innerFlow.js';
import { translate } from '../i18n/catalog.js';
import { HIDDEN_RELEASE_DELAY } from '../eventRetention.js';
import { immersiveMotion } from '../scene/immersiveMotion.js';

export class MobiusRenderer {
  constructor(canvas, telemetry, layout) {
    this.canvas = canvas; this.telemetry = telemetry; this.layout = layout;
    this.usePalette(themeFor(telemetry.current.theme));
    this.locations = new WeakMap();
    this.gl = canvas.getContext('webgl2', { alpha: false, antialias: true, powerPreference: 'low-power' });
    if (!this.gl) throw new Error('The dual-display ribbon requires WebGL 2');
    this.textCanvas = document.createElement('canvas');
    this.textCanvas.width = 3072; this.textCanvas.height = 384;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    this.frameCount = 0; this.sampleAt = performance.now(); this.atlasAt = 0;
    this.onVisibility = () => {
      cancelAnimationFrame(this.raf); clearTimeout(this.releaseTimer);
      this.nextFrame = null; this.sampleAt = performance.now(); this.frameCount = 0;
      if (document.hidden) this.releaseTimer = setTimeout(() => this.releaseResources(), HIDDEN_RELEASE_DELAY);
      else {
        if (this.released && !this.gl.isContextLost()) this.initialize();
        this.animate();
      }
    };
    this.onLost = event => { event.preventDefault(); cancelAnimationFrame(this.raf); this.released = true; };
    this.onRestored = () => { if (!this.destroyed && !document.hidden) { this.initialize(); this.animate(); } };
    document.addEventListener('visibilitychange', this.onVisibility);
    canvas.addEventListener('webglcontextlost', this.onLost);
    canvas.addEventListener('webglcontextrestored', this.onRestored);
    this.initialize(); this.onVisibility();
    document.fonts.ready.then(() => { if (!this.destroyed) { this.atlasAt = 0; this.atlasRevision = null; } });
  }

  initialize() {
    this.released = false; this.atlasAt = 0; this.atlasRevision = null;
    this.textCanvas.width = 3072; this.textCanvas.height = 384;
    const gl = this.gl, { width, height, y, sceneHeight } = this.layout;
    const visibleHeight = Math.max(1, Math.min(height, sceneHeight - y));
    const scale = Math.min(devicePixelRatio || 1, Math.sqrt(8294400 / (width * visibleHeight)));
    this.canvas.width = Math.round(width * scale); this.canvas.height = Math.round(visibleHeight * scale);
    this.view = new Float32Array([this.layout.x, y, width, visibleHeight]);
    this.ring = program(gl, ringVertex, ringFragment); this.line = program(gl, lineVertex, lineFragment);
    this.packetProgram = program(gl, packetVertex, lineFragment);
    this.innerProgram = program(gl, innerVertex, lineFragment);
    const mesh = ringMesh(); this.meshCount = mesh.length / 2;
    this.mesh = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.mesh); gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW);
    this.packetBuffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.packetBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, packetMesh(), gl.STATIC_DRAW);
    const inner = innerMeshes(); this.innerRouteCount = inner.routes.length / 7;
    this.innerRoutes = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.innerRoutes);
    gl.bufferData(gl.ARRAY_BUFFER, inner.routes, gl.STATIC_DRAW);
    this.innerPackets = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.innerPackets);
    gl.bufferData(gl.ARRAY_BUFFER, inner.packets, gl.STATIC_DRAW);
    this.texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.clearColor(...hexRGB(this.palette.background), 1); gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.buildRoutes(); this.updateAtlas(Date.now());
  }

  buildRoutes() {
    const vertices = routeMesh(this.layout.worldWidth, this.layout.sceneHeight, this.palette);
    this.routeCount = vertices.length / 6;
    if (this.routes) this.gl.deleteBuffer(this.routes);
    this.routes = this.gl.createBuffer(); this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.routes);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
  }

  updateTheme() {
    const palette = themeFor(this.telemetry.current.theme);
    if (palette.id === this.palette.id) return;
    this.usePalette(palette); this.atlasRevision = null; this.atlasAt = 0;
    this.gl.clearColor(...hexRGB(palette.background), 1); this.buildRoutes();
  }

  usePalette(palette) {
    this.palette = palette;
    this.accent = new Float32Array(rgb(palette.accent)); this.ink = new Float32Array(rgb(palette.ink));
  }

  // Locations stay valid for the life of a linked program; looking them up each frame only makes garbage.
  uniform(program, name) {
    let table = this.locations.get(program);
    if (!table) this.locations.set(program, table = {});
    return table[name] ??= this.gl.getUniformLocation(program, name);
  }

  attribute(program, name) {
    let table = this.locations.get(program);
    if (!table) this.locations.set(program, table = {});
    return table[name] ??= this.gl.getAttribLocation(program, name);
  }

  setPalette(program) {
    const gl = this.gl;
    gl.uniform3fv(this.uniform(program, 'u_accent'), this.accent);
    gl.uniform3fv(this.uniform(program, 'u_ink'), this.ink);
  }

  updateAtlas(now) {
    const state = this.telemetry.current;
    const events = state.immersive ? state.replayEvents || [] : state.events || [];
    const revision = `${state.language}:${state.replayRevision}:${events.length}:${Math.floor(now / 12000)}`;
    if (revision === this.atlasRevision) return;
    const page = Math.floor(now / 12000);
    if (this.atlasAt && now - this.atlasAt < 2500 && page === this.atlasPage) return;
    this.atlasAt = now; this.atlasPage = page;
    this.atlasRevision = revision;
    const c = this.textCanvas.getContext('2d');
    c.fillStyle = this.palette.surface; c.fillRect(0, 0, 3072, 384);
    c.font = '500 17px "IBM Plex Mono", monospace'; c.textBaseline = 'top';
    for (let column = 0; column < 6; column++) for (let block = 0; block < 4; block++) {
      const event = events[(page * 17 + column * 4 + block) % events.length];
      const content = (event?.preview || event?.text || translate(state.language, 'WAITING FOR LOCAL LOGS')).replace(/\s+/g, ' ');
      const hex = Array.from(new TextEncoder().encode(content.slice(0, 80)), byte => byte.toString(16).padStart(2, '0')).join(' ');
      for (let row = 0; row < 5; row++) {
        c.fillStyle = row === 0 ? `rgb(${this.palette.accent})` : row % 3 ? `rgb(${this.palette.ink})` : this.palette.muted;
        const text = row === 0 ? `${event?.provider?.toUpperCase() || 'LOCAL'} / ${event?.kind || 'REPLAY'}` :
          column % 3 === 2 ? hex.slice((row - 1) * 44, row * 44) : content.slice((row - 1) * 44, row * 44);
        c.fillText(text, column * 512 + 10, block * 96 + row * 17 + 9, 484);
      }
    }
    const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.textCanvas);
  }

  drawLines(buffer, count) {
    const gl = this.gl; gl.useProgram(this.line); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.uniform4fv(this.uniform(this.line, 'u_view'), this.view);
    for (const [name, size, offset] of [['a_position', 2, 0], ['a_color', 4, 8]]) {
      const location = this.attribute(this.line, name);
      gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, size, gl.FLOAT, false, 24, offset);
    }
    gl.drawArrays(gl.TRIANGLES, 0, count);
  }

  drawPackets(now, intensity) {
    const state = this.telemetry.current;
    const count = state.immersive ? OUTER_PACKETS : Math.floor(Math.min(OUTER_PACKETS, 100 + (state.data?.rate || 0) * 40));
    const gl = this.gl; gl.useProgram(this.packetProgram); gl.bindBuffer(gl.ARRAY_BUFFER, this.packetBuffer);
    gl.uniform4fv(this.uniform(this.packetProgram, 'u_view'), this.view);
    gl.uniform2f(this.uniform(this.packetProgram, 'u_world'), this.layout.worldWidth, this.layout.sceneHeight);
    gl.uniform1f(this.uniform(this.packetProgram, 'u_phase'), (now % 120000) / 120000);
    gl.uniform1f(this.uniform(this.packetProgram, 'u_intensity'), intensity);
    for (const [name, size, offset] of [['a_packet', 4, 0], ['a_tail', 3, 16]]) {
      const location = this.attribute(this.packetProgram, name);
      gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, size, gl.FLOAT, false, 28, offset);
    }
    this.setPalette(this.packetProgram);
    gl.drawArrays(gl.TRIANGLES, 0, count * 18);
  }

  drawInner(now, packets, intensity) {
    const gl = this.gl, shader = this.innerProgram, state = this.telemetry.current;
    const count = state.immersive ? INNER_PACKETS : Math.min(INNER_PACKETS, Math.floor((state.data?.rate || 0) * 20));
    gl.useProgram(shader); gl.bindBuffer(gl.ARRAY_BUFFER, packets ? this.innerPackets : this.innerRoutes);
    gl.uniform4fv(this.uniform(shader, 'u_view'), this.view);
    gl.uniform2f(this.uniform(shader, 'u_world'), this.layout.worldWidth, this.layout.sceneHeight);
    gl.uniform1f(this.uniform(shader, 'u_phase'), (now % 120000) / 120000);
    gl.uniform1f(this.uniform(shader, 'u_packets'), Number(packets));
    gl.uniform1f(this.uniform(shader, 'u_intensity'), intensity);
    for (const [name, size, offset] of [['a_path', 4, 0], ['a_sample', 3, 16]]) {
      const location = this.attribute(shader, name);
      gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, size, gl.FLOAT, false, 28, offset);
    }
    this.setPalette(shader);
    gl.drawArrays(gl.TRIANGLES, 0, packets ? count * 24 : this.innerRouteCount);
  }

  draw(now, intensity) {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.disable(gl.DEPTH_TEST);
    this.drawLines(this.routes, this.routeCount); this.drawPackets(now, intensity);
    this.drawInner(now, false, intensity); this.drawInner(now, true, intensity);
    gl.enable(gl.DEPTH_TEST); gl.useProgram(this.ring); gl.bindBuffer(gl.ARRAY_BUFFER, this.mesh);
    const uv = this.attribute(this.ring, 'a_uv');
    gl.enableVertexAttribArray(uv); gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 0, 0);
    gl.uniform4fv(this.uniform(this.ring, 'u_view'), this.view);
    gl.uniform2f(this.uniform(this.ring, 'u_world'), this.layout.worldWidth, this.layout.sceneHeight);
    gl.uniform1f(this.uniform(this.ring, 'u_phase'), (now % 120000) / 120000);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.uniform(this.ring, 'u_text'), 0);
    this.setPalette(this.ring);
    gl.drawArrays(gl.TRIANGLES, 0, this.meshCount);
  }

  animate = timestamp => {
    if (this.destroyed || document.hidden || this.gl.isContextLost()) return;
    this.raf = requestAnimationFrame(this.animate);
    if (timestamp == null) return;
    const state = this.telemetry.current;
    const interval = 1000 / (state.paused || this.reduced.matches ? 1 : state.eco ? 15 : state.quality === 'standard' ? 30 : 60);
    if (this.nextFrame != null && timestamp + .5 < this.nextFrame) return;
    this.nextFrame = Math.max(this.nextFrame ?? timestamp, timestamp - interval) + interval;
    const started = performance.now(), now = Date.now();
    state.queue.length = 0;
    if (this.visualTime == null || (!state.paused && !this.reduced.matches)) this.visualTime = now;
    const motion = state.immersive ? immersiveMotion(this.visualTime) : { time: this.visualTime, speed: 1 };
    const intensity = state.immersive ? Math.min(1, .42 + .4 * motion.speed) : 1;
    this.updateTheme(); this.updateAtlas(motion.time); this.draw(motion.time, intensity);
    state.frameMs = performance.now() - started;
    this.frameCount++;
    if (timestamp - this.sampleAt > 1000) {
      state.fps = Math.round(this.frameCount * 1000 / (timestamp - this.sampleAt));
      this.sampleAt = timestamp; this.frameCount = 0;
    }
  };

  releaseResources() {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, null); gl.bindTexture(gl.TEXTURE_2D, null); gl.useProgram(null);
    for (const name of ['mesh', 'packetBuffer', 'routes', 'innerRoutes', 'innerPackets']) {
      gl.deleteBuffer(this[name]); this[name] = null;
    }
    for (const name of ['ring', 'line', 'packetProgram', 'innerProgram']) {
      gl.deleteProgram(this[name]); this[name] = null;
    }
    gl.deleteTexture(this.texture); this.texture = null;
    this.canvas.width = 1; this.canvas.height = 1;
    this.textCanvas.width = 1; this.textCanvas.height = 1; this.released = true;
    gl.flush();
  }

  destroy() {
    this.destroyed = true; cancelAnimationFrame(this.raf); clearTimeout(this.releaseTimer);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    this.releaseResources();
  }
}
