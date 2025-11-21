
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';
import { VirtualFile, FileType, Cluster } from '../types';

// Fix for TypeScript errors
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

interface MultiClusterVisualizerProps {
  clusters: Cluster[];
  currentClusterId: string;
  files: VirtualFile[];
  onClusterClick: (clusterId: string) => void;
  onNodeClick: (file: VirtualFile) => void;
  onNodeContextMenu: (file: VirtualFile, event: any) => void;
  divingNodeId: string | null;
  onDiveComplete: () => void;
  canNavigateUp: boolean;
  onNavigateUp: () => void;
}

// WASD Camera Controller
const WASDController = () => {
    const { camera } = useThree();
    const keysPressed = useRef<Set<string>>(new Set());
    const moveSpeed = 0.3;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            keysPressed.current.add(e.key.toLowerCase());
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            keysPressed.current.delete(e.key.toLowerCase());
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    useFrame(() => {
        const keys = keysPressed.current;

        if (keys.has('w')) {
            camera.position.z -= moveSpeed;
        }
        if (keys.has('s')) {
            camera.position.z += moveSpeed;
        }
        if (keys.has('a')) {
            camera.position.x -= moveSpeed;
        }
        if (keys.has('d')) {
            camera.position.x += moveSpeed;
        }
    });

    return null;
};

// Helper to calculate node position on a sphere
const calculateNodePosition = (index: number, total: number, radius: number = 4.2): [number, number, number] => {
    const phi = Math.acos(-1 + (2 * index) / total);
    const theta = Math.sqrt(total * Math.PI) * phi;

    const x = radius * Math.cos(theta) * Math.sin(phi);
    const y = radius * Math.sin(theta) * Math.sin(phi);
    const z = radius * Math.cos(phi);

    return [x, y, z];
};

// Individual Cluster Sphere
interface ClusterSphereProps {
    cluster: Cluster;
    files: VirtualFile[];
    isActive: boolean;
    onClick: () => void;
    onNodeClick: (file: VirtualFile) => void;
    onNodeContextMenu: (file: VirtualFile, event: any) => void;
    divingNodeId: string | null;
}

const ClusterSphere: React.FC<ClusterSphereProps> = ({
    cluster,
    files,
    isActive,
    onClick,
    onNodeClick,
    onNodeContextMenu,
    divingNodeId
}) => {
    const groupRef = useRef<THREE.Group>(null);
    const [hovered, setHovered] = useState(false);

    // Only show files for this cluster
    const clusterFiles = files.filter(f => (f.clusterId || 'root') === cluster.id);

    // Reduced particle count for performance
    const particleCount = isActive ? 400 : 200;
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
    }, [particleCount]);

    return (
        <group ref={groupRef} position={cluster.position}>
            {/* Cluster Name Label */}
            <Html position={[0, 6, 0]} center className="pointer-events-none select-none">
                <div className={`transition-all duration-300 ${isActive ? 'scale-110' : 'scale-100'}`}>
                    <div className={`px-4 py-2 rounded-lg border ${isActive ? 'bg-green-500/30 border-green-400' : 'bg-black/60 border-white/20'} backdrop-blur-sm`}>
                        <span className={`font-bold font-mono ${isActive ? 'text-white text-sm' : 'text-gray-300 text-xs'}`}>
                            {cluster.name}
                        </span>
                    </div>
                </div>
            </Html>

            {/* Background particles */}
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
                    color={cluster.color}
                    transparent
                    opacity={isActive ? 0.4 : 0.2}
                    sizeAttenuation={true}
                />
            </points>

            {/* Clickable sphere for cluster selection */}
            {!isActive && (
                <mesh
                    onClick={(e) => { e.stopPropagation(); onClick(); }}
                    onPointerOver={() => setHovered(true)}
                    onPointerOut={() => setHovered(false)}
                >
                    <sphereGeometry args={[5, 32, 32]} />
                    <meshBasicMaterial
                        color={cluster.color}
                        transparent
                        opacity={hovered ? 0.15 : 0.05}
                        wireframe={hovered}
                    />
                </mesh>
            )}

            {/* File nodes - only render if active cluster */}
            {isActive && clusterFiles.map((file, idx) => (
                <DataNode
                    key={file.id}
                    file={file}
                    index={idx}
                    total={clusterFiles.length}
                    onClick={onNodeClick}
                    onContextMenu={onNodeContextMenu}
                    isDiving={file.id === divingNodeId}
                />
            ))}

            {/* Network lines - only for active cluster */}
            {isActive && <NetworkLines count={10} opacity={0.1} color={cluster.color} />}
        </group>
    );
};

