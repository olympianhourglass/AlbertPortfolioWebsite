// Iridescent 3D panels drifting like clouds on a black canvas.
// Real WebGL geometry + physically based iridescent/metallic material.
// Color inspiration (reflected environment) comes from the two Figma frames:
//   warm: cream -> rose -> hot pink (#ff5bb0)
//   cool: steel blue -> blue-grey -> cream (#6b8ca1)

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

function toyMaterial(color, envMap) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    metalness: 0.82,
    roughness: 0.16,
    iridescence: 1.0,
    iridescenceIOR: 1.4,
    iridescenceThicknessRange: [140, 520],
    clearcoat: 0.75,
    clearcoatRoughness: 0.08,
    envMap,
    envMapIntensity: 1.7,
  });
}

function makeToy(index, envMap) {
  const hues = [0xff6bb5, 0x6b8ca1, 0xf2e6a8, 0x8ec5ff, 0xff9a6b, 0xc4b5fd];
  const mat = toyMaterial(hues[index % hues.length], envMap);
  const group = new THREE.Group();
  const kind = index % 12;

  if (kind === 0) {
    group.add(new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.17, 20, 48), mat));
  } else if (kind === 1) {
    group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), mat));
  } else if (kind === 2) {
    group.add(
      new THREE.Mesh(new THREE.TorusKnotGeometry(0.3, 0.1, 90, 14, 2, 3), mat)
    );
  } else if (kind === 3) {
    group.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.52), mat));
  } else if (kind === 4) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.05, 28), mat);
    cone.rotation.z = 0.18;
    group.add(cone);
  } else if (kind === 5) {
    group.add(new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 24), mat));
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.045, 12, 48),
      toyMaterial(0xf6e6c8, envMap)
    );
    ring.rotation.x = 1.15;
    group.add(ring);
  } else if (kind === 6) {
    const cap = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.72, 8, 16), mat);
    cap.rotation.z = Math.PI / 2;
    group.add(cap);
  } else if (kind === 7) {
    group.add(new THREE.Mesh(new THREE.TetrahedronGeometry(0.58), mat));
  } else if (kind === 8) {
    group.add(new THREE.Mesh(new THREE.SphereGeometry(0.44, 32, 24), mat));
  } else if (kind === 9) {
    group.add(new THREE.Mesh(new THREE.DodecahedronGeometry(0.46), mat));
  } else if (kind === 10) {
    const a = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.1, 16, 40), mat);
    const b = new THREE.Mesh(
      new THREE.TorusGeometry(0.4, 0.1, 16, 40),
      toyMaterial(0xffd6ec, envMap)
    );
    a.rotation.x = 0.2;
    b.rotation.y = 1.2;
    group.add(a, b);
  } else {
    const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 28), mat);
    spool.rotation.z = Math.PI / 2;
    group.add(spool);
  }

  // Fill the facing face; keep Z short so they stay inside the thicker case.
  group.scale.set(1.28, 1.12, 0.52);
  return group;
}

