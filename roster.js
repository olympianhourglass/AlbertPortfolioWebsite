// The Roster debrief printer — a pocket terminal that commits a rating to thermal paper.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const W = 4.7;
const H = 2.72;
const D = 0.78;
const R = 0.58;

function roundedRect(w, h, r, cx = 0, cy = 0) {
  const x = cx - w / 2;
  const y = cy - h / 2;
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

function plate(w, h, r, depth, bevel = 0.03) {
  const shape = roundedRect(w - bevel * 2, h - bevel * 2, Math.max(0.02, r - bevel));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, depth - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 28,
  });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

function canvasTex(draw, w = 1024, h = 1024) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h, c);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function receiptTexture() {
  return canvasTex((g, w, h) => {
    g.fillStyle = "#f4f1ea";
    g.fillRect(0, 0, w, h);
    // Thermal tooth along the top edge.
    g.fillStyle = "#efece4";
    for (let x = 0; x < w; x += 10) {
      g.fillRect(x, 0, 5, 6);
    }
    g.fillStyle = "#1a1a1a";
    g.font = "500 54px 'Neue Haas Display', 'Times New Roman', serif";
    g.fillText("Debrief", 64, 120);
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(64, 158);
    g.lineTo(w - 64, 158);
    g.stroke();
    g.font = "400 48px 'Neue Haas Display', 'Times New Roman', serif";
    g.fillText("5 out of 5 stars", 64, 230);
    g.beginPath();
    g.moveTo(64, 268);
    g.lineTo(w - 64, 268);
    g.stroke();
    g.font = "400 40px 'Neue Haas Display', 'Times New Roman', serif";
    const lines = [
      "Bartholomew was everything I dreame-",
      "d of and more. He bought me flowers,",
      "dinner, and smelled nice. I wish we-",
    ];
    lines.forEach((line, i) => g.fillText(line, 64, 360 + i * 58));
    // Fibre in the stock.
    g.globalAlpha = 0.035;
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = Math.random() > 0.5 ? "#000" : "#fff";
      g.fillRect(Math.random() * w, Math.random() * h, 2, 1);
    }
    g.globalAlpha = 1;
  }, 768, 1024);
}

function screenTexture() {
  return canvasTex((g, w, h) => {
    g.fillStyle = "#1c1f24";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#eef0f3";
    g.font = "600 96px 'SF Mono', ui-monospace, Menlo, monospace";
    g.fillText("> print?   y/n", 70, 160);
    g.fillText("> y", 70, 280);
  }, 1024, 384);
}

function knobTexture() {
  return canvasTex((g, w) => {
    const cx = w / 2;
    const cy = w / 2;
    const rad = g.createRadialGradient(cx * 0.78, cy * 0.72, w * 0.04, cx, cy, w * 0.5);
    rad.addColorStop(0, "#f5f6f8");
    rad.addColorStop(0.45, "#c9ccd1");
    rad.addColorStop(1, "#7c8188");
    g.fillStyle = rad;
    g.fillRect(0, 0, w, w);
    g.strokeStyle = "rgba(30,32,36,0.22)";
    for (let r = w * 0.07; r < w * 0.46; r += w * 0.028) {
      g.lineWidth = r < w * 0.2 ? 1.2 : 1.6;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
    }
    const spec = g.createRadialGradient(cx * 0.72, cy * 0.68, 0, cx * 0.72, cy * 0.68, w * 0.18);
    spec.addColorStop(0, "rgba(255,255,255,0.55)");
    spec.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = spec;
    g.beginPath();
    g.arc(cx * 0.72, cy * 0.68, w * 0.18, 0, Math.PI * 2);
    g.fill();
  }, 512, 512);
}

