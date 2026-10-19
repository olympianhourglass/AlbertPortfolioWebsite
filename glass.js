// Glass tiles — stacked rounded blocks on a cream set, caustics thrown on the floor and wall.

import * as THREE from "three";
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
      vec3 ext = vec3(0.75, 0.37, 0.75);
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
  varying vec3 vWorld;
  ${stackShadow}
  ${grain}

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
          float near = exp(-max(uBlocks[k].y - 0.37, 0.0) * 1.5);
          ao += exp(-dot(d, d) * 1.4) * 0.45 * near;
          pool += exp(-dot(d + L2 * 0.9, d + L2 * 0.9) * 0.9) * 0.5 * near;
        }
      }
      pool += 0.4 * (1.0 - smoothstep(2.5, 8.0, length(vWorld.xz)));
      pool = clamp(pool, 0.0, 1.4);
      col *= 1.0 - clamp(ao, 0.0, 1.0) * uAO;
      vec3 c = causticRGB(vWorld.xz * 0.34, t);
      col += (c * pool * warm * 1.1 + pool * 0.06 * warm) * lift;
      col *= 1.0 - stackShadow(vWorld, normalize(uLight)) * uShadow;
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
    }

    col += grainAt(gl_FragCoord.xy, uTime) * uGrain;
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
  },
};
THEMES["grey-plain"] = { ...THEMES.grey, caustic: 0 };
// Salmon always at the base, blue through the middle, white on top; only the counts vary.
THEMES["grey-layered"] = {
  ...THEMES.grey,
  physics: true,
  glass: 0.12,
  contrast: 1.25,
  layers: [
    { color: "#f59a94", tint: "#ec655f", dist: 2.4, rough: 0.02, ghost: "#ec655f" },
    { color: "#c5d5e4", tint: "#b5cadd", dist: 1.6, rough: 0.01, ghost: "#b5cadd" },
    { color: "#ffffff", tint: "#ffffff", dist: 50, rough: 0.2, ghost: "#f4f4f4" },
  ],
  // One salmon base per stack at most; blue and white can repeat.
  stacks: [
    [1, 2, 2],
    [1, 2, 1],
    [1, 1, 2],
    [1, 1, 1],
  ],
};