function initCloudField(section) {
  const canvas = section.querySelector(".cloud-canvas");
  if (!canvas) return;
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  const isPlay = section.dataset.clouds === "play";
  const isToys = section.dataset.clouds === "toys";

  const looks = {
    keep: {
      exposure: 1.12,
      ambient: { color: 0xb8c0c8, intensity: 0.18 },
      key: { color: 0xe8d8c8, intensity: 0.85, pos: [-8, 3, 2] },
      cool: { color: 0x6b8ca1, intensity: 1.35, pos: [9, 1, 1.5] },
      blush: { color: 0xe8b8c8, intensity: 0.7, pos: [-4, -6, 2] },
      fill: { color: 0xf1ede1, intensity: 0.35, pos: [0, 10, 1] },
      palettes: [
        { color: 0xd8cfc0, thickBase: 280, thickSpan: 420 },
        { color: 0x6b8ca1, thickBase: 90, thickSpan: 280 },
        { color: 0xd6d4b8, thickBase: 340, thickSpan: 380 },
      ],
      metalness: 0.82,
      roughness: 0.1,
      iridescenceIOR: 1.35,
      clearcoat: 0.7,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.55,
      envGain: 1,
    },
    // Midway: luminous cream/steel/chartreuse, not the 2.55 white flash
    // and not the 1.7 muted metal.
    play: {
      exposure: 1.22,
      ambient: { color: 0xd8dce0, intensity: 0.26 },
      key: { color: 0xf2dcc8, intensity: 1.16, pos: [-7, 3.4, 2.55] },
      cool: { color: 0x8cb4cc, intensity: 1.55, pos: [8.4, 1.25, 2.05] },
      blush: { color: 0xffc4d6, intensity: 1.05, pos: [-3.4, -5.4, 2.45] },
      fill: { color: 0xf4eee0, intensity: 0.42, pos: [0, 9.2, 1.45] },
      palettes: [
        { color: 0xe6d8c6, thickBase: 260, thickSpan: 440 },
        { color: 0x8aacc0, thickBase: 70, thickSpan: 330 },
        { color: 0xe2daac, thickBase: 320, thickSpan: 400 },
      ],
      metalness: 0.91,
      roughness: 0.055,
      iridescenceIOR: 1.41,
      clearcoat: 0.9,
      clearcoatRoughness: 0.05,
      envMapIntensity: 2.12,
      envGain: 1.22,
    },
    toys: {
      exposure: 1.26,
      ambient: { color: 0xd8dce0, intensity: 0.28 },
      key: { color: 0xf2dcc8, intensity: 1.2, pos: [-7, 3.4, 2.6] },
      cool: { color: 0x8cb4cc, intensity: 1.65, pos: [8.4, 1.3, 2.1] },
      blush: { color: 0xffc0d8, intensity: 1.15, pos: [-3.4, -5.4, 2.5] },
      fill: { color: 0xf4eee0, intensity: 0.48, pos: [0, 9.2, 1.5] },
      palettes: [
        { color: 0xe4d6c4, thickBase: 260, thickSpan: 480 },
        { color: 0x88a8bc, thickBase: 70, thickSpan: 340 },
        { color: 0xe0d8a8, thickBase: 320, thickSpan: 420 },
      ],
      metalness: 0.94,
      roughness: 0.045,
      iridescenceIOR: 1.42,
      clearcoat: 0.95,
      clearcoatRoughness: 0.04,
      envMapIntensity: 2.55,
      envGain: 1.35,
    },
  };
  const look = looks[section.dataset.clouds] || looks.keep;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = look.exposure;

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

    const gain = look.envGain;
    const g = ctx.createLinearGradient(0, 0, c.width, c.height);
    g.addColorStop(0.0, `rgba(167,198,218,${0.4 * gain})`);
    g.addColorStop(0.18, `rgba(107,140,161,${0.22 * gain})`);
    g.addColorStop(0.4, "rgba(20,16,32,0)");
    g.addColorStop(0.62, `rgba(246,247,232,${0.55 * gain})`);
    g.addColorStop(0.78, `rgba(241,237,225,${0.5 * gain})`);
    g.addColorStop(0.9, `rgba(243,207,224,${0.4 * gain})`);
    g.addColorStop(1.0, `rgba(255,91,176,${0.45 * gain})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);

    const blobs = [
      { x: 0.18, y: 0.22, r: 0.26, col: `rgba(210,230,255,${0.85 * gain})` },
      { x: 0.72, y: 0.16, r: 0.24, col: `rgba(246,247,232,${Math.min(isPlay ? 0.78 : 1, gain)})` },
      { x: 0.42, y: 0.38, r: 0.22, col: `rgba(247,248,230,${0.95 * gain})` },
      { x: 0.88, y: 0.48, r: 0.2, col: `rgba(238,241,236,${0.9 * gain})` },
      { x: 0.5, y: 0.82, r: 0.28, col: `rgba(255,150,205,${0.85 * gain})` },
      { x: 0.28, y: 0.7, r: 0.2, col: `rgba(241,237,225,${0.9 * gain})` },
    ];
    if (isPlay) {
      blobs.push(
        { x: 0.12, y: 0.55, r: 0.2, col: "rgba(130,190,230,0.58)" },
        { x: 0.78, y: 0.72, r: 0.22, col: "rgba(255,120,190,0.52)" }
      );
    }
    if (isToys) {
      blobs.push(
        { x: 0.12, y: 0.55, r: 0.22, col: "rgba(130,190,230,0.95)" },
        { x: 0.78, y: 0.72, r: 0.24, col: "rgba(255,110,190,0.9)" },
        { x: 0.58, y: 0.18, r: 0.18, col: "rgba(255,230,210,0.75)" }
      );
    }
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
  scene.add(new THREE.AmbientLight(look.ambient.color, look.ambient.intensity));
  const keyLight = new THREE.DirectionalLight(look.key.color, look.key.intensity);
  keyLight.position.set(...look.key.pos);
  scene.add(keyLight);
  const coolRim = new THREE.DirectionalLight(look.cool.color, look.cool.intensity);
  coolRim.position.set(...look.cool.pos);
  scene.add(coolRim);
  const blushRim = new THREE.DirectionalLight(look.blush.color, look.blush.intensity);
  blushRim.position.set(...look.blush.pos);
  scene.add(blushRim);
  const topFill = new THREE.DirectionalLight(look.fill.color, look.fill.intensity);
  topFill.position.set(...look.fill.pos);
  scene.add(topFill);

  const BOX_W = 4.35;
  const BOX_H = 1.85;
  const BOX_D = isToys ? 1.58 : 0.82;
  const geometry = new RoundedBoxGeometry(BOX_W, BOX_H, BOX_D, 8, isToys ? 0.42 : 0.38);

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

  const palettes = look.palettes;

  const panels = [];
  let panelIndex = 0;

  for (const lane of lanes) {
    for (let j = 0; j < lane.count; j++) {
      const pal = palettes[panelIndex % palettes.length];
      panelIndex += 1;

      const material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(pal.color),
        metalness: isToys ? 0.12 : look.metalness,
        roughness: isToys ? 0.06 : look.roughness,
        iridescence: 1.0,
        iridescenceIOR: isToys ? 1.5 : look.iridescenceIOR,
        iridescenceThicknessRange: [pal.thickBase, pal.thickBase + pal.thickSpan],
        clearcoat: isToys ? 1.0 : look.clearcoat,
        clearcoatRoughness: isToys ? 0.04 : look.clearcoatRoughness,
        envMapIntensity: isToys ? 2.1 : look.envMapIntensity,
        transparent: isToys,
        opacity: isToys ? 0.4 : 1,
        side: isToys ? THREE.DoubleSide : THREE.FrontSide,
        depthWrite: !isToys,
      });

      let cubeCam = null;
      let cubeRT = null;
      if (!isToys) {
        cubeRT = new THREE.WebGLCubeRenderTarget(256, {
          type: THREE.HalfFloatType,
        });
        cubeCam = new THREE.CubeCamera(0.35, 60, cubeRT);
        cubeCam.layers.enable(ENV_LAYER);
        cubeCam.children.forEach((cam) => cam.layers.enable(ENV_LAYER));
        scene.add(cubeCam);
        material.envMap = cubeRT.texture;
      } else {
        material.envMap = envRT.texture;
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.y = BASE_ROT_Y;
      mesh.rotation.x = BASE_ROT_X;
      if (isToys) mesh.renderOrder = 1;

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
        toy: null,
        toySpinX: 0,
        toySpinY: 0,
        toySpinZ: 0,
      };

      if (isToys) {
        const toy = makeToy(panelIndex - 1, envRT.texture);
        toy.renderOrder = 0;
        mesh.add(toy);
        mesh.userData.toy = toy;
        mesh.userData.toySpinX = 0.08 + Math.random() * 0.1;
        mesh.userData.toySpinY = 0.1 + Math.random() * 0.12;
        mesh.userData.toySpinZ = 0.55 + Math.random() * 0.7;
      }

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
  let lastTime = 0;
  let reflectIndex = 0;

  function updateReflection(mesh) {
    if (!mesh.userData.cubeCam) return;
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
    const dt = Math.min(0.05, Math.max(0, t - lastTime));
    lastTime = t;

    for (const m of panels) {
      const u = m.userData;
      m.position.x = wrap(u.baseX + t * u.speed, WRAP_LIMIT);
      u.wobbleT += dt;
      const damp = Math.exp(-u.wobbleT * 1.35);
      m.rotation.x =
        BASE_ROT_X + u.wobbleAmpX * Math.sin(u.wobbleT * u.wobbleFreq) * damp;
      m.rotation.y =
        BASE_ROT_Y +
        u.wobbleAmpY * Math.sin(u.wobbleT * u.wobbleFreq * 0.86) * damp;
      m.rotation.z =
        u.wobbleAmpZ * Math.sin(u.wobbleT * u.wobbleFreq * 1.12) * damp;
      const th = u.thickBase + Math.sin(t * 0.5 + u.phase) * 90;
      m.material.iridescenceThicknessRange = [th, th + 340];
      if (u.toy) {
        u.toy.rotation.x += dt * u.toySpinX;
        u.toy.rotation.y += dt * u.toySpinY;
        u.toy.rotation.z += dt * u.toySpinZ;
      }
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

  function pulseWobble(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    clickPtr.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    clickPtr.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    clickRay.setFromCamera(clickPtr, camera);
    const hit = clickRay.ray.intersectPlane(clickPlane, clickHit);

    for (const m of panels) {
      const u = m.userData;
      const dx = hit ? m.position.x - clickHit.x : clickPtr.x * 8;
      const dy = hit ? m.position.y - clickHit.y : clickPtr.y * 5;
      const falloff = Math.min(1.5, 3.2 / (Math.hypot(dx, dy) + 0.35));
      u.wobbleT = 0;
      u.wobbleAmpX = THREE.MathUtils.degToRad(16 + 22 * falloff) * Math.sign(dy || 1);
      u.wobbleAmpY = THREE.MathUtils.degToRad(20 + 26 * falloff) * Math.sign(dx || 1);
      u.wobbleAmpZ = THREE.MathUtils.degToRad(10 + 12 * falloff) * (dx >= 0 ? 1 : -1);
      u.wobbleFreq = 4.2 + Math.random() * 2.2;
    }
  }

  section.addEventListener("pointerdown", (event) => {
    if (reduceMotion || event.button !== 0) return;
    pulseWobble(event.clientX, event.clientY);
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

document.querySelectorAll(".showcase").forEach(initCloudField);
