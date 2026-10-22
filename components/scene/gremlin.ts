// Peep, Perspective's matchmaking gremlin, built from primitives: a bean body,
// big glossy eyes, wide bat ears, a lavender tuft and one tiny fang. Feet sit
// at y = 0 and the whole character is about 2.3 units tall.

import * as THREE from "three";
import { withRim } from "./materials";

export type Reaction = "post" | "match" | "pledge" | "cheer";

export type Gremlin = {
  root: THREE.Group;
  /** Where Peep should look, -1..1 on each axis (screen space, y down). */
  setLook(x: number, y: number): void;
  react(kind: Reaction): void;
  update(dt: number): void;
  /** Bounding sphere in Peep's local space, for hit tests. */
  bounds: THREE.Sphere;
};

const C = {
  body: "#8fdcbd",
  belly: "#ecfbf2",
  foot: "#72c9a5",
  earInner: "#ff9fc4",
  tuft: "#b7a3ff",
  iris: "#2a2046",
  pupil: "#120c20",
  cheek: "#ff8db3",
  mouth: "#3b2342",
  heart: ["#ff6b8f", "#ff8a5c", "#ff9fc4"],
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const damp = (a: number, b: number, rate: number, dt: number) => lerp(a, b, 1 - Math.exp(-rate * dt));

function earShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, -0.26);
  s.quadraticCurveTo(0.62, -0.34, 1.22, 0.16);
  s.quadraticCurveTo(0.6, 0.3, 0, 0.3);
  s.quadraticCurveTo(-0.07, 0.02, 0, -0.26);
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
      color: C.body,
      emissive: C.body,
      emissiveIntensity: 0.12,
      roughness: 0.55,
      sheen: 1,
      sheenColor: new THREE.Color("#f2fff9"),
      sheenRoughness: 0.4,
      clearcoat: 0.08,
    }),
    "#ffd8ef",
    0.32,
  );
  const glossy = (color: string) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 });
  const matte = (color: string) => withRim(new THREE.MeshStandardMaterial({ color, roughness: 0.7 }), "#ffffff", 0.18);

  // Body: a sphere pinched into a bean, wider at the bottom.
  const bodyGeo = new THREE.SphereGeometry(1, 72, 54);
  const p = bodyGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) * 1.08;
    const k = y < 0 ? 1 + 0.15 * Math.min(1, -y) : 1 - 0.1 * y;
    p.setXYZ(i, p.getX(i) * k, y, p.getZ(i) * k * 0.94);
  }
  bodyGeo.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeo, skin);
  body.position.y = 1.08;
  turn.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), matte(C.belly));
  belly.scale.set(0.58, 0.52, 0.22);
  belly.position.set(0, 0.7, 0.84);
  belly.rotation.x = 0.28;
  turn.add(belly);

  // Eyes: glossy sclera, an iris group that tracks, and two catchlights.
  const eyes = new THREE.Group();
  eyes.position.set(0, 1.42, 0);
  turn.add(eyes);
  const irises: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(side * 0.36, 0, 0.72);
    eye.rotation.y = side * 0.3;
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.26, 40, 32), glossy("#fdfcff"));
    sclera.scale.set(1, 1.1, 0.58);
    eye.add(sclera);
    const iris = new THREE.Group();
    const irisBall = new THREE.Mesh(new THREE.SphereGeometry(0.18, 36, 28), glossy(C.iris));
    irisBall.scale.set(1, 1.1, 0.45);
    irisBall.position.z = 0.09;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.1, 28, 20), glossy(C.pupil));
    pupil.scale.set(1, 1.1, 0.4);
    pupil.position.z = 0.135;
    const shine = new THREE.MeshBasicMaterial({ color: "#ffffff" });
    const hi1 = new THREE.Mesh(new THREE.SphereGeometry(0.048, 16, 12), shine);
    hi1.position.set(0.065, 0.075, 0.175);
    const hi2 = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), shine);
    hi2.position.set(-0.05, -0.06, 0.175);
    iris.add(irisBall, pupil, hi1, hi2);
    eye.add(iris);
    irises.push(iris);
    eyes.add(eye);
  }

  // Cheeks.
  const cheekMat = new THREE.MeshStandardMaterial({ color: C.cheek, roughness: 0.8, transparent: true, opacity: 0.55, depthWrite: false });
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), cheekMat);
    cheek.scale.set(1, 0.6, 0.3);
    cheek.position.set(side * 0.57, 1.2, 0.8);
    cheek.rotation.y = side * 0.6;
    turn.add(cheek);
  }

  // Smile and one tiny fang.
  const mouth = new THREE.Group();
  mouth.position.set(0, 1.13, 0.925);
  mouth.rotation.x = -0.08;
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 10, 32, Math.PI), new THREE.MeshStandardMaterial({ color: C.mouth, roughness: 0.6 }));
  smile.rotation.z = Math.PI;
  const fang = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.085, 12), new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.3 }));
  fang.rotation.x = Math.PI;
  fang.position.set(0.065, -0.13, 0.01);
  mouth.add(smile, fang);
  turn.add(mouth);

  // Ears: extruded leaves with a pink lining. Left is a mirror of right.
  const earGeo = new THREE.ExtrudeGeometry(earShape(), { depth: 0.05, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 5, curveSegments: 28 });
  const innerShape = earShape();
  const innerGeo = new THREE.ExtrudeGeometry(innerShape, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 24 });
  innerGeo.scale(0.66, 0.6, 1);
  innerGeo.translate(0.22, 0.01, 0.1);
  const earSkin = skin.clone();
  earSkin.side = THREE.DoubleSide;
  const innerMat = new THREE.MeshStandardMaterial({ color: C.earInner, roughness: 0.6, side: THREE.DoubleSide });
  const ears: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(side * 0.78, 1.6, -0.05);
    ear.scale.setScalar(0.78);
    const leaf = new THREE.Group();
    leaf.add(new THREE.Mesh(earGeo, earSkin), new THREE.Mesh(innerGeo, innerMat));
    if (side < 0) leaf.scale.x = -1;
    ear.add(leaf);
    ear.rotation.set(0, side * -0.45, side * 0.12);
    ears.push(ear);
    turn.add(ear);
  }

  // Tuft.
  const tuft = new THREE.Group();
  tuft.position.set(0, 2.08, -0.04);
  const tuftMat = withRim(new THREE.MeshStandardMaterial({ color: C.tuft, roughness: 0.5 }), "#ffffff", 0.3);
  for (const [x, rz, h] of [
    [0, 0, 0.4],
    [-0.11, 0.55, 0.3],
    [0.11, -0.55, 0.3],
  ]) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.075, h, 14), tuftMat);
    spike.geometry.translate(0, h / 2, 0);
    spike.position.x = x;
    spike.rotation.z = rz;
    tuft.add(spike);
  }
  turn.add(tuft);

  // Arms hang from the shoulders so they can wave.
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.86, 0.98, 0.12);
    const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.3, 8, 18), skin);
    limb.position.y = -0.24;
    arm.add(limb);
    arm.rotation.z = side * 0.45;
    arms.push(arm);
    squash.add(arm);
  }

  for (const side of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), matte(C.foot));
    foot.scale.set(0.3, 0.15, 0.36);
    foot.position.set(side * 0.4, 0.07, 0.25);
    squash.add(foot);
  }

  // Hearts for celebrations, pooled.
  const heartGeo = new THREE.ExtrudeGeometry(heartShape(), { depth: 0.06, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3, curveSegments: 16 });
  heartGeo.center();
  const hearts = Array.from({ length: 8 }, (_, i) => {
    const mat = new THREE.MeshStandardMaterial({ color: C.heart[i % 3], emissive: C.heart[i % 3], emissiveIntensity: 0.35, roughness: 0.4, transparent: true });
    const mesh = new THREE.Mesh(heartGeo, mat);
    mesh.visible = false;
    root.add(mesh);
    return { mesh, mat, life: -1, x: 0, drift: 0, spin: 0 };
  });
  // life is -1 when idle; a small negative life is a stagger before the heart appears.
  function burst(n: number) {
    let k = 0;
    for (const h of hearts) {
      if (h.life !== -1 || k >= n) continue;
      h.life = -k * 0.12 - 0.0001;
      h.x = (Math.random() - 0.5) * 1.6;
      h.drift = (Math.random() - 0.5) * 0.8;
      h.spin = (Math.random() - 0.5) * 3;
      k++;
    }
  }

  // State.
  let t = 0;
  const look = { x: 0, y: 0, tx: 0, ty: 0 };
  let blinkAt = 1.2;
  let blinkT = -1;
  let doubleBlink = false;
  let waveT = 0.4;
  let nextWave = 9;
  let jumpT = -1;
  let thinkT = -1;
  let earT = -1;
  let earSide = 0;
  let nextEar = 2.5;

  function update(dt: number) {
    t += dt;

    // Breathing and a slow sway.
    const br = Math.sin(t * 2.2) * 0.018;
    let sy = 1 + br;
    let sxz = 1 - br * 0.6;
    let y = 0;
    let armsUp = 0;

    // Jump with squash and stretch.
    if (jumpT >= 0) {
      jumpT += dt;
      const p = jumpT / 0.8;
      if (p >= 1) jumpT = -1;
      else {
        armsUp = Math.sin(Math.PI * Math.min(1, p * 1.4));
        if (p < 0.14) {
          sy = 1 - 0.18 * Math.sin((p / 0.14) * Math.PI);
          sxz = 1 + 0.12 * Math.sin((p / 0.14) * Math.PI);
        } else if (p > 0.86) {
          const q = (p - 0.86) / 0.14;
          sy = 1 - 0.14 * Math.sin(q * Math.PI);
          sxz = 1 + 0.1 * Math.sin(q * Math.PI);
        } else {
          const q = (p - 0.14) / 0.72;
          y = Math.sin(Math.PI * q) * 0.6;
          sy = 1 + 0.08 * Math.cos(Math.PI * q);
          sxz = 1 - 0.05 * Math.cos(Math.PI * q);
        }
      }
    }
    hop.position.y = y;
    squash.scale.set(sxz, sy, sxz);

    // Looking: the body turns a little, the eyes a lot.
    let lx = look.tx;
    let ly = look.ty;
    if (thinkT >= 0) {
      thinkT += dt;
      lx = Math.sin(thinkT * 5) > 0 ? 0.8 : -0.8;
      ly = -0.7;
      if (thinkT > 1.7) thinkT = -1;
    }
    look.x = damp(look.x, lx, 7, dt);
    look.y = damp(look.y, ly, 7, dt);
    turn.rotation.y = look.x * 0.42;
    turn.rotation.x = look.y * 0.16;
    turn.rotation.z = Math.sin(t * 1.3) * 0.035 + (thinkT >= 0 ? 0.12 : 0);
    for (const iris of irises) {
      iris.rotation.y = look.x * 0.5;
      iris.rotation.x = look.y * 0.42;
    }

    // Blinks, sometimes doubled.
    if (t > blinkAt && blinkT < 0) {
      blinkT = 0;
      doubleBlink = Math.random() < 0.25;
      blinkAt = t + 2.2 + Math.random() * 3.5;
    }
    let eyeY = 1;
    if (blinkT >= 0) {
      blinkT += dt;
      const b = blinkT;
      eyeY = b < 0.07 ? 1 - (b / 0.07) * 0.92 : b < 0.16 ? 0.08 + ((b - 0.07) / 0.09) * 0.92 : 1;
      if (b > 0.16) {
        if (doubleBlink) {
          doubleBlink = false;
          blinkT = 0;
        } else blinkT = -1;
      }
    }
    eyes.scale.y = eyeY;

    // Ears: perk when thinking or jumping, flick now and then.
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
    const perk = thinkT >= 0 || jumpT >= 0 ? 0.25 : 0;
    ears.forEach((ear, i) => {
      const side = i === 0 ? -1 : 1;
      const wobble = Math.sin(t * 2.2 + i) * 0.03;
      ear.rotation.z = side * (0.12 + perk + wobble + (i === earSide ? flick : 0));
    });
    tuft.rotation.z = Math.sin(t * 3) * 0.06 - (jumpT >= 0 ? Math.cos((jumpT / 0.8) * Math.PI * 2) * 0.25 : 0);

    // Arms: rest, wave, or both up for a cheer.
    if (t > nextWave && waveT < 0) {
      waveT = 0;
      nextWave = t + 8 + Math.random() * 6;
    }
    let wave = 0;
    if (waveT >= 0) {
      waveT += dt;
      const p = waveT / 2.2;
      wave = Math.sin(Math.PI * Math.min(1, p)) ** 0.5;
      if (p >= 1) waveT = -1;
    }
    const right = arms[1];
    const left = arms[0];
    const waveAngle = 0.45 + wave * (2.0 + Math.sin(t * 9) * 0.35);
    right.rotation.z = lerp(waveAngle, 2.6, armsUp);
    left.rotation.z = -lerp(0.45 + Math.sin(t * 2.2) * 0.04, 2.6, armsUp);
    mouth.scale.y = 1 + armsUp * 0.6 + wave * 0.15;

    // Hearts float up and fade.
    for (const h of hearts) {
      if (h.life === -1) continue;
      h.life += dt;
      if (h.life < 0) continue;
      const p = h.life / 1.5;
      if (p >= 1) {
        h.life = -1;
        h.mesh.visible = false;
        continue;
      }
      h.mesh.visible = true;
      h.mesh.position.set(h.x + Math.sin(p * 6) * 0.12 + h.drift * p, 2.2 + p * 1.4 + y, 0.4);
      const s = p < 0.2 ? (p / 0.2) * 0.5 : 0.5 - p * 0.12;
      h.mesh.scale.setScalar(s);
      h.mesh.rotation.y = p * h.spin;
      h.mat.opacity = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
    }
  }

  return {
    root,
    bounds: new THREE.Sphere(new THREE.Vector3(0, 1.15, 0), 1.25),
    setLook(x, y) {
      look.tx = Math.max(-1, Math.min(1, x));
      look.ty = Math.max(-1, Math.min(1, y));
    },
    react(kind) {
      if (kind === "pledge" || kind === "cheer") {
        jumpT = 0;
        burst(kind === "pledge" ? 6 : 4);
      } else if (kind === "match") {
        thinkT = 0;
      } else if (kind === "post") {
        waveT = 0;
      }
    },
    update,
  };
}
