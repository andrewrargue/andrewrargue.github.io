/**
 * about-liquid.js
 * Liquid / water-ripple distortion on the about page photo.
 * WebGL1, zero dependencies.
 */
(() => {
  const CONFIG = {
    strength:    0.07,
    radius:      0.3,
    dissipation: 0.94,
    advect:      0.008,
    velocity:    5,
    hold:        0.3,
    fadeOut:     0.9
  };

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const wrap = document.querySelector('.about-photo');
  const img  = wrap && wrap.querySelector('.about-photo__img');
  if (!wrap || !img) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'liquid-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute;pointer-events:none;display:block;inset:0;width:100%;height:100%;';

  const gl = canvas.getContext('webgl', { alpha: false, antialias: false })
          || canvas.getContext('experimental-webgl', { alpha: false });
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
    uniform sampler2D uPhoto, uFlow;
    uniform vec2 uStrength; uniform float uAmount;
    void main(){
      vec2 f = texture2D(uFlow, vUv).xy * 2.0 - 1.0;
      f = sign(f) * max(abs(f) - 0.02, 0.0);
      vec2 o = f * uStrength * uAmount;
      gl_FragColor = texture2D(uPhoto, vUv - o);
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

  function blankFlow(w, h) {
    const d = new Uint8Array(w * h * 4);
    for (let i = 0; i < d.length; i += 4) { d[i] = 128; d[i + 1] = 128; d[i + 2] = 0; d[i + 3] = 255; }
    return d;
  }

  let W = 0, H = 0, photoTex = null, flow = null;

  function buildPhotoTex() {
    // Pre-crop the image to simulate object-fit:cover; object-position:center 25%
    const r   = canvas.getBoundingClientRect();
    const cW  = r.width;
    const cH  = r.height;
    const iW  = img.naturalWidth;
    const iH  = img.naturalHeight;
    const cAr = cW / cH;
    const iAr = iW / iH;

    let sx, sy, sw, sh;
    if (iAr > cAr) {
      // image wider: fit height, crop sides
      sh = iH;
      sw = iH * cAr;
      sx = (iW - sw) * 0.5;
      sy = 0;
    } else {
      // image taller: fit width, crop top/bottom
      sw = iW;
      sh = iW / cAr;
      sx = 0;
      const maxSy = iH - sh;
      sy = Math.min(iH * 0.25, maxSy);
    }

    const tc = document.createElement('canvas');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    tc.width  = Math.round(cW * dpr);
    tc.height = Math.round(cH * dpr);
    tc.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, tc.width, tc.height);

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    if (photoTex) gl.deleteTexture(photoTex);
    photoTex = mkTex();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tc);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  function layout() {
    const r   = canvas.getBoundingClientRect();
    W = r.width;
    H = r.height;
    if (W < 1 || H < 1) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    buildPhotoTex();

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
    gl.uniform1f(flowProg.u.uRadius, CONFIG.radius);
    gl.uniform1f(flowProg.u.uDiss, Math.pow(CONFIG.dissipation, dt * 60));
    gl.uniform1f(flowProg.u.uAdvect, CONFIG.advect);
    gl.uniform1f(flowProg.u.uActive, active ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    flow.reverse();
  }

  function render(amount = 1) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(dispProg.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, photoTex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, flow[0].t);
    gl.uniform1i(dispProg.u.uPhoto, 0);
    gl.uniform1i(dispProg.u.uFlow, 1);
    gl.uniform2f(dispProg.u.uStrength, CONFIG.strength, CONFIG.strength * W / H);
    gl.uniform1f(dispProg.u.uAmount, amount);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function frame(t) {
    const dt = clamp((t - prevT) / 1000, 0.001, 0.05);
    prevT = t;

    if (inside && pmx !== null) {
      vx = clamp(vx * 0.5 + (mx - pmx) * CONFIG.velocity * 0.5 / (dt * 60), -1, 1);
      vy = clamp(vy * 0.5 + (my - pmy) * CONFIG.velocity * 0.5 / (dt * 60), -1, 1);
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
  function init() {
    if (!img.naturalWidth) return; // image not loaded yet
    wrap.appendChild(canvas);
    try {
      layout();
    } catch (e) {
      canvas.remove();
      return;
    }
    img.style.visibility = 'hidden';
    // Expose canvas so the parallax code in about.html can sync transforms
    img._liquidCanvas = canvas;
    new ResizeObserver(() => { if (img.naturalWidth) layout(); }).observe(wrap);
  }

  if (img.complete && img.naturalWidth) {
    init();
  } else {
    img.addEventListener('load', init, { once: true });
  }
})();
