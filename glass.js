// Glass tiles — keyed glass modules on a soft cream set, lit like a product shot.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const setVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const setFragment = /* glsl */ `
  uniform float uTime;
  uniform float uWall;
  uniform float uRadius;
  uniform vec3 uLight;
  uniform vec3 uStacks[4];
  varying vec3 vWorld;

  #define TAU 6.28318530718

  float caustic(vec2 uv, float time) {
    vec2 p = mod(uv * TAU, TAU) - 250.0;
    vec2 i = p;
    float c = 1.0;
    float inten = 0.005;
    for (int n = 0; n < 5; n++) {
      float t = time * (1.0 - (3.5 / float(n + 1)));
      i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
      c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
    }
    c /= 5.0;
    c = 1.17 - pow(c, 1.4);
    return pow(abs(c), 8.0);
  }

  vec3 causticRGB(vec2 uv, float t) {
    vec2 s = vec2(0.012, 0.004);
    return vec3(caustic(uv + s, t), caustic(uv, t), caustic(uv - s, t));
  }

  void main() {
    vec3 cream = vec3(0.9, 0.87, 0.81);
    vec3 warm = vec3(1.0, 0.94, 0.82);
    vec3 col = cream;
    vec2 L2 = normalize(-uLight.xz);
    float t = uTime * 0.55;

    if (uWall < 0.5) {
      float slope = length(uLight.xz) / max(uLight.y, 0.1);
      float pool = 0.0;
      float ao = 0.0;
      for (int k = 0; k < 4; k++) {
        vec2 d = vWorld.xz - uStacks[k].xy;
        float hgt = uStacks[k].z;
        float a = dot(d, L2);
        float b = dot(d, vec2(-L2.y, L2.x));
        float reach = hgt * slope;
        float m = smoothstep(-0.9, 0.3, a)
          * (1.0 - smoothstep(reach * 0.55, reach * 1.05, a))
          * (1.0 - smoothstep(0.6, 1.6, abs(b)));
        pool += m * (1.0 - 0.5 * clamp(a / max(reach, 0.01), 0.0, 1.0));
        ao += exp(-dot(d, d) * 1.6) * 0.6 + exp(-b * b * 2.5) * smoothstep(-0.5, 0.5, a) * (1.0 - smoothstep(0.0, reach, a)) * 0.25;
      }
      pool = clamp(pool, 0.0, 1.4);
      col *= 1.0 - clamp(ao, 0.0, 1.0) * 0.16;
      vec3 c = causticRGB(vWorld.xz * 0.34, t);
      col += c * pool * warm * 0.7 + pool * 0.04 * warm;
      col *= mix(1.0, 0.97, smoothstep(5.0, uRadius, length(vWorld.xz)));
    } else {
      float ang = atan(vWorld.z, vWorld.x);
      float y = vWorld.y;
      float band = smoothstep(0.2, 1.6, y) * (1.0 - smoothstep(6.0, 11.0, y));
      float da = ang - atan(L2.y, L2.x);
      da = atan(sin(da), cos(da));
      float db = ang - atan(-L2.y, -L2.x);
      db = atan(sin(db), cos(db));
      float through = exp(-da * da * 2.5) * band;
      float bounced = exp(-db * db * 4.0) * band * 0.4;
      vec2 uv = vec2(ang * uRadius * 0.16, y * 0.22);
      vec3 c = causticRGB(uv, t * 0.8);
      col = mix(cream, vec3(0.94, 0.92, 0.88), smoothstep(0.0, 12.0, y));
      col *= mix(0.97, 1.0, smoothstep(0.0, 2.5, y));
      col += c * warm * (through * 0.4 + bounced * 0.3) + warm * (through + bounced) * 0.02;
    }

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

function initGlass(section, canvas) {
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#f4f1ea");
  const pmrem = new THREE.PMREMGenerator(renderer);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);

  const light = new THREE.Vector3(0.55, 0.75, 0.37).normalize();
  const sun = new THREE.DirectionalLight("#fff6e8", 1.1);
  sun.position.copy(light).multiplyScalar(12);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight("#fffaf0", "#e9dfcc", 0.3));

  // One module, keyed to stack: a rim on top, a skirt below that drops over the rim beneath.
  const MOD = { size: 1.5, height: 0.6, radius: 0.2, lip: 0.07 };
  const PITCH = MOD.height + MOD.lip;
  const GAP = 0.2;
  const STEP = MOD.size + GAP;
  const columns = [
    { at: [0, 0], count: 5 },
    { at: [STEP, 0], count: 3 },
    { at: [0, STEP], count: 2 },
    { at: [STEP, STEP], count: 1 },
  ];

  function roundedRect(w, d, r) {
    const s = new THREE.Shape();
    const x = -w / 2;
    const y = -d / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + d - r);
    s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
    s.lineTo(x + r, y + d);
    s.quadraticCurveTo(x, y + d, x, y + d - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  function ringGeometry(outer, band, height, r) {
    const bevel = Math.min(0.018, height * 0.3);
    const shape = roundedRect(outer - bevel * 2, outer - bevel * 2, r);
    const inner = outer - band * 2 + bevel * 2;
    shape.holes.push(roundedRect(inner, inner, Math.max(0.02, r - band)));
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: height - bevel * 2,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 3,
      curveSegments: 18,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, bevel, 0);
    return geo;
  }

  const bodyGeo = new RoundedBoxGeometry(MOD.size, MOD.height, MOD.size, 6, MOD.radius);
  const rimOuter = MOD.size - 0.26;
  const rimGeo = ringGeometry(rimOuter, 0.1, MOD.lip, 0.12);
  rimGeo.translate(0, MOD.height / 2, 0);
  const skirtGeo = ringGeometry(MOD.size - 0.06, (MOD.size - 0.06 - (rimOuter + 0.03)) / 2, MOD.lip, 0.14);
  skirtGeo.translate(0, -MOD.height / 2 - MOD.lip, 0);

  const tints = [
    { tint: "#eef1ef", dist: 12, rough: 0.0, ior: 1.5 },
    { tint: "#e3ebe8", dist: 8, rough: 0.0, ior: 1.52 },
    { tint: "#f2f2f0", dist: 16, rough: 0.32, ior: 1.5 },
    { tint: "#dde8e4", dist: 7, rough: 0.0, ior: 1.54 },
    { tint: "#eceeed", dist: 12, rough: 0.0, ior: 1.48 },
    { tint: "#e6ecea", dist: 10, rough: 0.18, ior: 1.52 },
  ];

  function glassFor(k) {
    const t = tints[k % tints.length];
    return new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      metalness: 0,
      roughness: t.rough,
      transmission: 1,
      thickness: 1.0,
      ior: t.ior,
      attenuationColor: new THREE.Color(t.tint),
      attenuationDistance: t.dist,
      specularIntensity: 1,
      clearcoat: t.rough > 0 ? 0 : 0.8,
      clearcoatRoughness: 0.01,
      envMapIntensity: 1.0,
    });
  }

  const stackUniform = [];
  const group = new THREE.Group();
  scene.add(group);
  let k = 0;
  columns.forEach((col) => {
    for (let i = 0; i < col.count; i++) {
      const mat = glassFor(k++ * 5 + 1);
      const block = new THREE.Group();
      block.add(
        new THREE.Mesh(bodyGeo, mat),
        new THREE.Mesh(rimGeo, mat),
        new THREE.Mesh(skirtGeo, mat)
      );
      block.position.set(col.at[0], MOD.lip + MOD.height / 2 + i * PITCH, col.at[1]);
      group.add(block);
    }
    stackUniform.push(new THREE.Vector3(col.at[0], col.at[1], MOD.lip + col.count * PITCH));
  });
  group.position.set(-STEP / 2, 0, -STEP / 2);
  stackUniform.forEach((v) => {
    v.x -= STEP / 2;
    v.y -= STEP / 2;
  });

  const RADIUS = 16;
  const setUniforms = (wall) => ({
    uTime: { value: 0 },
    uWall: { value: wall },
    uRadius: { value: RADIUS },
    uLight: { value: light },
    uStacks: { value: stackUniform },
  });
  const floorMat = new THREE.ShaderMaterial({
    uniforms: setUniforms(0),
    vertexShader: setVertex,
    fragmentShader: setFragment,
  });
  const wallMat = new THREE.ShaderMaterial({
    uniforms: setUniforms(1),
    vertexShader: setVertex,
    fragmentShader: setFragment,
    side: THREE.BackSide,
  });

  const floor = new THREE.Mesh(new THREE.CircleGeometry(RADIUS, 96), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(RADIUS, RADIUS, 30, 128, 1, true),
    wallMat
  );
  wall.position.y = 15;
  scene.add(wall);

  // Reflection studio: dark surround, one big overhead softbox, thin side strips.
  // The glass edges mirror the dark band, which is what gives the reference its crisp black rims.
  const envScene = new THREE.Scene();
  envScene.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(30, 48, 24),
      new THREE.MeshBasicMaterial({ color: "#0c0d0d", side: THREE.BackSide })
    )
  );
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(30, 48),
    new THREE.MeshBasicMaterial({ color: "#3a3936" })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2;
  envScene.add(ground);
  const glow = (r, g, b) =>
    new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), side: THREE.DoubleSide });
  const overhead = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), glow(2.4, 2.4, 2.35));
  overhead.position.set(0, 14, 0);
  overhead.rotation.x = Math.PI / 2;
  envScene.add(overhead);
  for (const [x, y, z, sw, sh, v] of [
    [12, 9, 4, 0.9, 6, 2.2],
    [-11, 10, -6, 0.7, 5, 1.8],
    [3, 12, -13, 9, 0.8, 1.6],
  ]) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), glow(v, v, v * 0.98));
    strip.position.set(x, y, z);
    strip.lookAt(0, 2, 0);
    envScene.add(strip);
  }
  scene.environment = pmrem.fromScene(envScene, 0.015).texture;

  const target = new THREE.Vector3(0, 1.3, 0);

  function placeCamera(t) {
    const a = t * 0.16 + 0.6;
    const r = 12.5;
    camera.position.set(
      target.x + Math.cos(a) * r,
      4.4 + Math.sin(t * 0.21) * 0.4,
      target.z + Math.sin(a) * r
    );
    camera.lookAt(target);
  }

  function resize() {
    const w = section.clientWidth;
    const h = section.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1 ? 46 : 34;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  const clock = new THREE.Clock();
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
    if (!running) return;
    const t = reduceMotion ? 4 : clock.getElapsedTime();
    floorMat.uniforms.uTime.value = t;
    wallMat.uniforms.uTime.value = t;
    placeCamera(t);
    renderer.render(scene, camera);
  }
  loop();
}

const section = document.getElementById("showcase-glass");
const canvas = section?.querySelector(".glass-canvas");
if (section && canvas) initGlass(section, canvas);
