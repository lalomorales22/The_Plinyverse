
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';
import { VirtualFile, FileType } from '../types';

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

    useFrame((state, delta) => {
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
                    // Interpolate position
                    camera.position.lerp(targetPos, 0.1);
                    // Make camera look at the node
                    const currentLookAt = new THREE.Vector3();
                    camera.getWorldDirection(currentLookAt);
                    
                    if (controls) {
                         const orbitControls = controls as any;
                         orbitControls.target.lerp(targetPos, 0.1);
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
            // We have loaded a new directory.
            // Reset camera to a nice viewing distance
            camera.position.set(0, 0, 22);
            if (controls) {
                const orbitControls = controls as any;
                orbitControls.target.set(0, 0, 0);
                orbitControls.update();
            }
            
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
                 camera.position.set(0, 0, 22);
                 if (controls) {
                    const orbitControls = controls as any;
                    orbitControls.target.set(0, 0, 0);
                    orbitControls.update();
                 }
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
    const ZOOM_OUT_THRESHOLD = 45;

    useFrame(() => {
        if (canNavigateUp) {
            const dist = camera.position.distanceTo(new THREE.Vector3(0,0,0));
            if (dist > ZOOM_OUT_THRESHOLD) {
                onNavigateUp();
            }
        }
    });

    return null;
}

const ParticleSphere = ({ files, onNodeClick }: { files: VirtualFile[], onNodeClick: (f: VirtualFile) => void }) => {
  const groupRef = useRef<THREE.Group>(null!);
  
  // Base particles for the "Globe" structure
  const particleCount = 1500;
  const positions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
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

  return (
    <group ref={groupRef}>
        {/* The Static Matrix Grid */}
        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={positions.length / 3}
              array={positions}
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
}

const DataNode: React.FC<DataNodeProps> = ({ file, index, total, onClick }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = useState(false);
    const [targetPos, setTargetPos] = useState<[number, number, number]>([0,0,0]);
    
    // Calculate final position on sphere
    useEffect(() => {
        const [x, y, z] = calculateNodePosition(index, total);
        setTargetPos([x,y,z]);
    }, [index, total]);

    // Animation: Explode from center to target position
    useFrame(() => {
        if (meshRef.current) {
            // Lerp current position to target position
            meshRef.current.position.lerp(new THREE.Vector3(...targetPos), 0.08);
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
                onPointerOver={() => setHovered(true)}
                onPointerOut={() => setHovered(false)}
            >
                <sphereGeometry args={[hovered ? 0.3 : 0.2, 16, 16]} />
                <meshStandardMaterial 
                    color={color} 
                    emissive={color} 
                    emissiveIntensity={hovered ? 3 : 1.5} 
                />
                
                {/* Text Label - Always Visible */}
                <Html distanceFactor={12} position={[0, 0.4, 0]} center className="pointer-events-none select-none">
                     <div className={`transition-opacity duration-500 ${hovered ? 'opacity-100 z-50 scale-110' : 'opacity-80'}`}>
                        <div className="bg-black/60 backdrop-blur-[2px] px-2 py-0.5 rounded border border-white/10 flex flex-col items-center shadow-lg">
                             <span className={`text-[10px] font-bold whitespace-nowrap ${hovered ? 'text-white' : 'text-green-400/90'}`}>
                                 {file.name}
                             </span>
                             {hovered && <span className="text-[8px] text-gray-300">{file.type}</span>}
                        </div>
                     </div>
                </Html>
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
    divingNodeId, 
    onDiveComplete,
    canNavigateUp,
    onNavigateUp
}) => {
  return (
    <div className="w-full h-full absolute inset-0 z-0 bg-gradient-to-b from-black via-gray-900 to-black">
      <Canvas camera={{ position: [0, 0, 22], fov: 60 }}>
        <color attach="background" args={['#050505']} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#00ff9d" />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#3b82f6" />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        
        <DiveController 
            divingNodeId={divingNodeId} 
            files={files} 
            onDiveComplete={onDiveComplete} 
        />
        
        <ZoomListener 
            canNavigateUp={canNavigateUp} 
            onNavigateUp={onNavigateUp} 
        />

        <ParticleSphere files={files} onNodeClick={onNodeClick} />
        
        <OrbitControls 
            makeDefault
            enabled={!divingNodeId} // Disable controls while auto-diving to prevent conflicts
            enablePan={false} 
            enableZoom={true} 
            minDistance={0.5} 
            maxDistance={60} 
            autoRotate={false} 
            enableDamping={true}
            dampingFactor={0.05}
        />
      </Canvas>
    </div>
  );
};

export default GlobeVisualizer;
