// Iridescent silk cloth — Verlet field, dense displaced sheet,
// shaded per-pixel from a cubic field so no grid reads as geometry.

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
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  camera.position.set(0, 0.22, 17.6);
  camera.lookAt(0, -0.05, 0);

  const SEG_X = 72;
  const SEG_Y = 46;
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
    const windX = reduceMotion
      ? 0
      : Math.sin(t * 0.38) * 2.4 + Math.sin(t * 0.91) * 1.1;
    const windZ = reduceMotion
      ? 0
      : Math.cos(t * 0.26) * 1.4 + Math.sin(t * 0.67) * 0.8;
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
      if (p.z > 2.2) p.z += (2.2 - p.z) * 0.25;
      if (p.z < -2.0) p.z += (-2.0 - p.z) * 0.25;
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

  const sampleGLSL = `
    vec3 clothTexel(vec2 cell) {
      vec2 uv = (clamp(cell, vec2(0.0), uClothRes - 1.0) + 0.5) / uClothRes;
      return texture2D(uPosTex, uv).xyz;
    }
    vec3 cr(vec3 p0, vec3 p1, vec3 p2, vec3 p3, float t) {
      vec3 a = 2.0 * p1;
      vec3 b = -p0 + p2;
      vec3 c = 2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3;
      vec3 d = -p0 + 3.0 * p1 - 3.0 * p2 + p3;
      return 0.5 * (((d * t + c) * t + b) * t + a);
    }
    vec3 sampleCubic(vec2 uv) {
      vec2 loc = clamp(uv, 0.0, 1.0) * (uClothRes - 1.0);
      vec2 i0 = floor(loc);
      vec2 f = loc - i0;
      vec3 r0 = cr(
        clothTexel(i0 + vec2(-1.0, -1.0)),
        clothTexel(i0 + vec2( 0.0, -1.0)),
        clothTexel(i0 + vec2( 1.0, -1.0)),
        clothTexel(i0 + vec2( 2.0, -1.0)),
        f.x
      );
      vec3 r1 = cr(
        clothTexel(i0 + vec2(-1.0, 0.0)),
        clothTexel(i0 + vec2( 0.0, 0.0)),
        clothTexel(i0 + vec2( 1.0, 0.0)),
        clothTexel(i0 + vec2( 2.0, 0.0)),
        f.x
      );
      vec3 r2 = cr(
        clothTexel(i0 + vec2(-1.0, 1.0)),
        clothTexel(i0 + vec2( 0.0, 1.0)),
        clothTexel(i0 + vec2( 1.0, 1.0)),
        clothTexel(i0 + vec2( 2.0, 1.0)),
        f.x
      );
      vec3 r3 = cr(
        clothTexel(i0 + vec2(-1.0, 2.0)),
        clothTexel(i0 + vec2( 0.0, 2.0)),
        clothTexel(i0 + vec2( 1.0, 2.0)),
        clothTexel(i0 + vec2( 2.0, 2.0)),
        f.x
      );
      return cr(r0, r1, r2, r3, f.y);
    }
  `;

  const uniforms = {
    uPosTex: { value: posTex },
    uClothRes: { value: new THREE.Vector2(COLS, ROWS) },
    uRot: { value: new THREE.Matrix3() },
    uTime: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    vertexShader: `
      uniform sampler2D uPosTex;
      uniform vec2 uClothRes;
      varying vec2 vUv;
      varying vec3 vPos;
      ${sampleGLSL}
      void main() {
        vUv = uv;
        vPos = sampleCubic(uv);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(vPos, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uPosTex;
      uniform vec2 uClothRes;
      uniform mat3 uRot;
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vPos;
      ${sampleGLSL}

      vec3 clothNormal(vec2 uv) {
        vec2 e = 1.15 / uClothRes;
        vec3 pL = sampleCubic(uv - vec2(e.x, 0.0));
        vec3 pR = sampleCubic(uv + vec2(e.x, 0.0));
        vec3 pD = sampleCubic(uv - vec2(0.0, e.y));
        vec3 pU = sampleCubic(uv + vec2(0.0, e.y));
        vec3 n = cross(pR - pL, pU - pD);
        float len = length(n);
        return len > 1e-5 ? n / len : vec3(0.0, 0.0, 1.0);
      }

      vec3 envColor(vec3 r) {
        float v = r.y * 0.5 + 0.5;
        vec3 bot = vec3(0.96, 0.97, 0.91);
        vec3 mid = vec3(0.16, 0.13, 0.20);
        vec3 top = vec3(0.73, 0.84, 0.90);
        vec3 c = mix(bot, mid, smoothstep(0.0, 0.48, v));
        c = mix(c, top, smoothstep(0.48, 1.0, v));
        c = mix(c, vec3(1.0, 0.55, 0.78), smoothstep(0.35, 1.0, r.x * 0.35 + v * 0.4));
        return c;
      }

      vec3 shadeSilk(vec3 n, vec3 v, vec3 pW) {
        vec3 base = vec3(0.769, 0.749, 0.714);
        vec3 sheenCol = vec3(1.0, 0.839, 0.910);
        float ndv = max(dot(n, v), 0.0);
        float fres = pow(1.0 - ndv, 3.2);
        float film = sin(ndv * (7.6 + sin(uTime * 0.22) * 0.8) + 0.35);
        vec3 irid = mix(
          vec3(0.55, 0.75, 0.94),
          vec3(1.0, 0.68, 0.82),
          film * 0.5 + 0.5
        );

        vec3 col = base * 0.14;
        col += mix(vec3(0.40, 0.52, 0.62), vec3(0.96, 0.93, 0.95), n.y * 0.5 + 0.5) * base * 0.18;

        vec3 l1 = normalize(vec3(-7.0, 5.0, 4.0) - pW);
        vec3 l2 = normalize(vec3(8.0, 1.0, 3.0) - pW);
        vec3 l3 = normalize(vec3(2.0, -6.0, 4.0) - pW);
        vec3 c1 = vec3(1.00, 0.894, 0.831) * 1.12;
        vec3 c2 = vec3(0.659, 0.800, 0.878) * 1.20;
        vec3 c3 = vec3(1.00, 0.769, 0.847) * 0.72;

        vec3 h1 = normalize(l1 + v);
        vec3 h2 = normalize(l2 + v);
        vec3 h3 = normalize(l3 + v);
        float d1 = max(dot(n, l1), 0.0);
        float d2 = max(dot(n, l2), 0.0);
        float d3 = max(dot(n, l3), 0.0);

        col += base * (d1 * c1 + d2 * c2 + d3 * c3) * 0.58;
        col += irid * (
          pow(max(dot(n, h1), 0.0), 52.0) * c1 +
          pow(max(dot(n, h2), 0.0), 52.0) * c2 +
          pow(max(dot(n, h3), 0.0), 40.0) * c3
        ) * 0.26;
        col += sheenCol * pow(1.0 - ndv, 2.6) * (d1 + d2 + d3) * 0.12;

        vec3 r = reflect(-v, n);
        col += envColor(r) * mix(base, irid, 0.58) * (0.12 + fres * 0.40);
        col += sheenCol * fres * 0.18;
        return col;
      }

      void main() {
        vec3 nObj = clothNormal(vUv);
        vec3 pW = uRot * vPos;
        vec3 nW = normalize(uRot * nObj);
        vec3 V = normalize(cameraPosition - pW);
        if (dot(nW, V) < 0.0) nW = -nW;
        gl_FragColor = vec4(shadeSilk(nW, V, pW), 1.0);
      }
    `,
  });

  const displayGeo = new THREE.PlaneGeometry(WIDTH, HEIGHT, 640, 420);
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
  const GRAB_R = 9.2;
  const GRAB_INNER = 3.4;

  function grabWeight(d) {
    if (d <= GRAB_INNER) return 1;
    if (d >= GRAB_R) return 0;
    const t = (d - GRAB_INNER) / (GRAB_R - GRAB_INNER);
    const s = t * t * t * (t * (t * 6 - 15) + 10);
    return 1 - s;
  }

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
    const g = particles[index];
    if (!g || g.pinned) return;
    const dx = target.x - g.x;
    const dy = target.y - g.y;
    const dz = target.z - g.z;
    const gx = index % COLS;
    const gy = Math.floor(index / COLS);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const i = y * COLS + x;
        const p = particles[i];
        if (p.pinned) continue;
        const w = grabWeight(Math.hypot(x - gx, y - gy));
        if (w <= 0) continue;
        p.x += dx * w;
        p.y += dy * w;
        p.z += dz * w;
        p.px += dx * w;
        p.py += dy * w;
        p.pz += dz * w;
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
  mesh.updateMatrixWorld();
  uniforms.uRot.value.setFromMatrix4(mesh.matrixWorld);
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
    mesh.updateMatrixWorld();
    uniforms.uRot.value.setFromMatrix4(mesh.matrixWorld);
    uniforms.uTime.value = t;
    renderer.render(scene, camera);
  }
  loop();
}
