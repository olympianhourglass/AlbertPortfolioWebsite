// Breathing petals — sakura wash, irregular organic forms.

const section = document.getElementById("showcase-breath");
const canvas = section?.querySelector(".breath-canvas");

if (canvas && section) {
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  const ctx = canvas.getContext("2d", { alpha: true });

  const pink = {
    deep: "#c45d6c",
    rose: "#e08a93",
    sakura: "#f3b8b8",
    pale: "#fbe0dc",
    paper: "#fff7f4",
  };

  const forms = [
    { type: "notch", x: -0.1, y: -0.16, a: -0.55, len: 1.28, w: 0.44, curl: 0.14, delay: 0.0, shade: 0 },
    { type: "cup", x: 0.12, y: -0.04, a: 0.72, len: 1.12, w: 0.56, curl: -0.1, delay: 0.08, shade: 1 },
    { type: "ribbon", x: 0.22, y: 0.12, a: 1.85, len: 1.42, w: 0.2, curl: 0.26, delay: 0.15, shade: 2 },
    { type: "fold", x: -0.02, y: 0.1, a: 3.05, len: 0.98, w: 0.4, curl: 0.08, delay: 0.04, shade: 1 },
    { type: "notch", x: -0.2, y: 0.08, a: 2.55, len: 0.82, w: 0.3, curl: -0.12, delay: 0.12, shade: 0 },
    { type: "ribbon", x: -0.18, y: -0.08, a: -1.25, len: 1.08, w: 0.16, curl: 0.2, delay: 0.2, shade: 2 },
    { type: "cup", x: 0.08, y: 0.2, a: 4.15, len: 0.7, w: 0.38, curl: -0.06, delay: 0.1, shade: 0 },
    { type: "splinter", x: 0.16, y: -0.18, a: 0.18, len: 0.78, w: 0.12, curl: 0.16, delay: 0.18, shade: 2 },
  ];

  const shades = [
    [pink.deep, pink.rose, pink.pale],
    [pink.rose, pink.sakura, pink.paper],
    [pink.sakura, pink.pale, pink.paper],
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

  function hexAlpha(hex, a) {
    const n = hex.replace("#", "");
    const r = parseInt(n.slice(0, 2), 16);
    const g = parseInt(n.slice(2, 4), 16);
    const b = parseInt(n.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  function drawNotch(length, width, curl, open) {
    const n = 0.14 + open * 0.07;
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.bezierCurveTo(width * 0.5, length * 0.1, width * 1.08 + curl * 12, length * 0.42, width * 0.42 + curl * 8, length * (0.86 - n * 0.2));
    ctx.quadraticCurveTo(width * 0.16, length * 0.7, curl * 4, length * 0.62);
    ctx.quadraticCurveTo(-width * 0.12, length * 0.7, -width * 0.4 + curl * 4, length * (0.86 - n * 0.2));
    ctx.bezierCurveTo(-width * 1.02 + curl * 8, length * 0.4, -width * 0.48, length * 0.1, 0, 4);
    ctx.closePath();
  }

  function drawCup(length, width, curl) {
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.bezierCurveTo(width * 0.7, length * 0.08, width * 1.2 + curl * 14, length * 0.5, curl * 8, length);
    ctx.bezierCurveTo(-width * 1.15 + curl * 10, length * 0.48, -width * 0.65, length * 0.08, 0, 6);
    ctx.closePath();
  }

  function drawRibbon(length, width, curl) {
    const s = curl * 58;
    ctx.beginPath();
    ctx.moveTo(-width * 0.15, 8);
    ctx.bezierCurveTo(width * 1.6 + s, length * 0.18, -width * 1.4 - s, length * 0.52, s * 0.55, length);
    ctx.bezierCurveTo(-width * 1.5 - s, length * 0.56, width * 0.7 + s, length * 0.22, width * 0.3, 12);
    ctx.closePath();
  }

  function drawFold(length, width, curl) {
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.bezierCurveTo(width * 0.85, length * 0.18, width * 0.95 + curl * 10, length * 0.55, curl * 6, length * 0.72);
    ctx.quadraticCurveTo(width * 0.12, length * 0.88, 0, length);
    ctx.quadraticCurveTo(-width * 0.2, length * 0.7, -width * 0.55, length * 0.5);
    ctx.bezierCurveTo(-width * 0.9, length * 0.22, -width * 0.3, length * 0.1, 0, 8);
    ctx.closePath();
  }

  function drawSplinter(length, width, curl) {
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.bezierCurveTo(width * 1.4, length * 0.3, width * 0.2 + curl * 20, length * 0.7, curl * 12, length);
    ctx.bezierCurveTo(-width * 0.4, length * 0.62, -width * 0.9, length * 0.22, 0, 10);
    ctx.closePath();
  }

  function pathFor(type, length, width, curl, open) {
    if (type === "notch") drawNotch(length, width, curl, open);
    else if (type === "ribbon") drawRibbon(length, width, curl);
    else if (type === "fold") drawFold(length, width, curl);
    else if (type === "splinter") drawSplinter(length, width, curl);
    else drawCup(length, width, curl);
  }

  function paintForm(p, size, breath, seconds) {
    const b = breathAt(seconds, p.delay);
    const unfurl = 0.86 + breath * 0.12 + b * 0.1;
    const pal = shades[p.shade];
    const len = size * p.len * unfurl;
    const width = size * p.w * (0.9 + b * 0.16);
    const curl = p.curl * (0.7 + b * 0.55);

    ctx.save();
    ctx.translate(p.x * size * 1.35, p.y * size * 1.25);
    ctx.rotate(p.a + (b - 0.5) * 0.08);
    pathFor(p.type, len, width, curl, b);

    const g = ctx.createLinearGradient(-width * 0.2, 0, width * 0.4, len);
    g.addColorStop(0, hexAlpha(pal[0], 0.42 + b * 0.12));
    g.addColorStop(0.4, hexAlpha(pal[1], 0.5 + b * 0.1));
    g.addColorStop(1, hexAlpha(pal[2], 0.14 + b * 0.08));
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.82;
    ctx.filter = "blur(5px)";
    ctx.fill();
    ctx.filter = "none";
    ctx.globalAlpha = 0.68;
    ctx.fill();

    const edge = ctx.createLinearGradient(-width, len * 0.2, width, len * 0.75);
    edge.addColorStop(0, hexAlpha(pink.deep, 0.16));
    edge.addColorStop(0.5, hexAlpha(pink.paper, 0));
    edge.addColorStop(1, hexAlpha(pink.rose, 0.12));
    ctx.fillStyle = edge;
    ctx.globalAlpha = 0.7;
    ctx.fill();
    ctx.restore();
  }

  function paintBackground(breath) {
    const bg = ctx.createRadialGradient(
      w * 0.5,
      h * 0.44,
      Math.min(w, h) * 0.06,
      w * 0.52,
      h * 0.5,
      Math.max(w, h) * 0.7
    );
    bg.addColorStop(0, `rgba(255, 246, 242, ${0.4 + breath * 0.1})`);
    bg.addColorStop(0.4, "rgba(250, 224, 218, 0.22)");
    bg.addColorStop(0.75, "rgba(236, 196, 196, 0.2)");
    bg.addColorStop(1, "rgba(224, 176, 178, 0.24)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }

  function paintShadow(cx, cy, size, breath) {
    ctx.save();
    ctx.translate(cx + 6, cy + 30 + (1 - breath) * 10);
    ctx.rotate(-0.08);
    ctx.scale(1.08 + breath * 0.06, 0.68);
    ctx.filter = "blur(48px)";
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.9, size * 0.58, 0.18, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(92, 42, 52, ${0.18 + breath * 0.07})`;
    ctx.fill();
    ctx.filter = "blur(20px)";
    ctx.beginPath();
    ctx.ellipse(18, 8, size * 0.4, size * 0.28, -0.2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(168, 88, 96, 0.12)";
    ctx.fill();
    ctx.restore();
    ctx.filter = "none";
  }

  function paintHeart(size, breath) {
    ctx.save();
    ctx.filter = "blur(12px)";
    ctx.beginPath();
    ctx.ellipse(0, 4, size * (0.09 + breath * 0.03), size * (0.07 + breath * 0.02), 0.2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 232, 228, ${0.4 + breath * 0.2})`;
    ctx.fill();
    ctx.filter = "none";
    ctx.beginPath();
    ctx.ellipse(-2, 2, size * 0.03, size * 0.024, 0.15, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 248, 246, ${0.45 + breath * 0.2})`;
    ctx.fill();
    ctx.restore();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!running) return;
    const seconds = (now - start) / 1000;
    const breath = breathAt(seconds, 0);
    const size = Math.min(w, h) * 0.36;

    ctx.clearRect(0, 0, w, h);
    paintBackground(breath);

    const cx = w * 0.5;
    const cy = h * 0.43;
    paintShadow(cx, cy, size, breath);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.08 + breath * 0.05);
    for (const p of forms) paintForm(p, size, breath, seconds);
    paintHeart(size, breath);
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
