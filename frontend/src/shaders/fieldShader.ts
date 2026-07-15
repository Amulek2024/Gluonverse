export const fieldVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const fieldFragmentShader = `
  uniform float uTime;
  uniform float uIntensity;
  varying vec2 vUv;

  void main() {
    vec2 p = vUv - 0.5;
    float radius = length(p);
    float wave = sin(24.0 * radius - uTime * 2.2);
    float ring = smoothstep(0.48, 0.08, radius) * (0.45 + 0.35 * wave);
    vec3 field = mix(vec3(0.1, 0.55, 0.66), vec3(0.95, 0.72, 0.25), radius);
    gl_FragColor = vec4(field, ring * uIntensity);
  }
`;