function faceTexture() {
  return canvasTex((g, w, h) => {
    const split = w * 0.44;
    const left = g.createLinearGradient(0, 0, split, 0);
    left.addColorStop(0, "#dfe3e8");
    left.addColorStop(1, "#c9ced4");
    g.fillStyle = left;
    g.fillRect(0, 0, split, h);
    const right = g.createLinearGradient(split, 0, w, 0);
    right.addColorStop(0, "#1a1d22");
    right.addColorStop(1, "#121418");
    g.fillStyle = right;
    g.fillRect(split, 0, w - split, h);
    const seam = g.createLinearGradient(split - 10, 0, split + 10, 0);
    seam.addColorStop(0, "rgba(255,255,255,0)");
    seam.addColorStop(0.45, "rgba(255,255,255,0.28)");
    seam.addColorStop(0.55, "rgba(0,0,0,0.25)");
    seam.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = seam;
    g.fillRect(split - 10, 0, 20, h);
    // Speaker slits.
    g.fillStyle = "rgba(70,76,82,0.7)";
    for (let i = 0; i < 3; i++) g.fillRect(split - 78 + i * 14, h * 0.52, 4, 78);
    // Channel on the dark half.
    g.fillStyle = "rgba(8,10,12,0.55)";
    g.fillRect(w * 0.78, h * 0.18, 36, h * 0.55);
    g.fillStyle = "rgba(180,186,192,0.18)";
    g.fillRect(w * 0.78, h * 0.18, 3, h * 0.55);
    // Wordmark.
    g.fillStyle = "rgba(120,126,132,0.95)";
    g.font = "500 36px 'Neue Haas Display', sans-serif";
    g.fillText("the roster", 48, h - 52);
    // Heart, year, barcode.
    g.fillStyle = "rgba(210,216,220,0.92)";
    g.save();
    g.translate(w - 280, h - 118);
    g.beginPath();
    g.moveTo(12, 8);
    g.bezierCurveTo(12, 2, 5, 2, 5, 8);
    g.bezierCurveTo(5, 14, 12, 20, 12, 24);
    g.bezierCurveTo(12, 20, 19, 14, 19, 8);
    g.bezierCurveTo(19, 2, 12, 2, 12, 8);
    g.fill();
    g.restore();
    g.font = "500 22px 'Neue Haas Display', sans-serif";
    g.fillText("2006", w - 248, h - 96);
    let x = w - 280;
    const pattern = [2, 1, 3, 1, 1, 2, 4, 1, 2, 1, 3, 2, 1, 1, 2, 3, 1, 4, 1, 2, 1, 3, 2, 1];
    pattern.forEach((n, i) => {
      if (i % 2 === 0) g.fillRect(x, h - 78, n * 1.8, 22);
      x += n * 1.8 + 1.2;
    });
    g.font = "500 16px 'Neue Haas Display', sans-serif";
    g.fillText("olympian hourglass", w - 280, h - 42);
  }, 1024, 640);
}

function knurl(radius, height, count) {
  const geo = new THREE.CylinderGeometry(radius, radius, height, count * 2, 2, false);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (Math.abs(y) > height * 0.42) continue;
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const r = Math.hypot(x, z) * (1 + 0.045 * Math.sin(a * count));
    pos.setXYZ(i, Math.cos(a) * r, y, Math.sin(a) * r);
  }
  geo.computeVertexNormals();
  return geo;
}

function studioEnv(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const envScene = new THREE.Scene();
  const bright = new THREE.MeshBasicMaterial({ color: new THREE.Color(6.5, 6.3, 6.0), side: THREE.DoubleSide });
  const dim = new THREE.MeshBasicMaterial({ color: "#0a0b0d", side: THREE.DoubleSide });
  const key = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), bright);
  key.position.set(-4.5, 5.5, 6);
  key.lookAt(0, 0, 0);
  envScene.add(key);
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.3, 2.5), side: THREE.DoubleSide }));
  fill.position.set(5, 3, 4);
  fill.lookAt(0, 0, 0);
  envScene.add(fill);
  const rim = new THREE.Mesh(new THREE.PlaneGeometry(3, 8), bright);
  rim.position.set(0, 2, -7);
  rim.lookAt(0, 0, 0);
  envScene.add(rim);
  for (const [x, y, z] of [[-8, 1, -2], [8, 0.5, 1], [0, -4, 0]]) {
    const card = new THREE.Mesh(new THREE.PlaneGeometry(5, 7), dim);
    card.position.set(x, y, z);
    card.lookAt(0, 0, 0);
    envScene.add(card);
  }
  const studio = pmrem.fromScene(envScene, 0.03).texture;
  room.dispose();
  return studio;
}

