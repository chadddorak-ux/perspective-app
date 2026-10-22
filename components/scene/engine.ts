// The 3D environments behind the page: a starry night over sunset clouds, a
// daytime cloudscape, and a mountain forest at dusk. Everything is laid out
// relative to the canvas so the scene reframes itself at any size, and the
// loop only runs while the canvas is on screen. Peep herself lives on her own
// stage (stage.ts) so she can move between scenes.

import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng, withRim } from "./materials";

export type SceneKind = "night" | "day" | "mountains";
export type WorldOptions = { kind: SceneKind; reduced: boolean };
export type WorldAPI = { setActive(on: boolean): void; dispose(): void };

const CAM_Z = 14;
const FOV = 32;

type Look = { top: string; mid: string; low: string; glow: string; glowAt: [number, number]; fog: string; stars: number };
const LOOKS: Record<SceneKind, Look> = {
  night: { top: "#0a0720", mid: "#2a1850", low: "#8c3f7c", glow: "#ff9a7a", glowAt: [0.7, 0.0], fog: "#7a3570", stars: 280 },
  day: { top: "#6d77cf", mid: "#c3a2da", low: "#ffd3b8", glow: "#fff2da", glowAt: [0.8, 0.85], fog: "#e6b9cf", stars: 0 },
  mountains: { top: "#4c5fbf", mid: "#b28ad0", low: "#ffa7a6", glow: "#ffd2a8", glowAt: [0.45, 0.32], fog: "#d79ab2", stars: 70 },
};

// A puff of cloud: u is across the canvas (-1..1), v is height above the bottom
// edge in "U" units (the smaller of the canvas height and 1.6x its width), z is depth.
type Puff = { u: number; v: number; z: number; r: number; color: THREE.Color; speed: number; bob: number };

function skyMesh(look: Look) {
  const mat = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      cTop: { value: new THREE.Color(look.top) },
      cMid: { value: new THREE.Color(look.mid) },
      cLow: { value: new THREE.Color(look.low) },
      cGlow: { value: new THREE.Color(look.glow) },
      uGlowAt: { value: new THREE.Vector2(...look.glowAt) },
      uAspect: { value: 1 },
    },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }",
    fragmentShader: `
      uniform vec3 cTop, cMid, cLow, cGlow; uniform vec2 uGlowAt; uniform float uAspect; varying vec2 vUv;
      void main(){
        float y = vUv.y;
        vec3 col = mix(cLow, cMid, smoothstep(0.0, 0.5, y));
        col = mix(col, cTop, smoothstep(0.45, 1.0, y));
        vec2 d = vec2((vUv.x - uGlowAt.x) * uAspect, vUv.y - uGlowAt.y);
        col += cGlow * exp(-dot(d, d) * 4.0) * 0.55;
        col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

function starField(count: number, minY: number, seed: number) {
  const r = rng(seed);
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = r() * 2 - 1;
    pos[i * 3 + 1] = minY + r() * (1 - minY);
    size[i] = r() < 0.08 ? 3.2 + r() * 1.5 : 1.2 + r() * 1.6;
    phase[i] = r() * 6.28;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uDpr: { value: 1 }, uMinY: { value: minY } },
    vertexShader: `
      attribute float aSize; attribute float aPhase; uniform float uTime; uniform float uDpr; uniform float uMinY; varying float vA;
      void main(){
        gl_Position = vec4(position.xy, 0.9999, 1.0);
        vA = (0.55 + 0.45 * sin(uTime * (0.7 + aPhase * 0.25) + aPhase)) * smoothstep(uMinY, uMinY + 0.4, position.y);
        gl_PointSize = aSize * uDpr;
      }`,
    fragmentShader: `
      varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(1.0, 0.95, 0.88, smoothstep(0.5, 0.0, d) * vA); }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

