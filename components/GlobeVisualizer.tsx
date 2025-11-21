
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { VirtualFile, FileType } from '../types';
import { SpriteLabel } from './SpriteLabel';

// Fix for TypeScript errors where R3F elements and HTML elements are not recognized in JSX.IntrinsicElements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

interface GlobeVisualizerProps {
  files: VirtualFile[];
  onNodeClick: (file: VirtualFile) => void;
  onNodeContextMenu: (file: VirtualFile, event: any) => void;
  divingNodeId: string | null;
  onDiveComplete: () => void;
  canNavigateUp: boolean;
  onNavigateUp: () => void;
}

// Helper to calculate node position on the sphere
const calculateNodePosition = (index: number, total: number, radius: number = 4.2): [number, number, number] => {
    const phi = Math.acos(-1 + (2 * index) / total);
    const theta = Math.sqrt(total * Math.PI) * phi;
    
    const x = radius * Math.cos(theta) * Math.sin(phi);
    const y = radius * Math.sin(theta) * Math.sin(phi);
    const z = radius * Math.cos(phi);
    
    return [x, y, z];
};

// Handles the "Zoom In" animation when diving
const DiveController = ({
    divingNodeId,
    files,
    onDiveComplete
}: {
    divingNodeId: string | null,
    files: VirtualFile[],
    onDiveComplete: () => void
}) => {
    const { camera, controls } = useThree();
    // We need to reset the camera when the file list changes (meaning we arrived at the new folder)
    const prevFilesRef = useRef(files);
    const prevDivingIdRef = useRef(divingNodeId);
    const isResettingRef = useRef(false);

    useFrame((state, delta) => {
        // Skip frame updates if we're in the middle of a reset to prevent conflicts
        if (isResettingRef.current) return;

        // 1. Handle Diving Animation
        if (divingNodeId) {
            const targetIndex = files.findIndex(f => f.id === divingNodeId);
            if (targetIndex !== -1) {
                const [tx, ty, tz] = calculateNodePosition(targetIndex, files.length);
                const targetPos = new THREE.Vector3(tx, ty, tz);

                // Move camera towards target
                // We want to get very close, effectively "inside" it
                const distance = camera.position.distanceTo(targetPos);

                if (distance > 0.8) {
                    // Smoother interpolation for better animation
                    camera.position.lerp(targetPos, 0.08);

                    if (controls) {
                         const orbitControls = controls as any;
                         orbitControls.target.lerp(targetPos, 0.08);
                         orbitControls.update();
                    }
                } else {
                    // Animation complete
                    onDiveComplete();
                }
            } else {
                // Node not found in current view (shouldn't happen), abort
                onDiveComplete();
            }
        }
    });

    // 2. Handle "New Level" Reset (When files actually change)
    useEffect(() => {
        if (files !== prevFilesRef.current) {
            isResettingRef.current = true;
            // Smooth camera reset with animation
            const resetCamera = () => {
                camera.position.set(0, 0, 22);
                if (controls) {
                    const orbitControls = controls as any;
                    orbitControls.target.set(0, 0, 0);
                    orbitControls.update();
                }
                // Allow frame updates again after a short delay
                setTimeout(() => {
                    isResettingRef.current = false;
                }, 100);
            };
            resetCamera();
            prevFilesRef.current = files;
        }
    }, [files, camera, controls]);

    // 3. Safety Reset: If dive ends but files didn't change (e.g. empty folder or same state), pull back
    useEffect(() => {
        // Detect if we just stopped diving
        if (prevDivingIdRef.current && !divingNodeId) {
            // If the file list hasn't changed yet, or we are stuck close to a node, reset.
            // We check if the camera is dangerously close to the center or a node
            if (camera.position.length() < 5) {
                isResettingRef.current = true;
                camera.position.set(0, 0, 22);
                if (controls) {
                    const orbitControls = controls as any;
                    orbitControls.target.set(0, 0, 0);
                    orbitControls.update();
                }
                setTimeout(() => {
                    isResettingRef.current = false;
                }, 100);
            }
        }
        prevDivingIdRef.current = divingNodeId;
    }, [divingNodeId, camera, controls]);

    return null;
};

