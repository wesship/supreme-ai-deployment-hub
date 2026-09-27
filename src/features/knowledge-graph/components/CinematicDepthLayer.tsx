import React, { useEffect, useRef } from 'react';

type DepthState = 'idle' | 'connecting' | 'running' | 'complete' | 'failed';

export interface CinematicDepthLayerProps {
  runtimeState: DepthState;
  active: boolean;
  corridor: boolean;
  anchor: { x: number; y: number };
}

const vertexShader = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const fragmentShader = `
precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_intensity;
uniform float u_corridor;
uniform vec3 u_tint;
uniform vec2 u_anchor;
uniform vec2 u_parallax;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float dust(vec2 uv, float scale, float speed) {
  vec2 grid = floor(uv * scale);
  vec2 cell = fract(uv * scale) - 0.5;
  float n = hash(grid);
  float twinkle = 0.42 + 0.58 * sin(u_time * speed + n * 6.2831);
  float size = mix(0.025, 0.09, n);
  return smoothstep(size, 0.0, length(cell)) * step(0.91, n) * twinkle;
}

void main() {
  vec2 uv = gl_FragCoord.xy / max(u_resolution.xy, vec2(1.0));
  vec2 aspect = vec2(u_resolution.x / max(u_resolution.y, 1.0), 1.0);
  vec2 anchoredUv = u_anchor + u_parallax;
  vec2 anchorP = (anchoredUv - 0.5) * aspect;
  vec2 p = (uv - 0.5) * aspect;

  float t = u_time * 0.08;
  vec2 drift = vec2(sin(t) * 0.018, cos(t * 0.73) * 0.012);
  vec2 local = p - anchorP;

  float core = exp(-8.5 * dot(local - drift, local - drift));
  float halo = exp(-3.2 * dot(local * vec2(0.82, 1.0), local * vec2(0.82, 1.0)));
  float corridorBand = exp(-18.0 * abs(local.y + 0.08 * sin(local.x * 5.0 + u_time * 0.22)));
  corridorBand *= smoothstep(0.95, 0.08, abs(local.x));

  float d1 = dust(uv + drift, 18.0, 0.65);
  float d2 = dust(uv * 1.07 - drift * 0.55, 31.0, 0.42);
  float d3 = dust(uv * 0.92 + vec2(t * 0.01, 0.0), 47.0, 0.3);

  float light = (core * 0.62 + halo * 0.18) * u_intensity;
  light += (d1 * 0.52 + d2 * 0.34 + d3 * 0.18) * (0.35 + u_intensity * 0.7);
  light += corridorBand * u_corridor * 0.22;

  vec3 warmWhite = vec3(1.0, 0.965, 0.82);
  vec3 amber = vec3(0.98, 0.65, 0.16);
  vec3 color = mix(amber, warmWhite, clamp(core + corridorBand * 0.6, 0.0, 1.0));
  color = mix(color, u_tint, 0.22);

  float vignette = smoothstep(0.98, 0.24, length(p * vec2(0.74, 1.0)));
  float alpha = light * vignette;

  gl_FragColor = vec4(color * alpha, alpha);
}
`;

export const depthVisualConfig = (
  state: DepthState,
  active: boolean,
  corridor: boolean,
): { tint: [number, number, number]; intensity: number; corridor: number } => {
  let tint: [number, number, number];
  switch (state) {
    case 'complete':
      tint = [0.74, 0.95, 0.78];
      break;
    case 'failed':
      tint = [0.96, 0.43, 0.42];
      break;
    case 'connecting':
      tint = [1.0, 0.82, 0.42];
      break;
    case 'running':
      tint = [1.0, 0.9, 0.64];
      break;
    default:
      tint = [0.96, 0.72, 0.28];
  }
  return {
    tint,
    intensity: active ? 1.0 : 0.42,
    corridor: corridor ? 1.0 : 0.0,
  };
};

const compileShader = (
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

export const CinematicDepthLayer: React.FC<CinematicDepthLayerProps> = ({
  runtimeState,
  active,
  corridor,
  anchor,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const anchorRef = useRef(anchor);

  useEffect(() => {
    anchorRef.current = anchor;
  }, [anchor.x, anchor.y]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      depth: false,
      powerPreference: 'low-power',
    });
    if (!gl) return;

    const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexShader);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
    if (!vertex || !fragment) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    gl.useProgram(program);
    const position = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const resolution = gl.getUniformLocation(program, 'u_resolution');
    const time = gl.getUniformLocation(program, 'u_time');
    const intensity = gl.getUniformLocation(program, 'u_intensity');
    const corridorUniform = gl.getUniformLocation(program, 'u_corridor');
    const tint = gl.getUniformLocation(program, 'u_tint');
    const anchorUniform = gl.getUniformLocation(program, 'u_anchor');
    const parallaxUniform = gl.getUniformLocation(program, 'u_parallax');
    const visual = depthVisualConfig(runtimeState, active, corridor);
    const [r, g, b] = visual.tint;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    let raf = 0;
    let targetParallaxX = 0;
    let targetParallaxY = 0;
    let parallaxX = 0;
    let parallaxY = 0;
    let anchorX = anchorRef.current.x;
    let anchorY = anchorRef.current.y;

    const onPointerMove = (event: PointerEvent) => {
      if (reducedMotion) return;
      const rect = canvas.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        targetParallaxX = 0;
        targetParallaxY = 0;
        return;
      }
      const nx = (event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5;
      const ny = (event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5;
      targetParallaxX = nx * 0.035;
      targetParallaxY = -ny * 0.028;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const draw = (now: number) => {
      resize();
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform1f(time, reducedMotion ? 0 : now / 1000);
      gl.uniform1f(intensity, visual.intensity);
      gl.uniform1f(corridorUniform, visual.corridor);
      gl.uniform3f(tint, r, g, b);
      const targetAnchor = anchorRef.current;
      if (reducedMotion) {
        anchorX = targetAnchor.x;
        anchorY = targetAnchor.y;
      } else {
        anchorX += (targetAnchor.x - anchorX) * 0.055;
        anchorY += (targetAnchor.y - anchorY) * 0.055;
      }
      gl.uniform2f(anchorUniform, anchorX, 1 - anchorY);
      parallaxX += (targetParallaxX - parallaxX) * 0.055;
      parallaxY += (targetParallaxY - parallaxY) * 0.055;
      gl.uniform2f(
        parallaxUniform,
        reducedMotion ? 0 : parallaxX,
        reducedMotion ? 0 : parallaxY,
      );
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (!reducedMotion) raf = requestAnimationFrame(draw);
    };

    draw(0);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    };
  }, [active, corridor, runtimeState]);

  return (
    <canvas
      ref={canvasRef}
      className="d3-webgl-depth"
      aria-hidden="true"
      data-runtime-state={runtimeState}
      style={{ pointerEvents: 'none' }}
    />
  );
};

export default CinematicDepthLayer;
