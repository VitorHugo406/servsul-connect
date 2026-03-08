import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Float, MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';

interface RobotModelProps {
  action: 'wave' | 'point' | 'thumbsup';
}

function RobotHead() {
  const visorRef = useRef<THREE.Mesh>(null);

  // Glowing eyes pulse
  useFrame(({ clock }) => {
    if (visorRef.current) {
      const mat = visorRef.current.material as THREE.MeshStandardMaterial;
      const pulse = 0.6 + Math.sin(clock.getElapsedTime() * 2) * 0.4;
      mat.emissiveIntensity = pulse;
    }
  });

  return (
    <group position={[0, 1.6, 0]}>
      {/* Head shell - white rounded */}
      <mesh>
        <sphereGeometry args={[0.55, 32, 32]} />
        <meshStandardMaterial color="#e8edf2" roughness={0.3} metalness={0.1} />
      </mesh>

      {/* Visor / Face screen - dark */}
      <mesh ref={visorRef} position={[0, -0.02, 0.35]} rotation={[0, 0, 0]}>
        <sphereGeometry args={[0.42, 32, 32, 0, Math.PI, 0, Math.PI * 0.55]} />
        <meshStandardMaterial
          color="#0a0a1a"
          roughness={0.1}
          metalness={0.8}
          emissive="#00bfff"
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Left eye */}
      <mesh position={[-0.15, 0.02, 0.5]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color="#00ddff"
          emissive="#00ddff"
          emissiveIntensity={2}
          toneMapped={false}
        />
      </mesh>

      {/* Right eye */}
      <mesh position={[0.15, 0.02, 0.5]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color="#00ddff"
          emissive="#00ddff"
          emissiveIntensity={2}
          toneMapped={false}
        />
      </mesh>

      {/* Smile */}
      <mesh position={[0, -0.13, 0.5]}>
        <torusGeometry args={[0.08, 0.015, 8, 16, Math.PI]} />
        <meshStandardMaterial
          color="#00ddff"
          emissive="#00ddff"
          emissiveIntensity={1.5}
          toneMapped={false}
        />
      </mesh>

      {/* Left headphone */}
      <mesh position={[-0.55, 0.05, 0]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#2a3a4a" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Left headphone glow */}
      <mesh position={[-0.57, 0.05, 0]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial
          color="#00bfff"
          emissive="#00bfff"
          emissiveIntensity={1.5}
          toneMapped={false}
        />
      </mesh>

      {/* Right headphone */}
      <mesh position={[0.55, 0.05, 0]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#2a3a4a" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Right headphone glow */}
      <mesh position={[0.57, 0.05, 0]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial
          color="#00bfff"
          emissive="#00bfff"
          emissiveIntensity={1.5}
          toneMapped={false}
        />
      </mesh>

      {/* Headband */}
      <mesh position={[0, 0.35, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.5, 0.03, 8, 32, Math.PI]} />
        <meshStandardMaterial color="#2a3a4a" roughness={0.4} metalness={0.6} />
      </mesh>

      {/* Antenna */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.2, 8]} />
        <meshStandardMaterial color="#667788" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.72, 0]}>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshStandardMaterial
          color="#00ddff"
          emissive="#00ddff"
          emissiveIntensity={2}
          toneMapped={false}
        />
      </mesh>

      {/* Microphone boom */}
      <group position={[0.5, -0.1, 0.15]}>
        <mesh rotation={[0, 0, Math.PI * 0.3]}>
          <cylinderGeometry args={[0.015, 0.015, 0.3, 8]} />
          <meshStandardMaterial color="#2a3a4a" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0.12, -0.12, 0]}>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshStandardMaterial color="#1a2a3a" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

function RobotBody() {
  return (
    <group position={[0, 0.7, 0]}>
      {/* Main torso */}
      <mesh>
        <capsuleGeometry args={[0.35, 0.4, 8, 16]} />
        <meshStandardMaterial color="#e8edf2" roughness={0.3} metalness={0.1} />
      </mesh>

      {/* Neck ring */}
      <mesh position={[0, 0.45, 0]}>
        <torusGeometry args={[0.18, 0.04, 8, 24]} />
        <meshStandardMaterial color="#2a3a4a" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Chest circle (SS logo area) */}
      <mesh position={[0, 0.05, 0.33]}>
        <circleGeometry args={[0.18, 32]} />
        <meshStandardMaterial
          color="#1a3a5a"
          emissive="#0066aa"
          emissiveIntensity={0.3}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* SS text - left S */}
      <mesh position={[-0.06, 0.05, 0.34]}>
        <torusGeometry args={[0.04, 0.015, 6, 12, Math.PI]} />
        <meshStandardMaterial
          color="#4488cc"
          emissive="#4488cc"
          emissiveIntensity={1}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[-0.06, 0.01, 0.34]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.04, 0.015, 6, 12, Math.PI]} />
        <meshStandardMaterial
          color="#4488cc"
          emissive="#4488cc"
          emissiveIntensity={1}
          toneMapped={false}
        />
      </mesh>

      {/* SS text - right S */}
      <mesh position={[0.06, 0.05, 0.34]}>
        <torusGeometry args={[0.04, 0.015, 6, 12, Math.PI]} />
        <meshStandardMaterial
          color="#4488cc"
          emissive="#4488cc"
          emissiveIntensity={1}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0.06, 0.01, 0.34]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.04, 0.015, 6, 12, Math.PI]} />
        <meshStandardMaterial
          color="#4488cc"
          emissive="#4488cc"
          emissiveIntensity={1}
          toneMapped={false}
        />
      </mesh>

      {/* Belt / waist ring */}
      <mesh position={[0, -0.35, 0]}>
        <torusGeometry args={[0.28, 0.04, 8, 24]} />
        <meshStandardMaterial color="#2a3a4a" roughness={0.3} metalness={0.7} />
      </mesh>
    </group>
  );
}

