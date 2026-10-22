// Peep: a mint gremlin with a big head, long notched ears and huge glossy
// eyes, somewhere between cuddly and up to something. Built from primitives.
// Feet sit at y = 0 and she is about 2.6 units tall.
//
// Her face is driven by a handful of parameters (eyelids, brows, ears, mouth,
// blush) that blend between moods, and one-shot actions (jump, giggle, spin,
// knock on the glass, stomp, rub her claws together) layer on top.

import * as THREE from "three";
import { withRim } from "./materials";

export type Mood = "idle" | "happy" | "love" | "mischief" | "angry" | "attention" | "surprised" | "sleepy";
export type Reaction =
  | "post"
  | "match"
  | "pledge"
  | "cheer"
  | "giggle"
  | "spin"
  | "mischief"
  | "angry"
  | "attention"
  | "surprised"
  | "sleepy"
  | "love"
  | "wave";

type MouthKind = "smile" | "grin" | "smirk" | "sly" | "snarl" | "o" | "small";
type Face = { lid: number; lower: number; tilt: number; brow: number; browY: number; ears: number; blush: number; flush: number; mouth: MouthKind; eye: number };

const FACES: Record<Mood, Face> = {
  idle: { lid: 0.08, lower: 0, tilt: 0, brow: 0, browY: 0, ears: 0, blush: 0.35, flush: 0, mouth: "smile", eye: 1 },
  happy: { lid: 0.18, lower: 0.62, tilt: -0.12, brow: -0.15, browY: 0.04, ears: 0.3, blush: 0.9, flush: 0, mouth: "grin", eye: 1 },
  love: { lid: 0.26, lower: 0.72, tilt: -0.15, brow: -0.2, browY: 0.05, ears: 0.15, blush: 1, flush: 0, mouth: "grin", eye: 1 },
  mischief: { lid: 0.46, lower: 0.22, tilt: 0.42, brow: 0.42, browY: -0.03, ears: -0.2, blush: 0.3, flush: 0, mouth: "sly", eye: 1 },
  angry: { lid: 0.48, lower: 0.18, tilt: 0.6, brow: 0.6, browY: -0.05, ears: -0.75, blush: 0, flush: 0.65, mouth: "snarl", eye: 0.96 },
  attention: { lid: 0, lower: 0, tilt: -0.1, brow: -0.25, browY: 0.07, ears: 0.35, blush: 0.4, flush: 0, mouth: "o", eye: 1.08 },
  surprised: { lid: 0, lower: 0, tilt: 0, brow: -0.22, browY: 0.1, ears: 0.45, blush: 0.3, flush: 0, mouth: "o", eye: 1.14 },
  sleepy: { lid: 0.74, lower: 0.12, tilt: -0.15, brow: -0.05, browY: -0.02, ears: -0.45, blush: 0.2, flush: 0, mouth: "small", eye: 1 },
};

export type Gremlin = {
  root: THREE.Group;
  /** Where Peep should look, -1..1 on each axis (screen space, y down). */
  setLook(x: number, y: number): void;
  setMood(mood: Mood, holdSeconds?: number): void;
  react(kind: Reaction): void;
  /** Call every frame while someone is petting her. */
  pet(dt: number): void;
  update(dt: number): void;
  bounds: THREE.Sphere;
};

const C = {
  skin: "#86d8bd",
  belly: "#e9fbf2",
  foot: "#6fc6a7",
  brow: "#2c6f5d",
  earInner: "#ff98c0",
  tuft: "#b29dff",
  iris: "#1d1536",
  irisRing: "#3a2a6e",
  nose: "#2a2046",
  mouth: "#2b1430",
  tongue: "#ff7fa6",
  cheek: "#ff8db3",
  heart: ["#ff6b8f", "#ff8a5c", "#ff9fc4"],
};

