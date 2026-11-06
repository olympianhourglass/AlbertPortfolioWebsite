// The Roster debrief printer — rebuilt to the original drawing.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Measured from the original: face 591×354, almost 50/50 split, bumper ~22px.
const FACE_W = 5.0;
const FACE_H = 3.0;
const B = 0.175;
const W = FACE_W + B * 2;
const H = FACE_H + B * 2;
const D = 0.94;
const OUTER_R = 0.615;
const INNER_R = 0.44;
const SPLIT = -0.04;
const SCREEN_W = 3.61;
const SCREEN_H = 0.89;
const SCREEN_X = 0.12;
const SCREEN_Y = 0.58;
const KNOB_X = -1.5;
const KNOB_Y = -0.82;
const KNOB_R = 0.54;
const MODEL_SCALE = 0.68;
const HAAS = '"Neue Haas Display"';
const MONO = '"SF Mono", ui-monospace, Menlo, monospace';

function roundedRect(w, h, r, cx = 0, cy = 0) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001);
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

function shapeMesh(shape, mat) {
  const geo = new THREE.ShapeGeometry(shape, 48);
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const w = Math.max(1e-6, bb.max.x - bb.min.x);
  const h = Math.max(1e-6, bb.max.y - bb.min.y);
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - bb.min.x) / w;
    uv[i * 2 + 1] = (pos.getY(i) - bb.min.y) / h;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

function canvasTex(draw, w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function roundPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

function receiptTexture() {
  return canvasTex((g, w, h) => {
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#111";
    g.font = `400 56px ${HAAS}`;
    g.fillText("Debrief", 64, 118);
    g.lineWidth = 2.4;
    g.strokeStyle = "#111";
    g.beginPath();
    g.moveTo(64, 148);
    g.lineTo(w - 64, 148);
    g.stroke();
    g.font = `400 46px ${HAAS}`;
    g.fillText("5 out of 5 stars", 64, 210);
    g.beginPath();
    g.moveTo(64, 240);
    g.lineTo(w - 64, 240);
    g.stroke();
    g.font = `400 38px ${HAAS}`;
    const lines = [
      "Bartholomew was everything I dreame-",
      "d of and more. He bought me flowers,",
      "dinner, and smelled nice. I wish we-",
    ];
    lines.forEach((line, i) => g.fillText(line, 64, 312 + i * 56));
    g.globalAlpha = 0.04;
    for (let i = 0; i < 1800; i++) {
      g.fillStyle = Math.random() > 0.5 ? "#000" : "#fff";
      g.fillRect(Math.random() * w, Math.random() * h, 2, 1);
    }
    g.globalAlpha = 1;
    // Cut edge at the top of the slip.
    g.fillStyle = "rgba(0,0,0,0.06)";
    for (let x = 0; x < w; x += 7) g.fillRect(x, 0, 4, 5);
  }, 1024, 768);
}

function paperBackTexture() {
  return canvasTex((g, w, h) => {
    g.fillStyle = "#f3f0ea";
    g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.05;
    for (let i = 0; i < 900; i++) {
      g.fillStyle = Math.random() > 0.5 ? "#000" : "#fff";
      g.fillRect(Math.random() * w, Math.random() * h, 2, 1);
    }
    g.globalAlpha = 1;
  }, 256, 512);
}

function makeScreenDisplay() {
  const w = 1536;
  const h = 420;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  const texture = new THREE.CanvasTexture(c);
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;

  function glyph(text, x, y) {
    g.shadowColor = "#3d9dff";
    g.shadowBlur = 26;
    g.fillStyle = "#5eb0ff";
    g.fillText(text, x, y);
    g.shadowBlur = 10;
    g.fillStyle = "#c5e4ff";
    g.fillText(text, x, y);
    g.shadowBlur = 0;
    g.fillStyle = "#eaf5ff";
    g.fillText(text, x, y);
  }

  function draw(cursorOn) {
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#0c1a2c");
    bg.addColorStop(0.45, "#070f1a");
    bg.addColorStop(1, "#050a12");
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);

    const wash = g.createRadialGradient(w * 0.4, h * 0.48, 0, w * 0.4, h * 0.48, w * 0.7);
    wash.addColorStop(0, "rgba(46, 120, 200, 0.28)");
    wash.addColorStop(0.55, "rgba(20, 60, 120, 0.1)");
    wash.addColorStop(1, "rgba(0, 0, 0, 0)");
    g.fillStyle = wash;
    g.fillRect(0, 0, w, h);

    g.fillStyle = "rgba(4, 10, 20, 0.38)";
    for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);

    g.globalAlpha = 0.045;
    for (let i = 0; i < 420; i++) {
      g.fillStyle = Math.random() > 0.55 ? "#8ec8ff" : "#000810";
      g.fillRect(Math.random() * w, Math.random() * h, 2, 1);
    }
    g.globalAlpha = 1;

    const vig = g.createRadialGradient(w / 2, h / 2, h * 0.18, w / 2, h / 2, w * 0.62);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.5)");
    g.fillStyle = vig;
    g.fillRect(0, 0, w, h);

    g.font = `400 88px ${MONO}`;
    g.textBaseline = "alphabetic";
    glyph("> print?", 72, 158);
    const yn = "y/n";
    glyph(yn, w - 72 - g.measureText(yn).width, 158);
    const line2 = "> y";
    glyph(line2, 72, 278);

    if (cursorOn) {
      const cx = 72 + g.measureText(line2).width + 16;
      g.shadowColor = "#4aa6ff";
      g.shadowBlur = 18;
      g.fillStyle = "#b7ddff";
      g.fillRect(cx, 216, 40, 74);
      g.shadowBlur = 0;
    }

    texture.needsUpdate = true;
  }

  draw(true);
  return { texture, draw };
}

