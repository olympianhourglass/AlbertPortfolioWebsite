// Cross-section HUD — layered rings that pull apart as you scroll.

const THEMES = {
  tactical: {
    ink: "255, 255, 255",
    accent: "255, 96, 44",
    header: "XS-04 // CROSS SECTION",
    modes: ["STACKED", "EXPLODED"],
    status: ["ACQUIRING", "◆ SECTION LOCKED"],
    tag: "TGT",
    codes: ["CORE", "SEG", "TCK", "DSH", "DBL", "BRK", "SWP", "SEG", "DSH", "BRG"],
    vitals: false,
  },
  "vitals-dark": {
    ink: "236, 248, 244",
    accent: "94, 234, 196",
    heart: "255, 98, 98",
    header: "BIO-02 // VITAL SECTION",
    modes: ["INTACT", "SECTIONED"],
    status: ["CALIBRATING", "◆ SCAN COMPLETE"],
    tag: "MKR",
    codes: ["CORE", "MDLA", "CRTX", "VASC", "NERV", "MUSC", "FASC", "HYPO", "DERM", "EPI"],
    vitals: true,
  },
  "vitals-cream": {
    ink: "34, 44, 48",
    accent: "14, 138, 124",
    heart: "214, 72, 58",
    header: "BIO-03 // VITAL SECTION",
    modes: ["INTACT", "SECTIONED"],
    status: ["CALIBRATING", "◆ SCAN COMPLETE"],
    tag: "MKR",
    codes: ["CORE", "MDLA", "CRTX", "VASC", "NERV", "MUSC", "FASC", "HYPO", "DERM", "EPI"],
    vitals: true,
  },
};

document.querySelectorAll(".showcase-hud").forEach((section) => {
  mountHud(section, THEMES[section.dataset.hud] || THEMES.tactical);
});