function RobotArm({ side, action }: { side: 'left' | 'right'; action: string }) {
  const armRef = useRef<THREE.Group>(null);
  const isLeft = side === 'left';
  const xPos = isLeft ? -0.5 : 0.5;

  useFrame(({ clock }) => {
    if (!armRef.current) return;
    const t = clock.getElapsedTime();

    if (action === 'wave' && !isLeft) {
      // Right arm waves
      armRef.current.rotation.z = -0.3 + Math.sin(t * 3) * 0.4;
      armRef.current.rotation.x = -0.8;
    } else if (action === 'point' && !isLeft) {
      // Right arm points forward
      armRef.current.rotation.x = -0.6 + Math.sin(t * 1.5) * 0.1;
      armRef.current.rotation.z = -0.2;
    } else if (action === 'thumbsup' && !isLeft) {
      // Right arm thumbs up
      armRef.current.rotation.z = -0.5;
      armRef.current.rotation.x = -0.9 + Math.sin(t * 2) * 0.1;
    } else if (isLeft) {
      // Left arm gentle idle
      armRef.current.rotation.z = 0.15 + Math.sin(t * 1.2 + 1) * 0.05;
      armRef.current.rotation.x = Math.sin(t * 0.8) * 0.05;
    }
  });

  return (
    <group ref={armRef} position={[xPos, 1.0, 0]}>
      {/* Shoulder joint */}
      <mesh>
        <sphereGeometry args={[0.1, 12, 12]} />
        <meshStandardMaterial color="#2a3a4a" roughness={0.3} metalness={0.6} />
      </mesh>
      {/* Upper arm */}
      <mesh position={[0, -0.2, 0]}>
        <capsuleGeometry args={[0.06, 0.2, 6, 12]} />
        <meshStandardMaterial color="#e0e5ea" roughness={0.3} metalness={0.1} />
      </mesh>
      {/* Elbow */}
      <mesh position={[0, -0.35, 0]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color="#2a3a4a" roughness={0.3} metalness={0.6} />
      </mesh>
      {/* Lower arm */}
      <mesh position={[0, -0.5, 0]}>
        <capsuleGeometry args={[0.05, 0.15, 6, 12]} />
        <meshStandardMaterial color="#e0e5ea" roughness={0.3} metalness={0.1} />
      </mesh>
      {/* Hand */}
      <mesh position={[0, -0.65, 0]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color="#d0dae5" roughness={0.3} metalness={0.2} />
      </mesh>
    </group>
  );
}

function RobotScene({ action }: RobotModelProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Subtle body sway
  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.5) * 0.1;
      groupRef.current.position.y = Math.sin(clock.getElapsedTime() * 0.8) * 0.03;
    }
  });

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 5, 4]} intensity={1} color="#ffffff" />
      <directionalLight position={[-2, 3, -2]} intensity={0.3} color="#80c0ff" />
      <pointLight position={[0, 2, 2]} intensity={0.5} color="#00bfff" distance={5} />

      <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.3}>
        <group ref={groupRef} position={[0, -0.8, 0]} scale={1.1}>
          <RobotHead />
          <RobotBody />
          <RobotArm side="left" action={action} />
          <RobotArm side="right" action={action} />
        </group>
      </Float>

      <Environment preset="city" />
    </>
  );
}

export function Robot3D({ action }: RobotModelProps) {
  return (
    <div className="w-full h-full min-h-[200px]">
      <Canvas
        camera={{ position: [0, 1, 3.5], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <RobotScene action={action} />
      </Canvas>
    </div>
  );
}