function knobCapTexture() {
  return canvasTex((g, w) => {
    const cx = w / 2;
    const cy = w / 2;
    const outer = w * 0.5;
    g.clearRect(0, 0, w, w);
    // Knurled rim — fine radial teeth like the drawing.
    const teeth = 96;
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * Math.PI * 2;
      const a1 = ((i + 1) / teeth) * Math.PI * 2;
      g.fillStyle = i % 2 === 0 ? "#efefef" : "#5c5c5c";
      g.beginPath();
      g.moveTo(cx, cy);
      g.arc(cx, cy, outer, a0, a1);
      g.closePath();
      g.fill();
    }
    g.strokeStyle = "#1e2024";
    g.lineWidth = w * 0.02;
    g.beginPath();
    g.arc(cx, cy, outer - w * 0.008, 0, Math.PI * 2);
    g.stroke();
    const faceR = outer * 0.78;
    const rad = g.createRadialGradient(cx * 0.72, cy * 0.64, w * 0.02, cx, cy, faceR);
    rad.addColorStop(0, "#f3f3f3");
    rad.addColorStop(0.35, "#d0d0d0");
    rad.addColorStop(0.8, "#a7a7a7");
    rad.addColorStop(1, "#7a7a7a");
    g.fillStyle = rad;
    g.beginPath();
    g.arc(cx, cy, faceR, 0, Math.PI * 2);
    g.fill();
    const spec = g.createRadialGradient(cx * 0.68, cy * 0.62, 0, cx * 0.68, cy * 0.62, w * 0.2);
    spec.addColorStop(0, "rgba(255,255,255,0.75)");
    spec.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = spec;
    g.beginPath();
    g.arc(cx * 0.68, cy * 0.62, w * 0.2, 0, Math.PI * 2);
    g.fill();
  }, 1024, 1024);
}

function faceTexture() {
  return canvasTex((g, w, h) => {
    const r = (INNER_R / FACE_W) * w;
    roundPath(g, 0, 0, w, h, r);
    g.clip();

    const splitX = ((SPLIT + FACE_W / 2) / FACE_W) * w;

    const left = g.createLinearGradient(0, 0, 0, h);
    left.addColorStop(0, "#f6f8f5");
    left.addColorStop(0.22, "#e8eae7");
    left.addColorStop(0.5, "#ccd0cf");
    left.addColorStop(0.78, "#8e9296");
    left.addColorStop(1, "#7b8086");
    g.fillStyle = left;
    g.fillRect(0, 0, splitX, h);

    const leftSpec = g.createRadialGradient(w * 0.12, h * 0.08, 0, w * 0.12, h * 0.08, w * 0.55);
    leftSpec.addColorStop(0, "rgba(255,255,255,0.55)");
    leftSpec.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = leftSpec;
    g.fillRect(0, 0, splitX, h);

    const right = g.createLinearGradient(0, 0, 0, h);
    right.addColorStop(0, "#9b9ba3");
    right.addColorStop(0.18, "#8a8a94");
    right.addColorStop(0.48, "#74747e");
    right.addColorStop(0.72, "#4a4e58");
    right.addColorStop(1, "#2c2e3b");
    g.fillStyle = right;
    g.fillRect(splitX, 0, w - splitX, h);

    const rightEdge = g.createLinearGradient(splitX, 0, w, 0);
    rightEdge.addColorStop(0, "rgba(0,0,0,0.08)");
    rightEdge.addColorStop(0.55, "rgba(0,0,0,0)");
    rightEdge.addColorStop(0.82, "rgba(255,255,255,0.1)");
    rightEdge.addColorStop(1, "rgba(255,255,255,0.16)");
    g.fillStyle = rightEdge;
    g.fillRect(splitX, 0, w - splitX, h);

    // Hairline split.
    const seam = g.createLinearGradient(splitX - 6, 0, splitX + 6, 0);
    seam.addColorStop(0, "rgba(255,255,255,0)");
    seam.addColorStop(0.45, "rgba(255,255,255,0.35)");
    seam.addColorStop(0.5, "rgba(20,22,28,0.55)");
    seam.addColorStop(0.62, "rgba(0,0,0,0.28)");
    seam.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = seam;
    g.fillRect(splitX - 6, 0, 12, h);

    // Speaker slits — three hairlines just left of the split, under the screen.
    const slitX = [0.376, 0.403, 0.43];
    const slitTop = h * 0.46;
    const slitH = h * 0.22;
    slitX.forEach((u) => {
      const x = u * w;
      g.fillStyle = "rgba(40,44,48,0.28)";
      g.fillRect(x, slitTop, 3.2, slitH);
      g.fillStyle = "rgba(255,255,255,0.18)";
      g.fillRect(x + 3.2, slitTop, 1.2, slitH);
    });

    // Recessed well where the LCD sits.
    const sx = ((SCREEN_X - SCREEN_W / 2 + FACE_W / 2) / FACE_W) * w;
    const sy = ((FACE_H / 2 - SCREEN_Y - SCREEN_H / 2) / FACE_H) * h;
    const sw = (SCREEN_W / FACE_W) * w;
    const sh = (SCREEN_H / FACE_H) * h;
    g.fillStyle = "rgba(0,0,0,0.22)";
    roundPath(g, sx - 6, sy - 6, sw + 12, sh + 12, 10);
    g.fill();
    g.fillStyle = "#1c1c1e";
    roundPath(g, sx, sy, sw, sh, 8);
    g.fill();

    // Wordmark, right of the dial.
    g.fillStyle = "rgba(118,124,130,0.95)";
    g.font = `400 48px ${HAAS}`;
    g.fillText("the roster", w * 0.355, h * 0.88);

    // Heart, year, barcode on the dark half.
    const bx = w * 0.665;
    const by = h * 0.84;
    g.fillStyle = "rgba(220,224,230,0.95)";
    g.save();
    g.translate(bx, by);
    g.scale(1.55, 1.55);
    g.beginPath();
    g.moveTo(10, 6);
    g.bezierCurveTo(10, 1, 4, 1, 4, 6);
    g.bezierCurveTo(4, 11, 10, 16, 10, 20);
    g.bezierCurveTo(10, 16, 16, 11, 16, 6);
    g.bezierCurveTo(16, 1, 10, 1, 10, 6);
    g.fill();
    g.restore();
    g.font = `400 32px ${HAAS}`;
    g.fillText("2006", bx + 34, by + 24);
    let x = bx + 112;
    const pattern = [2, 1, 3, 1, 1, 2, 4, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 4, 1, 2, 1, 3, 2, 1, 2];
    pattern.forEach((n, i) => {
      if (i % 2 === 0) g.fillRect(x, by + 4, n * 2.4, 26);
      x += n * 2.4 + 1.5;
    });
    g.font = `400 22px ${HAAS}`;
    g.fillText("olympian hourglass", bx + 112, by + 48);

    // Contact shadow under the bumper lip.
    g.strokeStyle = "rgba(0,0,0,0.28)";
    g.lineWidth = 14;
    roundPath(g, 4, 4, w - 8, h - 8, r - 4);
    g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.2)";
    g.lineWidth = 3;
    roundPath(g, 8, 8, w - 16, h - 16, r - 8);
    g.stroke();
  }, 2048, 1229);
}

