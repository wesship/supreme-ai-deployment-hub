import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGraphFrameScheduler } from './useGraphFrameScheduler';

const BLUE = '#4da8ff';
const CYAN = '#6ff0ff';
const MAGENTA = '#ff4da6';
const CYAN_COLOR = new THREE.Color(CYAN);
const MAGENTA_COLOR = new THREE.Color(MAGENTA);

// Shared mutable state between the DOM listeners and the render loop, so
// scroll and pointer events flow into useFrame without triggering re-renders.
const state = {
  progress: 0,
  smooth: 0,
  mouseX: 0,
  mouseY: 0,
};

function NeuralWeb({ count }: { count: number }) {
  const { pointGeometry, lineGeometry, lineCount } = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      const r = 4 + Math.random() * 12;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pts.push(
        new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi) - 2,
        ),
      );
    }

    const positions = new Float32Array(count * 3);
    pts.forEach((p, i) => {
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
    });

    const pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const threshold = 2.8;
    const maxConnections = 2400;
    const linkCoords: number[] = [];
    let connections = 0;

    outer: for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        if (pts[i].distanceToSquared(pts[j]) < threshold * threshold) {
          linkCoords.push(pts[i].x, pts[i].y, pts[i].z, pts[j].x, pts[j].y, pts[j].z);
          connections++;
          if (connections >= maxConnections) break outer;
        }
      }
    }

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(linkCoords), 3),
    );

    return { pointGeometry, lineGeometry, lineCount: connections };
  }, [count]);

  const group = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * 0.04;
    }
  });

  return (
    <group ref={group}>
      <points geometry={pointGeometry}>
        <pointsMaterial
          size={0.18}
          color={CYAN}
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
      {lineCount > 0 && (
        <lineSegments geometry={lineGeometry}>
          <lineBasicMaterial
            color={BLUE}
            transparent
            opacity={0.34}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </lineSegments>
      )}
    </group>
  );
}

function AccentPulse() {
  const geometry = useMemo(() => {
    const count = 170;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 2.8 + Math.random() * 3.6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, []);

  const points = useRef<THREE.Points>(null);
  const material = useRef<THREE.PointsMaterial>(null);

  useFrame(({ clock }, delta) => {
    if (points.current) {
      points.current.rotation.y += delta * 0.16;
      points.current.rotation.x += delta * 0.06;
    }
    if (material.current) {
      const pulse = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 1.6));
      material.current.opacity = pulse;
    }
  });

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial
        ref={material}
        size={0.15}
        color={MAGENTA}
        transparent
        opacity={0.4}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