/** A lumpy sphere shared by every cloud puff; instances rotate it so no two match. */
function puffGeometry() {
  // Icosahedra come unindexed; merging shared vertices gives smooth normals instead of facets.
  const ico = new THREE.IcosahedronGeometry(1, 5);
  ico.deleteAttribute("normal");
  ico.deleteAttribute("uv");
  const geo = mergeVertices(ico);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = 1 + 0.04 * Math.sin(v.x * 4.1 + v.y * 3.3) + 0.03 * Math.sin(v.z * 5.3 - v.y * 3.9);
    v.multiplyScalar(n);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

function bank(out: Puff[], r: () => number, o: { n: number; z: number; v: [number, number]; rad: [number, number]; from: string; to: string; speed: number; spread?: number }) {
  const a = new THREE.Color(o.from);
  const b = new THREE.Color(o.to);
  const spread = o.spread ?? 1.2;
  for (let i = 0; i < o.n; i++) {
    const u = -spread + ((i + r() * 0.8) / o.n) * spread * 2;
    const v = o.v[0] + r() * (o.v[1] - o.v[0]);
    const rad = o.rad[0] + r() * (o.rad[1] - o.rad[0]);
    const t = (v - o.v[0]) / Math.max(1e-6, o.v[1] - o.v[0]);
    out.push({ u, v, z: o.z + (r() - 0.5) * 1.2, r: rad, color: a.clone().lerp(b, t * 0.7 + r() * 0.3), speed: o.speed, bob: r() * 6.28 });
    // Small puffs on top make the silhouette fluffy.
    for (let k = 0; k < 2; k++) {
      out.push({
        u: u + (r() - 0.5) * rad * 1.4,
        v: v + rad * (0.45 + r() * 0.35),
        z: o.z + 0.4 + (r() - 0.5),
        r: rad * (0.45 + r() * 0.2),
        color: a.clone().lerp(b, 0.75 + r() * 0.25),
        speed: o.speed,
        bob: r() * 6.28,
      });
    }
  }
}

/** A cumulus: a flat-bottomed row of puffs with a dome of puffs on top. */
function cluster(out: Puff[], r: () => number, o: { u: number; v: number; z: number; size: number; from: string; to: string; speed: number; n?: number }) {
  const a = new THREE.Color(o.from);
  const b = new THREE.Color(o.to);
  const n = o.n ?? 16;
  const base = Math.ceil(n * 0.45);
  const push = (du: number, dv: number, rr: number, t: number) =>
    out.push({ u: o.u + du, v: o.v + dv, z: o.z + (r() - 0.5) * o.size * 3, r: rr, color: a.clone().lerp(b, t), speed: o.speed, bob: r() * 6.28 });
  for (let j = 0; j < base; j++) {
    const x = base > 1 ? j / (base - 1) - 0.5 : 0;
    push(x * 2.6 * o.size, (r() - 0.5) * 0.1 * o.size, o.size * (0.42 + r() * 0.14) * (1 - Math.abs(x) * 0.5), 0.15 + r() * 0.2);
  }
  for (let j = base; j < n - 1; j++) {
    const ang = Math.PI * (0.18 + r() * 0.64);
    push(Math.cos(ang) * o.size * 1.05, Math.sin(ang) * o.size * 0.62, o.size * (0.42 + r() * 0.2), 0.55 + r() * 0.35);
  }
  push((r() - 0.5) * 0.3 * o.size, o.size * 0.62, o.size * 0.68, 0.95);
}

function puffsFor(kind: SceneKind): Puff[] {
  const r = rng(kind === "night" ? 7 : kind === "day" ? 21 : 33);
  const out: Puff[] = [];
  if (kind === "night") {
    bank(out, r, { n: 26, z: -9, v: [0.05, 0.11], rad: [0.04, 0.065], from: "#7a3a86", to: "#d0679a", speed: 0.004 });
    bank(out, r, { n: 24, z: -3.5, v: [0.02, 0.07], rad: [0.035, 0.06], from: "#c45f96", to: "#ffa6a0", speed: 0.007 });
    bank(out, r, { n: 22, z: 2, v: [-0.03, 0.02], rad: [0.035, 0.055], from: "#f08aa6", to: "#ffd8c6", speed: 0.012 });
  } else if (kind === "day") {
    cluster(out, r, { u: -0.05, v: 0.62, z: -16, size: 0.16, from: "#b9a0d9", to: "#ffe6d6", speed: 0.003, n: 20 });
    cluster(out, r, { u: 0.62, v: 0.5, z: -10, size: 0.11, from: "#c3a3d8", to: "#ffe1cf", speed: 0.004, n: 16 });
    cluster(out, r, { u: -0.8, v: 0.36, z: -7, size: 0.08, from: "#c9a5d6", to: "#ffdcc8", speed: 0.005, n: 12 });
    bank(out, r, { n: 22, z: -3, v: [0.02, 0.09], rad: [0.045, 0.075], from: "#d2a6d0", to: "#ffd6c4", speed: 0.007 });
    bank(out, r, { n: 20, z: 2, v: [-0.04, 0.03], rad: [0.04, 0.065], from: "#f2b8c6", to: "#fff0e6", speed: 0.011 });
  } else {
    for (const [u, v, s] of [
      [-0.7, 0.78, 0.05],
      [0.35, 0.88, 0.06],
      [0.85, 0.66, 0.04],
    ]) {
      cluster(out, r, { u, v, z: -22, size: s, from: "#d98aa6", to: "#ffc6b0", speed: 0.003, n: 12 });
    }
  }
  return out;
}

export function createWorld(canvas: HTMLCanvasElement, opts: WorldOptions): WorldAPI {
  const look = LOOKS[opts.kind];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(look.fog, 14, opts.kind === "mountains" ? 52 : 42);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
  camera.position.set(0, 0, CAM_Z);

  const sky = skyMesh(look);
  scene.add(sky);
  const stars = look.stars ? starField(look.stars, opts.kind === "night" ? -0.35 : 0.25, 11) : null;
  if (stars) scene.add(stars);

  // Light.
  if (opts.kind === "night") {
    scene.add(new THREE.HemisphereLight("#c3b4ff", "#7a3a78", 1.6));
    const key = new THREE.DirectionalLight("#ffe4d8", 2.1);
    key.position.set(-4, 6, 10);
    const back = new THREE.DirectionalLight("#ff9a88", 2.4);
    back.position.set(3, 1, -10);
    scene.add(key, back);
  } else if (opts.kind === "day") {
    scene.add(new THREE.HemisphereLight("#d6e2ff", "#ffcdb8", 1.7));
    const sun = new THREE.DirectionalLight("#fff0da", 2.3);
    sun.position.set(6, 8, 7);
    scene.add(sun);
  } else {
    scene.add(new THREE.HemisphereLight("#a8b6ff", "#6a3a6a", 1.4));
    const sun = new THREE.DirectionalLight("#ffb48a", 2.4);
    sun.position.set(-8, 5, -4);
    const fill = new THREE.DirectionalLight("#ffd9e6", 0.9);
    fill.position.set(4, 6, 10);
    scene.add(sun, fill);
  }

  // Clouds.
  const puffs = puffsFor(opts.kind);
  const cloudMat = withRim(new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1 }), opts.kind === "night" ? "#ffc4b4" : "#ffffff", opts.kind === "night" ? 0.6 : 0.4, 2.2);
  const maxPuffs = puffs.length;
  const clouds = new THREE.InstancedMesh(puffGeometry(), cloudMat, maxPuffs);
  clouds.frustumCulled = false;
  scene.add(clouds);
  const rot = puffs.map((_, i) => new THREE.Euler(i * 1.7, i * 2.3, i * 0.9));

  // Mountains, hills, trees (mountain scene only).
  type Placed = { obj: THREE.Object3D; u: number; v: number; z: number; s: number; sx?: number; sy?: number; sz?: number };
  const placed: Placed[] = [];
  if (opts.kind === "mountains") {
    const mountainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    const r = rng(5);
    const peaks: [number, number, number, number][] = [
      [-0.32, -30, 0.95, 1.0],
      [0.38, -26, 0.75, 0.85],
      [0.95, -22, 0.5, 0.7],
      [-0.95, -24, 0.55, 0.65],
    ];
    peaks.forEach(([u, z, h, w], idx) => {
      const geo = new THREE.ConeGeometry(1, 1, 48, 18);
      geo.translate(0, 0.5, 0);
      const p = geo.attributes.position;
      const colors = new Float32Array(p.count * 3);
      const c = new THREE.Color();
      const stops = ["#3d3470", "#8e5a9e", "#ff9f9c", "#ffe0d4", "#fff6f0"].map((s) => new THREE.Color(s));
      const seed = idx * 1.7;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const y = p.getY(i);
        const z2 = p.getZ(i);
        const ang = Math.atan2(z2, x);
        const n = 0.13 * Math.sin(ang * 3 + seed) + 0.07 * Math.sin(ang * 7 + seed * 2) + 0.05 * Math.sin(y * 13 + ang * 5);
        const k = 1 + n * (1 - y);
        p.setXYZ(i, x * k, y * (1 + 0.04 * Math.sin(ang * 9 + seed)), z2 * k);
        const t = y;
        if (t < 0.35) c.copy(stops[0]).lerp(stops[1], t / 0.35);
        else if (t < 0.72) c.copy(stops[1]).lerp(stops[2], (t - 0.35) / 0.37);
        else if (t < 0.84) c.copy(stops[2]).lerp(stops[3], (t - 0.72) / 0.12);
        else c.copy(stops[3]).lerp(stops[4], (t - 0.84) / 0.16);
        c.multiplyScalar(0.92 + r() * 0.14);
        colors.set([c.r, c.g, c.b], i * 3);
      }
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mountainMat);
      scene.add(m);
      placed.push({ obj: m, u, v: -0.05, z, s: h, sx: w * 1.25, sz: w * 0.8 });
    });

    const hillGeo = new THREE.SphereGeometry(1, 48, 24);
    (
      [
        [-0.75, -12, 0.55, "#4a3c78"],
        [0.25, -14, 0.7, "#57427f"],
        [0.85, -9, 0.45, "#3c4f6e"],
        [-0.15, -7, 0.4, "#3f3a6e"],
      ] as const
    ).forEach(([u, z, s, color]) => {
      const m = new THREE.Mesh(hillGeo, withRim(new THREE.MeshStandardMaterial({ color, roughness: 1 }), "#ffb0b0", 0.25));
      scene.add(m);
      placed.push({ obj: m, u, v: -0.12, z, s, sx: 2.2, sy: 0.38, sz: 1 });
    });

    // Conifers frame both sides, the way a storybook page does.
    const cone = (rad: number, h: number, y: number) => new THREE.ConeGeometry(rad, h, 9, 1).translate(0, y, 0);
    const treeGeo = mergeGeometries([cone(0.34, 0.55, 0.42), cone(0.27, 0.5, 0.68), cone(0.19, 0.45, 0.92), new THREE.CylinderGeometry(0.05, 0.06, 0.2, 6).translate(0, 0.1, 0)]);
    const palette = ["#e8743b", "#f2a541", "#d65d4f", "#3f7f6b", "#2f6b5e", "#9cc06b", "#c2603a", "#f08a5d"].map((s) => new THREE.Color(s));
    const treeMat = withRim(new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9 }), "#ffd0b0", 0.3);
    const trees: { u: number; v: number; z: number; s: number }[] = [];
    for (let i = 0; i < 70; i++) {
      const left = i % 2 === 0;
      const depth = r();
      const edge = 0.5 + r() * 0.62;
      trees.push({ u: left ? -edge : edge, v: -0.04 + depth * 0.22, z: 3 - depth * 13, s: 0.3 + (1 - depth) * 0.25 + r() * 0.1 });
    }
    trees.sort((a, b) => a.z - b.z);
    const treeMesh = new THREE.InstancedMesh(treeGeo, treeMat, trees.length);
    trees.forEach((_, i) => treeMesh.setColorAt(i, palette[Math.floor(r() * palette.length)]));
    treeMesh.frustumCulled = false;
    scene.add(treeMesh);
    placed.push({ obj: treeMesh, u: 0, v: 0, z: 0, s: 0 });
    (treeMesh.userData as { trees: typeof trees }).trees = trees;
  }

  // Layout: everything is positioned from the canvas size.
  let W = 1;
  let H = 1;
  let pxH = 1;
  let pxW = 1;
  const extents = (z: number) => {
    const h = 2 * (CAM_Z - z) * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    return { h, w: h * camera.aspect, U: Math.min(h, h * camera.aspect * 1.6) };
  };

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sv = new THREE.Vector3();
  const pv = new THREE.Vector3();
  function placePuffs(time: number) {
    puffs.forEach((p, i) => {
      const e = extents(p.z);
      pv.set((p.u * e.w) / 2, -e.h / 2 + p.v * e.U + Math.sin(time * 0.4 + p.bob) * 0.02 * e.U * p.r * 4, p.z);
      sv.setScalar(Math.max(p.r * e.U, 0.001));
      q.setFromEuler(rot[i % rot.length]);
      m4.compose(pv, q, sv);
      clouds.setMatrixAt(i, m4);
      clouds.setColorAt(i, p.color);
    });
    clouds.count = puffs.length;
    clouds.instanceMatrix.needsUpdate = true;
    if (clouds.instanceColor) clouds.instanceColor.needsUpdate = true;
  }

  function layout() {
    const rect = canvas.parentElement!.getBoundingClientRect();
    pxW = Math.max(1, rect.width);
    pxH = Math.max(1, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, pxW < 768 ? 1.5 : 1.75);
    renderer.setPixelRatio(dpr);
    renderer.setSize(pxW, pxH, false);
    camera.aspect = pxW / pxH;
    camera.updateProjectionMatrix();
    const e0 = extents(0);
    W = e0.w;
    H = e0.h;
    (sky.material as THREE.ShaderMaterial).uniforms.uAspect.value = camera.aspect;
    if (stars) (stars.material as THREE.ShaderMaterial).uniforms.uDpr.value = dpr;

    for (const p of placed) {
      if (p.obj instanceof THREE.InstancedMesh) {
        const inst = p.obj;
        const trees = (inst.userData as { trees: { u: number; v: number; z: number; s: number }[] }).trees;
        trees.forEach((t, i) => {
          const e = extents(t.z);
          m4.compose(pv.set((t.u * e.w) / 2, -e.h / 2 + t.v * e.U, t.z), q.identity(), sv.setScalar(t.s * e.U * 0.42));
          inst.setMatrixAt(i, m4);
        });
        inst.instanceMatrix.needsUpdate = true;
        continue;
      }
      const e = extents(p.z);
      const s = p.s * e.U;
      p.obj.position.set((p.u * e.w) / 2, -e.h / 2 + p.v * e.U, p.z);
      p.obj.scale.set(s * (p.sx ?? 1), s * (p.sy ?? 1), s * (p.sz ?? 1));
    }

    placePuffs(elapsed);
  }

  // Loop.
  let elapsed = 0;
  let raf = 0;
  let active = false;
  let last = 0;
  function tick(dt: number) {
    elapsed += dt;
    if (stars) (stars.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsed;
    for (const p of puffs) {
      p.u += p.speed * dt;
      if (p.u > 1.35) p.u -= 2.7;
    }
    placePuffs(elapsed);
  }
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    tick(dt);
    renderer.render(scene, camera);
  }
  function start() {
    if (raf || opts.reduced) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  const ro = new ResizeObserver(() => {
    layout();
    renderer.render(scene, camera);
  });
  ro.observe(canvas.parentElement!);
  layout();
  renderer.render(scene, camera);

  return {
    setActive(on) {
      active = on;
      if (active) start();
      else stop();
    },
    dispose() {
      stop();
      ro.disconnect();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
      renderer.dispose();
    },
  };
}
