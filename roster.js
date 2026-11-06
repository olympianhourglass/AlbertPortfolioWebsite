// The Roster debrief printer — rebuilt to the original drawing.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Measured from the original: face 591×354, almost 50/50 split, bumper ~22px.
const FACE_W = 5.0;
const FACE_H = 3.0;
const B = 0.2;
const W = FACE_W + B * 2;
const H = FACE_H + B * 2;
const D = 0.94;
const OUTER_R = 0.64;
const INNER_R = 0.44;
const SPLIT = -0.04;
const SCREEN_W = 3.61;
const SCREEN_H = 0.89;
const SCREEN_X = 0.12;
const SCREEN_Y = 0.58;
const KNOB_X = -1.5;
const KNOB_Y = -0.9;
const KNOB_R = 0.54;
const MODEL_SCALE = 0.68;

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
    g.font = '400 56px "Neue Haas Display", sans-serif';
    g.fillText("Debrief", 64, 118);
    g.lineWidth = 2.4;
    g.strokeStyle = "#111";
    g.beginPath();
    g.moveTo(64, 148);
    g.lineTo(w - 64, 148);
    g.stroke();
    g.font = '400 46px "Neue Haas Display", sans-serif';
    g.fillText("5 out of 5 stars", 64, 210);
    g.beginPath();
    g.moveTo(64, 240);
    g.lineTo(w - 64, 240);
    g.stroke();
    g.font = '400 38px "Neue Haas Display", sans-serif';
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
  }, 1024, 768);
}

