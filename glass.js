// Glass tiles — stacked rounded blocks on a cream set, caustics thrown on the floor and wall.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
// Caps stay dead flat; only the walls and bevels share normals, so the plan corner shades as one curve.
function smooth(geo) {
  geo.deleteAttribute("uv");
  const pos = geo.attributes.position.array;
  const normals = new Float32Array(pos.length);
  const capCount = geo.groups.find((g) => g.materialIndex === 0)?.count ?? 0;
  const key = (i) => `${Math.round(pos[i] * 1e4)},${Math.round(pos[i + 1] * 1e4)},${Math.round(pos[i + 2] * 1e4)}`;
  const shared = new Map();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let v = 0; v < pos.length / 3; v += 3) {
    a.fromArray(pos, v * 3);
    b.fromArray(pos, v * 3 + 3);
    c.fromArray(pos, v * 3 + 6);
    const face = b.sub(a).cross(c.sub(a));
    for (let k = 0; k < 3; k++) {
      const i = (v + k) * 3;
      if (v < capCount) {
        const n = face.clone().normalize();
        normals.set([n.x, n.y, n.z], i);
      } else {
        const id = key(i);
        const sum = shared.get(id) || shared.set(id, new THREE.Vector3()).get(id);
        sum.add(face);
      }
    }
  }
  for (let v = capCount; v < pos.length / 3; v++) {
    const n = shared.get(key(v * 3)).clone().normalize();
    normals.set([n.x, n.y, n.z], v * 3);
  }
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  return geo;
}
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

// Soft occlusion toward the sun from each stack's box (xz centre, height). The longer the
// ray runs through glass, the deeper the shade, so edges feather instead of cutting hard.
// With physics on, the boxes are the loose blocks themselves (uBlocks: centre, w = live).
const stackShadow = /* glsl */ `
  uniform vec4 uBlocks[16];
  uniform float uUseBlocks;
  uniform float uBlockHalf;

  float boxOcc(vec3 p, vec3 inv, vec3 lo, vec3 hi) {
    if (all(greaterThan(p, lo - 0.03)) && all(lessThan(p, hi + 0.03))) return 0.0;
    vec3 t1 = (lo - p) * inv;
    vec3 t2 = (hi - p) * inv;
    vec3 tn = min(t1, t2);
    vec3 tf = max(t1, t2);
    float enter = max(max(tn.x, tn.y), max(tn.z, 0.0));
    float leave = min(min(tf.x, tf.y), tf.z);
    return smoothstep(0.0, 0.7, leave - enter);
  }

  float stackShadow(vec3 p, vec3 L) {
    float occ = 0.0;
    vec3 inv = 1.0 / L;
    if (uUseBlocks > 0.5) {
      vec3 ext = vec3(0.75, uBlockHalf, 0.75);
      for (int k = 0; k < 16; k++) {
        if (uBlocks[k].w < 0.5) continue;
        occ = max(occ, boxOcc(p, inv, uBlocks[k].xyz - ext, uBlocks[k].xyz + ext));
      }
      return occ;
    }
    for (int k = 0; k < 4; k++) {
      vec3 lo = vec3(uStacks[k].x - 0.75, 0.0, uStacks[k].y - 0.75);
      vec3 hi = vec3(uStacks[k].x + 0.75, uStacks[k].z, uStacks[k].y + 0.75);
      occ = max(occ, boxOcc(p, inv, lo, hi));
    }
    return occ;
  }
`;

// Light pulses from clicked tiles: xyz follows the tile, w is age in seconds (< 0 is idle);
// colour is the tile's filter times strength, alpha the source block's index.
const pulseChunk = /* glsl */ `
  uniform vec4 uPulse[4];
  uniform vec4 uPulseColor[4];
  uniform float uPulseCalm;

  float pulseEnv(float a) {
    return (1.0 - exp(-a * 30.0)) * exp(-a * mix(3.6, 6.0, uPulseCalm));
  }

  // A soft ring of light rolling outward across the set.
  float pulseWave(float a, float r) {
    float x = (r - a * 5.5) / (0.35 + a * 1.4);
    return exp(-x * x) * (1.0 - exp(-a * 30.0)) * exp(-a * 2.4) * (1.0 - uPulseCalm);
  }
`;

// Zero-mean film grain, re-seeded every frame so it shimmers instead of sitting on the glass.
const grain = /* glsl */ `
  float grainAt(vec2 px, float time) {
    vec3 p = fract(vec3(px, floor(time * 24.0)) * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z) - 0.5;
  }
`;