function initGlass(section, canvas, theme) {
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
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
  const MOD = { size: 1.5, height: 0.6, radius: 0.34, lip: 0.07 };
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

  const blockUniform = Array.from({ length: 16 }, () => new THREE.Vector4());
  const useBlocks = { value: theme.physics ? 1 : 0 };

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
  };
  function shadeGlass(mat) {
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, glassShade);
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
        .replaceAll("transmissionSamplerSize", "uBehindSize");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <transmission_pars_fragment>", behind)
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
          ${stackShadow}
          ${grain}`
        )
        .replace(
          "#include <opaque_fragment>",
          `#include <opaque_fragment>
          float seamD = (abs(vGlassLocalY) - uPitch * 0.5) / 0.07;
          float seam = exp(-seamD * seamD);
          float occl = stackShadow(vGlassWorld, normalize(uLight));
          float facing = abs(dot(normalize(normal), normalize(vViewPosition)));
          float fres = pow(1.0 - facing, 2.0);
          gl_FragColor.rgb *= 1.0 - uEdge * fres;
          gl_FragColor.rgb *= uBody * (1.0 - occl * uOccl) * (1.0 - seam * uSeam);
          gl_FragColor.rgb = max((gl_FragColor.rgb - 0.35) * uContrast + 0.35, 0.0);
          gl_FragColor.rgb += grainAt(gl_FragCoord.xy, uTime) * uGrain;`
        );
    };
    return mat;
  }

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
      const mat = shadeGlass(glassFor(k++ * 5 + 1, layer));
      const block = new THREE.Group();
      const parts = [bodyGeo, rimGeo, skirtGeo].map((g) => new THREE.Mesh(g, mat));
      glassMeshes.push(...parts);
      parts.forEach(() => ghostColors.push(layer?.ghost || theme.ghost));
      block.add(...parts);
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
  if (theme.physics) {
    group.updateMatrixWorld(true);
    blocks.forEach((b) => scene.attach(b));
    stackUniform.forEach((v) => v.set(1000, 1000, 0));
    syncBlockUniform();
    import("https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js").then((CANNON) => {
      physics = createPhysics(CANNON);
    });
  }

  function createPhysics(CANNON) {
    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0), allowSleep: true });
    world.solver.iterations = 20;
    world.defaultContactMaterial.friction = 0.45;
    world.defaultContactMaterial.restitution = 0.12;

    const ground = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(ground);
    const fence = 28;
    for (let i = 0; i < fence; i++) {
      const a = (i / fence) * Math.PI * 2;
      const post = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Box(new CANNON.Vec3(2, 6, 0.4)) });
      post.position.set(Math.cos(a) * (RADIUS - 0.6), 6, Math.sin(a) * (RADIUS - 0.6));
      post.quaternion.setFromEuler(0, -a + Math.PI / 2, 0);
      world.addBody(post);
    }

    // The collider is the body plus rim; the skirt nests over the block below, as it does visually.
    const shape = new CANNON.Box(new CANNON.Vec3(MOD.size / 2, PITCH / 2, MOD.size / 2));
    const rest = blocks.map((b) => b.position.clone());
    const bodies = blocks.map((b) => {
      const body = new CANNON.Body({
        mass: 1,
        linearDamping: 0.05,
        angularDamping: 0.08,
        sleepSpeedLimit: 0.15,
        sleepTimeLimit: 0.5,
      });
      body.addShape(shape, new CANNON.Vec3(0, -MOD.lip / 2, 0));
      body.position.set(b.position.x, b.position.y, b.position.z);
      world.addBody(body);
      body.sleep();
      return body;
    });

    function kick(i, point, dir) {
      const body = bodies[i];
      bodies.forEach((b) => b.wakeUp());
      const push = new THREE.Vector3(dir.x, 0, dir.z).normalize();
      push.y = 0.75;
      push.normalize().multiplyScalar(12);
      body.applyImpulse(
        new CANNON.Vec3(push.x, push.y, push.z),
        new CANNON.Vec3(point.x - body.position.x, point.y - body.position.y, point.z - body.position.z)
      );
    }

    function restack() {
      bodies.forEach((body, i) => {
        body.position.set(rest[i].x, rest[i].y, rest[i].z);
        body.quaternion.set(0, 0, 0, 1);
        body.velocity.setZero();
        body.angularVelocity.setZero();
        body.sleep();
      });
    }

    function step(dt) {
      world.step(1 / 60, dt, 4);
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
      physics.kick(blocks.indexOf(hit.object.parent), hit.point, ray.ray.direction);
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
  const ghostMats = ghostColors.map(ghostFor);
  const glassMats = glassMeshes.map((m) => m.material);
  function renderBehind() {
    glassMeshes.forEach((m, i) => (m.material = ghostMats[i]));
    renderer.setRenderTarget(behindTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
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

  const target = new THREE.Vector3(0, 1.3, 0);

  // The studio set turns like a turntable that breathes: it lingers on faces and eases between them.
  function placeCamera(t) {
    const a = t * 0.16 + 0.6 + (theme.studio ? Math.sin(t * 0.32) * 0.28 : 0);
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
    const px = h * renderer.getPixelRatio();
    floorMat.uniforms.uHeight.value = px;
    wallMat.uniforms.uHeight.value = px;
    const buffer = renderer.getDrawingBufferSize(new THREE.Vector2());
    behindTarget.setSize(buffer.x, buffer.y);
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
    const now = clock.getElapsedTime();
    physics?.step(Math.min(now - last, 0.1));
    last = now;
    const t = reduceMotion ? 4 : now;
    floorMat.uniforms.uTime.value = t;
    wallMat.uniforms.uTime.value = t;
    glassShade.uTime.value = t;
    placeCamera(t);
    renderBehind();
    renderer.render(scene, camera);
  }
  loop();
}

document.querySelectorAll(".showcase-glass").forEach((section) => {
  const canvas = section.querySelector(".glass-canvas");
  if (canvas) initGlass(section, canvas, THEMES[section.dataset.glass] || THEMES.cream);
});