function pcbTexture() {
  return canvasTex((g, w, h) => {
    g.fillStyle = "#245c3c";
    g.fillRect(0, 0, w, h);
    const edge = g.createLinearGradient(0, 0, 0, 18);
    edge.addColorStop(0, "rgba(0,0,0,0.35)");
    edge.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = edge;
    g.fillRect(0, 0, w, 18);
    g.fillStyle = "#0f2a1c";
    roundPath(g, 18, 18, w - 36, h - 36, 28);
    g.fill();

    g.strokeStyle = "rgba(232, 186, 86, 0.85)";
    g.lineWidth = 2.4;
    for (let i = 0; i < 18; i++) {
      const y = 70 + i * 58;
      g.beginPath();
      g.moveTo(40, y);
      g.lineTo(w - 80, y + ((i % 3) - 1) * 16);
      g.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const x = 90 + i * 150;
      g.beginPath();
      g.moveTo(x, 50);
      g.lineTo(x + ((i % 2) ? 40 : -20), h - 60);
      g.stroke();
    }

    g.fillStyle = "rgba(212, 175, 90, 0.8)";
    for (let i = 0; i < 90; i++) {
      const x = 50 + (i * 97) % (w - 100);
      const y = 50 + (i * 53) % (h - 100);
      g.beginPath();
      g.arc(x, y, 3.2, 0, Math.PI * 2);
      g.fill();
    }

    g.fillStyle = "rgba(232, 228, 214, 0.78)";
    g.font = `400 22px ${MONO}`;
    g.fillText("THE ROSTER  ·  DEBRIEF I/O", 48, 64);
    g.font = `400 16px ${MONO}`;
    [
      ["U1  STM32H7", 48, 980],
      ["U4  FLASH", 400, 980],
      ["J2  HEAD", 48, 160],
      ["BT1  3V7", 720, 160],
      ["LS1", 900, 520],
      ["ENC1", 48, 720],
    ].forEach(([t, x, y]) => g.fillText(t, x, y));

    g.strokeStyle = "rgba(232, 228, 214, 0.25)";
    g.lineWidth = 1.5;
    roundPath(g, 36, 36, w - 72, h - 72, 22);
    g.stroke();
  }, 1024, 1024);
}

function matte(color, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.48,
    metalness: 0.12,
    ...extra,
  });
}

function chip(w, h, d, pins = 0) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new RoundedBoxGeometry(w, h, d, 1, 0.015),
    matte("#141416", { roughness: 0.42, metalness: 0.08 })
  );
  g.add(body);
  const mark = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.min(w, d) * 0.28, Math.min(w, d) * 0.28),
    matte("#c4a46a", { metalness: 0.85, roughness: 0.22 })
  );
  mark.rotation.x = -Math.PI / 2;
  mark.position.y = h / 2 + 0.001;
  g.add(mark);
  if (pins > 0) {
    const pin = new THREE.Mesh(
      new THREE.BoxGeometry(0.028, 0.012, 0.07),
      matte("#c9cdd2", { metalness: 0.88, roughness: 0.24 })
    );
    for (let i = 0; i < pins; i++) {
      const t = (i / Math.max(1, pins - 1) - 0.5) * (w - 0.05);
      const a = pin.clone();
      a.position.set(t, -h / 2 + 0.006, d / 2 + 0.028);
      g.add(a);
      const b = pin.clone();
      b.position.set(t, -h / 2 + 0.006, -d / 2 - 0.028);
      g.add(b);
    }
  }
  return g;
}