function screenTexture() {
  return canvasTex((g, w, h) => {
    g.fillStyle = "#2c2c2e";
    g.fillRect(0, 0, w, h);
    const inset = g.createLinearGradient(0, 0, 0, h);
    inset.addColorStop(0, "rgba(0,0,0,0.35)");
    inset.addColorStop(0.18, "rgba(0,0,0,0)");
    inset.addColorStop(1, "rgba(0,0,0,0.08)");
    g.fillStyle = inset;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#f3f3f3";
    g.font = '400 88px "SF Mono", ui-monospace, Menlo, monospace';
    g.fillText("> print?", 72, 158);
    const yn = "y/n";
    g.fillText(yn, w - 72 - g.measureText(yn).width, 158);
    g.fillText("> y", 72, 278);
  }, 1536, 420);
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
    g.font = '400 48px "Neue Haas Display", sans-serif';
    g.fillText("the roster", w * 0.355, h * 0.915);

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
    g.font = '400 32px "Neue Haas Display", sans-serif';
    g.fillText("2006", bx + 34, by + 24);
    let x = bx + 112;
    const pattern = [2, 1, 3, 1, 1, 2, 4, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 4, 1, 2, 1, 3, 2, 1, 2];
    pattern.forEach((n, i) => {
      if (i % 2 === 0) g.fillRect(x, by + 4, n * 2.4, 26);
      x += n * 2.4 + 1.5;
    });
    g.font = '400 22px "Neue Haas Display", sans-serif';
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
    g.font = "600 22px 'SF Mono', ui-monospace, Menlo, monospace";
    g.fillText("THE ROSTER  ·  DEBRIEF I/O", 48, 64);
    g.font = "500 16px 'SF Mono', ui-monospace, Menlo, monospace";
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

  const head = new THREE.Mesh(
    new RoundedBoxGeometry(SCREEN_W * 0.92, 0.14, 0.22, 1, 0.02),
    matte("#1a1c1f", { metalness: 0.35, roughness: 0.32 })
  );
  head.position.set(SCREEN_X, 1.22, 0.12);
  g.add(head);
  const gold = new THREE.Mesh(
    new THREE.BoxGeometry(SCREEN_W * 0.86, 0.03, 0.16),
    matte("#d7b15a", { metalness: 0.88, roughness: 0.2 })
  );
  gold.position.set(SCREEN_X, 1.28, 0.12);
  g.add(gold);
  const roller = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, SCREEN_W * 0.9, 18),
    matte("#2a2422", { roughness: 0.7 })
  );
  roller.rotation.z = Math.PI / 2;
  roller.position.set(SCREEN_X, 1.12, 0.02);
  g.add(roller);

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
    roundedRect(SCREEN_W + 0.04, SCREEN_H + 0.04, 0.03),
    new THREE.MeshStandardMaterial({ color: "#141416", roughness: 0.55, metalness: 0.1 })
  );
  well.position.set(SCREEN_X, SCREEN_Y, zFront + 0.01);
  well.renderOrder = 2;
  root.add(well);

  const lcd = shapeMesh(
    roundedRect(SCREEN_W, SCREEN_H, 0.025),
    new THREE.MeshBasicMaterial({ map: screenTexture() })
  );
  lcd.position.set(SCREEN_X, SCREEN_Y, zFront + 0.018);
  lcd.renderOrder = 3;
  root.add(lcd);

  const glass = shapeMesh(
    roundedRect(SCREEN_W, SCREEN_H, 0.04),
    new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      metalness: 0.1,
      roughness: 0.06,
      transparent: true,
      opacity: 0.06,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      envMapIntensity: 0.5,
    })
  );
  glass.position.set(SCREEN_X, SCREEN_Y, zFront + 0.022);
  glass.renderOrder = 4;
  root.add(glass);

  const slot = new THREE.Mesh(
    new THREE.BoxGeometry(SCREEN_W * 0.98, 0.055, 0.16),
    new THREE.MeshStandardMaterial({ color: "#050506", roughness: 0.7 })
  );
  slot.position.set(SCREEN_X, H / 2 - 0.155, 0.18);
  root.add(slot);

  const paperW = SCREEN_W * 0.99;
  const paperH = 1.62;
  const paperGeo = new THREE.PlaneGeometry(paperW, paperH, 1, 20);
  const ppos = paperGeo.attributes.position;
  for (let i = 0; i < ppos.count; i++) {
    const y = ppos.getY(i);
    const t = (y + paperH / 2) / paperH;
    ppos.setZ(i, 0.008 * t + 0.02 * t * t);
  }
  paperGeo.computeVertexNormals();
  const paper = new THREE.Mesh(
    paperGeo,
    new THREE.MeshBasicMaterial({
      map: receiptTexture(),
    })
  );
  paper.position.set(SCREEN_X, H / 2 + paperH / 2 - 0.16, zFront + 0.04);
  paper.castShadow = true;
  root.add(paper);
  const paperBack = new THREE.Mesh(
    paperGeo,
    new THREE.MeshStandardMaterial({ color: "#f4f4f4", roughness: 0.95, metalness: 0, envMapIntensity: 0.04 })
  );
  paperBack.rotation.y = Math.PI;
  paperBack.position.copy(paper.position);
  paperBack.position.z -= 0.004;
  root.add(paperBack);

  const paperShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(paperW * 1.02, 0.22),
    new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.22 })
  );
  paperShadow.position.set(SCREEN_X, H / 2 - 0.02, zFront + 0.03);
  root.add(paperShadow);

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

  const rubber = new THREE.MeshStandardMaterial({ color: "#15171a", roughness: 0.7, metalness: 0.05 });
  [
    [0.18, 0.07],
    [-0.32, 0.07],
  ].forEach(([y, r]) => {
    const btn = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 16), rubber);
    btn.scale.set(0.55, 1, 1);
    btn.position.set(W / 2 + 0.01, y, 0);
    root.add(btn);
  });

  return { root, paper, knob };
}

async function initRoster(section) {
  const canvas = section.querySelector(".roster-canvas");
  if (!canvas) return;
  try {
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load('400 56px "Neue Haas Display"'),
      document.fonts.load('400 88px "SF Mono"'),
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
  const { root, paper, knob } = buildDevice();
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
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    tyaw -= (e.clientX - lastX) * 0.005;
    tpitch = THREE.MathUtils.clamp(tpitch + (e.clientY - lastY) * 0.004, 0.04, 0.7);
    lastX = e.clientX;
    lastY = e.clientY;
  });
  canvas.addEventListener("pointerup", () => {
    dragging = false;
  });

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
  function loop() {
    requestAnimationFrame(loop);
    if (!running) return;
    clock.getDelta();
    const t = clock.elapsedTime;
    if (!dragging && !reduceMotion) {
      tyaw = 0.55 + Math.sin(t * 0.16) * 0.42;
      tpitch = 0.14 + Math.sin(t * 0.13) * 0.05;
    }
    yaw += (tyaw - yaw) * 0.08;
    pitch += (tpitch - pitch) * 0.08;
    knob.rotation.z = t * 0.16;
    paper.rotation.z = reduceMotion ? 0 : Math.sin(t * 0.32) * 0.01;
    placeCamera();
    renderer.render(scene, camera);
  }
  placeCamera();
  renderer.render(scene, camera);
  loop();
}

document.querySelectorAll(".showcase-roster").forEach(initRoster);