function Core() {
  const group = useRef<THREE.Group>(null);
  const sphere = useRef<THREE.Mesh>(null);
  const icosahedron = useRef<THREE.Mesh>(null);
  const torus = useRef<THREE.Mesh>(null);
  const inner = useRef<THREE.Mesh>(null);
  const glowMat = useRef<THREE.MeshBasicMaterial>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  const processor = useRef<THREE.Mesh>(null);

  useFrame(({ clock }, delta) => {
    const s = state.smooth;
    const reveal = Math.max(0.4, 1 - s * 0.5);

    // Crossfade windows across scroll progress: sphere -> icosahedron -> torus.
    const win = (center: number, half: number) =>
      THREE.MathUtils.clamp(1 - Math.abs(s - center) / half, 0, 1);

    const oSphere = win(0.0, 0.35);
    const oIco = win(0.5, 0.35);
    const oTorus = win(1.0, 0.35);

    if (group.current) {
      group.current.rotation.y += delta * 0.25;
      // Tilt the whole core toward the cursor for extra depth.
      const targetRotX = state.mouseY * 0.35;
      const targetRotZ = -state.mouseX * 0.25;
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x,
        targetRotX,
        0.05,
      );
      group.current.rotation.z = THREE.MathUtils.lerp(
        group.current.rotation.z,
        targetRotZ,
        0.05,
      );
      group.current.scale.setScalar(reveal);
    }

    const apply = (
      ref: { current: THREE.Mesh | null },
      opacity: number,
      base: number,
      spinX: number,
      spinY: number,
    ) => {
      const mesh = ref.current;
      if (!mesh) return;
      (mesh.material as THREE.MeshBasicMaterial).opacity = opacity * base;
      mesh.rotation.x += delta * spinX;
      mesh.rotation.y += delta * spinY;
      mesh.scale.setScalar(0.8 + opacity * 0.35);
    };

    apply(sphere, oSphere, 0.45, 0.1, 0.2);
    apply(icosahedron, oIco, 0.45, -0.05, 0.25);
    apply(torus, oTorus, 0.45, 0.15, -0.12);

    if (inner.current) {
      inner.current.rotation.y -= delta * 0.4;
      inner.current.rotation.z += delta * 0.15;
      (inner.current.material as THREE.MeshBasicMaterial).opacity =
        0.35 * Math.max(oSphere, oIco, oTorus, 0.25);
    }

    if (glowMat.current) {
      const t = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 1.2);
      glowMat.current.color.lerpColors(CYAN_COLOR, MAGENTA_COLOR, t);
    }

    // Living core: rotating data rings + illuminated inner processor
    if (ringA.current) {
      ringA.current.rotation.z += delta * 0.35;
      ringA.current.rotation.x += delta * 0.14;
    }
    if (ringB.current) {
      ringB.current.rotation.z -= delta * 0.24;
      ringB.current.rotation.y += delta * 0.16;
    }
    if (processor.current) {
      const p = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 1.8);
      (processor.current.material as THREE.MeshBasicMaterial).opacity = 0.5 + p * 0.35;
      processor.current.scale.setScalar(1 + p * 0.1);
    }
  });

  return (
    <group ref={group}>
      <mesh ref={sphere}>
        <sphereGeometry args={[2.5, 28, 28]} />
        <meshBasicMaterial color={CYAN} wireframe transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={icosahedron}>
        <icosahedronGeometry args={[2.7, 1]} />
        <meshBasicMaterial color={CYAN} wireframe transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={torus}>
        <torusGeometry args={[2.4, 0.85, 16, 80]} />
        <meshBasicMaterial color={BLUE} wireframe transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={inner}>
        <icosahedronGeometry args={[1.5, 1]} />
        <meshBasicMaterial color={BLUE} wireframe transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial
          ref={glowMat}
          color={CYAN}
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={ringA}>
        <torusGeometry args={[2.9, 0.02, 8, 96]} />
        <meshBasicMaterial
          color={CYAN}
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={ringB}>
        <torusGeometry args={[3.15, 0.015, 8, 96]} />
        <meshBasicMaterial
          color={BLUE}
          transparent
          opacity={0.4}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh ref={processor}>
        <sphereGeometry args={[1.1, 32, 32]} />
        <meshBasicMaterial
          color={CYAN}
          transparent
          opacity={0.6}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function Rig() {
  const { camera } = useThree();

  useFrame((_, delta) => {
    state.smooth = THREE.MathUtils.lerp(state.smooth, state.progress, Math.min(1, delta * 3));

    const targetZ = 12 + state.smooth * 9;
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 0.08);
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, state.mouseX * 1.7, 0.06);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, state.mouseY * 1.3, 0.06);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

/** Keep the same time-based motion without drawing at every display refresh. */
function FrameScheduler({ paused }: { paused: boolean }) {
  const { invalidate } = useThree();
  useGraphFrameScheduler(invalidate, paused);
  return null;
}

export default function ThreeBackground({ compact = false }: { compact?: boolean }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(preference.matches || document.documentElement.classList.contains('reduce-motion'));
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    preference.addEventListener('change', update);
    update();
    return () => { observer.disconnect(); preference.removeEventListener('change', update); };
  }, []);
  const [count] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768
      ? (compact ? 260 : 520)
      : (compact ? 560 : 1100),
  );

  useEffect(() => {
    let ok = true;
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) ok = false;
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      ok = false;
    }
    setSupported(ok);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      state.progress = max > 0 ? window.scrollY / max : 0;
    };
    const onMove = (e: MouseEvent) => {
      state.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      state.mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  if (!supported) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 12], fov: 60, near: 0.1, far: 120 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      >
        <FrameScheduler paused={reduceMotion} />
        <Rig />
        <Core />
        <AccentPulse />
        <NeuralWeb count={count} />
      </Canvas>
    </div>
  );
}