function buildInternals() {
  const g = new THREE.Group();
  const bw = FACE_W * 0.9;
  const bh = FACE_H * 0.84;

  const board = new THREE.Mesh(
    new RoundedBoxGeometry(bw, bh, 0.05, 3, 0.1),
    matte("#163822", { roughness: 0.55 })
  );
  g.add(board);
  const traces = new THREE.Mesh(
    new THREE.PlaneGeometry(bw - 0.06, bh - 0.06),
    matte("#1d4a32", { map: pcbTexture(), roughness: 0.38, metalness: 0.22 })
  );
  traces.position.z = 0.027;
  g.add(traces);
  const tracesBack = traces.clone();
  tracesBack.rotation.y = Math.PI;
  tracesBack.position.z = -0.027;
  g.add(tracesBack);

  const mcu = chip(1.05, 0.1, 1.05, 14);
  mcu.rotation.x = Math.PI / 2;
  mcu.position.set(0.7, 0.05, -0.08);
  g.add(mcu);
  const flash = chip(0.42, 0.06, 0.28, 6);
  flash.rotation.x = Math.PI / 2;
  flash.position.set(1.42, -0.35, -0.07);
  g.add(flash);
  const pmic = chip(0.32, 0.05, 0.22, 5);
  pmic.rotation.x = Math.PI / 2;
  pmic.position.set(1.35, 0.55, -0.07);
  g.add(pmic);

  const capMat = matte("#2a1a12", { roughness: 0.35 });
  const capTop = matte("#c5c8cc", { metalness: 0.7, roughness: 0.28 });
  [
    [1.85, 0.2],
    [1.7, -0.15],
    [1.9, -0.55],
    [-0.15, 0.7],
  ].forEach(([x, y]) => {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 14), capMat);
    can.rotation.x = Math.PI / 2;
    can.position.set(x, y, -0.16);
    g.add(can);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.01, 14), capTop);
    lid.rotation.x = Math.PI / 2;
    lid.position.set(x, y, -0.24);
    g.add(lid);
  });

  const battery = new THREE.Mesh(
    new RoundedBoxGeometry(1.55, 2.05, 0.32, 2, 0.08),
    new THREE.MeshPhysicalMaterial({
      color: "#cfd5dc",
      metalness: 0.72,
      roughness: 0.22,
      clearcoat: 0.4,
    })
  );
  battery.position.set(-1.38, -0.12, -0.22);
  g.add(battery);
  const tab = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.12, 0.02),
    matte("#d7b15a", { metalness: 0.8, roughness: 0.3 })
  );
  tab.position.set(-1.38, 0.98, -0.16);
  g.add(tab);

  const encoder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.42, 20),
    matte("#2b2e33", { metalness: 0.4, roughness: 0.35 })
  );
  encoder.rotation.x = Math.PI / 2;
  encoder.position.set(KNOB_X, KNOB_Y, 0.12);
  g.add(encoder);

  const speaker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, 0.1, 24),
    matte("#3a3d42", { metalness: 0.45, roughness: 0.4 })
  );
  speaker.rotation.x = Math.PI / 2;
  speaker.position.set(-0.42, -0.08, 0.16);
  g.add(speaker);
  const coil = new THREE.Mesh(
    new THREE.RingGeometry(0.08, 0.22, 24),
    matte("#c4a46a", { metalness: 0.7, roughness: 0.3 })
  );
  coil.position.set(-0.42, -0.08, 0.22);
  g.add(coil);

  const ribbonMat = matte("#d2a15a", { roughness: 0.45, metalness: 0.05 });
  const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.9, 0.012), ribbonMat);
  ribbon.position.set(SCREEN_X - 0.9, 0.35, 0.18);
  ribbon.rotation.x = -0.35;
  g.add(ribbon);
  const ribbon2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.012), ribbonMat);
  ribbon2.position.set(0.05, -0.15, 0.2);
  g.add(ribbon2);

  const usb = new THREE.Mesh(
    new RoundedBoxGeometry(0.12, 0.28, 0.18, 1, 0.02),
    matte("#c5c9ce", { metalness: 0.75, roughness: 0.25 })
  );
  usb.position.set(bw / 2 - 0.02, 0.15, 0.05);
  g.add(usb);

  const led = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.06, 0.04),
    new THREE.MeshBasicMaterial({ color: "#5dff9a" })
  );
  led.position.set(1.05, 0.85, 0.06);
  g.add(led);
  const glow = new THREE.PointLight("#5dff9a", 0.55, 1.6);
  glow.position.copy(led.position);
  g.add(glow);

  [
    [-2.05, 1.15],
    [2.05, 1.15],
    [-2.05, -1.15],
    [2.05, -1.15],
  ].forEach(([x, y]) => {
    const boss = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.22, 12),
      matte("#2c3036", { roughness: 0.5 })
    );
    boss.rotation.x = Math.PI / 2;
    boss.position.set(x, y, 0.02);
    g.add(boss);
  });

  g.position.z = -0.08;
  return g;
}

function shellMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: "#d5dde4",
    metalness: 0,
    roughness: 0.12,
    transmission: 0.94,
    thickness: 0.22,
    ior: 1.49,
    attenuationColor: new THREE.Color("#8d98a5"),
    attenuationDistance: 0.7,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    transparent: true,
    side: THREE.DoubleSide,
    envMapIntensity: 1.2,
  });
}