const setFragment = /* glsl */ `
  uniform float uTime;
  uniform float uWall;
  uniform float uRadius;
  uniform vec3 uLight;
  uniform vec3 uStacks[4];
  uniform vec3 uBase;
  uniform vec3 uTop;
  uniform vec3 uWarm;
  uniform float uTopCaustic;
  uniform float uCaustic;
  uniform float uHeight;
  uniform float uShadow;
  uniform float uAO;
  uniform float uVignette;
  uniform float uGrain;
  uniform vec3 uBlockTint[16];
  uniform float uTinted;
  varying vec3 vWorld;
  ${stackShadow}
  ${grain}
  ${pulseChunk}

  // How much of the segment from p to the pulse runs through a block (0 = clear).
  float segOcc(vec3 p, vec3 inv, vec3 lo, vec3 hi, float len) {
    vec3 t1 = (lo - p) * inv;
    vec3 t2 = (hi - p) * inv;
    vec3 tn = min(t1, t2);
    vec3 tf = max(t1, t2);
    float enter = max(max(tn.x, tn.y), max(tn.z, 0.0));
    float leave = min(min(min(tf.x, tf.y), tf.z), len);
    return smoothstep(0.0, 0.5, leave - enter);
  }

  // Each pulse is a point light riding its tile plus a rolling wave. Other tiles stand in the
  // way as tinted glass, and the caustics already on the set flare in the pulse colour.
  vec3 pulseLight(vec3 p, vec3 n, vec3 caus) {
    vec3 sum = vec3(0.0);
    vec3 ext = vec3(0.75, uBlockHalf, 0.75);
    for (int i = 0; i < 4; i++) {
      float a = uPulse[i].w;
      if (a < 0.0) continue;
      vec3 d = uPulse[i].xyz - p;
      float len = length(d);
      vec3 dir = d / max(len, 1e-3);
      // The whole tile glows, not a point at its centre, so wrap the falloff like an area light.
      float I = pulseEnv(a) * 2.6 * max(dot(n, dir) * 0.65 + 0.35, 0.0) / (1.0 + len * len * 0.7);
      I += pulseWave(a, length(d.xz)) * 0.7 / (1.0 + len * 0.3);
      if (I < 0.002) continue;
      vec3 vis = vec3(1.0);
      vec3 inv = 1.0 / dir;
      int src = int(uPulseColor[i].a + 0.5);
      for (int k = 0; k < 16; k++) {
        if (k == src || uBlocks[k].w < 0.5) continue;
        float o = segOcc(p, inv, uBlocks[k].xyz - ext, uBlocks[k].xyz + ext, len);
        vis *= mix(vec3(1.0), uBlockTint[k] * 0.3, o);
      }
      sum += uPulseColor[i].rgb * vis * I * (uBase * 0.9 + caus * 1.6);
    }
    return sum;
  }

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

  // Signed distance to a rounded square of half-size h and corner radius r.
  float roundedSquare(vec2 p, float h, float r) {
    vec2 d = abs(p) - (h - r);
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
  }

  void main() {
    vec3 warm = uWarm;
    vec3 col = uBase;
    vec2 L2 = normalize(-uLight.xz);
    float t = uTime * 0.55;
    float lift = mix(1.0, uTopCaustic, smoothstep(0.38, 0.56, gl_FragCoord.y / uHeight)) * uCaustic;

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
      if (uUseBlocks > 0.5) {
        for (int k = 0; k < 16; k++) {
          if (uBlocks[k].w < 0.5) continue;
          vec2 d = vWorld.xz - uBlocks[k].xz;
          float near = exp(-max(uBlocks[k].y - uBlockHalf, 0.0) * 1.5);
          ao += exp(-dot(d, d) * 1.4) * 0.45 * near;
          pool += exp(-dot(d + L2 * 0.9, d + L2 * 0.9) * 0.9) * 0.5 * near;
        }
      }
      pool += 0.4 * (1.0 - smoothstep(2.5, 8.0, length(vWorld.xz)));
      pool = clamp(pool, 0.0, 1.4);
      col *= 1.0 - clamp(ao, 0.0, 1.0) * uAO;
      vec3 c = causticRGB(vWorld.xz * 0.34, t);
      col += (c * pool * warm * 1.1 + pool * 0.06 * warm) * lift;
      if (uTinted > 0.0 && uUseBlocks > 0.5) {
        // Each block casts its rounded footprint along the sun, feathering wider the further the
        // light travels. Light crossing it picks up the block's colour (stacked blocks multiply)
        // and focuses into a soft caustic pool that fades with distance; right under a block
        // resting on the floor no light gets through, so the contact stays dark.
        vec3 Ln = normalize(uLight);
        vec3 filt = vec3(1.0);
        float through = 0.0;
        float focus = 0.0;
        float contact = 0.0;
        for (int k = 0; k < 16; k++) {
          if (uBlocks[k].w < 0.5) continue;
          float s = max(uBlocks[k].y - vWorld.y, 0.0) / max(Ln.y, 0.1);
          float sd = roundedSquare(vWorld.xz + Ln.xz * s - uBlocks[k].xz, 0.75, 0.42);
          float soft = max(0.1 + s * 0.12, fwidth(sd));
          float o = 1.0 - smoothstep(-soft, soft, sd);
          filt *= mix(vec3(1.0), uBlockTint[k], o);
          through = max(through, o);
          focus = max(focus, (1.0 - smoothstep(-0.6, 0.0, sd)) * exp(-s * 0.35));
          float rest = 1.0 - smoothstep(0.0, 0.3, uBlocks[k].y - uBlockHalf);
          float under = roundedSquare(vWorld.xz - uBlocks[k].xz, 0.75, 0.42);
          contact = max(contact, rest * (1.0 - smoothstep(-0.4, 0.12, under)));
        }
        col *= mix(vec3(1.0 - through * uShadow), filt * (1.0 - through * uShadow * 0.4), uTinted);
        if (focus * (1.0 - contact) > 0.001) {
          vec3 fc = causticRGB(vWorld.xz * 0.62 + 3.1, t * 1.25);
          col += (fc * 0.8 + 0.04) * filt * warm * focus * (1.0 - contact) * uTinted * lift;
        }
        col *= 1.0 - contact * 0.5;
      } else {
        col *= 1.0 - stackShadow(vWorld, normalize(uLight)) * uShadow;
      }
      if (uUseBlocks > 0.5) col += pulseLight(vWorld, vec3(0.0, 1.0, 0.0), c * warm);
      col *= mix(1.0, 0.97 - uVignette, smoothstep(5.0, uRadius, length(vWorld.xz)));
    } else {
      float ang = atan(vWorld.z, vWorld.x);
      float y = vWorld.y;
      float band = smoothstep(0.2, 1.6, y) * (1.0 - smoothstep(6.0, 11.0, y));
      float da = ang - atan(L2.y, L2.x);
      da = atan(sin(da), cos(da));
      float db = ang - atan(-L2.y, -L2.x);
      db = atan(sin(db), cos(db));
      float through = max(exp(-da * da * 1.4), 0.45) * band;
      float bounced = exp(-db * db * 2.2) * band * 0.6;
      vec2 uv = vec2(ang * uRadius * 0.16, y * 0.22);
      vec3 c = causticRGB(uv, t * 0.8);
      col = mix(uBase, uTop, smoothstep(0.0, 12.0, y));
      col *= mix(0.97 - uVignette, 1.0 - uVignette * 0.5, smoothstep(0.0, 2.5, y));
      col += (c * warm * (through * 0.7 + bounced * 0.5) + warm * (through + bounced) * 0.03) * lift;
      if (uUseBlocks > 0.5) col += pulseLight(vWorld, normalize(vec3(-vWorld.x, 0.0, -vWorld.z)), c * warm);
    }

    col = max(col + grainAt(gl_FragCoord.xy, uTime) * uGrain, 0.0);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

// Set colours are linear (the shader converts to sRGB); `glass` is how much black sits in the body.
const THEMES = {
  cream: {
    background: "#f3eee3",
    base: [0.89, 0.84, 0.75],
    top: [0.93, 0.9, 0.83],
    warm: [1.0, 0.94, 0.82],
    ground: "#e9dfcc",
    glass: 0.04,
    edge: 0,
    topCaustic: 1,
    contrast: 1,
    shadow: 0.3,
    ao: 0.2,
    occl: 0.2,
    seam: 0.14,
    vignette: 0,
    grain: 0,
    ghost: "#e4efe9",
    ghostOpacity: 0.32,
    studio: false,
    env: 1.15,
    blockHeight: 0.3,
    blockLip: 0.05,
  },
  grey: {
    background: "#e3e3e3",
    base: [0.768, 0.768, 0.768],
    top: [0.8, 0.8, 0.8],
    warm: [1.0, 0.98, 0.95],
    ground: "#d4d4d4",
    // Two stacked 20% black layers: 1 - 0.8 × 0.8.
    glass: 0.36,
    edge: 0.92,
    topCaustic: 0,
    contrast: 1.4,
    shadow: 0.5,
    ao: 0.34,
    occl: 0.28,
    seam: 0.28,
    vignette: 0.1,
    grain: 0.035,
    ghost: "#8c8f8e",
    ghostOpacity: 0.42,
    // Ring of strip lights and black cards: highlights and darks sweep across the glass as it turns.
    studio: true,
    env: 1.5,
    blockHeight: 0.3,
    blockLip: 0.05,
  },
};
THEMES["grey-plain"] = { ...THEMES.grey, caustic: 0 };
// Salmon always at the base, blue through the middle, white on top; only the counts vary.
THEMES["grey-layered"] = {
  ...THEMES.grey,
  physics: true,
  // No black veil over the colour: the blocks stay bright; only a whisper of edge falloff.
  glass: 0,
  edge: 0.22,
  contrast: 1,
  occl: 0.16,
  seam: 0.2,
  ghostOpacity: 0.62,
  // Grain reads as noise along the thin rims at this scale; the colour carries the set instead.
  grain: 0,
  blockHeight: 0.3,
  blockLip: 0.05,
  // How much of each block's shadow becomes coloured light through it (0 = plain grey shadow).
  tintedCaustics: 0.75,
  layers: [
    { color: "#f59a94", tint: "#ec655f", dist: 2.4, rough: 0.02, ghost: "#ec655f", ink: "#fdf1ef", icons: ["chart-bar"] },
    { color: "#c5d5e4", tint: "#b5cadd", dist: 1.6, rough: 0.01, ghost: "#b5cadd", ink: "#22262c", icons: ["timer", "image"] },
    { color: "#ffffff", tint: "#ffffff", dist: 50, rough: 0.2, ghost: "#f4f4f4", ink: "#1a1a1a", icons: ["cloud-sun", "alarm", "bell"] },
  ],
  // One salmon base per stack at most; blue and white can repeat.
  stacks: [
    [1, 2, 2],
    [1, 2, 1],
    [1, 1, 2],
    [1, 1, 1],
  ],
};
// The same set in a black room: the light still pools and glints, it just has nothing to fill.
THEMES["grey-layered-dark"] = {
  ...THEMES["grey-layered"],
  background: "#000000",
  base: [0.003, 0.003, 0.003],
  top: [0.006, 0.006, 0.006],
  ground: "#050505",
  vignette: 0,
  caustic: 0.6,
};
THEMES["grey-layered-black"] = {
  ...THEMES["grey-layered-dark"],
  base: [0, 0, 0],
  top: [0, 0, 0],
  ground: "#000000",
  caustic: 0,
};

function initGlass(section, canvas, theme) {
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(theme.background);
  const pmrem = new THREE.PMREMGenerator(renderer);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);

  const light = new THREE.Vector3(0.72, 0.52, 0.46).normalize();
  const sun = new THREE.DirectionalLight("#fff6e8", 1.1);
  sun.position.copy(light).multiplyScalar(12);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight("#fffaf0", theme.ground, 0.3));

  // One module, keyed to stack: a rim on top, a skirt below that drops over the rim beneath.
  const MOD = { size: 1.5, height: theme.blockHeight ?? 0.6, radius: 0.34, lip: theme.blockLip ?? 0.07 };
  const PITCH = MOD.height + MOD.lip;
  const GAP = 0.2;
  const STEP = MOD.size + GAP;
  const spots = [[0, 0], [STEP, 0], [0, STEP], [STEP, STEP]];
  // A layered theme lists each stack bottom-up as layer counts, e.g. [salmon, blue, white].
  const columns = theme.stacks
    ? theme.stacks.map((counts, c) => {
        const layers = counts.flatMap((n, li) => Array(n).fill(theme.layers[li]));
        return { at: spots[c], count: layers.length, layers };
      })
    : [5, 3, 2, 1].map((count, c) => ({ at: spots[c], count }));

  // Superellipse corners (x⁴ + y⁴ = 1): curvature eases to zero where they meet the straight sides,
  // so there's no visible break between edge and radius. The extent is scaled up to read like radius r.
  const QUARTER = (() => {
    const half = 24;
    const m = Math.pow(0.5, 0.25);
    const pts = [];
    for (let i = 0; i <= half; i++) {
      const y = (m * i) / half;
      pts.push([Math.pow(1 - y ** 4, 0.25), y]);
    }
    for (let i = half - 1; i >= 0; i--) {
      const x = (m * i) / half;
      pts.push([x, Math.pow(1 - x ** 4, 0.25)]);
    }
    return pts;
  })();

  // Every outline in the module shares one corner centre, so bodies, rims, skirts and their
  // holes are true offsets of each other and bands keep an even width around the corners.
  const CORNER = MOD.size / 2 - MOD.radius * 1.6;

  function roundedRect(w) {
    const R = w / 2 - CORNER;
    const cx = CORNER;
    const cy = CORNER;
    const centers = [[cx, cy], [-cx, cy], [-cx, -cy], [cx, -cy]];
    const pts = [];
    centers.forEach(([ox, oy], q) => {
      for (const [px, py] of QUARTER) {
        const [rx, ry] = [[px, py], [-py, px], [-px, -py], [py, -px]][q];
        const p = new THREE.Vector2(ox + rx * R, oy + ry * R);
        if (!pts.length || p.distanceTo(pts[pts.length - 1]) > 1e-6) pts.push(p);
      }
    });
    if (pts[0].distanceTo(pts[pts.length - 1]) < 1e-6) pts.pop();
    return new THREE.Shape(pts);
  }

  function ringGeometry(outer, band, height) {
    const bevel = Math.min(0.028, height * 0.4, band * 0.3);
    const shape = roundedRect(outer - bevel * 2);
    shape.holes.push(roundedRect(outer - band * 2 + bevel * 2));
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: height - bevel * 2,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 8,
      curveSegments: 32,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, bevel, 0);
    return smooth(geo);
  }

  // Rounded in plan, near-square in section: a straight extrusion with only a fine edge bevel.
  function slabGeometry(size, height, bevel) {
    const shape = roundedRect(size - bevel * 2);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: height - bevel * 2,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 5,
      curveSegments: 48,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, -(height - bevel * 2) / 2, 0);
    return smooth(geo);
  }

  const bodyGeo = slabGeometry(MOD.size, MOD.height, 0.025);
  const rimOuter = MOD.size - 0.26;
  const rimGeo = ringGeometry(rimOuter, 0.1, MOD.lip);
  rimGeo.translate(0, MOD.height / 2, 0);
  const skirtGeo = ringGeometry(MOD.size - 0.06, (MOD.size - 0.06 - (rimOuter + 0.03)) / 2, MOD.lip);
  skirtGeo.translate(0, -MOD.height / 2 - MOD.lip, 0);
  // One draw per block instead of three.
  const blockGeo = mergeGeometries([bodyGeo, rimGeo, skirtGeo], false);

  const normalMap = tileNormalMap();
  const tints = [
    { tint: "#d8f0e6", dist: 9, rough: 0.0, ior: 1.5 },
    { tint: "#c4e6dc", dist: 6, rough: 0.0, ior: 1.52 },
    { tint: "#eef4ee", dist: 14, rough: 0.0, ior: 1.48 },
    { tint: "#b9e0d6", dist: 5, rough: 0.01, ior: 1.54 },
    { tint: "#dfeee8", dist: 10, rough: 0.0, ior: 1.5 },
    { tint: "#cdeee2", dist: 7, rough: 0.0, ior: 1.53 },
  ];

  function glassFor(k, layer) {
    const t = layer ? { ...tints[k % tints.length], ...layer } : tints[k % tints.length];
    return new THREE.MeshPhysicalMaterial({
      color: t.color || "#ffffff",
      metalness: 0,
      roughness: t.rough,
      transmission: 1,
      thickness: 1.0,
      ior: t.ior,
      attenuationColor: new THREE.Color(t.tint),
      attenuationDistance: t.dist,
      specularIntensity: 1,
      clearcoat: theme.studio ? 1 : 0.6,
      iridescence: theme.studio ? 0.35 : 0,
      iridescenceIOR: 1.3,
      iridescenceThicknessRange: [220, 480],
      clearcoatRoughness: 0.02,
      normalMap,
      normalScale: new THREE.Vector2(0.28, 0.28),
      envMapIntensity: theme.env,
    });
  }

  // The glass refracts our own behind pass, so three's transmission pass (a full-screen copy,
  // resolve and mip chain every frame) is pure overhead. Keep the transmission shader code via
  // the define, report zero transmission to the renderer, and feed the uniforms ourselves.
  function ownTransmission(mat) {
    mat.userData.look = {
      thickness: mat.thickness,
      dist: mat.attenuationDistance,
      tint: mat.attenuationColor.clone(),
    };
    mat.transmission = 0;
    mat.defines = { ...mat.defines, USE_TRANSMISSION: "" };
    return mat;
  }

  const blockUniform = Array.from({ length: 16 }, () => new THREE.Vector4());
  const useBlocks = { value: theme.physics ? 1 : 0 };
  // Per-block filter for light crossing the glass, in the same order as blockUniform: body colour
  // times Beer–Lambert attenuation across one block, normalised so the hue tints rather than dims.
  const blockTint = Array.from({ length: 16 }, () => new THREE.Vector3(1, 1, 1));
  function filterFor(layer) {
    const c = new THREE.Color(layer.color || "#ffffff");
    const a = new THREE.Color(layer.tint);
    const k = MOD.size / layer.dist;
    const v = new THREE.Vector3(c.r * a.r ** k, c.g * a.g ** k, c.b * a.b ** k);
    v.divideScalar(Math.max(v.x, v.y, v.z, 1e-3));
    return v.lerp(new THREE.Vector3(1, 1, 1), 0.25);
  }

  // Up to four pulses live at once, so rapid clicks layer; the oldest slot is reused.
  const pulsePos = Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, 0, -1));
  const pulseColor = Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, 0, -1));
  const pulseCalm = { value: reduceMotion ? 1 : 0 };
  const pulses = [];
  const PULSE_LIFE = 2;
  // Mirrors pulseEnv in the shaders, for the ghost glow in the behind pass.
  const pulseEnv = (a) => (1 - Math.exp(-a * 30)) * Math.exp(-a * (reduceMotion ? 6 : 3.6));
  function emitPulse(i) {
    if (pulses.length >= pulsePos.length) pulses.shift();
    pulses.push({ i, t0: performance.now() / 1000 });
  }

  // Stacks shade one another, each seam gets a contact line, and the glass carries a little black.
  const glassShade = {
    uBlocks: { value: blockUniform },
    uUseBlocks: useBlocks,
    uBody: { value: 1 - theme.glass },
    uEdge: { value: theme.edge },
    uContrast: { value: theme.contrast },
    uOccl: { value: theme.occl },
    uSeam: { value: theme.seam },
    uGrain: { value: theme.grain },
    uTime: { value: 0 },
    uBehind: { value: null },
    uBehindSize: { value: new THREE.Vector2(1, 1) },
    uStacks: { value: null },
    uLight: { value: light },
    uPitch: { value: PITCH },
    uLip: { value: MOD.lip },
    uBlockHalf: { value: MOD.height / 2 + MOD.lip },
    uPulse: { value: pulsePos },
    uPulseColor: { value: pulseColor },
    uPulseCalm: pulseCalm,
  };
  const centroid = (src, stage) =>
    src
      .replace(`#include <normal_pars_${stage}>`, THREE.ShaderChunk[`normal_pars_${stage}`])
      .replace(/varying (vec3 v(?:Normal|ViewPosition|WorldPosition|GlassWorld)|float vGlassLocalY);/g, "centroid varying $1;");
  function shadeGlass(mat) {
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, glassShade);
      shader.uniforms.uSelf = { value: mat.userData.self ?? -1 };
      const look = mat.userData.look;
      shader.uniforms.transmission.value = 1;
      shader.uniforms.thickness.value = look.thickness;
      shader.uniforms.attenuationDistance.value = look.dist;
      shader.uniforms.attenuationColor.value.copy(look.tint);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vGlassWorld;\nvarying float vGlassLocalY;")
        .replace(
          "#include <project_vertex>",
          "#include <project_vertex>\nvGlassWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvGlassLocalY = transformed.y;"
        );
      // Three's own transmission pass only holds opaque objects; refract our pass instead,
      // which also carries the other blocks.
      const behind = THREE.ShaderChunk.transmission_pars_fragment
        .replaceAll("transmissionSamplerMap", "uBehind")
        .replaceAll("transmissionSamplerSize", "uBehindSize")
        .replace("EnvironmentBRDF( n, v,", "EnvironmentBRDF( pixelFacing( n, v ), v,");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <transmission_pars_fragment>", behind)
        .replace(
          "float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );",
          "float dotNVcc = pixelNV( saturate( dot( geometryClearcoatNormal, geometryViewDir ) ) );"
        )
        .replace(
          "#include <common>",
          `#include <common>
          varying vec3 vGlassWorld;
          varying float vGlassLocalY;
          uniform vec3 uStacks[4];
          uniform vec3 uLight;
          uniform float uPitch;
          uniform float uLip;
          uniform float uBody;
          uniform float uEdge;
          uniform float uContrast;
          uniform float uOccl;
          uniform float uSeam;
          uniform float uGrain;
          uniform float uTime;
          uniform float uSelf;
          // On a silhouette thinner than a pixel, N·V sweeps to zero inside one pixel and the
          // Fresnel term goes to a full mirror, swallowing the refraction: a dark dot on every
          // stair step. Hold N·V up by its own spread across the pixel.
          float pixelNV(float nv) {
            return max(nv, min(fwidth(nv) * 1.5, 0.5));
          }
          vec3 pixelFacing(vec3 n, vec3 v) {
            float nv = dot(n, v);
            return normalize(n + v * max(pixelNV(nv) - nv, 0.0));
          }
          ${stackShadow}
          ${grain}
          ${pulseChunk}`
        )
        .replace(
          "#include <lights_physical_fragment>",
          `#include <lights_physical_fragment>
          // Rims and bevels turn faster than a pixel, so their sharp highlights would sparkle
          // and stair-step. Widen the lobes by the normal's screen-space spread (Tokuyoshi-Kaplanyan).
          {
            vec3 dnx = dFdx(nonPerturbedNormal);
            vec3 dny = dFdy(nonPerturbedNormal);
            float spread = min(0.5 * (dot(dnx, dnx) + dot(dny, dny)), 0.18);
            material.roughness = sqrt(sqrt(min(pow4(material.roughness) + spread, 1.0)));
            #ifdef USE_CLEARCOAT
              material.clearcoatRoughness = sqrt(sqrt(min(pow4(material.clearcoatRoughness) + spread, 1.0)));
            #endif
          }`
        )
        .replace(
          "#include <opaque_fragment>",
          `#include <opaque_fragment>
          float seamD = (abs(vGlassLocalY) - uPitch * 0.5) / uLip;
          float seamW = max(1.0, fwidth(seamD) * 1.5);
          float seam = exp(-seamD * seamD / (seamW * seamW)) / seamW;
          float occl = stackShadow(vGlassWorld, normalize(uLight));
          float facing = pixelNV(abs(dot(normalize(normal), normalize(vViewPosition))));
          float fres = 1.0 - min(facing, 1.0);
          fres *= fres;
          gl_FragColor.rgb *= 1.0 - uEdge * fres;
          gl_FragColor.rgb *= uBody * (1.0 - occl * uOccl) * (1.0 - seam * uSeam);
          gl_FragColor.rgb = max((gl_FragColor.rgb - 0.35) * uContrast + 0.35, 0.0);
          // A clicked tile glows from inside: light trapped in thick glass leaks out strongest at
          // grazing edges and along the rims. Neighbours catch it on the faces turned toward it.
          vec3 nV = normalize(normal);
          vec3 glow = vec3(0.0);
          for (int i = 0; i < 4; i++) {
            float a = uPulse[i].w;
            if (a < 0.0) continue;
            vec3 pc = uPulseColor[i].rgb;
            if (abs(uPulseColor[i].a - uSelf) < 0.5) {
              float e = pulseEnv(a);
              gl_FragColor.rgb *= 1.0 + (pc - 0.5) * e * 0.7;
              glow += pc * e * (0.08 + 0.85 * fres + 0.4 * seam);
            } else {
              vec3 d = uPulse[i].xyz - vGlassWorld;
              float wrap = dot(nV, normalize((viewMatrix * vec4(d, 0.0)).xyz)) * 0.5 + 0.5;
              float I = pulseEnv(a) / (1.0 + dot(d, d) * 0.7) + pulseWave(a, length(d.xz)) * 0.2;
              glow += pc * I * wrap * (0.25 + 0.9 * fres);
            }
          }
          gl_FragColor.rgb += glow;
          // Below zero the sRGB encode returns NaN, which lands as black specks along the rims.
          gl_FragColor.rgb = max(gl_FragColor.rgb + grainAt(gl_FragCoord.xy, uTime) * uGrain, 0.0);`
        );
      // Under MSAA an edge pixel's centre can sit off the triangle; shade the thin bevels from
      // inside it rather than from normals extrapolated past the edge.
      shader.vertexShader = centroid(shader.vertexShader, "vertex");
      shader.fragmentShader = centroid(shader.fragmentShader, "fragment");
    };
    return mat;
  }

  // Phosphor (regular) glyphs, 256-unit viewBox.
  const ICONS = {
    "cloud-sun": "M164,72a76.2,76.2,0,0,0-20.26,2.73,55.63,55.63,0,0,0-9.41-11.54l9.51-13.57a8,8,0,1,0-13.11-9.18L121.22,54A55.9,55.9,0,0,0,96,48c-.58,0-1.16,0-1.74,0L91.37,31.71a8,8,0,1,0-15.75,2.77L78.5,50.82A56.1,56.1,0,0,0,55.23,65.67L41.61,56.14a8,8,0,1,0-9.17,13.11L46,78.77A55.55,55.55,0,0,0,40,104c0,.57,0,1.15,0,1.72L23.71,108.6a8,8,0,0,0,1.38,15.88,8.24,8.24,0,0,0,1.39-.12l16.32-2.88a55.74,55.74,0,0,0,5.86,12.42A52,52,0,0,0,84,224h80a76,76,0,0,0,0-152ZM56,104a40,40,0,0,1,72.54-23.24,76.26,76.26,0,0,0-35.62,40,52.14,52.14,0,0,0-31,4.17A40,40,0,0,1,56,104ZM164,208H84a36,36,0,1,1,4.78-71.69c-.37,2.37-.63,4.79-.77,7.23a8,8,0,0,0,16,.92,58.91,58.91,0,0,1,1.88-11.81c0-.16.09-.32.12-.48A60.06,60.06,0,1,1,164,208Z",
    alarm: "M128,40a96,96,0,1,0,96,96A96.11,96.11,0,0,0,128,40Zm0,176a80,80,0,1,1,80-80A80.09,80.09,0,0,1,128,216ZM61.66,37.66l-32,32A8,8,0,0,1,18.34,58.34l32-32A8,8,0,0,1,61.66,37.66Zm176,32a8,8,0,0,1-11.32,0l-32-32a8,8,0,0,1,11.32-11.32l32,32A8,8,0,0,1,237.66,69.66ZM184,128a8,8,0,0,1,0,16H128a8,8,0,0,1-8-8V80a8,8,0,0,1,16,0v48Z",
    bell: "M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z",
    timer: "M128,40a96,96,0,1,0,96,96A96.11,96.11,0,0,0,128,40Zm0,176a80,80,0,1,1,80-80A80.09,80.09,0,0,1,128,216ZM173.66,90.34a8,8,0,0,1,0,11.32l-40,40a8,8,0,0,1-11.32-11.32l40-40A8,8,0,0,1,173.66,90.34ZM96,16a8,8,0,0,1,8-8h48a8,8,0,0,1,0,16H104A8,8,0,0,1,96,16Z",
    image: "M216,40H40A16,16,0,0,0,24,56V200a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A16,16,0,0,0,216,40Zm0,16V158.75l-26.07-26.06a16,16,0,0,0-22.63,0l-20,20-44-44a16,16,0,0,0-22.62,0L40,149.37V56ZM40,172l52-52,80,80H40Zm176,28H194.63l-36-36,20-20L216,181.38V200ZM144,100a12,12,0,1,1,12,12A12,12,0,0,1,144,100Z",
    "chart-bar": "M224,200h-8V40a8,8,0,0,0-8-8H152a8,8,0,0,0-8,8V80H96a8,8,0,0,0-8,8v40H48a8,8,0,0,0-8,8v64H32a8,8,0,0,0,0,16H224a8,8,0,0,0,0-16ZM160,48h40V200H160ZM104,96h40V200H104ZM56,144H88v56H56Z",
  };
  // A hair of raised enamel: the glyph is extruded from its outline, so the edges catch light.
  const ICON_SIZE = 0.56;
  const ICON_RAISE = 0.005;
  const iconGeos = new Map();
  function iconGeometry(name) {
    if (iconGeos.has(name)) return iconGeos.get(name);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path d="${ICONS[name]}"/></svg>`;
    const shapes = new SVGLoader().parse(svg).paths.flatMap((p) => SVGLoader.createShapes(p));
    // Depth is in world units; the outline (and so the bevel width) is still in 256-unit glyph space.
    const bevel = ICON_RAISE * 0.3;
    const bevelSize = (bevel * 256) / ICON_SIZE;
    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth: ICON_RAISE - bevel * 2,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize,
      bevelOffset: -bevelSize,
      bevelSegments: 2,
      curveSegments: 10,
    });
    // SVG y runs down; rotating (rather than mirroring) keeps the glyph readable from above.
    geo.translate(-128, -128, 0);
    geo.scale(ICON_SIZE / 256, ICON_SIZE / 256, 1);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, ICON_RAISE - bevel, 0);
    // A flat, single-layer outline for the shadow, so no area is darkened twice.
    const flat = new THREE.ShapeGeometry(shapes, 10);
    flat.translate(-128, -128, 0);
    flat.scale(ICON_SIZE / 256, ICON_SIZE / 256, 1);
    flat.rotateX(Math.PI / 2);
    flat.translate(0, ICON_RAISE, 0);
    geo.userData.flat = flat;
    iconGeos.set(name, geo);
    return geo;
  }
  const iconMats = new Map();
  function iconMaterial(ink) {
    if (iconMats.has(ink)) return iconMats.get(ink);
    const mat = new THREE.MeshPhysicalMaterial({
      color: ink,
      roughness: 0.34,
      metalness: 0,
      clearcoat: 0.8,
      clearcoatRoughness: 0.12,
      envMapIntensity: theme.env,
    });
    iconMats.set(ink, mat);
    return mat;
  }
  const iconMeshes = [];
  const iconCount = new Map();

  const stackUniform = [];
  const glassMeshes = [];
  const ghostColors = [];
  const blocks = [];
  const group = new THREE.Group();
  scene.add(group);
  let k = 0;
  columns.forEach((col) => {
    for (let i = 0; i < col.count; i++) {
      const layer = col.layers?.[i];
      if (layer && k < blockTint.length) blockTint[k].copy(filterFor(layer));
      const mat = shadeGlass(ownTransmission(glassFor(k++ * 5 + 1, layer)));
      mat.userData.self = blocks.length;
      const block = new THREE.Group();
      const parts = [new THREE.Mesh(blockGeo, mat)];
      glassMeshes.push(...parts);
      parts.forEach(() => ghostColors.push(layer?.ghost || theme.ghost));
      block.add(...parts);
      if (layer?.icons) {
        const n = iconCount.get(layer) ?? 0;
        iconCount.set(layer, n + 1);
        // Painted on the recessed top face inside the rim; every glyph reads in the same direction.
        const icon = new THREE.Mesh(iconGeometry(layer.icons[n % layer.icons.length]), iconMaterial(layer.ink));
        icon.position.y = MOD.height / 2 + 0.0004;
        block.add(icon);
        iconMeshes.push(icon);
      }
      block.position.set(col.at[0], MOD.lip + MOD.height / 2 + i * PITCH, col.at[1]);
      group.add(block);
      blocks.push(block);
    }
    stackUniform.push(new THREE.Vector3(col.at[0], col.at[1], MOD.lip + col.count * PITCH));
  });
  group.position.set(-STEP / 2, 0, -STEP / 2);
  stackUniform.forEach((v) => {
    v.x -= STEP / 2;
    v.y -= STEP / 2;
  });
  glassShade.uStacks.value = stackUniform;

  const tmp = new THREE.Vector3();
  function syncBlockUniform() {
    blocks.forEach((b, i) => {
      if (i < blockUniform.length) blockUniform[i].set(b.position.x, b.position.y, b.position.z, 1);
    });
  }

  // Real rigid bodies: click a block to punt it; double-click to restack.
  let physics = null;
  let jolt = 0;
  if (theme.physics) {
    group.updateMatrixWorld(true);
    blocks.forEach((b) => scene.attach(b));
    stackUniform.forEach((v) => v.set(1000, 1000, 0));
    syncBlockUniform();
    import("https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js").then((CANNON) => {
      physics = createPhysics(CANNON);
    });
  }

  // Heavy soda-lime glass. One scene unit reads as 10 cm, so a tile is roughly 15 × 15 × 3.5 cm
  // and about 2 kg. Gravity is tuned by eye a little past 9.8 so falls land hard without rushing.
  const GLASS_DENSITY = 2500;
  const UNIT_M = 0.1;
  const GRAVITY = -14;
  // speed: how fast a punt sends a tile (units/s); reach/below: how far up and down the stack the
  // hand connects; drag: per-step speed kept while touching something.
  // hop: the upward pop (units/s) that lifts a keyed tile off the rim beneath before the shove.
  const PUNT = { speed: 5.5, lift: 0.18, hop: 1.6, reach: 0.4, below: 0.1, drag: 0.995 };
  const FLOOR_MU = 0.6;
  const GLASS_MU = 0.42;
  const RESTACK_S = 0.7;
  const PHYS_DT = 1 / 120;

  function createPhysics(CANNON) {
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, GRAVITY, 0), allowSleep: true });
    world.solver.iterations = 20;
    world.solver.tolerance = 1e-4;
    const glassMat = new CANNON.Material("glass");
    const floorMat = new CANNON.Material("floor");
    const wallMat = new CANNON.Material("wall");
    // Cannon caps friction per contact point per step (not per second) and by the pair's reduced
    // mass, so a box face (four points) at 120 Hz grips ~480× its coefficient against the floor
    // and ~240× against an equal tile. Convert real μ into what the solver expects.
    const grip = (mu, reducedMass = 1) => (mu * PHYS_DT) / 4 / reducedMass;
    const stiff = { contactEquationStiffness: 1e7, contactEquationRelaxation: 4, frictionEquationStiffness: 1e7 };
    world.addContactMaterial(new CANNON.ContactMaterial(glassMat, floorMat, { friction: grip(FLOOR_MU), restitution: 0.12, ...stiff }));
    world.addContactMaterial(new CANNON.ContactMaterial(glassMat, glassMat, { friction: grip(GLASS_MU, 0.5), restitution: 0.15, ...stiff }));
    world.addContactMaterial(new CANNON.ContactMaterial(glassMat, wallMat, { friction: grip(0.3), restitution: 0.1, ...stiff }));

    const ground = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane(), material: floorMat });
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(ground);
    const fence = 28;
    for (let i = 0; i < fence; i++) {
      const a = (i / fence) * Math.PI * 2;
      const post = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Box(new CANNON.Vec3(2, 6, 0.4)), material: wallMat });
      post.position.set(Math.cos(a) * (RADIUS - 0.6), 6, Math.sin(a) * (RADIUS - 0.6));
      post.quaternion.setFromEuler(0, -a + Math.PI / 2, 0);
      world.addBody(post);
    }

    // The collider follows the visual module: body, rim on top, skirt below. The skirt is a solid
    // slab to everything but rims, and a four-sided ring to rims, so a rim can only ever sit inside
    // the skirt's hole — tiles key together in a stack and never pass through each other tumbled.
    const SHAPE = { body: 1, rim: 2, slab: 4, ring: 8 };
    const skirtOuter = MOD.size - 0.06;
    const skirtBand = (skirtOuter - (rimOuter + 0.03)) / 2;
    const skirtY = -MOD.height / 2 - MOD.lip / 2;
    // A hair short of the block above, so a keyed stack rests on its skirts alone, as it does now.
    const rimTop = MOD.height / 2 + MOD.lip - 0.004;
    const colliderParts = () => {
      const box = (x, y, z, group, mask, at) => {
        const s = new CANNON.Box(new CANNON.Vec3(x, y, z));
        s.collisionFilterGroup = group;
        s.collisionFilterMask = mask;
        return [s, at];
      };
      const ringSide = (skirtOuter - skirtBand) / 2;
      return [
        box(MOD.size / 2, MOD.height / 2, MOD.size / 2, SHAPE.body, -1, new CANNON.Vec3()),
        box(rimOuter / 2, (rimTop - MOD.height / 2 + MOD.lip) / 2, rimOuter / 2, SHAPE.rim, ~SHAPE.slab,
          new CANNON.Vec3(0, (rimTop + MOD.height / 2 - MOD.lip) / 2, 0)),
        box(skirtOuter / 2, MOD.lip / 2, skirtOuter / 2, SHAPE.slab, ~(SHAPE.rim | SHAPE.ring), new CANNON.Vec3(0, skirtY, 0)),
        ...[-1, 1].flatMap((s) => [
          box(skirtOuter / 2, MOD.lip / 2, skirtBand / 2, SHAPE.ring, SHAPE.rim, new CANNON.Vec3(0, skirtY, s * ringSide)),
          box(skirtBand / 2, MOD.lip / 2, skirtOuter / 2 - skirtBand, SHAPE.ring, SHAPE.rim, new CANNON.Vec3(s * ringSide, skirtY, 0)),
        ]),
      ];
    };
    const mass = MOD.size * MOD.size * PITCH * UNIT_M ** 3 * GLASS_DENSITY;
    const rest = blocks.map((b) => b.position.clone());
    const bodies = blocks.map((b) => {
      const body = new CANNON.Body({
        mass,
        material: glassMat,
        linearDamping: 0.01,
        angularDamping: 0.04,
        sleepSpeedLimit: 0.18,
        sleepTimeLimit: 0.35,
      });
      colliderParts().forEach(([s, at]) => body.addShape(s, at));
      body.position.set(b.position.x, b.position.y, b.position.z);
      world.addBody(body);
      body.sleep();
      return body;
    });

    // Free in the air, but anything touching scrubs off speed and rocking so it settles flat.
    const touching = new Set();
    const onFloor = new Set();
    const above = new Map();
    const load = new Map();
    // Cannon's friction ignores the weight stacked on a tile, so a loaded base would skate out
    // as easily as a lone one. Brake floor tiles for the tiles resting on them.
    const loadOf = (b, depth = 0) => {
      if (load.has(b)) return load.get(b);
      let n = 1;
      if (depth < bodies.length) above.get(b)?.forEach((u) => (n += loadOf(u, depth + 1)));
      load.set(b, n);
      return n;
    };
    world.addEventListener("postStep", () => {
      touching.clear();
      onFloor.clear();
      above.clear();
      load.clear();
      world.contacts.forEach((c) => {
        touching.add(c.bi);
        touching.add(c.bj);
        if (c.bi === ground || c.bj === ground) onFloor.add(c.bi === ground ? c.bj : c.bi);
        else {
          const [lo, hi] = c.bi.position.y < c.bj.position.y ? [c.bi, c.bj] : [c.bj, c.bi];
          if (hi.position.y - lo.position.y < PITCH * 0.5) return;
          if (!above.has(lo)) above.set(lo, new Set());
          above.get(lo).add(hi);
        }
      });
      bodies.forEach((b) => {
        if (!touching.has(b) || b.sleepState === CANNON.Body.SLEEPING) return;
        const slow = b.velocity.lengthSquared() < 0.09;
        b.angularVelocity.scale(slow ? 0.95 : PUNT.drag, b.angularVelocity);
        b.velocity.x *= slow ? 0.96 : PUNT.drag;
        b.velocity.z *= slow ? 0.96 : PUNT.drag;
        if (!onFloor.has(b)) return;
        const h = Math.hypot(b.velocity.x, b.velocity.z);
        const brake = FLOOR_MU * -GRAVITY * (loadOf(b) - 1) * PHYS_DT;
        if (h <= 0 || brake <= 0) return;
        const k = Math.max(0, h - brake) / h;
        b.velocity.x *= k;
        b.velocity.z *= k;
      });
    });

    // A hard landing nudges the camera a hair; quiet contacts do nothing.
    bodies.forEach((b) => {
      b.addEventListener("collide", (e) => {
        const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
        if (v > 1.2) jolt = Math.max(jolt, Math.min((v - 1.2) * 0.012, 0.035));
      });
    });

    let glide = null;
    function kick(i, point, dir) {
      if (glide) return;
      if (pending) shove();
      const body = bodies[i];
      bodies.forEach((b) => b.wakeUp());
      const push = new THREE.Vector3(dir.x, 0, dir.z).normalize();
      push.y = PUNT.lift;
      push.normalize().multiplyScalar(PUNT.speed * mass);
      // Keep the lever height so a high hit tips the block over, but soften the sideways lever
      // so heavy tiles topple instead of spinning like a coin.
      const lever = new THREE.Vector3(point.x - body.position.x, point.y - body.position.y, point.z - body.position.z);
      const along = push.clone().setY(0).normalize();
      const side = lever.clone().setY(0).sub(along.clone().multiplyScalar(lever.dot(along)));
      lever.sub(side.multiplyScalar(0.6));
      // A hand is a few tiles tall: neighbours in the same stack near the hit share the shove,
      // so the stack above loses its footing and topples.
      const near = (b) => Math.hypot(b.position.x - body.position.x, b.position.z - body.position.z) < MOD.size * 0.5;
      const shoves = [];
      bodies.forEach((b) => {
        const dy = b.position.y - point.y;
        const share = b === body ? 1 : near(b) ? 1 - Math.abs(dy) / (dy > 0 ? PUNT.reach : PUNT.below) : 0;
        if (share <= 0) return;
        const arm = b === body ? lever.y : Math.max(-PITCH / 2, Math.min(PITCH / 2, -dy));
        shoves.push([b, new CANNON.Vec3(push.x * share, push.y * share, push.z * share), new CANNON.Vec3(lever.x, arm, lever.z)]);
      });
      // Keyed tiles can't slide out sideways: the skirt would cut through the rim beneath. The hand
      // first pops the tile clear of the rim below, and the stack above clear of its rim, then shoves.
      const keyedBelow = bodies.some((b) => b !== body && near(b) && body.position.y - b.position.y > 0 && body.position.y - b.position.y < PITCH * 1.3);
      const stackAbove = bodies.filter((b) => b !== body && near(b) && b.position.y > body.position.y);
      if (!keyedBelow && !stackAbove.length) return shoves.forEach(([b, j, at]) => b.applyImpulse(j, at));
      const hop = keyedBelow ? PUNT.hop : 0;
      body.velocity.y += hop;
      stackAbove.forEach((b) => (b.velocity.y += hop + PUNT.hop));
      const y0 = body.position.y;
      const above = stackAbove.reduce((lo, b) => (!lo || b.position.y < lo.position.y ? b : lo), null);
      const gap = above ? above.position.y - y0 : 0;
      const clearance = MOD.lip + 0.01;
      pending = {
        until: world.time + 0.15,
        ready: () =>
          (!keyedBelow || body.position.y - y0 > clearance) && (!above || above.position.y - body.position.y - gap > clearance),
        shoves,
      };
    }
    let pending = null;
    function shove() {
      pending.shoves.forEach(([b, j, at]) => b.applyImpulse(j, at));
      pending = null;
    }
    world.addEventListener("postStep", () => {
      if (pending && (pending.ready() || world.time >= pending.until)) shove();
    });

    // Blocks glide home bottom-up instead of snapping, then rest asleep in the stack.
    function restack() {
      if (glide) return;
      pending = null;
      glide = {
        t: 0,
        from: bodies.map((b) => ({
          p: new THREE.Vector3(b.position.x, b.position.y, b.position.z),
          q: new THREE.Quaternion(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w),
        })),
      };
    }

    const home = new THREE.Quaternion();
    const q = new THREE.Quaternion();
    function stepGlide(dt) {
      glide.t += dt;
      let done = true;
      bodies.forEach((body, i) => {
        const delay = (rest[i].y / (PITCH * 4)) * 0.25;
        const u = Math.min(Math.max((glide.t - delay) / RESTACK_S, 0), 1);
        if (u < 1) done = false;
        const e = u * u * (3 - 2 * u);
        const p = glide.from[i].p.clone().lerp(rest[i], e);
        p.y += Math.sin(e * Math.PI) * 0.35;
        q.copy(glide.from[i].q).slerp(home, e);
        body.position.set(p.x, p.y, p.z);
        body.quaternion.set(q.x, q.y, q.z, q.w);
      });
      if (!done) return;
      bodies.forEach((body, i) => {
        body.position.set(rest[i].x, rest[i].y, rest[i].z);
        body.quaternion.set(0, 0, 0, 1);
        body.velocity.setZero();
        body.angularVelocity.setZero();
        body.aabbNeedsUpdate = true;
        body.sleep();
      });
      glide = null;
    }

    function step(dt) {
      if (glide) stepGlide(dt);
      else world.step(PHYS_DT, dt, 12);
      bodies.forEach((body, i) => {
        blocks[i].position.copy(body.position);
        blocks[i].quaternion.copy(body.quaternion);
      });
      syncBlockUniform();
    }

    return { kick, restack, step };
  }

  if (theme.physics) {
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hitAt = (e) => {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.intersectObjects(glassMeshes, false)[0];
    };
    canvas.addEventListener("pointermove", (e) => {
      canvas.style.cursor = hitAt(e) ? "pointer" : "default";
    });
    canvas.addEventListener("pointerdown", (e) => {
      const hit = hitAt(e);
      if (!hit || !physics) return;
      const i = blocks.indexOf(hit.object.parent);
      physics.kick(i, hit.point, ray.ray.direction);
      emitPulse(i);
    });
    canvas.addEventListener("dblclick", () => physics?.restack());
  }

  // What the glass sees through itself: the set plus every block as a faint, reflective ghost.
  const behindTarget = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    samples: 4,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
  });
  glassShade.uBehind.value = behindTarget.texture;
  const ghosts = new Map();
  const ghostFor = (color) => {
    if (!ghosts.has(color)) {
      ghosts.set(color, new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0,
        roughness: 0.04,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        envMapIntensity: theme.env,
        transparent: true,
        opacity: theme.ghostOpacity,
        depthWrite: false,
      }));
    }
    return ghosts.get(color);
  };
  // Loose tiles get their own ghost so a glowing one also shines through the tiles in front.
  const ghostMats = ghostColors.map((c) => (theme.physics ? ghostFor(c).clone() : ghostFor(c)));
  const glassMats = glassMeshes.map((m) => m.material);
  function syncPulses() {
    const now = performance.now() / 1000;
    while (pulses.length && now - pulses[0].t0 > PULSE_LIFE) pulses.shift();
    ghostMats.forEach((g) => g.emissive.setRGB(0, 0, 0));
    const strength = reduceMotion ? 0.6 : 1;
    pulsePos.forEach((p, s) => {
      const pulse = pulses[s];
      if (!pulse) return p.setW(-1);
      const age = now - pulse.t0;
      const tint = blockTint[pulse.i];
      p.copy(blocks[pulse.i].position).setW(age);
      // Squared so the light carries the tile's hue on a bright set instead of washing to pink-white.
      pulseColor[s].set(tint.x ** 2 * strength, tint.y ** 2 * strength, tint.z ** 2 * strength, pulse.i);
      const e = pulseEnv(age) * 0.8;
      const c = pulseColor[s];
      const g = ghostMats[pulse.i].emissive;
      g.setRGB(g.r + c.x * e, g.g + c.y * e, g.b + c.z * e);
    });
  }
  function renderBehind() {
    glassMeshes.forEach((m, i) => (m.material = ghostMats[i]));
    // A glyph in the refraction source would reappear, offset, inside its own tile.
    iconMeshes.forEach((m) => (m.visible = false));
    renderer.setRenderTarget(behindTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    iconMeshes.forEach((m) => (m.visible = true));
    glassMeshes.forEach((m, i) => (m.material = glassMats[i]));
  }

  const RADIUS = 16;
  const setUniforms = (wall) => ({
    uTime: { value: 0 },
    uWall: { value: wall },
    uRadius: { value: RADIUS },
    uLight: { value: light },
    uStacks: { value: stackUniform },
    uBase: { value: new THREE.Vector3(...theme.base) },
    uTop: { value: new THREE.Vector3(...theme.top) },
    uWarm: { value: new THREE.Vector3(...theme.warm) },
    uTopCaustic: { value: theme.topCaustic },
    uCaustic: { value: theme.caustic ?? 1 },
    uHeight: { value: 1 },
    uShadow: { value: theme.shadow },
    uAO: { value: theme.ao },
    uVignette: { value: theme.vignette },
    uGrain: { value: theme.grain },
    uBlocks: { value: blockUniform },
    uUseBlocks: useBlocks,
    uBlockHalf: { value: MOD.height / 2 + MOD.lip },
    uBlockTint: { value: blockTint },
    uTinted: { value: theme.tintedCaustics ?? 0 },
    uPulse: { value: pulsePos },
    uPulseColor: { value: pulseColor },
    uPulseCalm: pulseCalm,
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

  // The floor runs a little past the wall so their polygon edges never leave a gap at the horizon.
  const floor = new THREE.Mesh(new THREE.CircleGeometry(RADIUS + 1, 128), floorMat);
  floor.rotation.x = -Math.PI / 2;
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(RADIUS, RADIUS, 30, 128, 1, true),
    wallMat
  );
  wall.position.y = 15;

  // The caustic set is the expensive shader, so it's drawn once per frame into a texture and
  // laid behind everything as a flat backdrop. The screen, the behind pass and three's own
  // transmission pass all reuse it instead of re-running the caustics. The blocks always sit
  // in front of the set, so the backdrop needs no depth.
  const setScene = new THREE.Scene();
  setScene.add(floor, wall);

  // The paint is opaque even though the glass isn't: each glyph throws its own shadow through
  // the tile onto the floor. Planar projection along the key light, a few jittered taps for a
  // soft penumbra, multiplied over the lit set so caustics and tinted light darken with it.
  const iconShadows = [];
  const TAPS = 4;
  if (iconMeshes.length) {
    const tapBase = new THREE.MeshBasicMaterial({
      transparent: true,
      premultipliedAlpha: true,
      blending: THREE.MultiplyBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    const side = new THREE.Vector3().crossVectors(light, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(side, light).normalize();
    const taps = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) =>
      light.clone().addScaledVector(side, a * 0.01).addScaledVector(up, b * 0.01).normalize()
    );
    const h = 0.002;
    const projectors = taps.map((L) =>
      new THREE.Matrix4().set(
        1, -L.x / L.y, 0, (L.x / L.y) * h,
        0, 0, 0, h,
        0, -L.z / L.y, 1, (L.z / L.y) * h,
        0, 0, 0, 1
      )
    );
    iconMeshes.forEach((icon) => {
      // Under a soft key light a thin glyph's shadow blurs away with distance, so it fades with height.
      const mat = tapBase.clone();
      projectors.forEach((P) => {
        const s = new THREE.Mesh(icon.geometry.userData.flat, mat);
        s.matrixAutoUpdate = false;
        s.frustumCulled = false;
        setScene.add(s);
        iconShadows.push({ s, icon, P, mat });
      });
    });
  }
  const iconPos = new THREE.Vector3();
  function syncIconShadows() {
    if (!iconShadows.length) return;
    scene.updateMatrixWorld();
    iconShadows.forEach(({ s, icon, P, mat }) => {
      s.matrix.multiplyMatrices(P, icon.matrixWorld);
      iconPos.setFromMatrixPosition(icon.matrixWorld);
      const strength = 0.4 * Math.exp(-Math.max(0, iconPos.y - 0.2) * 1.5);
      mat.color.setScalar(1 - strength / TAPS);
    });
  }
  const setTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: { uSet: { value: setTarget.texture } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 1.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uSet;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(uSet, vUv);
          #include <colorspace_fragment>
        }
      `,
      depthTest: false,
      depthWrite: false,
    })
  );
  backdrop.frustumCulled = false;
  backdrop.renderOrder = -1;
  scene.add(backdrop);

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
  // Black cards, as in a product shoot: they only show up as dark edge lines in the glass.
  const flag = new THREE.MeshBasicMaterial({ color: "#1d201e", side: THREE.DoubleSide });
  for (const [x, y, z, sw, sh] of [
    [-light.x * 8, 2.5, -light.z * 8, 2.2, 7],
    [light.z * 8, 2.2, -light.x * 8, 1.4, 6],
    [-light.z * 8, 3, light.x * 8, 1.0, 6],
  ]) {
    const card = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), flag);
    card.position.set(x, y, z);
    card.lookAt(0, 1.5, 0);
    envScene.add(card);
  }
  if (theme.studio) {
    const strip = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 5, 4.8), side: THREE.DoubleSide });
    const black = new THREE.MeshBasicMaterial({ color: "#050505", side: THREE.DoubleSide });
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const lit = i % 2 === 0;
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(lit ? 0.9 : 2.6, 9), lit ? strip : black);
      panel.position.set(Math.cos(a) * 8.5, 3.5, Math.sin(a) * 8.5);
      panel.lookAt(0, 3.5, 0);
      envScene.add(panel);
    }
  }
  envScene.position.y = -1.2;
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;

  // Shorter blocks make shorter stacks; drop the camera with them so they stay framed.
  const drop = (0.67 - PITCH) * 1.5;
  const target = new THREE.Vector3(0, 1.3 - drop, 0);

  // The studio set turns like a turntable that breathes: it lingers on faces and eases between them.
  function placeCamera(t) {
    const a = t * 0.16 + 0.6 + (theme.studio ? Math.sin(t * 0.32) * 0.28 : 0);
    const r = 12.5;
    camera.position.set(
      target.x + Math.cos(a) * r,
      4.4 - drop + Math.sin(t * 0.21) * 0.4,
      target.z + Math.sin(a) * r
    );
    camera.lookAt(target);
    if (jolt > 0.001 && !reduceMotion) camera.position.y -= jolt * Math.cos(t * 90);
  }

  function resize() {
    const w = section.clientWidth;
    const h = section.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    const px = h * renderer.getPixelRatio();
    floorMat.uniforms.uHeight.value = px;
    wallMat.uniforms.uHeight.value = px;
    const buffer = renderer.getDrawingBufferSize(new THREE.Vector2());
    behindTarget.setSize(buffer.x, buffer.y);
    setTarget.setSize(buffer.x, buffer.y);
    glassShade.uBehindSize.value.copy(buffer);
    camera.aspect = w / h;
    camera.fov = w / h < 1 ? 46 : 34;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  const clock = new THREE.Clock();
  let last = 0;
  let running = true;
  // Neighbouring sections peek in as thin strips; rendering a whole frame for a sliver is the
  // single biggest cost on this page, so a section only runs once a real part of it is in view.
  const io = new IntersectionObserver(
    (entries) => {
      const e = entries[0];
      const seen = e ? e.intersectionRect.height / Math.max(1, Math.min(e.rootBounds?.height || 1, e.boundingClientRect.height)) : 1;
      running = !!e?.isIntersecting && seen > 0.18;
    },
    { threshold: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.5, 1] }
  );
  io.observe(section);

  // Resolution follows the machine: step down when frames run long for a while, back up when
  // there's room. Below 1.5 on a retina screen the rims stair-step, so only real struggle goes there.
  const maxDpr = Math.min(window.devicePixelRatio, 2);
  const floorDpr = Math.min(maxDpr, 1.5);
  let dpr = maxDpr;
  let frameMs = 16.7;
  let lastTune = 0;
  let lastDrop = -100;
  let slow = 0;
  function tune(now, dt) {
    if (dt <= 0 || dt > 0.25) return;
    frameMs += (dt * 1000 - frameMs) * 0.08;
    if (now - lastTune < 1.5) return;
    lastTune = now;
    slow = frameMs > 22 ? slow + 1 : 0;
    let next = dpr;
    const low = frameMs > 40 ? 1 : floorDpr;
    if (slow >= 3 && dpr > low) next = Math.max(low, dpr - 0.25);
    else if (frameMs < 17.5 && dpr < maxDpr && now - lastDrop > 10) next = Math.min(maxDpr, dpr + 0.25);
    if (next === dpr) return;
    if (next < dpr) {
      lastDrop = now;
      slow = 0;
    }
    dpr = next;
    renderer.setPixelRatio(dpr);
    resize();
  }

  function loop() {
    requestAnimationFrame(loop);
    if (!running) return;
    const now = clock.getElapsedTime();
    physics?.step(Math.min(now - last, 0.1));
    if (theme.physics) syncPulses();
    jolt *= Math.exp(-(now - last) * 16);
    tune(now, now - last);
    last = now;
    const t = reduceMotion ? 4 : now;
    floorMat.uniforms.uTime.value = t;
    wallMat.uniforms.uTime.value = t;
    glassShade.uTime.value = t;
    placeCamera(t);
    syncIconShadows();
    renderer.setRenderTarget(setTarget);
    renderer.render(setScene, camera);
    renderBehind();
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  }
  loop();
}

document.querySelectorAll(".showcase-glass").forEach((section) => {
  const canvas = section.querySelector(".glass-canvas");
  if (canvas) initGlass(section, canvas, THEMES[section.dataset.glass] || THEMES.cream);
});
