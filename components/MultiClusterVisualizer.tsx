import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { VirtualFile, FileType, Cluster } from '../types';
import { SpriteLabel } from './SpriteLabel';

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
  currentDirectoryId: string;
  onClusterClick: (clusterId: string) => void;
  onClusterMove: (clusterId: string, position: [number, number, number]) => void;
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
    currentDirectoryId: string;
    isActive: boolean;
    onClick: () => void;
    onMove: (id: string, pos: [number, number, number]) => void;
    isEditing: boolean;
    onNodeClick: (file: VirtualFile) => void;
    onNodeContextMenu: (file: VirtualFile, event: any) => void;
    divingNodeId: string | null;
}

const ClusterSphere: React.FC<ClusterSphereProps> = ({
    cluster,
    files,
    currentDirectoryId,
    isActive,
    onClick,
    onMove,
    isEditing,
    onNodeClick,
    onNodeContextMenu,
    divingNodeId
}) => {
    const groupRef = useRef<THREE.Group>(null);
    const [hovered, setHovered] = useState(false);
    const [particleCount, setParticleCount] = useState(isActive ? 400 : 200);
    const { camera } = useThree();
    const frameCountRef = useRef(0);

    const clusterFiles = files.filter(f =>
        (f.clusterId || 'root') === cluster.id &&
        f.parentId === currentDirectoryId
    );

    useFrame(() => {
        // Debounce particle count updates to every 10 frames to prevent rapid WebGL buffer changes
        frameCountRef.current++;
        if (frameCountRef.current % 10 !== 0) return;

        if (groupRef.current) {
            const distance = camera.position.distanceTo(groupRef.current.position);
            let newCount;
            if (isActive) {
                if (distance < 15) newCount = 400;
                else if (distance < 30) newCount = 250;
                else newCount = 150;
            } else {
                if (distance < 15) newCount = 200;
                else if (distance < 30) newCount = 100;
                else newCount = 50;
            }
            // Only update if the change is significant to prevent unnecessary re-renders
            if (Math.abs(particleCount - newCount) > 30) {
                setParticleCount(newCount);
            }
        }
    });

    const positions = useMemo(() => {
        const maxParticles = 400;
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

    const activePositions = useMemo(() => {
        // Ensure we don't exceed the buffer size
        const maxParticles = 400;
        const safeCount = Math.min(particleCount, maxParticles);
        return new Float32Array(positions.buffer, 0, safeCount * 3);
    }, [positions, particleCount]);

    return (
        <TransformControls
            mode="translate"
            enabled={isEditing}
            showX={isEditing}
            showY={isEditing}
            showZ={isEditing}
            translationSnap={1}
            onMouseUp={() => {
                if (groupRef.current) {
                    const { x, y, z } = groupRef.current.position;
                    onMove(cluster.id, [x, y, z]);
                }
            }}
        >
            <group ref={groupRef} position={cluster.position}>
                <SpriteLabel
                    text={cluster.name}
                    position={[0, 6, 0]}
                    color="#ffffff"
                    fontSize={isActive ? 72 : 48}
                />
                <points>
                    <bufferGeometry>
                        <bufferAttribute
                            attach="attributes-position"
                            count={Math.min(particleCount, 400)}
                            array={activePositions}
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
                {isActive && <NetworkLines count={10} opacity={0.1} color={cluster.color} />}
            </group>
        </TransformControls>
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
    const targetPosRef = useRef(new THREE.Vector3(0, 0, 0));

    useEffect(() => {
        const [x, y, z] = calculateNodePosition(index, total);
        targetPosRef.current.set(x, y, z);
    }, [index, total]);

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
            <mesh scale={[1.6, 1.6, 1.6]}>
                <sphereGeometry args={[0.25, 16, 16]} />
                <meshBasicMaterial color={color} transparent opacity={0.25} depthWrite={false} />
            </mesh>
            <mesh scale={[1.4, 1.4, 1.4]}>
                <sphereGeometry args={[0.25, 16, 16]} />
                <meshBasicMaterial color={color} transparent opacity={hovered ? 0.45 : 0.35} depthWrite={false} />
            </mesh>
            <mesh
                ref={meshRef}
                position={[0,0,0]}
                onClick={(e) => { e.stopPropagation(); onClick(file); }}
                onContextMenu={(e) => { e.stopPropagation(); onContextMenu(file, e); }}
                onPointerOver={() => setHovered(true)}
                onPointerOut={() => setHovered(false)}
            >
                <sphereGeometry args={[0.25, 24, 24]} />
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={hovered ? 3.0 : 1.5} roughness={0.1} metalness={0.6} />
                <mesh ref={haloRef} scale={[1.2, 1.2, 1.2]}>
                    <sphereGeometry args={[0.25, 16, 16]} />
                    <meshBasicMaterial color={color} transparent opacity={hovered ? 0.4 : 0.3} depthWrite={false} />
                </mesh>
                <SpriteLabel
                    text={file.name}
                    position={[0, 0.8, 0]}
                    color="#ffffff"
                    fontSize={hovered ? 56 : 44}
                />
            </mesh>
        </group>
    );
};

// Network Lines
const NetworkLines = ({ count, opacity, color }: { count: number, opacity: number, color: string }) => {
    const lines = useMemo(() => {
        const points = [];
        for (let i=0; i < count; i++) {
            points.push(new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6));
            points.push(new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6));
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

// Dive Controller
const DiveController = ({
    divingNodeId,
    files,
    onDiveComplete,
    currentClusterId,
    currentDirectoryId,
    clusters
}: {
    divingNodeId: string | null,
    files: VirtualFile[],
    onDiveComplete: () => void,
    currentClusterId: string,
    currentDirectoryId: string,
    clusters: Cluster[]
}) => {
    const { camera, controls } = useThree();
    const prevFilesRef = useRef(files);
    const prevDivingIdRef = useRef(divingNodeId);
    const isResettingRef = useRef(false);

    const currentCluster = clusters.find(c => c.id === currentClusterId);
    const clusterOffset = currentCluster ? currentCluster.position : [0, 0, 0];

    useFrame(() => {
        // Skip frame updates if we're in the middle of a reset to prevent conflicts
        if (isResettingRef.current) return;

        if (divingNodeId) {
            const clusterFiles = files.filter(f =>
                (f.clusterId || 'root') === currentClusterId &&
                f.parentId === currentDirectoryId
            );
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
                    // Smoother interpolation for better animation
                    camera.position.lerp(targetPos, 0.08);
                    if (controls) {
                        const orbitControls = controls as any;
                        orbitControls.target.lerp(targetPos, 0.08);
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

    useEffect(() => {
        if (files !== prevFilesRef.current && currentCluster) {
            isResettingRef.current = true;
            // Smooth camera reset with animation
            const resetCamera = () => {
                const targetPos = new THREE.Vector3(clusterOffset[0], clusterOffset[1], clusterOffset[2] + 22);
                camera.position.copy(targetPos);
                if (controls) {
                    const orbitControls = controls as any;
                    orbitControls.target.set(clusterOffset[0], clusterOffset[1], clusterOffset[2]);
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
    }, [files, camera, controls, clusterOffset, currentCluster]);

    useEffect(() => {
        if (prevDivingIdRef.current && !divingNodeId && currentCluster) {
            const distanceFromCluster = camera.position.distanceTo(
                new THREE.Vector3(clusterOffset[0], clusterOffset[1], clusterOffset[2])
            );
            // Only reset if camera is very close to prevent conflicts with zoom out
            if (distanceFromCluster < 5) {
                isResettingRef.current = true;
                camera.position.set(clusterOffset[0], clusterOffset[1], clusterOffset[2] + 22);
                if (controls) {
                    const orbitControls = controls as any;
                    orbitControls.target.set(clusterOffset[0], clusterOffset[1], clusterOffset[2]);
                    orbitControls.update();
                }
                setTimeout(() => {
                    isResettingRef.current = false;
                }, 100);
            }
        }
        prevDivingIdRef.current = divingNodeId;
    }, [divingNodeId, camera, controls, clusterOffset, currentCluster]);

    return null;
};

// Zoom Listener
const ZoomListener = ({
    canNavigateUp,
    onNavigateUp,
    currentClusterId,
    clusters
}: {
    canNavigateUp: boolean,
    onNavigateUp: () => void,
    currentClusterId: string,
    clusters: Cluster[]
}) => {
    const { camera } = useThree();
    const ZOOM_OUT_THRESHOLD = 65;
    const currentCluster = clusters.find(c => c.id === currentClusterId);
    const clusterPos = useMemo(() => {
        return currentCluster ? new THREE.Vector3(...currentCluster.position) : new THREE.Vector3(0, 0, 0);
    }, [currentCluster]);

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

        const dist = camera.position.distanceTo(clusterPos);

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
};

const MultiClusterVisualizer: React.FC<MultiClusterVisualizerProps> = ({
    clusters,
    currentClusterId,
    files,
    currentDirectoryId,
    onClusterClick,
    onClusterMove,
    onNodeClick,
    onNodeContextMenu,
    divingNodeId,
    onDiveComplete,
    canNavigateUp,
    onNavigateUp
}) => {
    const currentCluster = clusters.find(c => c.id === currentClusterId);
    const [isAltPressed, setIsAltPressed] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Alt') setIsAltPressed(true);
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Alt') setIsAltPressed(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    return (
        <div className="w-full h-full absolute inset-0 z-0 bg-gradient-to-b from-black via-gray-900 to-black">
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
                    currentDirectoryId={currentDirectoryId}
                    clusters={clusters}
                />

                <ZoomListener
                    canNavigateUp={canNavigateUp}
                    onNavigateUp={onNavigateUp}
                    currentClusterId={currentClusterId}
                    clusters={clusters}
                />

                {clusters.map(cluster => (
                    <ClusterSphere
                        key={cluster.id}
                        cluster={cluster}
                        files={files}
                        currentDirectoryId={currentDirectoryId}
                        isActive={cluster.id === currentClusterId}
                        onClick={() => onClusterClick(cluster.id)}
                        onMove={onClusterMove}
                        isEditing={isAltPressed}
                        onNodeClick={onNodeClick}
                        onNodeContextMenu={onNodeContextMenu}
                        divingNodeId={divingNodeId}
                    />
                ))}

                <OrbitControls
                    makeDefault
                    enabled={!divingNodeId && !isAltPressed}
                    enablePan={true}
                    enableZoom={true}
                    minDistance={0.5}
                    maxDistance={70}
                    autoRotate={false}
                    enableDamping={true}
                    dampingFactor={0.08}
                />
            </Canvas>
            
            {isAltPressed && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 px-4 py-2 rounded-full backdrop-blur-md font-mono text-sm animate-pulse pointer-events-none">
                    EDIT MODE: DRAG CLUSTERS
                </div>
            )}
        </div>
    );
};

export default MultiClusterVisualizer;