function rollEndTexture() {
  return canvasTex((g, w) => {
    const cx = w / 2;
    const cy = w / 2;
    g.fillStyle = "#e8e2d6";
    g.fillRect(0, 0, w, w);
    for (let i = 18; i >= 1; i--) {
      g.strokeStyle = i % 2 === 0 ? "rgba(120,110,95,0.22)" : "rgba(255,252,245,0.5)";
      g.lineWidth = w * 0.018;
      g.beginPath();
      g.arc(cx, cy, (i / 18) * w * 0.48, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = "#c4b496";
    g.beginPath();
    g.arc(cx, cy, w * 0.09, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#8a7a5c";
    g.beginPath();
    g.arc(cx, cy, w * 0.045, 0, Math.PI * 2);
    g.fill();
  }, 512, 512);
}

function buildPaperBay(paperW) {
  const g = new THREE.Group();
  const R = 0.19;
  const stock = new THREE.MeshStandardMaterial({
    color: "#f4efe6",
    roughness: 0.9,
    metalness: 0,
    envMapIntensity: 0.06,
  });
  const hard = new THREE.MeshStandardMaterial({
    color: "#141618",
    roughness: 0.5,
    metalness: 0.08,
  });

  const roll = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, paperW * 0.94, 48, 1, true),
    stock
  );
  roll.rotation.z = Math.PI / 2;
  g.add(roll);

  const capMap = rollEndTexture();
  const capMat = new THREE.MeshStandardMaterial({
    map: capMap,
    roughness: 0.85,
    metalness: 0,
  });
  [-1, 1].forEach((side) => {
    const cap = new THREE.Mesh(new THREE.CircleGeometry(R, 48), capMat);
    cap.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    cap.position.x = side * (paperW * 0.47);
    g.add(cap);
  });

  const axle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, paperW * 1.08, 12),
    matte("#9aa0a6", { metalness: 0.75, roughness: 0.28 })
  );
  axle.rotation.z = Math.PI / 2;
  g.add(axle);

  [-1, 1].forEach((side) => {
    const plate = new THREE.Mesh(
      new RoundedBoxGeometry(0.06, R * 2.15, R * 2.05, 1, 0.02),
      hard
    );
    plate.position.x = side * (paperW * 0.5 + 0.05);
    g.add(plate);
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.04, 14),
      matte("#c5c9ce", { metalness: 0.7, roughness: 0.3 })
    );
    hub.rotation.z = Math.PI / 2;
    hub.position.x = side * (paperW * 0.5 + 0.07);
    g.add(hub);
  });

  const tray = new THREE.Mesh(
    new THREE.CylinderGeometry(R + 0.04, R + 0.04, paperW * 0.9, 24, 1, true, Math.PI, Math.PI),
    hard
  );
  tray.rotation.z = Math.PI / 2;
  tray.position.y = -0.02;
  g.add(tray);

  const platen = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, paperW * 0.9, 18),
    rubberMat()
  );
  platen.rotation.z = Math.PI / 2;
  platen.position.set(0, R + 0.02, R * 0.35);
  g.add(platen);

  const feedH = 0.42;
  const feed = new THREE.Mesh(
    new THREE.BoxGeometry(paperW * 0.92, feedH, 0.007, 1, 8, 1),
    stock
  );
  feed.position.set(0, R + feedH / 2 - 0.02, R * 0.42);
  feed.rotation.x = -0.18;
  g.add(feed);

  return { group: g, radius: R };
}

function rubberMat() {
  return new THREE.MeshPhysicalMaterial({
    color: "#141516",
    roughness: 0.74,
    metalness: 0.03,
    clearcoat: 0.12,
    clearcoatRoughness: 0.55,
    envMapIntensity: 0.35,
  });
}

function buildPrintMouth(paperW) {
  const g = new THREE.Group();
  const rubber = rubberMat();
  const hard = new THREE.MeshStandardMaterial({
    color: "#0c0d0e",
    roughness: 0.48,
    metalness: 0.1,
  });

  const housing = new THREE.Mesh(
    new RoundedBoxGeometry(paperW + 0.32, 0.08, 0.3, 2, 0.035),
    hard
  );
  housing.position.y = -0.02;
  g.add(housing);

  const lipGeo = new THREE.CylinderGeometry(0.05, 0.05, paperW + 0.1, 24);
  const frontLip = new THREE.Mesh(lipGeo, rubber);
  frontLip.rotation.z = Math.PI / 2;
  frontLip.scale.set(1, 1, 0.5);
  frontLip.position.set(0, 0.034, 0.048);
  g.add(frontLip);
  const rearLip = new THREE.Mesh(lipGeo, rubber);
  rearLip.rotation.z = Math.PI / 2;
  rearLip.scale.set(1, 1, 0.5);
  rearLip.position.set(0, 0.034, -0.048);
  g.add(rearLip);

  const gasket = new THREE.Mesh(
    new THREE.BoxGeometry(paperW + 0.06, 0.022, 0.09),
    rubber
  );
  gasket.position.y = 0.058;
  g.add(gasket);

  const roller = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, paperW * 0.92, 20),
    rubber
  );
  roller.rotation.z = Math.PI / 2;
  roller.position.set(0, -0.02, 0);
  g.add(roller);

  const cheekGeo = new THREE.BoxGeometry(0.07, 0.12, 0.22);
  [-1, 1].forEach((side) => {
    const cheek = new THREE.Mesh(cheekGeo, hard);
    cheek.position.set(side * (paperW / 2 + 0.08), 0.01, 0);
    g.add(cheek);
  });

  return g;
}

function makePaperGeo(w, h, thick, segs) {
  const geo = new THREE.BoxGeometry(w, h, thick, 1, segs, 1);
  geo.translate(0, h / 2, 0);
  geo.userData.rest = new Float32Array(geo.attributes.position.array);
  geo.userData.height = h;
  return geo;
}

