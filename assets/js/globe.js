/* ==========================================================================
   Leoside Equity: the globe on the home page
   --------------------------------------------------------------------------
   A real orthographic projection drawn into a canvas, no library.

     - every pixel of the sphere is lit twice: by a fixed studio light that
       gives the ball its volume, and by the actual sun for this minute, so
       the half of the world in daylight is the half that is lit
     - land comes from Natural Earth's 1:110m outline (assets/js/land-mask.js)
     - the three exchanges are marked, filled when their regular session is
       open, and joined by the arc the publishing week travels along
     - drag or use the arrow keys to turn it; it drifts on its own otherwise

   It only animates while a fair part of it is on screen and the tab is
   visible, at about 30 frames a second when drifting on its own. With
   reduced motion requested it holds still and redraws once a minute.
   ========================================================================== */

const Globe = (function () {
  'use strict';

  const RAD = Math.PI / 180;

  /* Run length decoded once: 720 x 360 cells, 1 for land. */
  let LAND = null;
  function land() {
    if (LAND || !window.LS_LAND) return LAND;
    const src = atob(window.LS_LAND.d);
    const W = window.LS_LAND.w, H = window.LS_LAND.h;
    const out = new Uint8Array(W * H);
    let p = 0;
    function varint() {
      let n = 0, shift = 0, b;
      do { b = src.charCodeAt(p++); n |= (b & 127) << shift; shift += 7; } while (b & 128);
      return n;
    }
    for (let j = 0; j < H; j++) {
      const runs = varint();
      let i = 0, v = 0;
      for (let k = 0; k < runs; k++) {
        const len = varint();
        if (v) out.fill(1, j * W + i, j * W + i + len);
        i += len; v ^= 1;
      }
    }
    LAND = { w: W, h: H, bits: out };
    return LAND;
  }

  /* Where the sun is overhead right now: declination from the day of the
     year, longitude from UTC corrected by the equation of time. Accurate to
     well under a degree, which is finer than a pixel here. */
  function subsolar(date) {
    const start = Date.UTC(date.getUTCFullYear(), 0, 0);
    const n = (date.getTime() - start) / 864e5;
    const g = 2 * Math.PI / 365 * (n - 1);
    const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) +
                 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const eot = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) -
                0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
    const lon = -((utcMin + eot) / 4 - 180);
    return { lat: decl, lon: ((lon + 540) % 360 - 180) * RAD };
  }

  function vec(lat, lon) {
    return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
  }

  function mount(stage, opts) {
    const canvas = stage.querySelector('canvas');
    if (!canvas || !canvas.getContext) return null;
    const ctx = canvas.getContext('2d');
    const mask = land();

    const css = getComputedStyle(document.documentElement);
    const BRASS = [201, 160, 82];
    const INK_TEXT = css.getPropertyValue('--on-ink').trim() || '#EDE6D6';
    const MONO = '"IBM Plex Mono", ui-monospace, monospace';

    const markers = opts.markers || [];
    let lon0 = (opts.focusLon || 0) * RAD;
    let lat0 = (opts.focusLat == null ? 22 : opts.focusLat) * RAD;
    let spin = LS.reducedMotion() ? 0 : -3.2 * RAD;      /* degrees per second */
    let vel = 0, dragging = false, lastX = 0, lastY = 0, resumeAt = 0;
    let visible = false, raf = 0, last = 0, size = 0, dpr = 1;
    let buf = null, bufCtx = null, img = null, N = 0;
    let sun = subsolar(new Date()), sunAt = Date.now();

    function resize() {
      const rect = stage.getBoundingClientRect();
      size = Math.max(160, Math.floor(rect.width));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      N = Math.max(180, Math.min(520, Math.round(size * dpr * 0.66)));
      buf = document.createElement('canvas');
      buf.width = buf.height = N;
      bufCtx = buf.getContext('2d');
      img = bufCtx.createImageData(N, N);
      draw();
    }

    /* ------------------------------------------------------------- shading
       Turning the globe only changes longitude, so everything else about a
       pixel (where it sits on the sphere, its latitude, the studio light,
       the soft rim) is worked out once per size and tilt and kept in `geom`.
       Each frame then only has to look up the land and the sunlight, which
       keeps a frame short even on a slow phone. */
    let geom = null;

    function buildGeom() {
      const W = mask ? mask.w : 720, H = mask ? mask.h : 360;
      const sl0 = Math.sin(lat0), cl0 = Math.cos(lat0);
      /* Studio light, up and to the left of the viewer. */
      const Lx = -0.42, Ly = 0.52, Lz = 0.74;
      const inv = 2 / N, cap = N * N, d = img.data;
      const at = new Int32Array(cap), phi = new Float32Array(cap), row0 = new Int32Array(cap),
            row1 = new Int32Array(cap), fy = new Float32Array(cap),
            rho = new Float32Array(cap), yw = new Float32Array(cap), base = new Float32Array(cap),
            alpha = new Uint8ClampedArray(cap);
      let n = 0, o = 0;
      for (let j = 0; j < N; j++) {
        const y = 1 - (j + 0.5) * inv;
        for (let i = 0; i < N; i++, o += 4) {
          const x = (i + 0.5) * inv - 1;
          const r2 = x * x + y * y;
          if (r2 >= 1) { d[o + 3] = 0; continue; }
          const z = Math.sqrt(1 - r2);

          /* View space to world space, before the turn in longitude. */
          const Yw = z * sl0 + y * cl0;
          const a = z * cl0 - y * sl0;
          const lat = Math.asin(Yw < -1 ? -1 : Yw > 1 ? 1 : Yw);
          /* The two map rows either side of this latitude and how far
             between them it falls, for smooth coastlines. */
          const rf = (Math.PI / 2 - lat) / Math.PI * H - 0.5;
          let r0 = Math.floor(rf);
          const t = rf - r0;
          if (r0 < 0) r0 = 0;
          if (r0 > H - 1) r0 = H - 1;
          const r1 = r0 + 1 > H - 1 ? H - 1 : r0 + 1;

          let studio = x * Lx + y * Ly + z * Lz;
          studio = 0.5 + 0.5 * (studio < 0 ? 0 : studio);
          /* Soft anti aliased rim. */
          const edge = (1 - Math.sqrt(r2)) * N * 0.5;

          at[n] = o;
          /* Longitude before the turn, in map columns, shifted up by one
             whole map width so the sum below never goes negative. */
          phi[n] = Math.atan2(x, a) / (2 * Math.PI) * W + W;
          row0[n] = r0 * W;
          row1[n] = r1 * W;
          fy[n] = rf < 0 ? 0 : t;
          rho[n] = Math.sqrt(x * x + a * a);             /* cosine of latitude */
          yw[n] = Yw;                                    /* sine of latitude */
          base[n] = studio * (0.72 + 0.28 * z);
          alpha[n] = edge < 1 ? 255 * edge : 255;
          n++;
        }
      }
      geom = { n: n, N: N, lat0: lat0, at: at, phi: phi, row0: row0, row1: row1, fy: fy, rho: rho, yw: yw, base: base, alpha: alpha, cosT: new Float32Array(W) };
    }

    function shade() {
      if (!geom || geom.N !== N || geom.lat0 !== lat0) buildGeom();
      const g = geom, d = img.data;
      const W = mask ? mask.w : 720, bits = mask ? mask.bits : null;
      const cd = Math.cos(sun.lat), sd = Math.sin(sun.lat);
      /* Sunlight on a point is cos(lat) cos(decl) cos(lon - sun lon) +
         sin(lat) sin(decl). The longitude part is the same for every pixel
         in a map column, so it is worked out once per column. */
      const cosT = g.cosT;
      for (let c = 0; c < W; c++) cosT[c] = cd * Math.cos((c + 0.5) / W * 2 * Math.PI - Math.PI - sun.lon);
      let shift = (lon0 + Math.PI) / (2 * Math.PI) * W;
      shift = ((shift % W) + W) % W;

      for (let k = 0; k < g.n; k++) {
        /* Land is read from the four map cells around the point and blended,
           then sharpened back to a crisp edge. Reading one cell gave stepped,
           pixelated coastlines, worst near the poles where the map's cells
           are squeezed together. */
        const cf = g.phi[k] + shift - 0.5;
        let c = cf | 0;
        const fx = cf - c;
        while (c >= W) c -= W;
        const c1 = c + 1 === W ? 0 : c + 1;
        let land = 0;
        if (bits) {
          const a0 = g.row0[k], a1 = g.row1[k];
          const top = bits[a0 + c] + (bits[a0 + c1] - bits[a0 + c]) * fx;
          const bot = bits[a1 + c] + (bits[a1 + c1] - bits[a1 + c]) * fx;
          land = (top + (bot - top) * g.fy[k] - 0.32) / 0.36;
          land = land < 0 ? 0 : land > 1 ? 1 : land;
          land = land * land * (3 - 2 * land);
        }

        let day = (g.rho[k] * cosT[c] + g.yw[k] * sd + 0.08) / 0.22;
        day = day < 0 ? 0 : day > 1 ? 1 : day;
        day = day * day * (3 - 2 * day);
        const light = (0.3 + 0.7 * day) * g.base[k];
        /* The night side keeps a faint blue so the continents still read
           as shapes rather than disappearing into black. */
        const night = 1 - day;

        /* Brass land on a deep sea. */
        const o = g.at[k], sea = 1 - land;
        d[o]     = (188 * land + 26 * sea) * light + 6 * night;
        d[o + 1] = (150 * land + 50 * sea) * light + 12 * night;
        d[o + 2] = (84 * land + 72 * sea) * light + 22 * night;
        d[o + 3] = g.alpha[k];
      }
      bufCtx.putImageData(img, 0, 0);
    }

    /* ------------------------------------------------------------- vectors */
    function project(lat, lon, lift) {
      const cl = Math.cos(lat), dl = lon - lon0;
      const x = cl * Math.sin(dl);
      const y = Math.cos(lat0) * Math.sin(lat) - Math.sin(lat0) * cl * Math.cos(dl);
      const z = Math.sin(lat0) * Math.sin(lat) + Math.cos(lat0) * cl * Math.cos(dl);
      const k = lift || 1;
      return { x: x * k, y: y * k, z: z };
    }

    function line(points, R, cx, cy, style, width, dash) {
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (p.z > 0) {
          const px = cx + p.x * R, py = cy - p.y * R;
          if (pen) ctx.lineTo(px, py); else { ctx.moveTo(px, py); pen = true; }
        } else pen = false;
      }
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.setLineDash(dash || []);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

    function slerp(A, B, t) {
      const dot = Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]));
      const w = Math.acos(dot), s = Math.sin(w);
      const a = Math.sin((1 - t) * w) / s, b = Math.sin(t * w) / s;
      return [A[0] * a + B[0] * b, A[1] * a + B[1] * b, A[2] * a + B[2] * b];
    }

    function draw(now) {
      if (!size) return;
      if (Date.now() - sunAt > 30000) { sun = subsolar(new Date()); sunAt = Date.now(); }
      const W = canvas.width;
      const pad = W * 0.13;
      const R = W / 2 - pad;
      const cx = W / 2, cy = W / 2;
      ctx.clearRect(0, 0, W, W);

      /* Atmosphere: a warm haze that fades out beyond the limb. */
      const haze = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.34);
      haze.addColorStop(0, 'rgba(214,176,106,0.28)');
      haze.addColorStop(0.3, 'rgba(214,176,106,0.09)');
      haze.addColorStop(1, 'rgba(214,176,106,0)');
      ctx.fillStyle = haze;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.34, 0, Math.PI * 2);
      ctx.fill();

      /* Two fine rings around it, like the orbits on an armillary sphere. */
      ctx.lineWidth = dpr;
      ctx.strokeStyle = rgba(BRASS, 0.2);
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.1, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = rgba(BRASS, 0.1);
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.25, 0, Math.PI * 2); ctx.stroke();

      shade();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(buf, cx - R, cy - R, R * 2, R * 2);

      /* A soft highlight where the studio light falls, for a rounder ball. */
      const shine = ctx.createRadialGradient(cx - R * 0.42, cy - R * 0.48, 0, cx - R * 0.42, cy - R * 0.48, R * 1.1);
      shine.addColorStop(0, 'rgba(255,244,220,0.10)');
      shine.addColorStop(1, 'rgba(255,244,220,0)');
      ctx.fillStyle = shine;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      /* Graticule every 30 degrees. The meridians stop at 80 degrees, so
         they never bunch into a bright knot at the poles. */
      const grid = rgba(BRASS, 0.16);
      for (let lon = -180; lon < 180; lon += 30) {
        const pts = [];
        for (let lat = -80; lat <= 80; lat += 2) pts.push(project(lat * RAD, lon * RAD));
        line(pts, R, cx, cy, grid, dpr);
      }
      for (let lat = -60; lat <= 60; lat += 30) {
        const pts = [];
        for (let lon = -180; lon <= 180; lon += 3) pts.push(project(lat * RAD, lon * RAD));
        line(pts, R, cx, cy, lat === 0 ? rgba(BRASS, 0.3) : grid, dpr);
      }

      /* The terminator: every point where the sun sits on the horizon. */
      const S = vec(sun.lat, sun.lon);
      const up = Math.abs(S[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const u = [S[1] * up[2] - S[2] * up[1], S[2] * up[0] - S[0] * up[2], S[0] * up[1] - S[1] * up[0]];
      const ul = Math.hypot(u[0], u[1], u[2]);
      u[0] /= ul; u[1] /= ul; u[2] /= ul;
      const v = [S[1] * u[2] - S[2] * u[1], S[2] * u[0] - S[0] * u[2], S[0] * u[1] - S[1] * u[0]];
      const term = [];
      for (let t = 0; t <= 360; t += 3) {
        const c = Math.cos(t * RAD), s = Math.sin(t * RAD);
        const w = [u[0] * c + v[0] * s, u[1] * c + v[1] * s, u[2] * c + v[2] * s];
        term.push(project(Math.asin(w[1]), Math.atan2(w[0], w[2])));
      }
      line(term, R, cx, cy, rgba(BRASS, 0.55), dpr, [3 * dpr, 4 * dpr]);

      /* The week's route, lifted off the surface so it reads as an arc. */
      const route = markers.map(function (m) { return vec(m.lat * RAD, m.lon * RAD); });
      const phase = LS.reducedMotion() ? 0.5 : ((now || 0) / 5200) % 1;
      for (let k = 0; k + 1 < route.length; k++) {
        const pts = [];
        for (let t = 0; t <= 1.0001; t += 0.025) {
          const w = slerp(route[k], route[k + 1], t);
          pts.push(project(Math.asin(w[1]), Math.atan2(w[0], w[2]), 1 + 0.14 * Math.sin(Math.PI * t)));
        }
        line(pts, R, cx, cy, rgba(BRASS, 0.6), 1.4 * dpr);
        const seg = phase * (route.length - 1);
        if (seg >= k && seg < k + 1) {
          const t = seg - k;
          const w = slerp(route[k], route[k + 1], t);
          const p = project(Math.asin(w[1]), Math.atan2(w[0], w[2]), 1 + 0.14 * Math.sin(Math.PI * t));
          if (p.z > 0) {
            ctx.fillStyle = rgba(BRASS, 0.25);
            ctx.beginPath(); ctx.arc(cx + p.x * R, cy - p.y * R, 6 * dpr, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = rgba(BRASS, 1);
            ctx.beginPath(); ctx.arc(cx + p.x * R, cy - p.y * R, 2.6 * dpr, 0, Math.PI * 2); ctx.fill();
          }
        }
      }

      /* Rim. */
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(BRASS, 0.5);
      ctx.lineWidth = dpr;
      ctx.stroke();

      /* Exchanges. Filled square while the regular session is open. */
      ctx.font = '500 ' + (11 * dpr) + 'px ' + MONO;
      ctx.textBaseline = 'middle';
      markers.forEach(function (m) {
        const p = project(m.lat * RAD, m.lon * RAD);
        if (p.z < 0.05) return;
        const px = cx + p.x * R, py = cy - p.y * R;
        const open = m.isOpen();
        ctx.globalAlpha = Math.min(1, p.z * 3);
        if (open) {
          ctx.fillStyle = rgba(BRASS, 0.22);
          ctx.beginPath(); ctx.arc(px, py, 9 * dpr, 0, Math.PI * 2); ctx.fill();
        }
        ctx.lineWidth = 1.5 * dpr;
        ctx.strokeStyle = rgba(BRASS, 1);
        ctx.fillStyle = open ? rgba(BRASS, 1) : 'rgba(11,17,24,0.95)';
        ctx.beginPath(); ctx.arc(px, py, 4 * dpr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        const label = m.label + '  ' + m.time();
        const tw = ctx.measureText(label).width;
        const right = p.x < 0.35;
        const lx = right ? px + 14 * dpr : px - 14 * dpr - tw;
        ctx.fillStyle = 'rgba(11,17,24,0.86)';
        ctx.strokeStyle = rgba(BRASS, 0.28);
        ctx.lineWidth = dpr;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(lx - 7 * dpr, py - 11 * dpr, tw + 14 * dpr, 22 * dpr, 6 * dpr);
        else ctx.rect(lx - 7 * dpr, py - 11 * dpr, tw + 14 * dpr, 22 * dpr);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = INK_TEXT;
        ctx.fillText(label, lx, py + 0.5 * dpr);
        ctx.globalAlpha = 1;
      });
    }

    /* ------------------------------------------------------------ the loop */
    let target = null;   /* longitude being turned to, in radians */
    function frame(t) {
      raf = 0;
      /* Left to itself the globe turns slowly, so about 30 frames a second
         is plenty. Dragging, turning to a city and the glide after a drag
         run at the full rate. */
      const idle = !dragging && target === null && Math.abs(vel) <= 0.0005;
      if (idle && last && t - last < 32) { if (running()) raf = requestAnimationFrame(frame); return; }
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      if (!dragging) {
        if (target !== null) {
          const gap = target - lon0;
          if (Math.abs(gap) < 0.002) { lon0 = target; target = null; }
          else lon0 += gap * (1 - Math.pow(0.015, dt));
        }
        else if (Math.abs(vel) > 0.0005) { lon0 += vel * dt; vel *= Math.pow(0.04, dt); }
        else if (Date.now() > resumeAt) lon0 += spin * dt;
      }
      draw(t);
      if (running()) raf = requestAnimationFrame(frame);
    }
    function running() { return visible && !document.hidden && (spin !== 0 || dragging || target !== null || Math.abs(vel) > 0.0005); }

    /* Brings a longitude to the front by the shortest way round, then holds
       it there for a few seconds before the slow drift resumes. */
    function turnTo(lonDeg) {
      let gap = (lonDeg * RAD - lon0) % (2 * Math.PI);
      if (gap > Math.PI) gap -= 2 * Math.PI;
      if (gap < -Math.PI) gap += 2 * Math.PI;
      vel = 0;
      resumeAt = Date.now() + 8000;
      if (LS.reducedMotion() || !visible) { lon0 += gap; target = null; draw(); return; }
      target = lon0 + gap;
      kick();
    }
    function kick() { if (!raf && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } }

    /* ------------------------------------------------------------ controls */
    canvas.addEventListener('pointerdown', function (e) {
      dragging = true; vel = 0; target = null; lastX = e.clientX; lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      kick();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      const k = 180 / size * RAD;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      lon0 -= dx * k;
      lat0 = Math.max(-60 * RAD, Math.min(60 * RAD, lat0 + dy * k));
      vel = -dx * k * 60;
      if (!raf) draw();
    });
    function release() { dragging = false; resumeAt = Date.now() + 2500; kick(); }
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('keydown', function (e) {
      const step = 8 * RAD;
      if (e.key === 'ArrowLeft') lon0 += step;
      else if (e.key === 'ArrowRight') lon0 -= step;
      else if (e.key === 'ArrowUp') lat0 = Math.min(60 * RAD, lat0 + step);
      else if (e.key === 'ArrowDown') lat0 = Math.max(-60 * RAD, lat0 - step);
      else return;
      e.preventDefault();
      target = null;
      resumeAt = Date.now() + 4000;
      draw();
    });

    /* It turns only while a fair part of it is on screen; a sliver at the
       edge of the window gets a still picture. */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        const e = entries[0];
        visible = e.isIntersecting && e.intersectionRatio >= 0.15;
        if (e.isIntersecting) draw();
        if (visible) kick();
      }, { threshold: [0, 0.15] }).observe(stage);
    } else { visible = true; }
    document.addEventListener('visibilitychange', kick);
    if ('ResizeObserver' in window) new ResizeObserver(LS.debounce(resize, 80)).observe(stage);
    else window.addEventListener('resize', LS.debounce(resize, 80));

    /* Still pictures still need the sun and the clocks to move. */
    setInterval(function () { if (!raf && visible) draw(); }, 60000);

    resize();
    kick();
    return { redraw: draw, turnTo: turnTo };
  }

  return { mount: mount, subsolar: subsolar };
})();