// Data Node Component
interface DataNodeProps {
    file: VirtualFile;
    index: number;
    total: number;
    onClick: (file: VirtualFile) => void;
    onContextMenu: (file: VirtualFile, event: any) => void;
    isDiving: boolean;
}

const DataNode: React.FC<DataNodeProps> = ({ file, index, total, onClick, onContextMenu, isDiving }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const haloRef = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = useState(false);

    // PERFORMANCE: Reuse Vector3 objects
    const targetPosRef = useRef(new THREE.Vector3(0, 0, 0));

    useEffect(() => {
        const [x, y, z] = calculateNodePosition(index, total);
        targetPosRef.current.set(x, y, z);
    }, [index, total]);

    // PERFORMANCE: Use scale for hover instead of rebuilding geometry
    useFrame(() => {
        if (meshRef.current) {
            meshRef.current.position.lerp(targetPosRef.current, 0.08);

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
            case FileType.CODE: return '#3b82f6';
            case FileType.IMAGE: return '#ec4899';
            case FileType.VIDEO: return '#8b5cf6';
            case FileType.PDF: return '#fca5a5';
            case FileType.SYSTEM: return '#ef4444';
            default: return '#eab308';
        }
    };

    const color = getColor(file.type);

    return (
        <group>
            <mesh
                ref={meshRef}
                position={[0,0,0]}
                onClick={(e) => { e.stopPropagation(); onClick(file); }}
                onContextMenu={(e) => { e.stopPropagation(); onContextMenu(file, e); }}
                onPointerOver={() => setHovered(true)}
                onPointerOut={() => setHovered(false)}
            >
                <sphereGeometry args={[0.25, 24, 24]} />
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={hovered ? 2.5 : 0.8}
                    roughness={0.1}
                    metalness={0.6}
                />

                <mesh ref={haloRef} scale={[1.4, 1.4, 1.4]}>
                    <sphereGeometry args={[0.25, 16, 16]} />
                    <meshBasicMaterial color={color} transparent opacity={hovered ? 0.2 : 0.1} depthWrite={false} />
                </mesh>

                {/* Only show label on hover for performance */}
                {hovered && (
                    <Html distanceFactor={12} position={[0, 0.5, 0]} center className="pointer-events-none select-none" zIndexRange={[100, 0]}>
                        <div className="bg-black/80 backdrop-blur-sm px-2 py-1 rounded border border-white/20">
                            <span className="text-[10px] font-bold text-white whitespace-nowrap block">
                                {file.name}
                            </span>
                            <span className="text-[8px] text-gray-300 block">{file.type}</span>
                        </div>
                    </Html>
                )}
            </mesh>
        </group>
    );
};

// Network Lines
const NetworkLines = ({ count, opacity, color }: { count: number, opacity: number, color: string }) => {
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
            <lineBasicMaterial color={color} transparent opacity={opacity} />
        </lineSegments>
    );
};