function bendPaper(geo, leanX, leanZ, time) {
  const rest = geo.userData.rest;
  const h = geo.userData.height;
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x0 = rest[i * 3];
    const y0 = rest[i * 3 + 1];
    const z0 = rest[i * 3 + 2];
    const t = THREE.MathUtils.clamp(y0 / h, 0, 1);
    const t2 = t * t;
    const t3 = t2 * t;
    const idle = 0.035 * t2 + 0.012 * t * Math.sin(t * Math.PI);
    const flutter = reduceMotion ? 0 : 0.01 * t2 * Math.sin(time * 2.1 + x0 * 3.4);
    pos.setXYZ(
      i,
      x0 + leanZ * t3 * h * 1.15,
      y0,
      z0 + idle + flutter - leanX * t3 * h * 1.05
    );
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

function bumperGeometry() {
  const shape = roundedRect(W, H, OUTER_R);
  const hole = new THREE.Path();
  const iw = FACE_W + 0.02;
  const ih = FACE_H + 0.02;
  const r = INNER_R;
  const x = -iw / 2;
  const y = -ih / 2;
  hole.moveTo(x + r, y);
  hole.absarc(x + r, y + r, r, -Math.PI / 2, Math.PI, true);
  hole.lineTo(x, y + ih - r);
  hole.absarc(x + r, y + ih - r, r, Math.PI, Math.PI / 2, true);
  hole.lineTo(x + iw - r, y + ih);
  hole.absarc(x + iw - r, y + ih - r, r, Math.PI / 2, 0, true);
  hole.lineTo(x + iw, y + r);
  hole.absarc(x + iw - r, y + r, r, 0, -Math.PI / 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: D,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.04,
    bevelSegments: 2,
    curveSegments: 28,
  });
  geo.translate(0, 0, -D / 2);
  geo.computeVertexNormals();
  return geo;
}

function studioEnv(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const bright = new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 7.8, 7.4), side: THREE.DoubleSide });
  const fillMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.7, 1.9), side: THREE.DoubleSide });
  const dim = new THREE.MeshBasicMaterial({ color: "#07080a", side: THREE.DoubleSide });
  const key = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), bright);
  key.position.set(-5, 7, 7);
  key.lookAt(0, 0, 0);
  envScene.add(key);
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), fillMat);
  fill.position.set(6, 3, 5);
  fill.lookAt(0, 0, 0);
  envScene.add(fill);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), bright);
  top.position.set(0, 9, 2);
  top.lookAt(0, 0, 0);
  envScene.add(top);
  for (const [x, y, z] of [[-9, 0, -2], [9, 0, 0], [0, -6, 2]]) {
    const card = new THREE.Mesh(new THREE.PlaneGeometry(6, 8), dim);
    card.position.set(x, y, z);
    card.lookAt(0, 0, 0);
    envScene.add(card);
  }
  return pmrem.fromScene(envScene, 0.04).texture;
}