// Monitors camera distance to trigger "Back/Up" navigation on zoom out
const ZoomListener = ({
    canNavigateUp,
    onNavigateUp
}: {
    canNavigateUp: boolean,
    onNavigateUp: () => void
}) => {
    const { camera } = useThree();
    // Threshold to trigger the "Zoom Out" navigation
    const ZOOM_OUT_THRESHOLD = 50;
    const frameCountRef = useRef(0);
    const hasTriggeredRef = useRef(false);

    useFrame(() => {
        if (!canNavigateUp) {
            hasTriggeredRef.current = false;
            return;
        }

        // Check every 5 frames for performance and to prevent rapid triggering
        frameCountRef.current++;
        if (frameCountRef.current % 5 !== 0) return;

        const dist = camera.position.distanceTo(new THREE.Vector3(0,0,0));

        // Only trigger once per zoom-out session to prevent repeated calls
        if (dist > ZOOM_OUT_THRESHOLD && !hasTriggeredRef.current) {
            hasTriggeredRef.current = true;
            onNavigateUp();
        } else if (dist <= ZOOM_OUT_THRESHOLD) {
            // Reset flag when camera comes back within threshold
            hasTriggeredRef.current = false;
        }
    });

    return null;
}

const ParticleSphere = ({ files, onNodeClick, onNodeContextMenu }: { files: VirtualFile[], onNodeClick: (f: VirtualFile) => void, onNodeContextMenu: (f: VirtualFile, e: any) => void }) => {
  const groupRef = useRef<THREE.Group>(null!);
  const [particleCount, setParticleCount] = useState(600);
  const { camera } = useThree();
  const frameCountRef = useRef(0);

  // PERFORMANCE FIX: LOD system - Adjust particle count based on camera distance
  useFrame(() => {
    // Debounce particle count updates to every 10 frames to prevent rapid WebGL buffer changes
    frameCountRef.current++;
    if (frameCountRef.current % 10 !== 0) return;

    if (groupRef.current) {
      const distance = camera.position.distanceTo(groupRef.current.position);

      // Dynamic particle count based on distance
      let newCount;
      if (distance < 10) {
        newCount = 600; // Close: high detail
      } else if (distance < 20) {
        newCount = 400; // Medium: medium detail
      } else if (distance < 30) {
        newCount = 200; // Far: low detail
      } else {
        newCount = 100; // Very far: minimal detail
      }

      // Only update if changed significantly to avoid re-renders
      if (Math.abs(particleCount - newCount) > 50) {
        setParticleCount(newCount);
      }
    }
  });

  const positions = useMemo(() => {
    // Generate more particles than needed, then we'll use a subset
    const maxParticles = 600;
    const pos = new Float32Array(maxParticles * 3);
    for (let i = 0; i < maxParticles; i++) {
      const theta = THREE.MathUtils.randFloatSpread(360);
      const phi = THREE.MathUtils.randFloatSpread(360);
      const r = 3.5 + Math.random() * 0.5;

      const x = r * Math.sin(theta) * Math.cos(phi);
      const y = r * Math.sin(theta) * Math.sin(phi);
      const z = r * Math.cos(theta);

      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
    }
    return pos;
  }, []);

  // Use only the number of particles needed for current LOD
  const activePositions = useMemo(() => {
    // Ensure we don't exceed the buffer size
    const maxParticles = 600;
    const safeCount = Math.min(particleCount, maxParticles);
    return new Float32Array(positions.buffer, 0, safeCount * 3);
  }, [positions, particleCount]);

  return (
    <group ref={groupRef}>
        {/* The Static Matrix Grid - PERFORMANCE FIX: Using LOD-based particle count */}
        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={Math.min(particleCount, 600)}
              array={activePositions}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial
            size={0.03}
            color="#00ff9d"
            transparent
            opacity={0.3}
            sizeAttenuation={true}
          />
        </points>

        {/* Dynamic File Nodes */}
        {files.map((file, idx) => (
            <DataNode 
                key={file.id} 
                file={file} 
                index={idx} 
                total={files.length}
                onClick={onNodeClick}
                onContextMenu={onNodeContextMenu}
            />
        ))}
        
        <NetworkLines count={15} opacity={0.1} />
      </group>
  );
};

interface DataNodeProps {
  file: VirtualFile;
  index: number;
  total: number;
  onClick: (file: VirtualFile) => void;
  onContextMenu: (file: VirtualFile, event: any) => void;
}

