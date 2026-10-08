/**
 * hero-liquid.js
 * Liquid / water-ripple distortion on the hero <h1> name.
 * WebGL1, zero dependencies, no layout shift.
 */
(() => {
  // ── Tuning knobs ─────────────────────────────────────────────────
  const CONFIG = {
    strength:    0.6,   // max displacement in em (how far the liquid pushes the type)
    radius:      0.6,   // brush size in em
    dissipation: 0.94,  // how much flow survives each frame @60fps
    advect:      0.006, // how much the liquid swirls on its own
    velocity:    4,     // how strongly mouse speed drives the flow
    chroma:      0.15,  // subtle RGB split inside the ripple (0 = off)
    hold:        0.25,  // s — keep liquid live after mouse stops
    fadeOut:     0.7    // s — then ease distortion back to original letterforms
  };
  // ─────────────────────────────────────────────────────────────────

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const title = document.querySelector('.hero__name');
  if (!title) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'liquid-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;pointer-events:none;display:block;';

  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false })
          || canvas.getContext('experimental-webgl');
  if (!gl) return;

  // ── Shaders ───────────────────────────────────────────────────────
  const VERT = `
    attribute vec2 aPos; varying vec2 vUv;
    void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FLOW_FRAG = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    varying vec2 vUv;
    uniform sampler2D uPrev; uniform vec2 uMouse; uniform vec2 uVel;
    uniform float uAspect, uRadius, uDiss, uAdvect, uActive;
    vec2 dec(vec4 c){ return c.xy * 2.0 - 1.0; }
    void main(){
      vec2 here = dec(texture2D(uPrev, vUv));
      vec2 prev = dec(texture2D(uPrev, vUv - here * uAdvect)) * uDiss;
      vec2 d = vUv - uMouse; d.y /= uAspect;
      float m = smoothstep(uRadius, 0.0, length(d)) * uActive;
      vec2 v = clamp(mix(prev, uVel, m), -1.0, 1.0);
      gl_FragColor = vec4(v * 0.5 + 0.5, 0.0, 1.0);
    }`;

  const DISP_FRAG = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    varying vec2 vUv;
    uniform sampler2D uText, uFlow;
    uniform vec2 uStrength; uniform float uAmount; uniform vec3 uColor; uniform float uChroma;
    void main(){
      vec2 f = texture2D(uFlow, vUv).xy * 2.0 - 1.0;
      f = sign(f) * max(abs(f) - 0.02, 0.0);
      vec2 o = f * uStrength * uAmount;
      float r = texture2D(uText, vUv - o * (1.0 + uChroma)).a;
      float g = texture2D(uText, vUv - o).a;
      float b = texture2D(uText, vUv - o * (1.0 - uChroma)).a;
      gl_FragColor = vec4(uColor * vec3(r, g, b), max(r, max(g, b)));
    }`;

  function mkShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function mkProgram(fs) {
    const p = gl.createProgram();
    gl.attachShader(p, mkShader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, mkShader(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(p, i).name;
      u[name] = gl.getUniformLocation(p, name);
    }
    return { p, u };
  }

  let flowProg, dispProg;
  try { flowProg = mkProgram(FLOW_FRAG); dispProg = mkProgram(DISP_FRAG); }
  catch (e) { return; }

  // Full-screen triangle
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  function mkTex(w, h, data) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (w) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return t;
  }

  // ── Layout + rasterise ────────────────────────────────────────────
  const color = (getComputedStyle(title).color.match(/[\d.]+/g) || [255, 255, 255])
    .slice(0, 3).map(v => +v / 255);

  let W = 0, H = 0, fontPx = 16, textTex = null, flow = null;

  function blankFlow(w, h) {
    const d = new Uint8Array(w * h * 4);
    for (let i = 0; i < d.length; i += 4) { d[i] = 128; d[i + 1] = 128; d[i + 2] = 0; d[i + 3] = 255; }
    return d;
  }

  function layout() {
    const cs = getComputedStyle(title);
    fontPx = parseFloat(cs.fontSize);
    const pad = Math.round(fontPx * 0.4);
    const r = title.getBoundingClientRect();
    W = r.width + pad * 2;
    H = r.height + pad * 2;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    Object.assign(canvas.style, {
      left:   -pad + 'px',
      top:    -pad + 'px',
      width:  W + 'px',
      height: H + 'px'
    });
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    // Rasterise each character exactly where the browser laid it out
    const tc = document.createElement('canvas');
    tc.width  = canvas.width;
    tc.height = canvas.height;
    const ctx = tc.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'alphabetic';
    const m = ctx.measureText('Hg');
    const asc  = m.fontBoundingBoxAscent  || fontPx * 0.8;
    const desc = m.fontBoundingBoxDescent || fontPx * 0.2;

    const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
    const range  = document.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const s = node.textContent;
      for (let i = 0; i < s.length; i++) {
        if (/\s/.test(s[i])) continue;
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const cr = range.getClientRects()[0];
        if (!cr) continue;
        const baseline = cr.top - r.top + pad + (cr.height - (asc + desc)) / 2 + asc;
        ctx.fillText(s[i], cr.left - r.left + pad, baseline);
      }
    }

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    if (textTex) gl.deleteTexture(textTex);
    textTex = mkTex();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tc);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    const fw = 160;
    const fh = Math.max(8, Math.round(160 * H / W));
    if (flow) flow.forEach(f => { gl.deleteTexture(f.t); gl.deleteFramebuffer(f.fb); });
    flow = [0, 1].map(() => {
      const t = mkTex(fw, fh, blankFlow(fw, fh));
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      return { t, fb, w: fw, h: fh };
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    render();
  }

  // ── Input ─────────────────────────────────────────────────────────
  let mx = 0.5, my = 0.5, pmx = null, pmy = null, inside = false;
  let vx = 0, vy = 0, lastMove = 0, running = false, prevT = 0;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = 1 - (e.clientY - r.top) / r.height;
    inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
    if (!inside) { pmx = pmy = null; return; }
    mx = x; my = y;
    lastMove = performance.now();
    if (!running) { running = true; prevT = lastMove; requestAnimationFrame(frame); }
  }
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('mousemove',   onMove, { passive: true });

  // ── Render ────────────────────────────────────────────────────────
  function stepFlow(dt, active) {
    const [a, b] = flow;
    gl.bindFramebuffer(gl.FRAMEBUFFER, b.fb);
    gl.viewport(0, 0, b.w, b.h);
    gl.useProgram(flowProg.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, a.t);
    gl.uniform1i(flowProg.u.uPrev, 0);
    gl.uniform2f(flowProg.u.uMouse, mx, my);
    gl.uniform2f(flowProg.u.uVel, vx, vy);
    gl.uniform1f(flowProg.u.uAspect, W / H);
    gl.uniform1f(flowProg.u.uRadius, CONFIG.radius * fontPx / W);
    gl.uniform1f(flowProg.u.uDiss, Math.pow(CONFIG.dissipation, dt * 60));
    gl.uniform1f(flowProg.u.uAdvect, CONFIG.advect);
    gl.uniform1f(flowProg.u.uActive, active ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    flow.reverse();
  }

  function render(amount = 1) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(dispProg.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, textTex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, flow[0].t);
    gl.uniform1i(dispProg.u.uText, 0);
    gl.uniform1i(dispProg.u.uFlow, 1);
    gl.uniform2f(dispProg.u.uStrength, CONFIG.strength * fontPx / W, CONFIG.strength * fontPx / H);
    gl.uniform3f(dispProg.u.uColor, color[0], color[1], color[2]);
    gl.uniform1f(dispProg.u.uAmount, amount);
    gl.uniform1f(dispProg.u.uChroma, CONFIG.chroma);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function frame(t) {
    const dt = clamp((t - prevT) / 1000, 0.001, 0.05);
    prevT = t;

    if (inside && pmx !== null) {
      const dx = (mx - pmx) * W / fontPx;
      const dy = (my - pmy) * H / fontPx;
      vx = clamp(vx * 0.5 + dx * CONFIG.velocity * 0.5 / (dt * 60), -1, 1);
      vy = clamp(vy * 0.5 + dy * CONFIG.velocity * 0.5 / (dt * 60), -1, 1);
    } else {
      vx *= 0.8; vy *= 0.8;
    }
    if (inside) { pmx = mx; pmy = my; }

    stepFlow(dt, inside && t - lastMove < 120);

    const since = (t - lastMove) / 1000;
    const k = clamp((since - CONFIG.hold) / CONFIG.fadeOut, 0, 1);
    const amount = 1 - k * k * (3 - 2 * k);
    render(amount);

    if (k >= 1) {
      flow.forEach(f => {
        gl.bindTexture(gl.TEXTURE_2D, f.t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, f.w, f.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, blankFlow(f.w, f.h));
      });
      render();
      running = false;
      return;
    }
    requestAnimationFrame(frame);
  }

  // ── Init ──────────────────────────────────────────────────────────
  title.appendChild(canvas);
  try {
    layout();
  } catch (e) {
    canvas.remove();
    return;
  }

  // Only hide the h1 text once WebGL is confirmed working
  title.classList.add('liquid-ready');
  title.style.color = 'transparent';
  title.style.webkitTextFillColor = 'transparent';

  new ResizeObserver(() => layout()).observe(title);

  if (document.fonts) {
    const ff = getComputedStyle(title).fontFamily;
    document.fonts.load(`400 1em ${ff}`).then(layout).catch(() => {});
    document.fonts.ready.then(layout);
  }
})();
