// Iridescent 3D panels drifting like clouds on a black canvas.
// Real WebGL geometry + physically based iridescent/metallic material.
// Color inspiration (reflected environment) comes from the two Figma frames:
//   warm: cream -> rose -> hot pink (#ff5bb0)
//   cool: steel blue -> blue-grey -> cream (#6b8ca1)

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const canvas = document.getElementById("cloudCanvas");
const section = document.getElementById("showcase");

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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 12);

  // --- Environment: an equirectangular gradient built from the Figma colors.
  function makeEnvTexture() {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    const ctx = c.getContext("2d");

    ctx.fillStyle = "#05060a";
    ctx.fillRect(0, 0, c.width, c.height);

    const g = ctx.createLinearGradient(0, 0, c.width, c.height);
    g.addColorStop(0.0, "rgba(167,198,218,0.4)");
    g.addColorStop(0.18, "rgba(107,140,161,0.22)");
    g.addColorStop(0.4, "rgba(20,16,32,0)");
    g.addColorStop(0.62, "rgba(246,247,232,0.55)");
    g.addColorStop(0.78, "rgba(241,237,225,0.5)");
    g.addColorStop(0.9, "rgba(243,207,224,0.4)");
    g.addColorStop(1.0, "rgba(255,91,176,0.45)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);

    const blobs = [
      { x: 0.18, y: 0.22, r: 0.26, col: "rgba(210,230,255,0.85)" },
      { x: 0.72, y: 0.16, r: 0.24, col: "rgba(246,247,232,1)" },
      { x: 0.42, y: 0.38, r: 0.22, col: "rgba(247,248,230,0.95)" },
      { x: 0.88, y: 0.48, r: 0.2, col: "rgba(238,241,236,0.9)" },
      { x: 0.5, y: 0.82, r: 0.28, col: "rgba(255,150,205,0.85)" },
      { x: 0.28, y: 0.7, r: 0.2, col: "rgba(241,237,225,0.9)" },
    ];
    blobs.forEach((b) => {
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
  pmrem.compileEquirectangularShader();
  const envTex = makeEnvTexture();
  const envRT = pmrem.fromEquirectangular(envTex);
  scene.environment = envRT.texture;

  // Colorful studio sky is visible only to reflection cameras, so the
  // main view stays a black void while metal still catches the Figma hues
  // and neighboring panels.
  const ENV_LAYER = 1;
  const envSphere = new THREE.Mesh(
    new THREE.SphereGeometry(40, 32, 24),
    new THREE.MeshBasicMaterial({
      map: envTex,
      side: THREE.BackSide,
    })
  );
  envSphere.layers.set(ENV_LAYER);
  scene.add(envSphere);

  scene.add(new THREE.AmbientLight(0xf6f7e8, 0.38));
  const keyLight = new THREE.DirectionalLight(0xf6f7e8, 2.0);
  keyLight.position.set(5, 4, 6);
  scene.add(keyLight);
  const creamLight = new THREE.DirectionalLight(0xf1ede1, 1.6);
  creamLight.position.set(-2, 5, 3);
  scene.add(creamLight);
  const rimLight = new THREE.DirectionalLight(0xa8c8ff, 1.35);
  rimLight.position.set(-6, -2, 4);
  scene.add(rimLight);
  const pinkFill = new THREE.DirectionalLight(0xffd6ec, 0.9);
  pinkFill.position.set(3, -3, 4);
  scene.add(pinkFill);

  const BOX_W = 3.2;
  const BOX_H = 1.6;
  const BOX_D = 0.62;
  const geometry = new RoundedBoxGeometry(BOX_W, BOX_H, BOX_D, 6, 0.12);

  const BASE_ROT_Y = THREE.MathUtils.degToRad(22);
  const BASE_ROT_X = THREE.MathUtils.degToRad(-10);

  // One shared Z-plane so perspective can't make a nearer slab slide
  // "through" a farther one. Two Y-lanes with a wide gap, same speed
  // inside each lane, so they never catch or clip each other.
  const SPREAD_X = 12;
  const WRAP_LIMIT = SPREAD_X + 2.5;
  const WRAP_SPAN = WRAP_LIMIT * 2;
  const GAP = 1.15;
  const lanes = [
    { y: -2.85, count: 3, speed: 0.32, phase: 0.0 },
    { y: 2.85, count: 3, speed: -0.28, phase: 0.5 },
  ];

  const palettes = [
    {
      // Warm Figma frame: cream → rose
      color: 0xf0ebe0,
      thickBase: 280,
      thickSpan: 420,
    },
    {
      // Cool Figma frame: steel → cream-white
      color: 0xb4bcc6,
      thickBase: 90,
      thickSpan: 280,
    },
    {
      // Warm cream, slightly more yellow-chartreuse like #f6f7e8
      color: 0xf3f4e6,
      thickBase: 340,
      thickSpan: 380,
    },
  ];

  const panels = [];
  let panelIndex = 0;

  for (const lane of lanes) {
    for (let j = 0; j < lane.count; j++) {
      const pal = palettes[panelIndex % palettes.length];
      panelIndex += 1;

      const material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(pal.color),
        metalness: 1.0,
        roughness: 0.025,
        iridescence: 1.0,
        iridescenceIOR: 1.4,
        iridescenceThicknessRange: [pal.thickBase, pal.thickBase + pal.thickSpan],
        clearcoat: 1.0,
        clearcoatRoughness: 0.03,
        envMapIntensity: 3.8,
      });

      const cubeRT = new THREE.WebGLCubeRenderTarget(256, {
        type: THREE.HalfFloatType,
      });
      const cubeCam = new THREE.CubeCamera(0.35, 60, cubeRT);
      cubeCam.layers.enable(ENV_LAYER);
      cubeCam.children.forEach((cam) => cam.layers.enable(ENV_LAYER));
      scene.add(cubeCam);

      material.envMap = cubeRT.texture;

      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.y = BASE_ROT_Y;
      mesh.rotation.x = BASE_ROT_X;

      const s = 0.74;
      mesh.scale.setScalar(s);

      const slot = (j + lane.phase) / lane.count;
      const baseX = -WRAP_LIMIT + slot * WRAP_SPAN;
      mesh.position.set(baseX, lane.y, 0);

      mesh.userData = {
        baseX,
        hx: 1.72 * s,
        hy: 0.92 * s,
        speed: lane.speed,
        phase: Math.random() * Math.PI * 2,
        thickBase: pal.thickBase,
        cubeCam,
        cubeRT,
        pmremRT: null,
      };

      scene.add(mesh);
      panels.push(mesh);
    }
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

  const wrap = (v, limit) => {
    const span = limit * 2;
    return (((v + limit) % span) + span) % span - limit;
  };

  const clock = new THREE.Clock();
  let reflectIndex = 0;

  function updateReflection(mesh) {
    const u = mesh.userData;
    mesh.visible = false;
    u.cubeCam.position.copy(mesh.position);
    u.cubeCam.update(renderer, scene);
    mesh.visible = true;
    if (u.pmremRT) u.pmremRT.dispose();
    u.pmremRT = pmrem.fromCubemap(u.cubeRT.texture);
    mesh.material.envMap = u.pmremRT.texture;
    mesh.material.needsUpdate = true;
  }

  function renderFrame() {
    const t = clock.getElapsedTime();

    for (const m of panels) {
      const u = m.userData;
      m.position.x = wrap(u.baseX + t * u.speed, WRAP_LIMIT);
      const th = u.thickBase + Math.sin(t * 0.5 + u.phase) * 90;
      m.material.iridescenceThicknessRange = [th, th + 340];
    }

    // Hard separation — if any pair's padded boxes overlap (including
    // across the wrap seam), nudge them apart on X only.
    for (let i = 0; i < panels.length; i++) {
      for (let j = i + 1; j < panels.length; j++) {
        const a = panels[i];
        const b = panels[j];
        const au = a.userData;
        const bu = b.userData;
        let dx = a.position.x - b.position.x;
        if (dx > WRAP_LIMIT) dx -= WRAP_SPAN;
        if (dx < -WRAP_LIMIT) dx += WRAP_SPAN;
        const dy = a.position.y - b.position.y;
        const minX = au.hx + bu.hx + GAP;
        const minY = au.hy + bu.hy + GAP;
        if (Math.abs(dx) >= minX || Math.abs(dy) >= minY) continue;
        const overlapX = minX - Math.abs(dx);
        const push = (overlapX / 2) * Math.sign(dx || 1);
        a.position.x = wrap(a.position.x + push, WRAP_LIMIT);
        b.position.x = wrap(b.position.x - push, WRAP_LIMIT);
        au.baseX = wrap(au.baseX + push, WRAP_LIMIT);
        bu.baseX = wrap(bu.baseX - push, WRAP_LIMIT);
      }
    }

    // Refresh a couple of local cube maps each frame so neighbors stay
    // visible in the metal without 9 extra scene renders every tick.
    const updates = reduceMotion ? 0 : 2;
    for (let i = 0; i < updates; i++) {
      updateReflection(panels[reflectIndex % panels.length]);
      reflectIndex += 1;
    }

    renderer.render(scene, camera);
  }

  // Seed reflections once so the first frame isn't dull.
  for (const m of panels) updateReflection(m);

  if (reduceMotion) {
    resize();
    renderer.render(scene, camera);
  } else {
    let running = true;
    const io = new IntersectionObserver(
      (entries) => {
        running = entries[0].isIntersecting;
      },
      { threshold: 0.01 }
    );
    io.observe(section);

    function loop() {
      requestAnimationFrame(loop);
      if (running) renderFrame();
    }
    loop();
  }
}