const HEAD = { y: 1.62, a: 1.12, b: 0.92, c: 0.94 };
const Z = new THREE.Vector3(0, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const damp = (a: number, b: number, rate: number, dt: number) => lerp(a, b, 1 - Math.exp(-rate * dt));
const ease = (t: number) => Math.sin(Math.PI * Math.min(1, Math.max(0, t)));

/** A point on the head ellipsoid (head-local x, y), pushed in by `inset`, and the way it faces. */
function onHead(x: number, y: number, inset = 0) {
  const zz = HEAD.c * Math.sqrt(Math.max(0, 1 - (x / HEAD.a) ** 2 - (y / HEAD.b) ** 2));
  const n = new THREE.Vector3(x / HEAD.a ** 2, y / HEAD.b ** 2, zz / HEAD.c ** 2).normalize();
  const p = new THREE.Vector3(x, y, zz).addScaledVector(n, -inset);
  return { p, q: new THREE.Quaternion().setFromUnitVectors(Z, n) };
}

function earShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, -0.3);
  s.quadraticCurveTo(0.75, -0.28, 1.55, 0.42);
  s.quadraticCurveTo(1.45, 0.5, 1.28, 0.46);
  // a little notch, like an old scrapper's ear
  s.lineTo(1.12, 0.36);
  s.lineTo(1.02, 0.5);
  s.quadraticCurveTo(0.5, 0.48, 0, 0.3);
  s.quadraticCurveTo(-0.07, 0, 0, -0.3);
  return s;
}

function heartShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, -0.3);
  s.bezierCurveTo(-0.05, -0.25, -0.35, -0.05, -0.35, 0.12);
  s.bezierCurveTo(-0.35, 0.3, -0.12, 0.36, 0, 0.2);
  s.bezierCurveTo(0.12, 0.36, 0.35, 0.3, 0.35, 0.12);
  s.bezierCurveTo(0.35, -0.05, 0.05, -0.25, 0, -0.3);
  return s;
}