function mountHud(section, theme) {
  const stage = section.querySelector(".hud-stage");
  const canvas = section.querySelector(".hud-canvas");
  if (!stage || !canvas) return;

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  const ctx = canvas.getContext("2d");

  const MONO = '"SF Mono", ui-monospace, Menlo, monospace';
  const WHITE = theme.ink;
  const SIGNAL = theme.accent;
  const HEART = theme.heart || theme.accent;
  const TAU = Math.PI * 2;
  const BEAT = 60 / 72;

  const rings = [
    { r: 0.12, kind: "core", spin: 0 },
    { r: 0.2, kind: "segments", spin: 0.6, count: 3 },
    { r: 0.28, kind: "ticks", spin: -0.08, count: 72 },
    { r: 0.37, kind: "dash", spin: 0.25 },
    { r: 0.46, kind: "double", spin: 0.04 },
    { r: 0.56, kind: "brackets", spin: -0.18 },
    { r: 0.66, kind: "ticks", spin: 0.05, count: 180, sweep: true },
    { r: 0.77, kind: "segments", spin: -0.12, count: 5 },
    { r: 0.88, kind: "dash", spin: -0.06 },
    { r: 1.0, kind: "bearing", spin: 0 },
  ];

  const codes = theme.codes;

  const blips = [
    { ring: 2, a: 3.7, period: 2.2, phase: 0.5, id: "09" },
    { ring: 3, a: 0.8, period: 1.1, phase: 0.0, id: "07" },
    { ring: 5, a: 2.6, period: 0.7, phase: 0.3, id: "12" },
    { ring: 7, a: 4.4, period: 1.6, phase: 0.6, id: "03" },
    { ring: 8, a: 5.6, period: 0.9, phase: 0.1, id: "21" },
  ];

  let w = 0;
  let h = 0;
  let dpr = 1;
  let stickyTop = 0;
  let running = true;
  let target = 0;
  let sp = 0;
  let sy = 1;
  let backDim = 1;
  const start = performance.now();
  let last = start;
  let hexAt = 0;
  const nextLine = theme.vitals ? randomSample : randomHex;
  const hex = Array.from({ length: 6 }, nextLine);

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const rgba = (c, a) => `rgba(${c}, ${a})`;

  function randomHex() {
    let s = "";
    for (let i = 0; i < 4; i++) {
      s += Math.floor(Math.random() * 0xffff)
        .toString(16)
        .toUpperCase()
        .padStart(4, "0");
      if (i < 3) s += " ";
    }
    return s;
  }

  function randomSample() {
    const ch = String(1 + Math.floor(Math.random() * 8)).padStart(2, "0");
    const mv = (Math.random() * 1.6 - 0.4).toFixed(2);
    const hz = 120 + Math.floor(Math.random() * 16);
    return `CH${ch}  ${mv.padStart(5, " ")} mV  ${hz} Hz`;
  }

  // One heartbeat: P wave, QRS spike, T wave.
  function ecg(phase) {
    const bump = (c, wdt, amp) => amp * Math.exp(-(((phase - c) / wdt) ** 2));
    return (
      bump(0.12, 0.035, 0.12) -
      bump(0.27, 0.008, 0.14) +
      bump(0.3, 0.012, 1) -
      bump(0.33, 0.01, 0.3) +
      bump(0.55, 0.06, 0.26)
    );
  }

  function pulseAt(t) {
    if (reduceMotion || !theme.vitals) return 0;
    const ph = ((t / BEAT) % 1 + 1) % 1;
    return Math.exp(-((ph - 0.3) ** 2) / 0.002);
  }

  function resize() {
    const nextW = stage.clientWidth;
    const nextH = stage.clientHeight;
    if (!nextW || !nextH) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = nextW;
    h = nextH;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stickyTop = parseFloat(getComputedStyle(stage).top) || 0;
  }

  function readScroll() {
    const rect = section.getBoundingClientRect();
    const range = section.offsetHeight - stage.offsetHeight;
    target = range > 0 ? clamp((stickyTop - rect.top) / range, 0, 1) : 0;
  }

  // Splits at multiples of PI so the far half of a tilted ring sits dimmer.
  function arc(x, y, r, a0, a1, alpha, color = WHITE) {
    let a = a0;
    while (a < a1 - 1e-4) {
      const next = Math.min(a1, (Math.floor(a / Math.PI + 1e-6) + 1) * Math.PI);
      const far = Math.sin((a + next) / 2) < 0;
      ctx.strokeStyle = rgba(color, alpha * (far ? backDim : 1));
      ctx.beginPath();
      ctx.ellipse(x, y, r, Math.max(0.01, r * sy), 0, a, next);
      ctx.stroke();
      a = next;
    }
  }

  function pt(x, y, a, r) {
    return [x + Math.cos(a) * r, y + Math.sin(a) * r * sy];
  }

  function line(x1, y1, x2, y2, alpha, color = WHITE) {
    ctx.strokeStyle = rgba(color, alpha);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function text(str, x, y, alpha, align = "left", color = WHITE, size = 10) {
    ctx.font = `${size}px ${MONO}`;
    ctx.textAlign = align;
    ctx.fillStyle = rgba(color, alpha);
    ctx.fillText(str, x, y);
  }

  function radialTicks(x, y, r, rot, count, lengthFor, alpha) {
    const front = new Path2D();
    const back = new Path2D();
    for (let k = 0; k < count; k++) {
      const a = rot + (k * TAU) / count;
      const len = lengthFor(k);
      const c = Math.cos(a);
      const s = Math.sin(a);
      const p = s < 0 ? back : front;
      p.moveTo(x + c * r, y + s * r * sy);
      p.lineTo(x + c * (r + len), y + s * (r + len) * sy);
    }
    ctx.strokeStyle = rgba(WHITE, alpha);
    ctx.stroke(front);
    ctx.strokeStyle = rgba(WHITE, alpha * backDim);
    ctx.stroke(back);
  }

  function ringLabels(x, y, r, rot, step, alpha) {
    ctx.font = `9px ${MONO}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let d = 0; d < 360; d += step) {
      const a = rot + (d * Math.PI) / 180 - Math.PI / 2;
      const [px, py] = pt(x, y, a, r);
      const far = Math.sin(a) < 0;
      ctx.fillStyle = rgba(WHITE, alpha * (far ? backDim : 1));
      ctx.fillText(String(d).padStart(3, "0"), px, py);
    }
    ctx.textBaseline = "alphabetic";
  }

  function drawRing(L, t) {
    const { ring, x, y, r, rot } = L;

    if (ring.kind === "core") {
      arc(x, y, r, 0, TAU, 0.9);
      arc(x, y, r * 0.55, 0, TAU, 0.35);
      const d = 4;
      ctx.strokeStyle = rgba(WHITE, 0.9);
      ctx.beginPath();
      ctx.moveTo(x, y - d * sy - 1);
      ctx.lineTo(x + d, y);
      ctx.lineTo(x, y + d * sy + 1);
      ctx.lineTo(x - d, y);
      ctx.closePath();
      ctx.stroke();
      if (theme.vitals) {
        const p = pulseAt(t);
        ctx.fillStyle = rgba(HEART, 0.25 + p * 0.6);
        ctx.beginPath();
        ctx.ellipse(x, y, r * (0.3 + p * 0.12), r * (0.3 + p * 0.12) * sy, 0, 0, TAU);
        ctx.fill();
      }
      return;
    }

    if (ring.kind === "segments") {
      const span = (TAU / ring.count) * 0.56;
      for (let k = 0; k < ring.count; k++) {
        const a0 = rot + (k * TAU) / ring.count;
        arc(x, y, r, a0, a0 + span, 0.85);
        for (const a of [a0, a0 + span]) {
          const [x1, y1] = pt(x, y, a, r - 4);
          const [x2, y2] = pt(x, y, a, r + 4);
          line(x1, y1, x2, y2, 0.85 * (Math.sin(a) < 0 ? backDim : 1));
        }
      }
      return;
    }

    if (ring.kind === "ticks") {
      arc(x, y, r, 0, TAU, 0.3);
      radialTicks(x, y, r, rot, ring.count, (k) =>
        k % 10 === 0 ? 9 : k % 5 === 0 ? 5 : 2.5, 0.7);
      if (ring.sweep) drawSweep(x, y, r, t);
      return;
    }

    if (ring.kind === "dash") {
      ctx.setLineDash([2, 6]);
      ctx.lineDashOffset = -t * 14 * Math.sign(ring.spin);
      arc(x, y, r, 0, TAU, 0.6);
      ctx.setLineDash([]);
      return;
    }

    if (ring.kind === "double") {
      arc(x, y, r, 0, TAU, 0.75);
      arc(x, y, r - 5, 0, TAU, 0.3);
      for (let k = 0; k < 12; k++) {
        const a = rot + (k * TAU) / 12;
        const [px, py] = pt(x, y, a, r - 2.5);
        const far = Math.sin(a) < 0;
        ctx.fillStyle = rgba(WHITE, 0.8 * (far ? backDim : 1));
        ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
      }
      ringLabels(x, y, r + 16, rot, 30, 0.55);
      return;
    }

    if (ring.kind === "brackets") {
      ctx.lineWidth = 1.6;
      for (let k = 0; k < 4; k++) {
        const a0 = rot + (k * Math.PI) / 2 - 0.21;
        arc(x, y, r, a0, a0 + 0.42, 0.9, k === 0 ? SIGNAL : WHITE);
      }
      ctx.lineWidth = 1;
      const [mx, my] = pt(x, y, rot, r + 10);
      ctx.fillStyle = rgba(SIGNAL, 0.95);
      ctx.beginPath();
      ctx.moveTo(mx, my - 4);
      ctx.lineTo(mx + 6, my);
      ctx.lineTo(mx, my + 4);
      ctx.closePath();
      ctx.fill();
      return;
    }

    if (ring.kind === "bearing") {
      arc(x, y, r, 0, TAU, 0.28);
      radialTicks(x, y, r, rot, 180, (k) => (k % 15 === 0 ? 8 : 3), 0.45);
      ringLabels(x, y, r + 20, rot, 30, 0.5);
      const ba = -Math.PI / 2 + Math.sin(t * 0.4) * 0.35;
      const [bx, by] = pt(x, y, ba, r - 4);
      ctx.fillStyle = rgba(SIGNAL, 0.95);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - 5, by - 9);
      ctx.lineTo(bx + 5, by - 9);
      ctx.closePath();
      ctx.fill();
      text(`${(((ba + Math.PI / 2) * 180) / Math.PI + 360).toFixed(1).padStart(5, "0")}°`,
        bx, by - 14, 0.9, "center", SIGNAL, 9);
    }
  }

  function drawSweep(x, y, r, t) {
    const a = t * 1.4;
    const slices = 28;
    const step = 0.028;
    for (let j = 0; j < slices; j++) {
      const a1 = a - j * step;
      const a0 = a1 - step;
      const [x1, y1] = pt(x, y, a1, r);
      const [x0, y0] = pt(x, y, a0, r);
      ctx.fillStyle = theme.vitals
        ? rgba(SIGNAL, 0.14 * (1 - j / slices))
        : rgba(WHITE, 0.12 * (1 - j / slices));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x0, y0);
      ctx.closePath();
      ctx.fill();
    }
    const [ex, ey] = pt(x, y, a, r);
    line(x, y, ex, ey, 0.7, theme.vitals ? SIGNAL : WHITE);
  }

  function drawBlips(layers, t) {
    for (const b of blips) {
      const L = layers[b.ring];
      const a = b.a + L.rot;
      const [px, py] = pt(L.x, L.y, a, L.r);
      const on = reduceMotion || (t / b.period + b.phase) % 1 < 0.5;
      ctx.strokeStyle = rgba(on ? SIGNAL : WHITE, on ? 0.95 : 0.25);
      ctx.strokeRect(px - 3.5, py - 3.5, 7, 7);
      if (on) {
        line(px + 4, py - 4, px + 12, py - 12, 0.6, SIGNAL);
        text(`${theme.tag}-${b.id}`, px + 14, py - 13, 0.9, "left", SIGNAL, 9);
      }
    }
  }

  function drawLeaders(layers, R, cx, cy, sep) {
    const reach = R * 1.12;
    const rightX = cx + reach + 34;
    const leftX = cx - reach - 34;
    const showRight = rightX + 96 < w;
    const showLeft = leftX - 70 > 0;
    for (const L of layers) {
      const a = ease(clamp((L.k - 0.45) / 0.55, 0, 1));
      if (a < 0.01) continue;
      if (showRight) {
        const x0 = L.x + L.r + 6;
        const x1 = x0 + (rightX - 6 - x0) * a;
        line(x0, L.y, x1, L.y, 0.3 * a);
        ctx.fillStyle = rgba(WHITE, 0.8 * a);
        ctx.fillRect(x0 - 1.5, L.y - 1.5, 3, 3);
        text(`L${String(L.i + 1).padStart(2, "0")}  Ø${((L.r * 2) / R).toFixed(2)}  ${codes[L.i]}`,
          rightX, L.y + 3, 0.75 * a, "left", WHITE, 9);
      }
      if (showLeft) {
        const x0 = L.x - L.r - 6;
        const x1 = x0 - (x0 - (leftX + 6)) * a;
        line(x0, L.y, x1, L.y, 0.2 * a);
        const z = (L.y - cy) / sep;
        const label = theme.vitals
          ? `D ${(((L.y - cy) / sep + 4.5) * 0.8).toFixed(1)} MM`
          : `Z${z >= 0 ? "+" : "−"}${Math.abs(z).toFixed(2)}`;
        text(label, leftX, L.y + 3, 0.55 * a, "right", WHITE, 9);
      }
    }
  }

  function drawChrome(t, cx, cy, e) {
    const m = 20;
    const c = 16;

    line(0, cy, w, cy, 0.07);
    line(cx, 0, cx, h, 0.07);
    for (let x = cx % 40; x < w; x += 40) line(x, cy - 2, x, cy + 2, 0.18);

    if (!reduceMotion) {
      const scan = (t * 70) % h;
      line(0, scan, w, scan, 0.05);
    }

    for (const [x, y, dx, dy] of [
      [m, m, 1, 1],
      [w - m, m, -1, 1],
      [m, h - m, 1, -1],
      [w - m, h - m, -1, -1],
    ]) {
      line(x, y, x + c * dx, y, 0.7);
      line(x, y, x, y + c * dy, 0.7);
    }

    // Depth ruler — the scale itself travels with scroll.
    const rx = m + 8;
    const top = m + 110;
    const bottom = h - m - 110;
    const off = sp * 640;
    if (bottom - top > 60) {
      line(rx, top, rx, bottom, 0.25);
      const first = Math.ceil((top + off) / 8) * 8;
      for (let v = first; v - off < bottom; v += 8) {
        const y = v - off;
        const major = v % 40 === 0;
        line(rx, y, rx + (major ? 8 : 4), y, major ? 0.6 : 0.3);
        if (major && w >= 640) text(String(v / 8).padStart(3, "0"), rx + 12, y + 3, 0.4, "left", WHITE, 8);
      }
      line(rx - 4, cy, rx + 14, cy, 0.95, SIGNAL);
    }

    const tx = m + 16;
    let ty = m + 22;
    const lh = 14;
    text(theme.header, tx, ty, 0.95);
    ty += lh;
    text(`MODE   ${theme.modes[sp > 0.04 ? 1 : 0]}`, tx, ty, 0.6);
    ty += lh;
    const open = rings.filter((_, i) => sp > i * 0.03 + 0.02).length;
    text(`LAYERS ${String(open).padStart(2, "0")}/${rings.length}`, tx, ty, 0.6);
    ty += lh;
    text(`EXPAND ${String(Math.round(sp * 100)).padStart(3, "0")}%`, tx, ty, 0.6);
    ty += 8;
    ctx.strokeStyle = rgba(WHITE, 0.5);
    ctx.strokeRect(tx + 0.5, ty + 0.5, 120, 4);
    ctx.fillStyle = rgba(WHITE, 0.9);
    ctx.fillRect(tx + 2, ty + 2, 117 * sp, 1.5);

    const rx2 = w - m - 16;
    let ry = m + 22;
    const secs = Math.floor(t);
    const clock = `${String(Math.floor(secs / 3600)).padStart(2, "0")}:${String(Math.floor(secs / 60) % 60).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}.${String(Math.floor((t % 1) * 100)).padStart(2, "0")}`;
    text(`T+ ${clock}`, rx2, ry, 0.95, "right");
    ry += lh;
    if (theme.vitals) drawVitals(t, rx2, ry, lh);
    else drawSignal(t, rx2, ry, lh);

    const locked = sp > 0.97;
    const status = theme.status[locked ? 1 : 0];
    if (locked || reduceMotion || Math.floor(t * 2.4) % 2 === 0) {
      text(status, cx, m + 22, 0.9, "center", locked ? SIGNAL : WHITE, 9);
    }

    if (w >= 640) {
      const bx = m + 16;
      if (theme.vitals) {
        drawEcg(t, bx, h - m - 44, Math.min(220, w * 0.22), 26);
      } else {
        let by = h - m - 50;
        const lat = 12.4 + Math.sin(t * 0.3) * 0.4;
        const lon = 48.1 + Math.cos(t * 0.23) * 0.4;
        text(`N 34°03'${lat.toFixed(1)}"`, bx, by, 0.6);
        by += lh;
        text(`W 118°14'${lon.toFixed(1)}"`, bx, by, 0.6);
        by += lh;
        text(`ALT ${(412.6 + e * 88).toFixed(1)} M`, bx, by, 0.6);
      }

      let hy = h - m - 64;
      for (let i = 0; i < hex.length; i++) {
        text(hex[i], w - m - 16, hy, 0.18 + (i / hex.length) * 0.5, "right", WHITE, 9);
        hy += 11;
      }
    }
  }

  function drawSignal(t, rx2, ry, lh) {
    const rec = reduceMotion || Math.floor(t * 1.6) % 2 === 0;
    text("REC", rx2, ry, 0.8, "right");
    if (rec) {
      ctx.fillStyle = rgba(SIGNAL, 0.95);
      ctx.beginPath();
      ctx.arc(rx2 - 30, ry - 3.5, 3, 0, TAU);
      ctx.fill();
    }
    ry += lh;
    text("SIG", rx2 - 40, ry, 0.6, "right");
    const bars = reduceMotion ? 3 : 2 + (Math.floor(t * 1.3) % 3);
    for (let b = 0; b < 4; b++) {
      const bh = 3 + b * 2;
      const bx = rx2 - 32 + b * 8;
      ctx.fillStyle = rgba(WHITE, b < bars ? 0.85 : 0.18);
      ctx.fillRect(bx, ry - bh, 5, bh);
    }
  }

  function drawVitals(t, rx2, ry, lh) {
    const p = pulseAt(t);
    const bpm = 72 + Math.round(Math.sin(t * 0.21) * 2);
    text(`HR ${String(bpm).padStart(3, "0")} BPM`, rx2, ry, 0.85, "right");
    ctx.fillStyle = rgba(HEART, 0.35 + p * 0.65);
    ctx.beginPath();
    ctx.arc(rx2 - 84, ry - 3.5, 2.5 + p * 1.5, 0, TAU);
    ctx.fill();
    ry += lh;
    const spo2 = 98 - (Math.floor(t * 0.4) % 3 === 0 ? 1 : 0);
    text(`SpO2 ${spo2}%`, rx2, ry, 0.6, "right");
    ry += lh;
    const resp = 14 + Math.round(Math.sin(t * 0.13));
    text(`RESP ${resp}/MIN  TEMP 36.8°C`, rx2, ry, 0.6, "right");
  }

  function drawEcg(t, x, y, width, height) {
    text("ECG  II  25 MM/S", x, y - height - 6, 0.55, "left", WHITE, 8);
    line(x, y, x + width, y, 0.12);
    const speed = width / (BEAT * 2.4);
    ctx.strokeStyle = rgba(HEART, 0.9);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let px = 0; px <= width; px += 1.5) {
      const at = t - (width - px) / speed;
      const ph = ((at / BEAT) % 1 + 1) % 1;
      const v = reduceMotion ? 0 : ecg(ph);
      const py = y - v * height;
      if (px === 0) ctx.moveTo(x + px, py);
      else ctx.lineTo(x + px, py);
    }
    ctx.stroke();
    ctx.lineWidth = 1;
    const headV = reduceMotion ? 0 : ecg(((t / BEAT) % 1 + 1) % 1);
    ctx.fillStyle = rgba(HEART, 0.95);
    ctx.beginPath();
    ctx.arc(x + width, y - headV * height, 2, 0, TAU);
    ctx.fill();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!running) {
      last = now;
      return;
    }
    if (!w) resize();
    if (!w) return;

    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = reduceMotion ? 0 : (now - start) / 1000;

    readScroll();
    sp += (target - sp) * (1 - Math.exp(-dt * 7));
    if (Math.abs(target - sp) < 1e-4) sp = target;
    const e = ease(sp);
    sy = 1 - 0.66 * e;
    backDim = 1 - 0.62 * e;

    if (!reduceMotion && now - hexAt > 140) {
      hexAt = now;
      hex.shift();
      hex.push(nextLine());
    }

    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1;

    const cx = w * 0.5;
    const cy = h * (0.47 - 0.08 * e);
    const R = Math.min(w * 0.4, h * 0.44);
    const sep = h * 0.04;
    const n = rings.length;
    const mid = (n - 1) / 2;
    const stagger = 0.03;
    const scrollRot = sp * Math.PI * 0.6;
    const beat = pulseAt(t);

    const layers = rings.map((ring, i) => {
      const k = ease(clamp((sp - i * stagger) / (1 - (n - 1) * stagger), 0, 1));
      return {
        ring,
        i,
        k,
        x: cx,
        y: cy + (i - mid) * sep * k,
        r: R * ring.r * (0.7 + 0.42 * k) * (1 + beat * 0.018 * (1 - i / n)),
        rot: scrollRot * (i % 2 ? 0.5 : -0.5) + t * ring.spin,
      };
    });

    drawChrome(t, cx, cy, e);

    if (e > 0.01) {
      const topY = layers[0].y - layers[0].r * sy - 30;
      const botY = layers[n - 1].y + layers[n - 1].r * sy + 30;
      ctx.setLineDash([3, 4]);
      line(cx, topY, cx, botY, 0.35 * e);
      ctx.setLineDash([]);
      for (const L of layers) line(cx - 3, L.y, cx + 3, L.y, 0.6 * e);
    }

    for (const L of layers) drawRing(L, t);
    drawBlips(layers, t);
    drawLeaders(layers, R, cx, cy, sep);
  }

  resize();
  window.addEventListener("resize", resize);

  const io = new IntersectionObserver(
    (entries) => {
      running = entries[0]?.isIntersecting ?? true;
    },
    { threshold: 0 }
  );
  io.observe(section);

  requestAnimationFrame(frame);
}