function buildDevice() {
  const root = new THREE.Group();
  const zFace = D / 2 - 0.02;

  const body = new THREE.Mesh(
    new RoundedBoxGeometry(W, H, D, 10, R),
    new THREE.MeshPhysicalMaterial({
      color: "#b7bec6",
      metalness: 0.08,
      roughness: 0.22,
      clearcoat: 0.7,
      clearcoatRoughness: 0.18,
      envMapIntensity: 0.7,
    })
  );
  body.position.z = -0.05;
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  const face = new THREE.Mesh(
    plate(W - 0.3, H - 0.3, R - 0.16, 0.07, 0.022),
    new THREE.MeshPhysicalMaterial({
      color: "#9aa1a8",
      metalness: 0.08,
      roughness: 0.28,
      clearcoat: 0.7,
      clearcoatRoughness: 0.14,
      envMapIntensity: 0.5,
    })
  );
  face.position.z = zFace - 0.04;
  face.castShadow = true;
  face.receiveShadow = true;
  root.add(face);
  const screenW = 2.38;
  const screenH = 0.82;
  const screenX = 0.1;
  const screenY = 0.32;
  const skin = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.52, H - 0.52),
    new THREE.MeshBasicMaterial({
      map: faceTexture(),
    })
  );
  skin.position.z = zFace + 0.012;
  skin.renderOrder = 1;
  root.add(skin);

  const lcd = screenTexture();
  const display = new THREE.Mesh(
    new THREE.PlaneGeometry(screenW - 0.06, screenH - 0.08),
    new THREE.MeshBasicMaterial({ map: lcd })
  );
  display.position.set(screenX, screenY, zFace + 0.028);
  display.renderOrder = 3;
  root.add(display);

  const slot = new THREE.Mesh(
    new THREE.BoxGeometry(2.08, 0.08, 0.18),
    new THREE.MeshPhysicalMaterial({ color: "#050607", roughness: 0.6, metalness: 0.15 })
  );
  slot.position.set(-0.1, H / 2 - 0.17, 0.12);
  root.add(slot);

  const paperW = 1.98;
  const paperH = 1.72;
  const paperGeo = new THREE.PlaneGeometry(paperW, paperH, 1, 24);
  const ppos = paperGeo.attributes.position;
  for (let i = 0; i < ppos.count; i++) {
    const y = ppos.getY(i);
    const t = (y + paperH / 2) / paperH;
    ppos.setZ(i, 0.01 * t + 0.03 * t * t);
  }
  paperGeo.computeVertexNormals();
  const paperMap = receiptTexture();
  const paper = new THREE.Mesh(
    paperGeo,
    new THREE.MeshStandardMaterial({
      map: paperMap,
      roughness: 0.95,
      metalness: 0,
      envMapIntensity: 0.08,
    })
  );
  paper.position.set(-0.1, H / 2 + paperH / 2 - 0.14, 0.16);
  paper.castShadow = true;
  root.add(paper);
  const paperBack = new THREE.Mesh(
    paperGeo,
    new THREE.MeshStandardMaterial({ color: "#e4dfd4", roughness: 0.96, metalness: 0, envMapIntensity: 0.05 })
  );
  paperBack.rotation.y = Math.PI;
  paperBack.position.copy(paper.position);
  paperBack.position.z -= 0.005;
  root.add(paperBack);

  const knob = new THREE.Group();
  const alum = new THREE.MeshPhysicalMaterial({
    color: "#b8bcc2",
    metalness: 0.78,
    roughness: 0.28,
    clearcoat: 0.35,
    clearcoatRoughness: 0.25,
    envMapIntensity: 0.8,
  });
  const ring = new THREE.Mesh(knurl(0.48, 0.14, 52), alum);
  ring.rotation.x = Math.PI / 2;
  knob.add(ring);
  const faceCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 0.035, 64),
    new THREE.MeshStandardMaterial({
      map: knobTexture(),
      metalness: 0.55,
      roughness: 0.32,
      envMapIntensity: 0.7,
    })
  );
  faceCap.rotation.x = Math.PI / 2;
  faceCap.position.z = 0.08;
  knob.add(faceCap);
  knob.position.set(-1.42, -0.68, zFace + 0.02);
  root.add(knob);

  const rubber = new THREE.MeshPhysicalMaterial({
    color: "#17191c",
    roughness: 0.62,
    metalness: 0.06,
  });
  [-0.18, 0.26].forEach((y) => {
    const btn = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.14, 6, 12), rubber);
    btn.rotation.z = Math.PI / 2;
    btn.position.set(W / 2 - 0.01, y, 0);
    root.add(btn);
  });

  return { root, paper, knob };
}

