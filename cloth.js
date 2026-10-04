// Iridescent silk cloth — same Figma hues as the cloud slabs.
// Verlet spring mesh, pinned at the top, grab-and-drag anywhere else.

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
  renderer.toneMappingExposure = 1.2;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  camera.position.set(0, 0.15, 16);
  camera.lookAt(0, -0.35, 0);

  function makeEnvTexture() {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#08090e";
    ctx.fillRect(0, 0, c.width, c.height);
    const g = ctx.createLinearGradient(0, 0, c.width, c.height);
    g.addColorStop(0.0, "rgba(167,198,218,0.7)");
    g.addColorStop(0.22, "rgba(107,140,161,0.4)");
    g.addColorStop(0.45, "rgba(30,22,40,0.1)");
    g.addColorStop(0.68, "rgba(246,247,232,0.75)");
    g.addColorStop(0.86, "rgba(243,207,224,0.65)");
    g.addColorStop(1.0, "rgba(255,91,176,0.7)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    [
      { x: 0.2, y: 0.22, r: 0.28, col: "rgba(180,220,255,0.9)" },
      { x: 0.72, y: 0.18, r: 0.24, col: "rgba(246,247,232,0.85)" },
      { x: 0.5, y: 0.8, r: 0.3, col: "rgba(255,130,200,0.85)" },
      { x: 0.86, y: 0.55, r: 0.2, col: "rgba(255,220,235,0.7)" },
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

  scene.add(new THREE.AmbientLight(0xd8dce4, 0.32));
  const key = new THREE.DirectionalLight(0xf2dcc8, 1.15);
  key.position.set(-6, 4, 5);
  scene.add(key);
  const cool = new THREE.DirectionalLight(0x8cb4cc, 1.35);
  cool.position.set(7, 1, 4);
  scene.add(cool);
  const blush = new THREE.DirectionalLight(0xffc0d4, 0.85);
  blush.position.set(2, -5, 3);
  scene.add(blush);

  const SEG_X = 64;
  const SEG_Y = 40;
  const COLS = SEG_X + 1;
  const ROWS = SEG_Y + 1;
  const WIDTH = 15.5;
  const HEIGHT = 9.4;
  const REST_X = WIDTH / SEG_X;
  const REST_Y = HEIGHT / SEG_Y;
  const REST_S = Math.hypot(REST_X, REST_Y);
  const REST_BX = REST_X * 2;
  const REST_BY = REST_Y * 2;

  const geometry = new THREE.PlaneGeometry(WIDTH, HEIGHT, SEG_X, SEG_Y);
  geometry.computeVertexNormals();

  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x8f9aaa),
    metalness: 0.42,
    roughness: 0.22,
    iridescence: 1.0,
    iridescenceIOR: 1.5,
    iridescenceThicknessRange: [160, 620],
    sheen: 1.0,
    sheenRoughness: 0.22,
    sheenColor: new THREE.Color(0xffb8d4),
    clearcoat: 0.55,
    clearcoatRoughness: 0.16,
    envMap: envRT.texture,
    envMapIntensity: 2.1,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -0.22;
  scene.add(mesh);

  const posAttr = geometry.attributes.position;
  const particles = [];

  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const pinned = y >= HEIGHT * 0.5 - 0.02;
    const z =
      Math.sin(x * 0.55 + y * 0.4) * 0.38 + Math.cos(x * 0.25) * 0.16;
    particles.push({
      x,
      y,
      z,
      px: x,
      py: y,
      pz: z,
      pinned,
    });
  }

  const constraints = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const i = y * COLS + x;
      if (x + 1 < COLS) constraints.push([i, i + 1, REST_X]);
      if (y + 1 < ROWS) constraints.push([i, i + COLS, REST_Y]);
      if (x + 1 < COLS && y + 1 < ROWS) {
        constraints.push([i, i + COLS + 1, REST_S]);
        constraints.push([i + 1, i + COLS, REST_S]);
      }
      if (x + 2 < COLS) constraints.push([i, i + 2, REST_BX]);
      if (y + 2 < ROWS) constraints.push([i, i + COLS * 2, REST_BY]);
    }
  }

  const _d = new THREE.Vector3();

  function satisfy(a, b, rest) {
    if (a.pinned && b.pinned) return;
    _d.set(b.x - a.x, b.y - a.y, b.z - a.z);
    const dist = Math.sqrt(_d.x * _d.x + _d.y * _d.y + _d.z * _d.z) || 1e-5;
    const corr = (dist - rest) / dist;
    if (a.pinned) {
      b.x -= _d.x * corr;
      b.y -= _d.y * corr;
      b.z -= _d.z * corr;
    } else if (b.pinned) {
      a.x += _d.x * corr;
      a.y += _d.y * corr;
      a.z += _d.z * corr;
    } else {
      a.x += _d.x * corr * 0.5;
      a.y += _d.y * corr * 0.5;
      a.z += _d.z * corr * 0.5;
      b.x -= _d.x * corr * 0.5;
      b.y -= _d.y * corr * 0.5;
      b.z -= _d.z * corr * 0.5;
    }
  }

  function stepSim(dt, t) {
    const grav = reduceMotion ? 0 : -22;
    const windX = reduceMotion ? 0 : Math.sin(t * 0.55) * 8;
    const windZ = reduceMotion ? 0 : Math.cos(t * 0.38) * 5;
    const damp = 0.975;
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
      if (p.z > 2.1) p.z += (2.1 - p.z) * 0.35;
      if (p.z < -1.8) p.z += (-1.8 - p.z) * 0.35;
    }

    const iters = reduceMotion ? 3 : 7;
    for (let n = 0; n < iters; n++) {
      for (const [i, j, rest] of constraints) {
        satisfy(particles[i], particles[j], rest);
      }
    }
  }

  function writeGeometry() {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      posAttr.setXYZ(i, p.x, p.y, p.z);
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
  const GRAB_R = 5.2;

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
        const w = (1 - d / GRAB_R) ** 2;
        p.x += (target.x - p.x) * w;
        p.y += (target.y - p.y) * w;
        p.z += (target.z - p.z) * w;
        p.px += (p.x - p.px) * 0.35;
        p.py += (p.y - p.py) * 0.35;
        p.pz += (p.z - p.pz) * 0.35;
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

  // Settle the drape before the first paint.
  for (let i = 0; i < 90; i++) stepSim(1 / 50, i * 0.04);
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
    const shimmer = 220 + Math.sin(t * 0.35) * 70;
    material.iridescenceThicknessRange = [shimmer, shimmer + 340];
    renderer.render(scene, camera);
  }
  loop();
}