function buildDevice() {
  const root = new THREE.Group();
  const zFront = D / 2;

  const internals = buildInternals();
  internals.traverse((obj) => {
    if (obj.isMesh) obj.castShadow = true;
  });
  root.add(internals);

  const body = new THREE.Mesh(
    bumperGeometry(),
    shellMaterial()
  );
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  const faceMap = faceTexture();
  faceMap.anisotropy = 8;
  const face = shapeMesh(
    roundedRect(FACE_W, FACE_H, INNER_R),
    new THREE.MeshPhysicalMaterial({
      map: faceMap,
      roughness: 0.18,
      metalness: 0,
      transmission: 0.38,
      thickness: 0.08,
      ior: 1.5,
      transparent: true,
      side: THREE.FrontSide,
      envMapIntensity: 0.35,
    })
  );
  face.position.z = zFront + 0.006;
  face.renderOrder = 1;
  face.castShadow = true;
  face.receiveShadow = true;
  root.add(face);

  const well = shapeMesh(
    roundedRect(SCREEN_W + 0.05, SCREEN_H + 0.05, 0.035),
    new THREE.MeshStandardMaterial({ color: "#07080c", roughness: 0.42, metalness: 0.18 })
  );
  well.position.set(SCREEN_X, SCREEN_Y, zFront + 0.01);
  well.renderOrder = 2;
  root.add(well);

  const screen = makeScreenDisplay();
  const lcd = shapeMesh(
    roundedRect(SCREEN_W, SCREEN_H, 0.025),
    new THREE.MeshBasicMaterial({
      map: screen.texture,
      toneMapped: false,
    })
  );
  lcd.position.set(SCREEN_X, SCREEN_Y, zFront + 0.016);
  lcd.renderOrder = 3;
  root.add(lcd);

  const polarizer = shapeMesh(
    roundedRect(SCREEN_W, SCREEN_H, 0.03),
    new THREE.MeshPhysicalMaterial({
      color: "#17304c",
      metalness: 0.05,
      roughness: 0.18,
      transparent: true,
      opacity: 0.16,
      envMapIntensity: 0.35,
    })
  );
  polarizer.position.set(SCREEN_X, SCREEN_Y, zFront + 0.019);
  polarizer.renderOrder = 4;
  root.add(polarizer);

  const glass = shapeMesh(
    roundedRect(SCREEN_W + 0.012, SCREEN_H + 0.012, 0.04),
    new THREE.MeshPhysicalMaterial({
      color: "#c5dcff",
      metalness: 0.04,
      roughness: 0.03,
      transparent: true,
      opacity: 0.12,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      envMapIntensity: 1.15,
    })
  );
  glass.position.set(SCREEN_X, SCREEN_Y, zFront + 0.023);
  glass.renderOrder = 5;
  root.add(glass);

  const screenGlow = new THREE.PointLight("#5aa8ff", 1.05, 2.15);
  screenGlow.position.set(SCREEN_X, SCREEN_Y, zFront + 0.32);
  root.add(screenGlow);

  const paperW = SCREEN_W * 0.92;
  const paperH = 1.58;
  const paperT = 0.008;
  const mouth = buildPrintMouth(paperW);
  mouth.position.set(SCREEN_X, H / 2 + 0.02, 0.04);
  root.add(mouth);

  const bay = buildPaperBay(paperW);
  bay.group.position.set(SCREEN_X, 1.08, 0.02);
  root.add(bay.group);

  const paperGeo = makePaperGeo(paperW, paperH, paperT, 28);
  const paperEdge = new THREE.MeshStandardMaterial({
    color: "#efebe3",
    roughness: 0.92,
    metalness: 0,
    envMapIntensity: 0.04,
  });
  const paperFront = new THREE.MeshStandardMaterial({
    map: receiptTexture(),
    roughness: 0.9,
    metalness: 0,
    envMapIntensity: 0.05,
  });
  const paperRear = new THREE.MeshStandardMaterial({
    map: paperBackTexture(),
    roughness: 0.94,
    metalness: 0,
    envMapIntensity: 0.04,
  });
  const paper = new THREE.Mesh(paperGeo, [
    paperEdge,
    paperEdge,
    paperEdge,
    paperEdge,
    paperFront,
    paperRear,
  ]);
  paper.castShadow = true;
  paper.receiveShadow = true;
  paper.position.set(SCREEN_X, H / 2 + 0.04, 0.04);
  root.add(paper);
  bendPaper(paperGeo, 0, 0, 0);

  const knob = new THREE.Group();
  const alum = new THREE.MeshPhysicalMaterial({
    color: "#c4c4c4",
    metalness: 0.55,
    roughness: 0.28,
    clearcoat: 0.45,
    clearcoatRoughness: 0.22,
    envMapIntensity: 0.85,
  });
  const darkRing = new THREE.Mesh(
    new THREE.CylinderGeometry(KNOB_R + 0.03, KNOB_R + 0.03, 0.03, 80),
    new THREE.MeshStandardMaterial({ color: "#2a2c30", roughness: 0.5, metalness: 0.2 })
  );
  darkRing.rotation.x = Math.PI / 2;
  darkRing.position.z = -0.01;
  knob.add(darkRing);

  const rim = new THREE.Mesh(new THREE.CylinderGeometry(KNOB_R, KNOB_R, 0.05, 80, 1, true), alum);
  rim.rotation.x = Math.PI / 2;
  knob.add(rim);

  const capMap = knobCapTexture();
  capMap.anisotropy = 8;
  const cap = new THREE.Mesh(
    new THREE.CircleGeometry(KNOB_R, 80),
    new THREE.MeshBasicMaterial({ map: capMap })
  );
  cap.position.z = 0.04;
  knob.add(cap);
  knob.position.set(KNOB_X, KNOB_Y, zFront + 0.03);
  root.add(knob);

  const brush = canvasTex((g, w, h) => {
    g.fillStyle = "#c8ccd1";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 520; i++) {
      const y = Math.random() * h;
      const lite = Math.random() > 0.5;
      g.strokeStyle = lite ? "rgba(255,255,255,0.18)" : "rgba(70,74,80,0.16)";
      g.lineWidth = 0.6 + Math.random();
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y + (Math.random() - 0.5) * 3);
      g.stroke();
    }
  }, 256, 512);
  const brushRough = canvasTex((g, w, h) => {
    g.fillStyle = "#6a6a6a";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 420; i++) {
      const y = Math.random() * h;
      g.strokeStyle = Math.random() > 0.5 ? "#9a9a9a" : "#4a4a4a";
      g.lineWidth = 0.5 + Math.random();
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y + (Math.random() - 0.5) * 2);
      g.stroke();
    }
  }, 256, 512);
  brushRough.colorSpace = THREE.NoColorSpace;
  const steel = new THREE.MeshPhysicalMaterial({
    color: "#e8ebef",
    map: brush,
    roughnessMap: brushRough,
    metalness: 0.74,
    roughness: 0.32,
    clearcoat: 0.72,
    clearcoatRoughness: 0.12,
    envMapIntensity: 0.62,
    emissive: "#6e737a",
    emissiveIntensity: 0.1,
  });
  const btnLen = 0.5;
  const btnFace = 0.05;
  const btnOut = 0.055;
  const stadium = roundedRect(btnFace, btnLen, btnFace / 2);
  const btnGeo = new THREE.ExtrudeGeometry(stadium, {
    depth: btnOut,
    bevelEnabled: true,
    bevelThickness: 0.0025,
    bevelSize: 0.0015,
    bevelSegments: 4,
    curveSegments: 28,
  });
  btnGeo.rotateY(Math.PI / 2);
  btnGeo.center();
  btnGeo.computeVertexNormals();
  const yLow = -H / 2 + OUTER_R + 0.2 + btnLen / 2;
  const yGap = 0.14;
  [yLow + btnLen + yGap, yLow].forEach((y) => {
    const btn = new THREE.Mesh(btnGeo, steel);
    btn.position.set(W / 2 + btnOut / 2 - 0.008, y, 0);
    btn.castShadow = true;
    root.add(btn);
  });
  const glint = new THREE.PointLight("#f4f1ec", 1.2, 1.55);
  glint.position.set(W / 2 + 0.38, yLow + btnLen / 2 + yGap / 2, 0.42);
  root.add(glint);

  let cursorLit = true;
  function tickScreen(t) {
    const on = reduceMotion ? true : t % 1.06 < 0.56;
    if (on === cursorLit) return;
    cursorLit = on;
    screen.draw(on);
  }

  return { root, paper, paperGeo, knob, tickScreen };
}

