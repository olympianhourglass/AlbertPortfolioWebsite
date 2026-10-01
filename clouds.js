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
  renderer.toneMappingExposure = 1.4;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 11);

  // --- Environment: an equirectangular gradient built from the Figma colors.
  // The metallic panels reflect this, so their iridescence rides on pink/blue.
  function makeEnvTexture() {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 512;
    const ctx = c.getContext("2d");

    // Base diagonal gradient: cool at top, dark core, warm at bottom.
    const g = ctx.createLinearGradient(0, 0, c.width, c.height);
    g.addColorStop(0.0, "#a7c6da");
    g.addColorStop(0.22, "#6b8ca1");
    g.addColorStop(0.42, "#3a2f5c");
    g.addColorStop(0.6, "#2a2142");
    g.addColorStop(0.78, "#f3cfe0");
    g.addColorStop(1.0, "#ff5bb0");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);

    // Soft bright blobs give the metal lively, silky specular highlights.
    const blobs = [
      { x: 0.2, y: 0.25, r: 0.28, col: "rgba(210,230,255,0.9)" },
      { x: 0.78, y: 0.2, r: 0.22, col: "rgba(255,255,255,0.85)" },
      { x: 0.5, y: 0.82, r: 0.3, col: "rgba(255,150,205,0.9)" },
      { x: 0.85, y: 0.7, r: 0.2, col: "rgba(255,235,245,0.8)" },
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
  envTex.dispose();

  // --- Lights for moving silky specular (animated below)
  scene.add(new THREE.AmbientLight(0xffffff, 0.32));
  const keyLight = new THREE.DirectionalLight(0xffd6ec, 1.5); // warm pink
  keyLight.position.set(5, 4, 6);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0xa8c8ff, 1.2); // cool blue
  rimLight.position.set(-6, -2, 4);
  scene.add(rimLight);

  // --- Panels: rounded boxes, wide 16 x 8 face toward the viewer,
  // with a chunkier depth so the slabs read thicker.
  const geometry = new RoundedBoxGeometry(3.2, 1.6, 0.62, 6, 0.12);

  // Shared orientation => all panels stay parallel in 3D space.
  // Mostly face-on so the big 16x8 face reads large, with a modest angle
  // so the 2-unit thickness is still visible as real 3D depth.
  const BASE_ROT_Y = THREE.MathUtils.degToRad(22);
  const BASE_ROT_X = THREE.MathUtils.degToRad(-10);

  const COUNT = 11;
  const SPREAD_X = 11;
  const panels = [];

  for (let i = 0; i < COUNT; i++) {
    const material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x9aa6b2),
      metalness: 1.0,
      roughness: 0.05,
      iridescence: 1.0,
      iridescenceIOR: 1.4,
      iridescenceThicknessRange: [120, 500],
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 2.4,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.y = BASE_ROT_Y;
    mesh.rotation.x = BASE_ROT_X;

    const depth = Math.random(); // 0 near .. 1 far
    const s = 1.15 - depth * 0.55 + (Math.random() * 0.3 - 0.15);
    mesh.scale.setScalar(s);

    const baseX = (Math.random() * 2 - 1) * SPREAD_X;
    const baseY = (Math.random() * 2 - 1) * 3.0;
    const z = -depth * 5 + (Math.random() * 1.5 - 0.75);
    mesh.position.set(baseX, baseY, z);

    mesh.userData = {
      baseX,
      baseY,
      z,
      speed: (0.25 + Math.random() * 0.5) * (Math.random() > 0.5 ? 1 : -1),
      bobAmp: 0.12 + Math.random() * 0.35,
      bobSpeed: 0.2 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
      // slight per-panel thickness shimmer start, kept subtle so they read as parallel
      thickBase: 120 + Math.random() * 120,
    };

    scene.add(mesh);
    panels.push(mesh);
  }

  // --- Sizing
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

  function renderFrame() {
    const t = clock.getElapsedTime();

    // Moving lights -> silky specular travels across the metal.
    keyLight.position.set(Math.cos(t * 0.18) * 6, 4, Math.sin(t * 0.18) * 6);
    rimLight.position.set(-6, Math.sin(t * 0.15) * 3, Math.cos(t * 0.2) * 5);

    for (const m of panels) {
      const u = m.userData;
      // Drift horizontally and wrap, like slow clouds.
      m.position.x = wrap(u.baseX + t * u.speed, SPREAD_X + 2);
      m.position.y = u.baseY + Math.sin(t * u.bobSpeed + u.phase) * u.bobAmp;
      // Gentle shared sway keeps them parallel while adding life.
      m.rotation.y = BASE_ROT_Y + Math.sin(t * 0.1) * 0.04;
      // Subtle iridescent film-thickness breathing for a shifting sheen.
      const th = u.thickBase + Math.sin(t * 0.5 + u.phase) * 90;
      m.material.iridescenceThicknessRange = [th, th + 340];
    }

    renderer.render(scene, camera);
  }

  if (reduceMotion) {
    resize();
    renderFrame();
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
