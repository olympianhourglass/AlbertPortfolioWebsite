// Glass tiles — stacked rounded blocks on a cream set, caustics thrown on the floor and wall.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
function tileNormalMap(size = 256, cells = 3) {
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * cells;
      const v = (y / size) * cells;
      const fu = u - Math.floor(u);
      const fv = v - Math.floor(v);
      const pillow = Math.pow(Math.sin(Math.PI * fu) * Math.sin(Math.PI * fv), 0.45);
      const ripple =
        0.06 * Math.sin(u * 11 + Math.sin(v * 5) * 1.6) +
        0.04 * Math.sin(v * 13 + Math.cos(u * 4) * 1.2);
      height[y * size + x] = pillow + ripple;
    }
  }
  const data = new Uint8Array(size * size * 4);
  const strength = 3.2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const at = (xx, yy) =>
        height[((yy + size) % size) * size + ((xx + size) % size)];
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

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
  uniform vec3 uStacks[3];
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
    vec3 cream = vec3(0.89, 0.84, 0.75);
    vec3 warm = vec3(1.0, 0.94, 0.82);
    vec3 col = cream;
    vec2 L2 = normalize(-uLight.xz);
    float t = uTime * 0.55;

    if (uWall < 0.5) {
      float slope = length(uLight.xz) / max(uLight.y, 0.1);
      float pool = 0.0;
      float ao = 0.0;
      for (int k = 0; k < 3; k++) {
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
      vec2 g = abs(fract(vWorld.xz / 1.1) - 0.5);
      float grout = 1.0 - smoothstep(0.0, 0.012, 0.5 - max(g.x, g.y));
      col *= 1.0 - grout * 0.07 * (1.0 - smoothstep(6.0, 13.0, length(vWorld.xz)));
      col *= 1.0 - clamp(ao, 0.0, 1.0) * 0.16;
      vec3 c = causticRGB(vWorld.xz * 0.34, t);
      col += c * pool * warm * 1.1 + pool * 0.06 * warm;
      col *= mix(1.0, 0.97, smoothstep(5.0, uRadius, length(vWorld.xz)));
    } else {
      float ang = atan(vWorld.z, vWorld.x);
      float y = vWorld.y;
      float band = smoothstep(0.3, 2.0, y) * (1.0 - smoothstep(4.5, 8.5, y));
      float da = ang - atan(L2.y, L2.x);
      da = atan(sin(da), cos(da));
      float db = ang - atan(-L2.y, -L2.x);
      db = atan(sin(db), cos(db));
      float through = exp(-da * da * 5.0) * band;
      float bounced = exp(-db * db * 9.0) * band * 0.45;
      vec2 uv = vec2(ang * uRadius * 0.16, y * 0.22);
      vec3 c = causticRGB(uv, t * 0.8);
      col = mix(cream, vec3(0.93, 0.9, 0.83), smoothstep(0.0, 12.0, y));
      col *= mix(0.97, 1.0, smoothstep(0.0, 2.5, y));
      vec2 g = abs(fract(vec2(ang * uRadius, y) / 1.1) - 0.5);
      float grout = 1.0 - smoothstep(0.0, 0.01, 0.5 - max(g.x, g.y));
      col *= 1.0 - grout * 0.06 * (1.0 - smoothstep(6.0, 14.0, y));
      col += c * warm * (through * 0.5 + bounced * 0.4) + warm * (through + bounced) * 0.03;
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
  scene.background = new THREE.Color("#f3eee3");
  const pmrem = new THREE.PMREMGenerator(renderer);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);

  const light = new THREE.Vector3(0.72, 0.52, 0.46).normalize();
  const sun = new THREE.DirectionalLight("#fff6e8", 1.1);
  sun.position.copy(light).multiplyScalar(12);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight("#fffaf0", "#e9dfcc", 0.3));

  const stacks = [
    {
      at: [0, 0],
      blocks: [
        [1.7, 0.62, 1.7, 0.0],
        [1.55, 0.68, 1.55, 0.18],
        [1.7, 0.58, 1.7, -0.12],
        [1.45, 0.66, 1.45, 0.32],
        [1.6, 0.6, 1.6, 0.06],
        [1.3, 0.64, 1.3, -0.22],
      ],
    },
    {
      at: [2.25, 0.85],
      blocks: [
        [1.35, 0.6, 1.35, 0.4],
        [1.2, 0.66, 1.2, 0.1],
        [1.3, 0.58, 1.3, 0.55],
      ],
    },
    {
      at: [-1.95, 1.25],
      blocks: [
        [1.25, 0.64, 1.25, -0.35],
        [1.1, 0.6, 1.1, -0.05],
      ],
    },
  ];

  const normalMap = tileNormalMap();
  const glassA = new THREE.MeshPhysicalMaterial({
    color: "#ffffff",
    metalness: 0,
    roughness: 0.03,
    transmission: 1,
    thickness: 1.6,
    ior: 1.52,
    attenuationColor: new THREE.Color("#d2ece2"),
    attenuationDistance: 4.5,
    specularIntensity: 0.8,
    clearcoat: 0.3,
    clearcoatRoughness: 0.05,
    normalMap,
    normalScale: new THREE.Vector2(0.6, 0.6),
    envMapIntensity: 0.55,
  });
  const glassB = glassA.clone();
  glassB.roughness = 0.07;
  glassB.attenuationColor = new THREE.Color("#dcf0e8");
  glassB.normalScale = new THREE.Vector2(0.85, 0.85);

  const stackUniform = [];
  const group = new THREE.Group();
  scene.add(group);
  stacks.forEach((stack, s) => {
    let y = 0;
    stack.blocks.forEach(([bw, bh, bd, rot], i) => {
      const geo = new RoundedBoxGeometry(bw, bh, bd, 5, 0.16);
      const mesh = new THREE.Mesh(geo, (i + s) % 2 ? glassB : glassA);
      const jx = Math.sin(i * 2.3 + s) * 0.05;
      const jz = Math.cos(i * 1.7 + s * 2) * 0.05;
      mesh.position.set(stack.at[0] + jx, y + bh / 2, stack.at[1] + jz);
      mesh.rotation.y = rot;
      group.add(mesh);
      y += bh + 0.004;
    });
    stackUniform.push(new THREE.Vector3(stack.at[0], stack.at[1], y));
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

  const envScene = new THREE.Scene();
  envScene.add(floor.clone(), wall.clone());
  const softbox = new THREE.MeshBasicMaterial({
    color: new THREE.Color(3.2, 3.0, 2.7),
    side: THREE.DoubleSide,
  });
  for (const [x, y, z, sw, sh] of [
    [light.x * 9, light.y * 9 + 2, light.z * 9, 6, 3],
    [-7, 6, -4, 3, 5],
    [0, 11, 0, 7, 7],
  ]) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), softbox);
    panel.position.set(x, y, z);
    panel.lookAt(0, 1.5, 0);
    envScene.add(panel);
  }
  envScene.position.y = -1.2;
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;

  const target = new THREE.Vector3(0.1, 1.15, 0.35);

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