async function initRoster(section) {
  const canvas = section.querySelector(".roster-canvas");
  if (!canvas) return;
  try {
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load(`400 56px ${HAAS}`),
      document.fonts.load(`400 88px ${MONO}`),
    ]);
  } catch (_) {
    /* Draw with fallbacks if the face files are still on their way. */
  }
  try {
    bootRoster(section, canvas);
  } catch (err) {
    window.__rosterError = String(err && err.stack ? err.stack : err);
    console.error("roster", err);
  }
}

function bootRoster(section, canvas) {

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#000000");
  scene.environment = studioEnv(renderer);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 40);
  const { root, paper, paperGeo, knob, tickScreen } = buildDevice();
  root.scale.setScalar(MODEL_SCALE);
  scene.add(root);

  const key = new THREE.DirectionalLight("#fff7ef", 2.4);
  key.position.set(-5.2, 6.4, 7.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 20;
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -6;
  key.shadow.bias = -0.0004;
  scene.add(key);
  scene.add(new THREE.HemisphereLight("#d7e0ec", "#0a0b0d", 0.4));
  const rim = new THREE.DirectionalLight("#c5d0de", 0.55);
  rim.position.set(5.5, 1.8, -3.5);
  scene.add(rim);
  const fill = new THREE.DirectionalLight("#e8eef6", 0.45);
  fill.position.set(3.5, 2.4, 5);
  scene.add(fill);
  const cavity = new THREE.PointLight("#e4ecf6", 1.8, 5);
  cavity.position.set(0.2, 0.1, -0.15);
  root.add(cavity);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(3.6, 48),
    new THREE.ShadowMaterial({ opacity: 0.5 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -H * MODEL_SCALE / 2 - 0.02;
  floor.receiveShadow = true;
  scene.add(floor);

  let yaw = 0.62;
  let pitch = 0.16;
  let tyaw = yaw;
  let tpitch = pitch;
  let dragging = false;
  let held = false;
  let lastX = 0;
  let lastY = 0;
  let running = true;

  function placeCamera() {
    const r = 9.2;
    const e = pitch;
    camera.position.set(
      Math.sin(yaw) * Math.cos(e) * r,
      Math.sin(e) * r + 0.12,
      Math.cos(yaw) * Math.cos(e) * r
    );
    camera.lookAt(0, 0.58, 0);
  }

  function resize() {
    const w = section.clientWidth;
    const h = section.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1 ? 40 : 30;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    held = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    tyaw -= (e.clientX - lastX) * 0.005;
    tpitch = THREE.MathUtils.clamp(
      tpitch + (e.clientY - lastY) * 0.004,
      -Math.PI / 2 + 0.08,
      Math.PI / 2 - 0.08
    );
    lastX = e.clientX;
    lastY = e.clientY;
  });
  const endDrag = () => {
    dragging = false;
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  const io = new IntersectionObserver(
    (entries) => {
      const e = entries[0];
      const seen = e
        ? e.intersectionRect.height / Math.max(1, Math.min(e.rootBounds?.height || 1, e.boundingClientRect.height))
        : 1;
      running = !!e?.isIntersecting && seen > 0.12;
    },
    { threshold: [0, 0.1, 0.2, 0.5, 1] }
  );
  io.observe(section);

  const clock = new THREE.Clock();
  let lastYaw = yaw;
  let lastPitch = pitch;
  let yawVel = 0;
  let pitchVel = 0;
  let leanX = 0;
  let leanZ = 0;
  let leanXVel = 0;
  let leanZVel = 0;
  function loop() {
    requestAnimationFrame(loop);
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05) || 0.016;
    const t = clock.elapsedTime;
    if (!dragging && !held && !reduceMotion) {
      tyaw = 0.55 + Math.sin(t * 0.16) * 0.42;
      tpitch = 0.14 + Math.sin(t * 0.13) * 0.05;
    }
    yaw += (tyaw - yaw) * 0.08;
    pitch += (tpitch - pitch) * 0.08;
    yawVel += ((yaw - lastYaw) / dt - yawVel) * 0.4;
    pitchVel += ((pitch - lastPitch) / dt - pitchVel) * 0.4;
    lastYaw = yaw;
    lastPitch = pitch;
    const targetZ = THREE.MathUtils.clamp(-yawVel * 0.14, -0.2, 0.2);
    const targetX = THREE.MathUtils.clamp(pitchVel * 0.12, -0.16, 0.16);
    const stiff = 26;
    const damp = 6.5;
    leanZVel += ((targetZ - leanZ) * stiff - leanZVel * damp) * dt;
    leanXVel += ((targetX - leanX) * stiff - leanXVel * damp) * dt;
    leanZ += leanZVel * dt;
    leanX += leanXVel * dt;
    knob.rotation.z = t * 0.16;
    tickScreen(t);
    if (!reduceMotion) bendPaper(paperGeo, leanX, leanZ, t);
    placeCamera();
    renderer.render(scene, camera);
  }
  placeCamera();
  renderer.render(scene, camera);
  loop();
}

document.querySelectorAll(".showcase-roster").forEach(initRoster);
