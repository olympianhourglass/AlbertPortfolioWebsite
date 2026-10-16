// Breathing petals — layered Japanese washes that open and rest.

const section = document.getElementById("showcase-breath");
const canvas = section?.querySelector(".breath-canvas");

if (canvas && section) {
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  const ctx = canvas.getContext("2d", { alpha: true });

  const petals = [
    { a: -0.12, len: 1.08, w: 0.3, curl: 0.03, pal: 0, delay: 0.0 },
    { a: 1.18, len: 1.0, w: 0.28, curl: -0.04, pal: 1, delay: 0.07 },
    { a: 2.42, len: 1.12, w: 0.32, curl: 0.02, pal: 2, delay: 0.13 },
    { a: 3.68, len: 0.96, w: 0.27, curl: -0.05, pal: 3, delay: 0.04 },
    { a: 4.92, len: 1.06, w: 0.29, curl: 0.04, pal: 4, delay: 0.18 },
  ];

  const inner = [
    { a: 0.32, len: 0.52, w: 0.22, curl: 0.02, pal: 3, delay: 0.06 },
    { a: 1.9, len: 0.48, w: 0.2, curl: -0.03, pal: 1, delay: 0.16 },
    { a: 3.55, len: 0.54, w: 0.23, curl: 0.01, pal: 4, delay: 0.02 },
    { a: 5.05, len: 0.46, w: 0.19, curl: -0.02, pal: 2, delay: 0.2 },
  ];

  const palettes = [
    ["#2a4a6e", "#7f9bb8", "#f4ece0"],
    ["#c47a7a", "#efc8c2", "#fff8f3"],
    ["#5f7a52", "#c3c9a6", "#f3f0e2"],
    ["#b08a4a", "#e2c58a", "#f8f1de"],
    ["#6a5878", "#c6b4c9", "#f5eef3"],
  ];

  let w = 0;
  let h = 0;
  let dpr = 1;
  let running = true;
  let start = performance.now();

  function resize() {
    const nextW = section.clientWidth;
    const nextH = section.clientHeight;
    if (!nextW || !nextH) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = nextW;
    h = nextH;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function easeInOut(t) {
    return 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));
  }

  function breathAt(seconds, delay) {
    if (reduceMotion) return 0.42;
    const cycle = 9.6;
    const t = ((seconds / cycle + delay) % 1 + 1) % 1;
    if (t < 0.42) return easeInOut(t / 0.42);
    return 1 - easeInOut((t - 0.42) / 0.58);
  }

  function drawPetal(length, width, curl) {
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.bezierCurveTo(
      width * 0.55,
      length * 0.12,
      width * 1.12 + curl * 16,
      length * 0.48,
      curl * 10,
      length
    );
    ctx.bezierCurveTo(
      -width * 1.05 + curl * 8,
      length * 0.46,
      -width * 0.52,
      length * 0.12,
      0,
      6
    );
    ctx.closePath();
  }

  function paintPetal(p, size, breath, seconds, alpha) {
    const b = breathAt(seconds, p.delay);
    const open = 0.88 + breath * 0.14 + b * 0.06;
    const pal = palettes[p.pal];
    const len = size * p.len * open;
    const width = size * p.w * (0.92 + b * 0.12);

    ctx.save();
    ctx.rotate(p.a + (b - 0.5) * 0.04);
    drawPetal(len, width, p.curl);

    const g = ctx.createLinearGradient(0, 8, width * 0.2, len);
    g.addColorStop(0, hexAlpha(pal[0], 0.38 + b * 0.12));
    g.addColorStop(0.38, hexAlpha(pal[1], 0.48 + b * 0.1));
    g.addColorStop(1, hexAlpha(pal[2], 0.12 + b * 0.08));
    ctx.fillStyle = g;
    ctx.globalAlpha = alpha;
    ctx.filter = "blur(10px)";
    ctx.fill();
    ctx.filter = "none";
    ctx.globalAlpha = alpha * 0.72;
    ctx.fill();

    const edge = ctx.createLinearGradient(-width, len * 0.25, width, len * 0.7);
    edge.addColorStop(0, hexAlpha(pal[0], 0.18));
    edge.addColorStop(0.5, hexAlpha("#fff8ef", 0.0));
    edge.addColorStop(1, hexAlpha(pal[1], 0.14));
    ctx.fillStyle = edge;
    ctx.globalAlpha = alpha * 0.7;
    ctx.fill();
    ctx.restore();
  }

  function hexAlpha(hex, a) {
    const n = hex.replace("#", "");
    const r = parseInt(n.slice(0, 2), 16);
    const g = parseInt(n.slice(2, 4), 16);
    const b = parseInt(n.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  function paintBackground(breath) {
    const bg = ctx.createRadialGradient(
      w * 0.5,
      h * 0.46,
      Math.min(w, h) * 0.08,
      w * 0.5,
      h * 0.5,
      Math.max(w, h) * 0.72
    );
    bg.addColorStop(0, `rgba(255, 248, 240, ${0.35 + breath * 0.08})`);
    bg.addColorStop(0.35, "rgba(244, 232, 220, 0.18)");
    bg.addColorStop(0.7, "rgba(214, 196, 196, 0.22)");
    bg.addColorStop(1, "rgba(168, 184, 196, 0.28)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const wash = ctx.createLinearGradient(0, 0, w, h);
    wash.addColorStop(0, "rgba(90, 122, 158, 0.07)");
    wash.addColorStop(0.45, "rgba(255, 244, 232, 0)");
    wash.addColorStop(1, "rgba(196, 122, 122, 0.08)");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);
  }

  function paintShadow(cx, cy, size, breath) {
    ctx.save();
    ctx.translate(cx, cy + 28 + (1 - breath) * 8);
    ctx.scale(1.04 + breath * 0.05, 0.7);
    ctx.filter = "blur(46px)";
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.82, size * 0.6, 0.1, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(32, 40, 58, ${0.2 + breath * 0.07})`;
    ctx.fill();
    ctx.filter = "blur(22px)";
    ctx.beginPath();
    ctx.ellipse(10, 12, size * 0.46, size * 0.32, -0.1, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(92, 64, 72, 0.14)";
    ctx.fill();
    ctx.restore();
    ctx.filter = "none";
  }

  function paintCenter(size, breath) {
    ctx.save();
    ctx.filter = "blur(10px)";
    ctx.beginPath();
    ctx.arc(0, 0, size * (0.1 + breath * 0.03), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(242, 214, 168, ${0.28 + breath * 0.18})`;
    ctx.fill();
    ctx.filter = "none";
    ctx.beginPath();
    ctx.arc(0, -2, size * 0.045, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 248, 236, ${0.35 + breath * 0.2})`;
    ctx.fill();
    ctx.restore();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!running) return;
    const seconds = (now - start) / 1000;
    const breath = breathAt(seconds, 0);
    const size = Math.min(w, h) * 0.34;

    ctx.clearRect(0, 0, w, h);
    paintBackground(breath);

    const cx = w * 0.5;
    const cy = h * 0.44;
    paintShadow(cx, cy, size, breath);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.12 + breath * 0.04);
    for (const p of petals) paintPetal(p, size, breath, seconds, 0.78);
    for (const p of inner) paintPetal(p, size, breath, seconds, 0.7);
    paintCenter(size, breath);
    ctx.restore();
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