const DataNode: React.FC<DataNodeProps> = ({ file, index, total, onClick, onContextMenu }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const haloRef = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = useState(false);

    // PERFORMANCE FIX: Reuse Vector3 objects instead of creating new ones every frame
    const targetPosRef = useRef(new THREE.Vector3(0, 0, 0));

    // Calculate final position on sphere
    useEffect(() => {
        const [x, y, z] = calculateNodePosition(index, total);
        targetPosRef.current.set(x, y, z);
    }, [index, total]);

    // PERFORMANCE FIX: Use scale for hover effect instead of rebuilding geometry
    useFrame(() => {
        if (meshRef.current) {
            // Lerp current position to target position
            meshRef.current.position.lerp(targetPosRef.current, 0.08);

            // Smooth scale transition on hover
            const targetScale = hovered ? 1.4 : 1.0;
            const currentScale = meshRef.current.scale.x;
            const newScale = currentScale + (targetScale - currentScale) * 0.15;
            meshRef.current.scale.setScalar(newScale);

            if (haloRef.current) {
                haloRef.current.scale.setScalar(newScale * 1.4);
            }
        }
    });

    const getColor = (type: FileType) => {
        switch(type) {
            case FileType.CODE: return '#3b82f6'; // Blue
            case FileType.IMAGE: return '#ec4899'; // Pink
            case FileType.VIDEO: return '#8b5cf6'; // Purple
            case FileType.PDF: return '#fca5a5'; // Light Red
            case FileType.SYSTEM: return '#ef4444'; // Red
            default: return '#eab308'; // Yellow (Data/Dir)
        }
    }

    const color = getColor(file.type);

    return (
        <group>
            <mesh
                ref={meshRef}
                position={[0,0,0]} // Start at center for explosion effect
                onClick={(e) => { e.stopPropagation(); onClick(file); }}
                onContextMenu={(e) => { e.stopPropagation(); onContextMenu(file, e); }}
                onPointerOver={() => setHovered(true)}
                onPointerOut={() => setHovered(false)}
            >
                {/* PERFORMANCE FIX: Fixed geometry size, use scale for hover */}
                <sphereGeometry args={[0.25, 24, 24]} />
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={hovered ? 3.0 : 1.8}
                    roughness={0.1}
                    metalness={0.6}
                />

                {/* Glow Halo - PERFORMANCE FIX: Removed point light, using only emissive */}
                <mesh ref={haloRef} scale={[1.4, 1.4, 1.4]}>
                    <sphereGeometry args={[0.25, 16, 16]} />
                    <meshBasicMaterial color={color} transparent opacity={hovered ? 0.3 : 0.2} depthWrite={false} />
                </mesh>

                {/* Node name label - Always visible for better node identification */}
                <SpriteLabel
                    text={file.name}
                    position={[0, 0.5, 0]}
                    color="#ffffff"
                    fontSize={hovered ? 28 : 24}
                />
            </mesh>
        </group>
    )
}

const NetworkLines = ({ count, opacity }: { count: number, opacity: number }) => {
    const lines = useMemo(() => {
        const points = [];
        for (let i=0; i < count; i++) {
            const p1 = new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
            const p2 = new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
            points.push(p1);
            points.push(p2);
        }
        return points;
    }, [count]);

    return (
        <lineSegments>
            <bufferGeometry>
                <bufferAttribute 
                    attach="attributes-position"
                    count={lines.length}
                    array={new Float32Array(lines.flatMap(v => [v.x, v.y, v.z]))}
                    itemSize={3}
                />
            </bufferGeometry>
            <lineBasicMaterial color="#10b981" transparent opacity={opacity} />
        </lineSegments>
    )
}


const GlobeVisualizer: React.FC<GlobeVisualizerProps> = ({ 
    files, 
    onNodeClick, 
    onNodeContextMenu,
    divingNodeId, 
    onDiveComplete,
    canNavigateUp,
    onNavigateUp
}) => {
  return (
    <div className="w-full h-full absolute inset-0 z-0 bg-gradient-to-b from-black via-gray-900 to-black">
      <Canvas camera={{ position: [0, 0, 22], fov: 60 }} dpr={[1, 2]} performance={{ min: 0.5 }}>
        <color attach="background" args={['#050505']} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#00ff9d" />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#3b82f6" />
        {/* PERFORMANCE FIX: Reduced stars from 5000 to 2000 */}
        <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
        
        <DiveController 
            divingNodeId={divingNodeId} 
            files={files} 
            onDiveComplete={onDiveComplete} 
        />
        
        <ZoomListener 
            canNavigateUp={canNavigateUp} 
            onNavigateUp={onNavigateUp} 
        />

        <ParticleSphere files={files} onNodeClick={onNodeClick} onNodeContextMenu={onNodeContextMenu} />
        
        <OrbitControls
            makeDefault
            enabled={!divingNodeId} // Disable controls while auto-diving to prevent conflicts
            enablePan={false}
            enableZoom={true}
            minDistance={0.5}
            maxDistance={55}
            autoRotate={false}
            enableDamping={true}
            dampingFactor={0.08}
        />
      </Canvas>
    </div>
  );
};

export default GlobeVisualizer;
