import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface SpriteLabelProps {
  text: string;
  position: [number, number, number];
  color?: string;
  backgroundColor?: string;
  fontSize?: number;
}

/**
 * PERFORMANCE FIX: Canvas-based sprite label instead of HTML overlay
 *
 * This component uses a canvas to render text as a texture on a sprite,
 * which is much more performant than using HTML overlays that trigger
 * DOM reflows and CSS calculations.
 */
export const SpriteLabel: React.FC<SpriteLabelProps> = ({
  text,
  position,
  color = '#ffffff',
  backgroundColor = 'rgba(0, 0, 0, 0.8)',
  fontSize = 24,
}) => {
  const spriteRef = useRef<THREE.Sprite>(null);

  // Create canvas texture for the label
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;

    // Set canvas size based on text length
    const padding = 16;
    canvas.width = 256;
    canvas.height = 64;

    // Draw background
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Draw border
    context.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    context.lineWidth = 2;
    context.strokeRect(0, 0, canvas.width, canvas.height);

    // Draw text
    context.fillStyle = color;
    context.font = `bold ${fontSize}px Arial, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    // Truncate text if too long
    let displayText = text;
    if (text.length > 20) {
      displayText = text.substring(0, 17) + '...';
    }

    context.fillText(displayText, canvas.width / 2, canvas.height / 2);

    const canvasTexture = new THREE.CanvasTexture(canvas);
    canvasTexture.needsUpdate = true;
    return canvasTexture;
  }, [text, color, backgroundColor, fontSize]);

  // Make sprite always face camera
  useFrame(({ camera }) => {
    if (spriteRef.current) {
      spriteRef.current.quaternion.copy(camera.quaternion);
    }
  });

  if (!texture) return null;

  return (
    <sprite ref={spriteRef} position={position} scale={[2, 0.5, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
};

export default SpriteLabel;
