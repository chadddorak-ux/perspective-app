// Peep's own little stage: a transparent canvas with just her in it, so she
// can float over any page (standing in the hero's arch, or in the corner as
// your campaign manager). The page decides where the canvas goes.

import * as THREE from "three";
import { makeGremlin, type Mood, type Reaction } from "./gremlin";

export type StageAPI = {
  setActive(on: boolean): void;
  react(kind: Reaction): void;
  setMood(mood: Mood, holdSeconds?: number): void;
  /** Point her eyes at a spot on screen. */
  lookAt(clientX: number, clientY: number): void;
  /** Is this screen point on Peep? */
  hit(clientX: number, clientY: number): boolean;
  pet(dt: number): void;
  setLantern(down: boolean, rate?: number): void;
  lanternDown(): boolean;
  /** Night lighting: moonlight, with her lantern doing the rest. */
  setNight(on: boolean): void;
  setDangle(on: boolean): void;
  setMotion(vx: number): void;
  dispose(): void;
};

const CAM_Z = 7.5;
const FOV = 30;
const TARGET_Y = 1.6;

export type StageOptions = {
  reduced: boolean;
  /** Hearts to float up from the top of her head, at this screen point. */
  onHearts?: (n: number, clientX: number, clientY: number, scale: number) => void;
};

export function createStage(canvas: HTMLCanvasElement, opts: StageOptions): StageAPI {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, TARGET_Y, CAM_Z);
  camera.lookAt(0, TARGET_Y, 0);
  const hemi = new THREE.HemisphereLight("#f3efff", "#d6b3dc", 1.6);
  scene.add(hemi);
  const key = new THREE.DirectionalLight("#fff2e8", 2.2);
  key.position.set(-3, 4, 6);
  const rim = new THREE.DirectionalLight("#ffb8d4", 1.5);
  rim.position.set(2.5, 3, -5);
  scene.add(key, rim);

  const peep = makeGremlin({
    onHearts(n) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width) return;
      const at = toScreen(0, 2.5, rect);
      opts.onHearts?.(n, at.x, at.y, unitPx(rect));
    },
  });
  scene.add(peep.root);

  function layout() {
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // Screen-space circles around her head and body, for hit tests.
  const v = new THREE.Vector3();
  function toScreen(x: number, y: number, rect: DOMRect) {
    v.set(x, y, 0).applyMatrix4(peep.root.matrixWorld).project(camera);
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
  }
  function unitPx(rect: DOMRect) {
    return rect.height / (2 * CAM_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
  }

  let raf = 0;
  let last = 0;
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    peep.update(dt);
    renderer.render(scene, camera);
  }
  function still() {
    peep.update(0.4);
    renderer.render(scene, camera);
  }

  const ro = new ResizeObserver(() => {
    layout();
    renderer.render(scene, camera);
  });
  ro.observe(canvas);
  layout();
  peep.update(0.016);
  renderer.render(scene, camera);

  return {
    setActive(on) {
      if (on && !raf && !opts.reduced) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      } else if (!on) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
    react(kind) {
      peep.react(kind);
      if (opts.reduced) still();
    },
    setMood(mood, hold) {
      peep.setMood(mood, hold);
      if (opts.reduced) still();
    },
    lookAt(cx, cy) {
      const rect = canvas.getBoundingClientRect();
      const headAt = toScreen(0, 1.62, rect);
      const reach = Math.max(rect.width, 320);
      peep.setLook((cx - headAt.x) / reach, (cy - headAt.y) / reach);
    },
    hit(cx, cy) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width) return false;
      const u = unitPx(rect);
      const headAt = toScreen(0, 1.62, rect);
      const bodyAt = toScreen(0, 0.7, rect);
      return Math.hypot((cx - headAt.x) / 1.15, cy - headAt.y) < 1.0 * u || Math.hypot(cx - bodyAt.x, cy - bodyAt.y) < 0.75 * u;
    },
    pet(dt) {
      peep.pet(dt);
    },
    setLantern(down, rate) {
      peep.setLantern(down, rate);
      if (opts.reduced) still();
    },
    lanternDown: () => peep.lanternDown(),
    setNight(on) {
      peep.setNight(on);
      hemi.color.set(on ? "#d4dcef" : "#f3efff");
      hemi.groundColor.set(on ? "#4a3a5e" : "#d6b3dc");
      hemi.intensity = on ? 1.15 : 1.6;
      key.color.set(on ? "#dfe6ff" : "#fff2e8");
      key.intensity = on ? 1.2 : 2.2;
      rim.color.set(on ? "#b9a8ff" : "#ffb8d4");
      if (opts.reduced) still();
    },
    setDangle: (on) => peep.setDangle(on),
    setMotion: (vx) => peep.setMotion(vx),
    dispose() {
      cancelAnimationFrame(raf);
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