export function makeGremlin(): Gremlin {
  const root = new THREE.Group();
  const hop = new THREE.Group();
  const squash = new THREE.Group();
  const turn = new THREE.Group();
  root.add(hop);
  hop.add(squash);
  squash.add(turn);

  const skin = withRim(
    new THREE.MeshPhysicalMaterial({
      color: C.skin,
      emissive: C.skin,
      emissiveIntensity: 0.12,
      roughness: 0.55,
      sheen: 1,
      sheenColor: new THREE.Color("#f2fff9"),
      sheenRoughness: 0.4,
      clearcoat: 0.08,
    }),
    "#ffd8ef",
    0.3,
  );
  const lidSkin = skin.clone();
  lidSkin.side = THREE.DoubleSide;
  const glossy = (color: string) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.06 });
  const matte = (color: string, rough = 0.7) => withRim(new THREE.MeshStandardMaterial({ color, roughness: rough }), "#ffffff", 0.16);
  const white = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.3 });

  // Body: a small pear under the big head.
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 56, 40), skin);
  body.scale.set(0.74, 0.72, 0.64);
  body.position.y = 0.68;
  turn.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), matte(C.belly));
  belly.scale.set(0.5, 0.5, 0.2);
  belly.position.set(0, 0.6, 0.5);
  belly.rotation.x = 0.2;
  turn.add(belly);

  // Head, with everything on it in head-local coordinates.
  const head = new THREE.Group();
  head.position.y = HEAD.y;
  turn.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), skin);
  skull.scale.set(HEAD.a, HEAD.b, HEAD.c);
  head.add(skull);

  // Eyes sit half sunk into the head, so they're attached at every angle.
  type Eye = { group: THREE.Group; iris: THREE.Group; lid: THREE.Mesh; lidPivot: THREE.Group; lower: THREE.Mesh; side: number };
  const eyes: Eye[] = [];
  for (const side of [-1, 1]) {
    const at = onHead(side * 0.43, 0.06, 0.08);
    const group = new THREE.Group();
    group.position.copy(at.p);
    group.quaternion.copy(at.q);
    const ball = new THREE.Group();
    ball.scale.set(1, 1.12, 0.62);
    group.add(ball);
    ball.add(new THREE.Mesh(new THREE.SphereGeometry(0.29, 40, 30), glossy("#fdfcff")));
    const iris = new THREE.Group();
    // Everything in the iris stays inside the lids' radius, so a closing lid
    // really hides it.
    const irisBall = new THREE.Mesh(new THREE.SphereGeometry(0.23, 36, 28), glossy(C.iris));
    irisBall.position.z = 0.09;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 10, 40), new THREE.MeshStandardMaterial({ color: C.irisRing, roughness: 0.4 }));
    ring.position.z = 0.27;
    const shine = new THREE.MeshBasicMaterial({ color: "#ffffff" });
    const hi1 = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), shine);
    hi1.scale.z = 0.4;
    hi1.position.set(0.085, 0.1, 0.285);
    const hi2 = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), shine);
    hi2.scale.z = 0.4;
    hi2.position.set(-0.075, -0.075, 0.295);
    iris.add(irisBall, ring, hi1, hi2);
    ball.add(iris);
    // Lids are caps of a slightly bigger sphere that roll down over the eye.
    const lidPivot = new THREE.Group();
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.335, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2), lidSkin);
    lidPivot.add(lid);
    const lower = new THREE.Mesh(new THREE.SphereGeometry(0.332, 36, 18, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), lidSkin);
    ball.add(lidPivot, lower);
    head.add(group);
    eyes.push({ group, iris, lid, lidPivot, lower, side });
  }

  const brows: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const at = onHead(side * 0.42, 0.5, -0.01);
    const g = new THREE.Group();
    g.position.copy(at.p);
    g.quaternion.copy(at.q);
    const pivot = new THREE.Group();
    const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.22, 4, 10), matte(C.brow, 0.6));
    bar.rotation.z = Math.PI / 2;
    pivot.add(bar);
    g.add(pivot);
    head.add(g);
    brows.push(pivot);
  }

  const noseAt = onHead(0, -0.14, 0.02);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), glossy(C.nose));
  nose.scale.set(0.11, 0.075, 0.07);
  nose.position.copy(noseAt.p);
  nose.quaternion.copy(noseAt.q);
  head.add(nose);

  const cheekMat = new THREE.MeshStandardMaterial({ color: C.cheek, roughness: 0.8, transparent: true, opacity: 0.4, depthWrite: false });
  for (const side of [-1, 1]) {
    const at = onHead(side * 0.72, -0.2, -0.01);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 14), cheekMat);
    cheek.scale.set(1, 0.6, 0.25);
    cheek.position.copy(at.p);
    cheek.quaternion.copy(at.q);
    head.add(cheek);
  }

  // Mouths: one shape per expression, crossfaded by scale.
  const mouthAt = onHead(0, -0.38, 0.01);
  const mouth = new THREE.Group();
  mouth.position.copy(mouthAt.p);
  mouth.quaternion.copy(mouthAt.q);
  head.add(mouth);
  const lipMat = new THREE.MeshStandardMaterial({ color: C.mouth, roughness: 0.6 });
  const arc = (r: number) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 10, 32, Math.PI), lipMat);
    m.rotation.z = Math.PI;
    return m;
  };
  const fang = (x: number, h = 0.09) => {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.034, h, 12), white);
    f.rotation.x = Math.PI;
    f.position.set(x, -h / 2 + 0.01, 0.03);
    return f;
  };
  const openMouth = (w: number, h: number, fangs: number[], tongue: boolean) => {
    const g = new THREE.Group();
    const hole = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), new THREE.MeshStandardMaterial({ color: C.mouth, roughness: 0.8 }));
    hole.scale.set(w, h, 0.05);
    g.add(hole);
    if (tongue) {
      const t = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshStandardMaterial({ color: C.tongue, roughness: 0.6 }));
      t.scale.set(w * 0.55, h * 0.4, 0.045);
      t.position.set(0, -h * 0.5, 0.012);
      g.add(t);
    }
    for (const x of fangs) {
      const f = fang(x * w, 0.08);
      f.position.y = h * 0.75;
      g.add(f);
    }
    return g;
  };
  const MOUTHS: Record<MouthKind, THREE.Object3D> = {
    smile: (() => {
      const g = new THREE.Group();
      g.add(arc(0.17), fang(0.08));
      return g;
    })(),
    grin: openMouth(0.22, 0.13, [-0.55, 0.55], true),
    smirk: (() => {
      const g = new THREE.Group();
      const a = arc(0.15);
      a.rotation.z = Math.PI + 0.28;
      g.add(a, fang(0.11, 0.1));
      g.position.x = 0.04;
      return g;
    })(),
    // The evil-cute grin: wide, closed, both fangs out.
    sly: (() => {
      const g = new THREE.Group();
      const a = arc(0.21);
      a.scale.y = 0.75;
      for (const x of [-0.1, 0.1]) {
        const f = fang(x, 0.1);
        f.position.y = -Math.sqrt(0.21 ** 2 - x * x) * 0.75 - 0.03;
        g.add(f);
      }
      g.add(a);
      return g;
    })(),
    snarl: openMouth(0.2, 0.08, [-0.6, -0.25, 0.25, 0.6], false),
    o: openMouth(0.085, 0.1, [], false),
    small: (() => {
      const g = new THREE.Group();
      g.add(arc(0.09));
      return g;
    })(),
  };
  for (const m of Object.values(MOUTHS)) {
    m.scale.setScalar(0.001);
    mouth.add(m);
  }

  // Ears: long, notched, lined in pink.
  const earGeo = new THREE.ExtrudeGeometry(earShape(), { depth: 0.05, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 5, curveSegments: 28 });
  const innerGeo = new THREE.ExtrudeGeometry(earShape(), { depth: 0.01, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 24 });
  innerGeo.scale(0.66, 0.56, 1);
  innerGeo.translate(0.24, 0.02, 0.1);
  const innerMat = new THREE.MeshStandardMaterial({ color: C.earInner, roughness: 0.6, side: THREE.DoubleSide });
  const ears: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(side * 0.98, 0.22, -0.06);
    const leaf = new THREE.Group();
    leaf.add(new THREE.Mesh(earGeo, lidSkin), new THREE.Mesh(innerGeo, innerMat));
    if (side < 0) leaf.scale.x = -1;
    ear.add(leaf);
    ear.scale.setScalar(0.82);
    ears.push(ear);
    head.add(ear);
  }

  const tuft = new THREE.Group();
  tuft.position.set(0, HEAD.b - 0.04, -0.05);
  const tuftMat = withRim(new THREE.MeshStandardMaterial({ color: C.tuft, roughness: 0.5 }), "#ffffff", 0.3);
  for (const [x, rz, h] of [
    [0, 0, 0.36],
    [-0.11, 0.55, 0.27],
    [0.11, -0.55, 0.27],
  ]) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, h, 14), tuftMat);
    spike.geometry.translate(0, h / 2, 0);
    spike.position.x = x;
    spike.rotation.z = rz;
    tuft.add(spike);
  }
  head.add(tuft);

  // Arms with little three-clawed hands, hung from the shoulders.
  const clawMat = new THREE.MeshStandardMaterial({ color: "#f4f1ff", roughness: 0.4 });
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.6, 0.98, 0.12);
    const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.26, 8, 16), skin);
    limb.position.y = -0.2;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 16), skin);
    hand.position.y = -0.42;
    arm.add(limb, hand);
    for (const k of [-1, 0, 1]) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 8), clawMat);
      claw.position.set(k * 0.07, -0.55, 0.04);
      claw.rotation.set(Math.PI, 0, -k * 0.3);
      arm.add(claw);
    }
    arm.rotation.z = side * 0.4;
    arms.push(arm);
    squash.add(arm);
  }

  for (const side of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), matte(C.foot));
    foot.scale.set(0.24, 0.13, 0.3);
    foot.position.set(side * 0.32, 0.07, 0.16);
    squash.add(foot);
    for (const k of [-1, 0, 1]) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.08, 8), clawMat);
      claw.position.set(side * 0.32 + k * 0.08, 0.06, 0.45);
      claw.rotation.x = Math.PI / 2;
      squash.add(claw);
    }
  }

  // Hearts for happy moments, and little puffs of steam for cross ones.
  const heartGeo = new THREE.ExtrudeGeometry(heartShape(), { depth: 0.06, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3, curveSegments: 16 });
  heartGeo.center();
  type Particle = { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; life: number; x: number; drift: number; spin: number };
  const particle = (geo: THREE.BufferGeometry, color: string, emissive: number): Particle => {
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: emissive, roughness: 0.5, transparent: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    root.add(mesh);
    return { mesh, mat, life: -1, x: 0, drift: 0, spin: 0 };
  };
  const hearts = Array.from({ length: 8 }, (_, i) => particle(heartGeo, C.heart[i % 3], 0.35));
  const steamGeo = new THREE.SphereGeometry(0.14, 14, 10);
  const steam = Array.from({ length: 6 }, () => particle(steamGeo, "#c9c3d6", 0.1));
  // life is -1 when idle; a small negative life is a stagger before it appears.
  function emit(pool: Particle[], n: number, spread: number) {
    let k = 0;
    for (const h of pool) {
      if (h.life !== -1 || k >= n) continue;
      h.life = -k * 0.12 - 0.0001;
      h.x = (Math.random() - 0.5) * spread;
      h.drift = (Math.random() - 0.5) * 0.8;
      h.spin = (Math.random() - 0.5) * 3;
      k++;
    }
  }

  // ---- state ----
  let t = 0;
  const look = { x: 0, y: 0, tx: 0, ty: 0 };
  const face: Face = { ...FACES.idle };
  let mood: Mood = "idle";
  let moodUntil = 0;
  let blinkAt = 1.2;
  let blinkT = -1;
  let doubleBlink = false;
  let earT = -1;
  let earSide = 0;
  let nextEar = 2.5;
  let nextFidget = 9;
  let petting = 0; // seconds of recent petting, decays
  let petHearts = 0;
  type Action = "jump" | "giggle" | "spin" | "wave" | "knock" | "stomp" | "rub" | "think" | "yawn";
  const DUR: Record<Action, number> = { jump: 0.8, giggle: 1.1, spin: 0.9, wave: 2.2, knock: 1.5, stomp: 1.3, rub: 1.8, think: 1.7, yawn: 1.8 };
  let action: Action | null = "wave";
  let actionT = -0.6; // wave hello shortly after she appears

  function play(a: Action) {
    action = a;
    actionT = 0;
  }
  function setMood(m: Mood, hold = 2.5) {
    mood = m;
    moodUntil = t + hold;
  }

  function update(dt: number) {
    t += dt;
    if (mood !== "idle" && t > moodUntil && petting < 0.05) mood = "idle";
    const target = petting > 0.15 ? (petting > 2.5 ? FACES.love : FACES.happy) : FACES[mood];

    // Blend the face toward the mood.
    for (const k of ["lid", "lower", "tilt", "brow", "browY", "ears", "blush", "flush", "eye"] as const) face[k] = damp(face[k], target[k], 9, dt);
    face.mouth = target.mouth;

    // Breathing, plus whatever action is running.
    const br = Math.sin(t * 2.2) * 0.018;
    let sy = 1 + br;
    let sxz = 1 - br * 0.6;
    let y = 0;
    let armsUp = 0;
    let wave = 0;
    let knock = 0;
    let rub = 0;
    let spin = 0;
    let shake = 0;
    let headTilt = 0;
    let yawn = 0;
    if (action) {
      actionT += dt;
      const p = actionT / DUR[action];
      if (p >= 1) action = null;
      else if (p >= 0) {
        switch (action) {
          case "jump": {
            armsUp = ease(p * 1.4);
            if (p < 0.14) {
              sy = 1 - 0.18 * ease(p / 0.14);
              sxz = 1 + 0.12 * ease(p / 0.14);
            } else if (p > 0.86) {
              sy = 1 - 0.14 * ease((p - 0.86) / 0.14);
              sxz = 1 + 0.1 * ease((p - 0.86) / 0.14);
            } else {
              const q = (p - 0.14) / 0.72;
              y = Math.sin(Math.PI * q) * 0.6;
              sy = 1 + 0.08 * Math.cos(Math.PI * q);
            }
            break;
          }
          case "giggle":
            y = Math.abs(Math.sin(p * Math.PI * 4)) * 0.12 * (1 - p);
            headTilt = Math.sin(p * Math.PI * 6) * 0.12 * (1 - p);
            sy = 1 + Math.sin(p * Math.PI * 8) * 0.03;
            break;
          case "spin":
            spin = (1 - Math.cos(Math.PI * p)) * Math.PI;
            y = ease(p) * 0.25;
            break;
          case "wave":
            wave = ease(p) ** 0.5;
            break;
          case "knock":
            knock = ease(p) ** 0.4;
            break;
          case "stomp":
            y = Math.abs(Math.sin(p * Math.PI * 4)) * 0.08;
            shake = Math.sin(p * Math.PI * 22) * 0.06 * ease(p);
            break;
          case "rub":
            rub = ease(p) ** 0.4;
            break;
          case "think":
            headTilt = 0.16 * ease(p);
            break;
          case "yawn":
            yawn = ease(p);
            break;
        }
      }
    }
    hop.position.y = y;
    squash.scale.set(sxz, sy, sxz);

    // Looking: eyes lead, the head follows, the body barely turns.
    let lx = look.tx;
    let ly = look.ty;
    if (action === "think") {
      lx = Math.sin(actionT * 5) > 0 ? 0.8 : -0.8;
      ly = -0.7;
    } else if (mood === "mischief") {
      lx = 0.9;
      ly = 0.1;
    } else if (action === "knock" || mood === "attention") {
      lx *= 0.3;
      ly = 0;
    }
    look.x = damp(look.x, lx, 7, dt);
    look.y = damp(look.y, ly, 7, dt);
    turn.rotation.y = look.x * 0.14 + spin + shake;
    turn.rotation.z = Math.sin(t * 1.3) * 0.03 + (petting > 0.15 ? Math.sin(t * 5) * 0.06 : 0);
    head.rotation.y = look.x * 0.3;
    head.rotation.x = look.y * 0.15 - yawn * 0.25;
    head.rotation.z = headTilt;
    for (const e of eyes) {
      e.iris.rotation.y = look.x * 0.42;
      e.iris.rotation.x = look.y * 0.36;
    }

    // Blinks, sometimes doubled, on top of the mood's lids.
    if (t > blinkAt && blinkT < 0) {
      blinkT = 0;
      doubleBlink = Math.random() < 0.25;
      blinkAt = t + 2.2 + Math.random() * 3.5;
    }
    let blink = 0;
    if (blinkT >= 0) {
      blinkT += dt;
      blink = blinkT < 0.07 ? blinkT / 0.07 : blinkT < 0.16 ? 1 - (blinkT - 0.07) / 0.09 : 0;
      if (blinkT > 0.16) {
        if (doubleBlink) {
          doubleBlink = false;
          blinkT = 0;
        } else blinkT = -1;
      }
    }
    const lid = Math.min(1, Math.max(face.lid, blink) + yawn * 0.4);
    for (const e of eyes) {
      e.lid.rotation.x = -Math.PI / 2 + lid * Math.PI;
      e.lidPivot.rotation.z = e.side * face.tilt;
      e.lower.rotation.x = Math.PI / 2 - face.lower * Math.PI * 0.55;
      e.group.scale.setScalar(face.eye);
    }
    brows.forEach((b, i) => {
      const side = i === 0 ? -1 : 1;
      b.rotation.z = side * face.brow;
      b.position.y = face.browY;
    });

    // Mouth crossfade.
    for (const [kind, m] of Object.entries(MOUTHS) as [MouthKind, THREE.Object3D][]) {
      const want = kind === (yawn > 0.3 ? "o" : face.mouth) ? 1 : 0.001;
      const s = damp(m.scale.x, want, 14, dt);
      m.scale.setScalar(s);
      m.visible = s > 0.01;
    }
    if (yawn > 0.3) MOUTHS.o.scale.set(1.3 + yawn, 1.3 + yawn * 1.5, 1);

    cheekMat.opacity = 0.15 + face.blush * 0.55;
    const red = new THREE.Color(C.skin).lerp(new THREE.Color("#ff4a4a"), face.flush);
    skin.emissive.copy(red);
    skin.emissiveIntensity = 0.12 + face.flush * 0.3;

    // Ears: mood angle, a flick now and then, a wiggle while petted.
    if (t > nextEar && earT < 0) {
      earT = 0;
      earSide = Math.random() < 0.5 ? 0 : 1;
      nextEar = t + 2.5 + Math.random() * 4;
    }
    let flick = 0;
    if (earT >= 0) {
      earT += dt;
      flick = Math.sin((earT / 0.35) * Math.PI) * 0.35;
      if (earT > 0.35) earT = -1;
    }
    ears.forEach((ear, i) => {
      const side = i === 0 ? -1 : 1;
      const wiggle = Math.sin(t * 2.2 + i) * 0.03 + (petting > 0.15 ? Math.sin(t * 12 + i * 2) * 0.12 : 0);
      ear.rotation.z = side * (0.5 + face.ears * 0.45 + wiggle + (i === earSide ? flick : 0) + armsUp * 0.2);
      ear.rotation.y = side * (-0.3 - Math.max(0, -face.ears) * 0.7);
    });
    tuft.rotation.z = Math.sin(t * 3) * 0.06 - (action === "jump" ? Math.cos((actionT / 0.8) * Math.PI * 2) * 0.25 : 0);

    // Arms.
    const [left, right] = arms;
    const rest = 0.4 + Math.sin(t * 2.2) * 0.04;
    let rz = rest;
    let rx = 0;
    let lz = -rest;
    let lx2 = 0;
    if (wave) rz = lerp(rest, 2.5 + Math.sin(t * 9) * 0.35, wave);
    if (knock) {
      rx = lerp(0, -1.5 + Math.abs(Math.sin(actionT * 11)) * 0.35, knock);
      rz = lerp(rest, 0.15, knock);
    }
    if (rub) {
      const w = Math.sin(actionT * 14) * 0.12;
      rx = lx2 = lerp(0, -0.95, rub);
      rz = lerp(rest, -0.35 + w, rub);
      lz = lerp(-rest, 0.35 + w, rub);
    }
    if (armsUp) {
      rz = lerp(rz, 2.6, armsUp);
      lz = lerp(lz, -2.6, armsUp);
    }
    right.rotation.set(rx, 0, rz);
    left.rotation.set(lx2, 0, lz);

    // Petting builds into hearts; it fades when the hand moves away.
    if (petting > 0) {
      petting = Math.max(0, petting - dt * 0.6);
      petHearts += dt;
      if (petting > 1.2 && petHearts > 0.7) {
        petHearts = 0;
        emit(hearts, 1, 1.4);
      }
    }

    // Idle fidgets, so she never looks frozen.
    if (t > nextFidget && !action && mood === "idle") {
      nextFidget = t + 9 + Math.random() * 8;
      const r = Math.random();
      play(r < 0.45 ? "wave" : r < 0.75 ? "rub" : "think");
      if (r >= 0.45 && r < 0.75) setMood("mischief", 1.8);
    }

    // Particles.
    for (const [pool, rise, life] of [
      [hearts, 1.4, 1.5],
      [steam, 0.9, 1.1],
    ] as const) {
      for (const h of pool) {
        if (h.life === -1) continue;
        h.life += dt;
        if (h.life < 0) continue;
        const p = h.life / life;
        if (p >= 1) {
          h.life = -1;
          h.mesh.visible = false;
          continue;
        }
        h.mesh.visible = true;
        const base = pool === hearts ? 2.5 : 2.2;
        h.mesh.position.set(h.x + Math.sin(p * 6) * 0.12 + h.drift * p, base + p * rise + y, pool === hearts ? 0.4 : -0.1);
        const s = pool === hearts ? (p < 0.2 ? (p / 0.2) * 0.5 : 0.5 - p * 0.12) : 0.6 + p * 1.2;
        h.mesh.scale.setScalar(s);
        h.mesh.rotation.y = p * h.spin;
        h.mat.opacity = p > 0.6 ? 1 - (p - 0.6) / 0.4 : pool === hearts ? 1 : 0.8;
      }
    }
    if (mood === "angry" && Math.random() < dt * 3) emit(steam, 1, 1.6);
  }

  return {
    root,
    bounds: new THREE.Sphere(new THREE.Vector3(0, 1.3, 0), 1.35),
    setLook(x, y) {
      look.tx = Math.max(-1, Math.min(1, x));
      look.ty = Math.max(-1, Math.min(1, y));
    },
    setMood,
    pet(dt) {
      petting = Math.min(4, petting + dt * 1.8);
    },
    react(kind) {
      switch (kind) {
        case "pledge":
        case "cheer":
          play("jump");
          setMood("happy", 2.5);
          emit(hearts, kind === "pledge" ? 7 : 5, 1.6);
          break;
        case "love":
          setMood("love", 2.5);
          emit(hearts, 4, 1.4);
          break;
        case "giggle":
          play("giggle");
          setMood("happy", 1.6);
          break;
        case "spin":
          play("spin");
          setMood("happy", 1.4);
          break;
        case "mischief":
          play("rub");
          setMood("mischief", 2.4);
          break;
        case "angry":
          play("stomp");
          setMood("angry", 3.5);
          emit(steam, 3, 1.4);
          break;
        case "attention":
          play("knock");
          setMood("attention", 3);
          break;
        case "surprised":
          setMood("surprised", 1.4);
          break;
        case "sleepy":
          play("yawn");
          setMood("sleepy", 6);
          break;
        case "match":
          play("think");
          break;
        case "post":
        case "wave":
          play("wave");
          setMood("happy", 1.5);
          break;
      }
    },
    update,
  };
}
