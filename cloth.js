// Iridescent silk cloth — same Figma hues as the cloud slabs.
// Verlet sim on a coarse grid; the visible surface is GPU-bicubic
// so lighting never picks up the square mesh.

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

  const SEG_X = 64;
  const SEG_Y = 40;
  const COLS = SEG_X + 1;
  const ROWS = SEG_Y + 1;
  const WIDTH = 15.5;
  const HEIGHT = 9.4;
  const REST_X = WIDTH / SEG_X;
  const REST_Y = HEIGHT / SEG_Y;
  const REST_S = Math.hypot(REST_X, REST_Y);

  const particles = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const px = (x / SEG_X - 0.5) * WIDTH;
      const py = (0.5 - y / SEG_Y) * HEIGHT;
      const z =
        Math.sin(px * 0.7) * 0.55 +
        Math.sin(px * 1.35 + py * 0.4) * 0.22 +
        Math.cos(px * 0.28 + py * 0.7) * 0.16;
      particles.push({
        x: px,
        y: py,
        z,
        px,
        py,
        pz: z,
        pinned: y === 0,
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
    const grav = reduceMotion ? 0 : -26;
    const windX = reduceMotion ? 0 : Math.sin(t * 0.38) * 2.4 + Math.sin(t * 0.91) * 1.1;
    const windZ = reduceMotion ? 0 : Math.cos(t * 0.26) * 1.4 + Math.sin(t * 0.67) * 0.8;
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

  const texData = new Float32Array(COLS * ROWS * 4);
  const blurA = new Float32Array(COLS * ROWS * 3);
  const blurB = new Float32Array(COLS * ROWS * 3);
  const posTex = new THREE.DataTexture(
    texData,
    COLS,
    ROWS,
    THREE.RGBAFormat,
    THREE.FloatType
  );
  posTex.magFilter = THREE.NearestFilter;
  posTex.minFilter = THREE.NearestFilter;
  posTex.wrapS = THREE.ClampToEdgeWrapping;
  posTex.wrapT = THREE.ClampToEdgeWrapping;
  posTex.generateMipmaps = false;
  posTex.colorSpace = THREE.NoColorSpace;
  posTex.needsUpdate = true;

  function blurField(src, dst) {
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let w = 0;
        for (let oy = -1; oy <= 1; oy++) {
          const yy = y + oy;
          if (yy < 0 || yy >= ROWS) continue;
          for (let ox = -1; ox <= 1; ox++) {
            const xx = x + ox;
            if (xx < 0 || xx >= COLS) continue;
            const wt = ox === 0 && oy === 0 ? 4 : ox === 0 || oy === 0 ? 2 : 1;
            const j = (yy * COLS + xx) * 3;
            sx += src[j] * wt;
            sy += src[j + 1] * wt;
            sz += src[j + 2] * wt;
            w += wt;
          }
        }
        const i = (y * COLS + x) * 3;
        dst[i] = sx / w;
        dst[i + 1] = sy / w;
        dst[i + 2] = sz / w;
      }
    }
  }

  function writeTexture() {
    for (let y = 0; y < ROWS; y++) {
      const pRow = SEG_Y - y;
      for (let x = 0; x < COLS; x++) {
        const p = particles[pRow * COLS + x];
        const i = (y * COLS + x) * 3;
        blurA[i] = p.x;
        blurA[i + 1] = p.y;
        blurA[i + 2] = p.z;
      }
    }
    blurField(blurA, blurB);
    blurField(blurB, blurA);
    for (let i = 0; i < COLS * ROWS; i++) {
      texData[i * 4] = blurA[i * 3];
      texData[i * 4 + 1] = blurA[i * 3 + 1];
      texData[i * 4 + 2] = blurA[i * 3 + 2];
      texData[i * 4 + 3] = 1;
    }
    posTex.needsUpdate = true;
  }

  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xc4bfb6),
    metalness: 0.12,
    roughness: 0.18,
    iridescence: 0.55,
    iridescenceIOR: 1.28,
    iridescenceThicknessRange: [240, 420],
    sheen: 1.0,
    sheenRoughness: 0.12,
    sheenColor: new THREE.Color(0xffd6e8),
    clearcoat: 0.18,
    clearcoatRoughness: 0.28,
    envMap: envRT.texture,
    envMapIntensity: 1.55,
    side: THREE.DoubleSide,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uPosTex = { value: posTex };
    shader.uniforms.uClothRes = { value: new THREE.Vector2(COLS, ROWS) };
    shader.vertexShader =
      `
      uniform sampler2D uPosTex;
      uniform vec2 uClothRes;
      vec3 clothTexel(vec2 cell) {
        vec2 uv = (clamp(cell, vec2(0.0), uClothRes - 1.0) + 0.5) / uClothRes;
        return texture2D(uPosTex, uv).xyz;
      }
      vec3 sampleCloth(vec2 uv) {
        vec2 loc = clamp(uv, 0.0, 1.0) * (uClothRes - 1.0);
        vec2 i0 = floor(loc);
        vec2 f = loc - i0;
        f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
        vec3 a = clothTexel(i0);
        vec3 b = clothTexel(i0 + vec2(1.0, 0.0));
        vec3 c = clothTexel(i0 + vec2(0.0, 1.0));
        vec3 d = clothTexel(i0 + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      ` +
      shader.vertexShader
        .replace(
          "#include <beginnormal_vertex>",
          `
          vec2 texel = 1.25 / uClothRes;
          vec3 pL = sampleCloth(uv - vec2(texel.x, 0.0));
          vec3 pR = sampleCloth(uv + vec2(texel.x, 0.0));
          vec3 pD = sampleCloth(uv - vec2(0.0, texel.y));
          vec3 pU = sampleCloth(uv + vec2(0.0, texel.y));
          vec3 objectNormal = normalize(cross(pR - pL, pU - pD));
          if (length(objectNormal) < 0.001) objectNormal = vec3(0.0, 0.0, 1.0);
          #ifdef USE_TANGENT
            vec3 objectTangent = vec3( tangent.xyz );
          #endif
          `
        )
        .replace(
          "#include <begin_vertex>",
          `
          vec3 transformed = sampleCloth(uv);
          `
        );
  };
  material.customProgramCacheKey = () => "cloth-realistic-v5";

  const displayGeo = new THREE.PlaneGeometry(WIDTH, HEIGHT, 360, 230);
  const mesh = new THREE.Mesh(displayGeo, material);
  mesh.rotation.x = -0.36;
  mesh.frustumCulled = false;
  scene.add(mesh);

  const hitGeo = new THREE.PlaneGeometry(WIDTH, HEIGHT, SEG_X, SEG_Y);
  const hitMesh = new THREE.Mesh(
    hitGeo,
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitMesh.rotation.copy(mesh.rotation);
  hitMesh.frustumCulled = false;
  scene.add(hitMesh);
  const hitPos = hitGeo.attributes.position;

  function writeHitMesh() {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      hitPos.setXYZ(i, p.x, p.y, p.z);
    }
    hitPos.needsUpdate = true;
    hitGeo.computeBoundingSphere();
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
    const hits = raycaster.intersectObject(hitMesh);
    if (!hits.length) return;
    grabIndex = nearestParticle(hitMesh.worldToLocal(hits[0].point.clone()));
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
    pullToward(grabIndex, hitMesh.worldToLocal(hit.clone()));
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
  writeTexture();
  writeHitMesh();
  renderer.render(scene, camera);

  function loop() {
    requestAnimationFrame(loop);
    if (!running) return;
    const t = clock.getElapsedTime();
    const dt = Math.min(0.033, Math.max(1 / 120, t - lastTime));
    lastTime = t;
    if (!reduceMotion || dragging) stepSim(dt, t);
    writeTexture();
    writeHitMesh();
    const shimmer = 250 + Math.sin(t * 0.22) * 40;
    material.iridescenceThicknessRange = [shimmer, shimmer + 220];
    renderer.render(scene, camera);
  }
  loop();
}
