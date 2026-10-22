import * as THREE from "three";

/**
 * Adds a soft fresnel glow to a standard material, so edges catch the light
 * the way fuzzy clouds and felt do. Uniforms are per material; the shader
 * program is shared.
 */
export function withRim<T extends THREE.MeshStandardMaterial>(material: T, color: THREE.ColorRepresentation, strength = 0.5, power = 2.5): T {
  const rim = new THREE.Color(color).multiplyScalar(strength);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRim = { value: rim };
    shader.uniforms.uRimPow = { value: power };
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uRim;\nuniform float uRimPow;")
      .replace(
        "#include <tonemapping_fragment>",
        "float rimF = pow(1.0 - clamp(dot(normalize(normal), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), uRimPow);\ngl_FragColor.rgb += uRim * rimF;\n#include <tonemapping_fragment>",
      );
  };
  material.customProgramCacheKey = () => `rim-${power}`;
  return material;
}

/** Small seeded random, so every visit paints the same sky. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}