async function initRoster(section) {
  const canvas = section.querySelector(".roster-canvas");
  if (!canvas) return;
  try {
    await document.fonts.ready;
  } catch (_) {
    /* Draw with fallbacks if the face files are still on their way. */
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#000000");
  scene.environment = studioEnv(renderer);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 40);
  const { root, paper, knob } = buildDevice();
  scene.add(root);

  const key = new THREE.DirectionalLight("#fff6ee", 2.1);
  key.position.set(-4.5, 5.2, 6.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 18;
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 5;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -5;
  key.shadow.bias = -0.0004;
  scene.add(key);
  scene.add(new THREE.HemisphereLight("#d9e2ee", "#08090b", 0.45));
  const rim = new THREE.DirectionalLight("#c9d4e2", 0.7);
  rim.position.set(5, 2.2, -4);
  scene.add(rim);
  const screenLight = new THREE.PointLight("#c5ccd4", 0.55, 3.2);
  screenLight.position.set(0.08, 0.38, 0.7);
  root.add(screenLight);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 48),
    new THREE.ShadowMaterial({ opacity: 0.55 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -H / 2 - 0.02;
  floor.receiveShadow = true;
  scene.add(floor);

  let yaw = 0.08;
  let pitch = 0.14;
  let tyaw = yaw;
  let tpitch = pitch;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let running = true;

  function placeCamera() {
    const r = 8.6;
    const e = pitch;
    camera.position.set(
      Math.sin(yaw) * Math.cos(e) * r,
      Math.sin(e) * r + 0.05,
      Math.cos(yaw) * Math.cos(e) * r
    );
    camera.lookAt(0, 0.55, 0);
  }

  function resize() {
    const w = section.clientWidth;
    const h = section.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1 ? 42 : 32;
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
    tpitch = THREE.MathUtils.clamp(tpitch + (e.clientY - lastY) * 0.004, 0.08, 0.72);
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
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    if (!dragging && !reduceMotion) {
      tyaw = 0.1 + Math.sin(t * 0.22) * 0.28;
      tpitch = 0.15 + Math.sin(t * 0.18) * 0.04;
    }
    yaw += (tyaw - yaw) * 0.08;
    pitch += (tpitch - pitch) * 0.08;
    knob.rotation.z = t * 0.18;
    paper.rotation.z = reduceMotion ? 0 : Math.sin(t * 0.35) * 0.012;
    placeCamera();
    renderer.render(scene, camera);
  }
  placeCamera();
  loop();
}

document.querySelectorAll(".showcase-roster").forEach(initRoster);
