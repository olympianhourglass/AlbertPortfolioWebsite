// Iridescent silk cloth — same Figma hues as the cloud slabs.
// Verlet spring mesh, pinned at the top, grab-and-drag anywhere else.
// Sim stays medium-res; a bicubic display mesh is what you see.

import * as THREE from "three";

const section = document.getElementById("showcase-cloth");
const canvas = section?.querySelector(".cloth-canvas");

if (canvas && section) {
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  camera.position.set(0, 0.15, 16);
  camera.lookAt(0, -0.35, 0);

  function makeEnvTexture() {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#0a0b10";
    ctx.fillRect(0, 0, c.width, c.height);
    const g = ctx.createLinearGradient(0, 0, c.width, c.height);
    g.addColorStop(0.0, "rgba(186,214,230,0.85)");
    g.addColorStop(0.2, "rgba(140,176,196,0.45)");
    g.addColorStop(0.48, "rgba(36,28,48,0.12)");
    g.addColorStop(0.7, "rgba(246,247,232,0.8)");
    g.addColorStop(0.88, "rgba(255,196,220,0.7)");
    g.addColorStop(1.0, "rgba(255,120,190,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    [
      { x: 0.22, y: 0.2, r: 0.34, col: "rgba(210,232,255,0.95)" },
      { x: 0.7, y: 0.16, r: 0.28, col: "rgba(255,236,244,0.7)" },
      { x: 0.52, y: 0.78, r: 0.32, col: "rgba(255,150,205,0.7)" },
      { x: 0.84, y: 0.52, r: 0.22, col: "rgba(255,228,236,0.55)" },
    ].forEach((b) => {
      const rg = ctx.createRadialGradient(
        b.x * c.width,
        b.y * c.height,
        0,
        b.x * c.width,
        b.y * c.height,
        b.r * c.width
      );
      rg.addColorStop(0, b.col);
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, c.width, c.height);
    });
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromEquirectangular(makeEnvTexture());
  scene.environment = envRT.texture;

  scene.add(new THREE.HemisphereLight(0xf6eef4, 0x6b8ca1, 0.28));
  scene.add(new THREE.AmbientLight(0xe4e0d8, 0.12));
  const key = new THREE.DirectionalLight(0xffe4d4, 1.05);
  key.position.set(-7, 5, 4);
  scene.add(key);
  const cool = new THREE.DirectionalLight(0xa8cce0, 1.15);
  cool.position.set(8, 1, 3);
  scene.add(cool);
  const blush = new THREE.DirectionalLight(0xffc4d8, 0.7);
  blush.position.set(2, -6, 4);
  scene.add(blush);

  const SEG_X = 72;
  const SEG_Y = 46;
  const COLS = SEG_X + 1;
  const ROWS = SEG_Y + 1;
  const SUB = 3;
  const WIDTH = 15.5;
  const HEIGHT = 9.4;
  const REST_X = WIDTH / SEG_X;
  const REST_Y = HEIGHT / SEG_Y;
  const REST_S = Math.hypot(REST_X, REST_Y);

  const geometry = new THREE.PlaneGeometry(
    WIDTH,
    HEIGHT,
    SEG_X * SUB,
    SEG_Y * SUB
  );

  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xb0b6bc),
    metalness: 0.22,
    roughness: 0.1,
    iridescence: 1.0,
    iridescenceIOR: 1.38,
    iridescenceThicknessRange: [180, 520],
    sheen: 1.0,
    sheenRoughness: 0.07,
    sheenColor: new THREE.Color(0xffcce0),
    clearcoat: 0.4,
    clearcoatRoughness: 0.14,
    envMap: envRT.texture,
    envMapIntensity: 2.05,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -0.36;
  mesh.frustumCulled = false;
  scene.add(mesh);

  const posAttr = geometry.attributes.position;
  const DCOLS = SEG_X * SUB + 1;
  const DROWS = SEG_Y * SUB + 1;

  const particles = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const px = (x / SEG_X - 0.5) * WIDTH;
      const py = (0.5 - y / SEG_Y) * HEIGHT;
      const z =
        Math.sin(px * 0.48 + py * 0.36) * 0.4 + Math.cos(px * 0.22) * 0.14;
      particles.push({
        x: px,
        y: py,
        z,
        px,
        py,
        pz: z,
        pinned: y === 0 && (x === 0 || x === SEG_X || x % 16 === 0),
      });
    }
  }

  const constraints = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const i = y * COLS + x;
      if (x + 1 < COLS) constraints.push(i, i + 1, REST_X);
      if (y + 1 < ROWS) constraints.push(i, i + COLS, REST_Y);
      if (x + 1 < COLS && y + 1 < ROWS) {
        constraints.push(i, i + COLS + 1, REST_S);
        constraints.push(i + 1, i + COLS, REST_S);
      }
      if (x + 2 < COLS) constraints.push(i, i + 2, REST_X * 2);
      if (y + 2 < ROWS) constraints.push(i, i + COLS * 2, REST_Y * 2);
    }
  }

  function satisfy(a, b, rest) {
    if (a.pinned && b.pinned) return;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-5;
    const corr = (dist - rest) / dist;
    if (a.pinned) {
      b.x -= dx * corr;
      b.y -= dy * corr;
      b.z -= dz * corr;
    } else if (b.pinned) {
      a.x += dx * corr;
      a.y += dy * corr;
      a.z += dz * corr;
    } else {
      const h = corr * 0.5;
      a.x += dx * h;
      a.y += dy * h;
      a.z += dz * h;
      b.x -= dx * h;
      b.y -= dy * h;
      b.z -= dz * h;
    }
  }

  function stepSim(dt, t) {
    const grav = reduceMotion ? 0 : -34;
    const windX = reduceMotion ? 0 : Math.sin(t * 0.42) * 6;
    const windZ = reduceMotion ? 0 : Math.cos(t * 0.3) * 3.6;
    const damp = 0.982;
    const dt2 = dt * dt;

    for (const p of particles) {
      if (p.pinned) continue;
      const vx = (p.x - p.px) * damp;
      const vy = (p.y - p.py) * damp;
      const vz = (p.z - p.pz) * damp;
      p.px = p.x;
      p.py = p.y;
      p.pz = p.z;
      p.x += vx + windX * dt2;
      p.y += vy + grav * dt2;
      p.z += vz + windZ * dt2;
      if (p.z > 1.8) p.z += (1.8 - p.z) * 0.25;
      if (p.z < -1.5) p.z += (-1.5 - p.z) * 0.25;
    }

    const iters = reduceMotion ? 4 : 8;
    for (let n = 0; n < iters; n++) {
      for (let c = 0; c < constraints.length; c += 3) {
        satisfy(
          particles[constraints[c]],
          particles[constraints[c + 1]],
          constraints[c + 2]
        );
      }
    }
  }

  function clampi(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function cr1(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      0.5 *
      (2 * p1 +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
    );
  }

  function sampleComp(u, v, key) {
    const x = Math.floor(u);
    const y = Math.floor(v);
    const tx = u - x;
    const ty = v - y;
    const get = (ix, iy) =>
      particles[clampi(iy, 0, SEG_Y) * COLS + clampi(ix, 0, SEG_X)][key];
    const r0 = cr1(get(x - 1, y - 1), get(x, y - 1), get(x + 1, y - 1), get(x + 2, y - 1), tx);
    const r1 = cr1(get(x - 1, y), get(x, y), get(x + 1, y), get(x + 2, y), tx);
    const r2 = cr1(get(x - 1, y + 1), get(x, y + 1), get(x + 1, y + 1), get(x + 2, y + 1), tx);
    const r3 = cr1(get(x - 1, y + 2), get(x, y + 2), get(x + 1, y + 2), get(x + 2, y + 2), tx);
    return cr1(r0, r1, r2, r3, ty);
  }

  function writeGeometry() {
    for (let dy = 0; dy < DROWS; dy++) {
      const v = dy / SUB;
      for (let dx = 0; dx < DCOLS; dx++) {
        const u = dx / SUB;
        const i = dy * DCOLS + dx;
        posAttr.setXYZ(i, sampleComp(u, v, "x"), sampleComp(u, v, "y"), sampleComp(u, v, "z"));
      }
    }
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  function resize() {
    const w = section.clientWidth;
    const h = section.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  const raycaster = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  const dragPlane = new THREE.Plane();
  const hit = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  let dragging = false;
  let grabIndex = -1;
  const GRAB_R = 6.4;

  function pointerToNDC(event) {
    const rect = canvas.getBoundingClientRect();
    ptr.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ptr.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function nearestParticle(point) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const d =
        (p.x - point.x) ** 2 + (p.y - point.y) ** 2 + (p.z - point.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  function pullToward(index, target) {
    const gx = index % COLS;
    const gy = Math.floor(index / COLS);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const i = y * COLS + x;
        const p = particles[i];
        if (p.pinned) continue;
        const d = Math.hypot(x - gx, y - gy);
        if (d > GRAB_R) continue;
        const t = 1 - d / GRAB_R;
        const w = t * t * (3 - 2 * t);
        p.x += (target.x - p.x) * w;
        p.y += (target.y - p.y) * w;
        p.z += (target.z - p.z) * w;
        p.px += (p.x - p.px) * 0.28;
        p.py += (p.y - p.py) * 0.28;
        p.pz += (p.z - p.pz) * 0.28;
      }
    }
  }

  function setDragCursor(on) {
    section.classList.toggle("is-dragging", on);
  }

  section.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    pointerToNDC(event);
    raycaster.setFromCamera(ptr, camera);
    const hits = raycaster.intersectObject(mesh);
    if (!hits.length) return;
    grabIndex = nearestParticle(mesh.worldToLocal(hits[0].point.clone()));
    camera.getWorldDirection(camDir);
    dragPlane.setFromNormalAndCoplanarPoint(camDir, hits[0].point);
    dragging = true;
    setDragCursor(true);
    section.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  section.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    pointerToNDC(event);
    raycaster.setFromCamera(ptr, camera);
    if (!raycaster.ray.intersectPlane(dragPlane, hit)) return;
    pullToward(grabIndex, mesh.worldToLocal(hit.clone()));
  });

  function endDrag(event) {
    if (!dragging) return;
    dragging = false;
    grabIndex = -1;
    setDragCursor(false);
    try {
      section.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
  }
  section.addEventListener("pointerup", endDrag);
  section.addEventListener("pointercancel", endDrag);

  const clock = new THREE.Clock();
  let lastTime = 0;
  let running = true;
  const io = new IntersectionObserver(
    (entries) => {
      running = entries[0]?.isIntersecting ?? true;
    },
    { threshold: 0 }
  );
  io.observe(section);

  for (let i = 0; i < 110; i++) stepSim(1 / 50, i * 0.035);
  writeGeometry();
  renderer.render(scene, camera);

  function loop() {
    requestAnimationFrame(loop);
    if (!running) return;
    const t = clock.getElapsedTime();
    const dt = Math.min(0.033, Math.max(1 / 120, t - lastTime));
    lastTime = t;
    if (!reduceMotion || dragging) stepSim(dt, t);
    writeGeometry();
    const shimmer = 250 + Math.sin(t * 0.22) * 40;
    material.iridescenceThicknessRange = [shimmer, shimmer + 220];
    renderer.render(scene, camera);
  }
  loop();
}
