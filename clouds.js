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
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

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

  // Raking lights from the sides — not sitting in front of the camera —
  // so the face-on slabs pick up hue instead of clipping to white.
  scene.add(new THREE.AmbientLight(0xb8c0c8, 0.18));
  const keyLight = new THREE.DirectionalLight(0xe8d8c8, 0.85);
  keyLight.position.set(-8, 3, 2);
  scene.add(keyLight);
  const coolRim = new THREE.DirectionalLight(0x6b8ca1, 1.35);
  coolRim.position.set(9, 1, 1.5);
  scene.add(coolRim);
  const blushRim = new THREE.DirectionalLight(0xe8b8c8, 0.7);
  blushRim.position.set(-4, -6, 2);
  scene.add(blushRim);
  const topFill = new THREE.DirectionalLight(0xf1ede1, 0.35);
  topFill.position.set(0, 10, 1);
  scene.add(topFill);

  const BOX_W = 4.35;
  const BOX_H = 1.85;
  const BOX_D = 0.82;
  const geometry = new RoundedBoxGeometry(BOX_W, BOX_H, BOX_D, 8, 0.38);

  // Largest face (16×8) square to the camera — no yaw or pitch.
  const BASE_ROT_Y = 0;
  const BASE_ROT_X = 0;

  // One shared Z-plane. Lanes sit in the upper half of the frame
  // with enough gap and shared speed so they never clip each other.
  const SPREAD_X = 13;
  const WRAP_LIMIT = SPREAD_X + 2.5;
  const WRAP_SPAN = WRAP_LIMIT * 2;
  const GAP = 0.55;
  const lanes = [
    { y: 0.85, count: 6, speed: 0.38, phase: 0.0 },
    { y: 3.45, count: 6, speed: -0.34, phase: 0.5 },
  ];

  const palettes = [
    {
      // Warm Figma frame: cream, kept off-white so it doesn't clip
      color: 0xd8cfc0,
      thickBase: 280,
      thickSpan: 420,
    },
    {
      // Cool Figma frame: steel blue
      color: 0x6b8ca1,
      thickBase: 90,
      thickSpan: 280,
    },
    {
      // Chartreuse cream from the warm frame
      color: 0xd6d4b8,
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
        metalness: 0.82,
        roughness: 0.1,
        iridescence: 1.0,
        iridescenceIOR: 1.35,
        iridescenceThicknessRange: [pal.thickBase, pal.thickBase + pal.thickSpan],
        clearcoat: 0.7,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.55,
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

      const s = 0.9;
      mesh.scale.setScalar(s);

      const slot = (j + lane.phase) / lane.count;
      const baseX = -WRAP_LIMIT + slot * WRAP_SPAN;
      mesh.position.set(baseX, lane.y, 0);

      mesh.userData = {
        baseX,
        hx: (BOX_W / 2) * s,
        hy: (BOX_H / 2) * s,
        speed: lane.speed,
        phase: Math.random() * Math.PI * 2,
        thickBase: pal.thickBase,
        cubeCam,
        cubeRT,
        pmremRT: null,
        wobbleT: 99,
        wobbleAmpX: 0,
        wobbleAmpY: 0,
        wobbleAmpZ: 0,
        wobbleFreq: 8,
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
    try {
      const u = mesh.userData;
      mesh.visible = false;
      u.cubeCam.position.copy(mesh.position);
      u.cubeCam.update(renderer, scene);
      mesh.visible = true;
      if (u.pmremRT) u.pmremRT.dispose();
      u.pmremRT = pmrem.fromCubemap(u.cubeRT.texture);
      mesh.material.envMap = u.pmremRT.texture;
    } catch {
      mesh.visible = true;
    }
  }

  function renderFrame() {
    const t = clock.getElapsedTime();

    const dt = clock.getDelta();

    for (const m of panels) {
      const u = m.userData;
      m.position.x = wrap(u.baseX + t * u.speed, WRAP_LIMIT);
      u.wobbleT += dt;
      const damp = Math.exp(-u.wobbleT * 2.6);
      m.rotation.x =
        BASE_ROT_X + u.wobbleAmpX * Math.sin(u.wobbleT * u.wobbleFreq) * damp;
      m.rotation.y =
        BASE_ROT_Y +
        u.wobbleAmpY * Math.sin(u.wobbleT * u.wobbleFreq * 0.86) * damp;
      m.rotation.z =
        u.wobbleAmpZ * Math.sin(u.wobbleT * u.wobbleFreq * 1.12) * damp;
      const th = u.thickBase + Math.sin(t * 0.5 + u.phase) * 90;
      m.material.iridescenceThicknessRange = [th, th + 340];
    }

    // Same-lane only. Cross-lane pairs are already separated in Y;
    // do not rewrite baseX or the drift gets cancelled every frame.
    for (let i = 0; i < panels.length; i++) {
      for (let j = i + 1; j < panels.length; j++) {
        const a = panels[i];
        const b = panels[j];
        const au = a.userData;
        const bu = b.userData;
        if (Math.abs(a.position.y - b.position.y) > 0.01) continue;
        let dx = a.position.x - b.position.x;
        if (dx > WRAP_LIMIT) dx -= WRAP_SPAN;
        if (dx < -WRAP_LIMIT) dx += WRAP_SPAN;
        const minX = au.hx + bu.hx + GAP;
        if (Math.abs(dx) >= minX) continue;
        const push = ((minX - Math.abs(dx)) / 2) * Math.sign(dx || 1);
        a.position.x = wrap(a.position.x + push, WRAP_LIMIT);
        b.position.x = wrap(b.position.x - push, WRAP_LIMIT);
      }
    }

    const updates = reduceMotion ? 0 : 1;
    for (let i = 0; i < updates; i++) {
      updateReflection(panels[reflectIndex % panels.length]);
      reflectIndex += 1;
    }

    renderer.render(scene, camera);
  }

  const clickRay = new THREE.Raycaster();
  const clickPtr = new THREE.Vector2();
  const clickPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const clickHit = new THREE.Vector3();

  section.addEventListener("click", (event) => {
    if (reduceMotion) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    clickPtr.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    clickPtr.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    clickRay.setFromCamera(clickPtr, camera);
    if (!clickRay.ray.intersectPlane(clickPlane, clickHit)) return;

    for (const m of panels) {
      const dx = m.position.x - clickHit.x;
      const dy = m.position.y - clickHit.y;
      const falloff = Math.min(1.35, 2.4 / (Math.hypot(dx, dy) + 0.4));
      const u = m.userData;
      u.wobbleT = 0;
      u.wobbleAmpX = THREE.MathUtils.degToRad(8 + 16 * falloff) * Math.sign(dy || 1);
      u.wobbleAmpY = THREE.MathUtils.degToRad(10 + 18 * falloff) * Math.sign(dx || 1);
      u.wobbleAmpZ = THREE.MathUtils.degToRad(5 + 8 * falloff) * (dx >= 0 ? 1 : -1);
      u.wobbleFreq = 6.5 + Math.random() * 3.5;
    }
  });

  if (reduceMotion) {
    for (const m of panels) updateReflection(m);
    resize();
    renderer.render(scene, camera);
  } else {
    let running = true;
    const io = new IntersectionObserver(
      (entries) => {
        running = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0 }
    );
    io.observe(section);

    function loop() {
      requestAnimationFrame(loop);
      if (running) renderFrame();
    }
    loop();
  }
}