// Dive Controller (for diving into folders within a cluster)
const DiveController = ({
    divingNodeId,
    files,
    onDiveComplete,
    currentClusterId,
    clusters
}: {
    divingNodeId: string | null,
    files: VirtualFile[],
    onDiveComplete: () => void,
    currentClusterId: string,
    clusters: Cluster[]
}) => {
    const { camera, controls } = useThree();
    const prevFilesRef = useRef(files);
    const prevDivingIdRef = useRef(divingNodeId);

    const currentCluster = clusters.find(c => c.id === currentClusterId);
    const clusterOffset = currentCluster ? currentCluster.position : [0, 0, 0];

    useFrame(() => {
        if (divingNodeId) {
            const clusterFiles = files.filter(f => (f.clusterId || 'root') === currentClusterId);
            const targetIndex = clusterFiles.findIndex(f => f.id === divingNodeId);

            if (targetIndex !== -1) {
                const [tx, ty, tz] = calculateNodePosition(targetIndex, clusterFiles.length);
                const targetPos = new THREE.Vector3(
                    tx + clusterOffset[0],
                    ty + clusterOffset[1],
                    tz + clusterOffset[2]
                );

                const distance = camera.position.distanceTo(targetPos);

                if (distance > 0.8) {
                    camera.position.lerp(targetPos, 0.1);
                    if (controls) {
                        const orbitControls = controls as any;
                        orbitControls.target.lerp(targetPos, 0.1);
                        orbitControls.update();
                    }
                } else {
                    onDiveComplete();
                }
            } else {
                onDiveComplete();
            }
        }
    });

    // Reset camera when files change
    useEffect(() => {
        if (files !== prevFilesRef.current && currentCluster) {
            camera.position.set(
                clusterOffset[0],
                clusterOffset[1],
                clusterOffset[2] + 22
            );
            if (controls) {
                const orbitControls = controls as any;
                orbitControls.target.set(clusterOffset[0], clusterOffset[1], clusterOffset[2]);
                orbitControls.update();
            }
            prevFilesRef.current = files;
        }
    }, [files, camera, controls, clusterOffset, currentCluster]);

    useEffect(() => {
        if (prevDivingIdRef.current && !divingNodeId) {
            if (camera.position.length() < 5 && currentCluster) {
                camera.position.set(
                    clusterOffset[0],
                    clusterOffset[1],
                    clusterOffset[2] + 22
                );
                if (controls) {
                    const orbitControls = controls as any;
                    orbitControls.target.set(clusterOffset[0], clusterOffset[1], clusterOffset[2]);
                    orbitControls.update();
                }
            }
        }
        prevDivingIdRef.current = divingNodeId;
    }, [divingNodeId, camera, controls, clusterOffset, currentCluster]);

    return null;
};

// Zoom Listener
const ZoomListener = ({
    canNavigateUp,
    onNavigateUp
}: {
    canNavigateUp: boolean,
    onNavigateUp: () => void
}) => {
    const { camera } = useThree();
    const ZOOM_OUT_THRESHOLD = 45;

    useFrame(() => {
        if (canNavigateUp) {
            const dist = camera.position.length();
            if (dist > ZOOM_OUT_THRESHOLD) {
                onNavigateUp();
            }
        }
    });

    return null;
};

const MultiClusterVisualizer: React.FC<MultiClusterVisualizerProps> = ({
    clusters,
    currentClusterId,
    files,
    onClusterClick,
    onNodeClick,
    onNodeContextMenu,
    divingNodeId,
    onDiveComplete,
    canNavigateUp,
    onNavigateUp
}) => {
    const currentCluster = clusters.find(c => c.id === currentClusterId);

    return (
        <div className="w-full h-full absolute inset-0 z-0 bg-gradient-to-b from-black via-gray-900 to-black">
            {/* WASD Controls Hint */}
            <div className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-2">
                <div className="text-xs text-gray-400 font-mono">
                    <span className="text-green-400">WASD</span> to navigate • Click cluster to switch
                </div>
            </div>

            <Canvas camera={{ position: [0, 0, 22], fov: 60 }} dpr={[1, 2]} performance={{ min: 0.5 }}>
                <color attach="background" args={['#050505']} />
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1} color="#00ff9d" />
                <pointLight position={[-10, -10, -10]} intensity={0.5} color="#3b82f6" />
                <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />

                <WASDController />

                <DiveController
                    divingNodeId={divingNodeId}
                    files={files}
                    onDiveComplete={onDiveComplete}
                    currentClusterId={currentClusterId}
                    clusters={clusters}
                />

                <ZoomListener
                    canNavigateUp={canNavigateUp}
                    onNavigateUp={onNavigateUp}
                />

                {/* Render all clusters */}
                {clusters.map(cluster => (
                    <ClusterSphere
                        key={cluster.id}
                        cluster={cluster}
                        files={files}
                        isActive={cluster.id === currentClusterId}
                        onClick={() => onClusterClick(cluster.id)}
                        onNodeClick={onNodeClick}
                        onNodeContextMenu={onNodeContextMenu}
                        divingNodeId={divingNodeId}
                    />
                ))}

                <OrbitControls
                    makeDefault
                    enabled={!divingNodeId}
                    enablePan={false}
                    enableZoom={true}
                    minDistance={0.5}
                    maxDistance={100}
                    autoRotate={false}
                    enableDamping={true}
                    dampingFactor={0.05}
                />
            </Canvas>
        </div>
    );
};

export default MultiClusterVisualizer;
