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
  backgroundColor = 'transparent',
  fontSize = 32,
}) => {
  const spriteRef = useRef<THREE.Sprite>(null);

  // Create canvas texture for the label
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;

    // Set canvas size based on text length
    const padding = 32;
    canvas.width = 512;
    canvas.height = 128;

    // Draw background (transparent by default)
    if (backgroundColor !== 'transparent') {
      context.fillStyle = backgroundColor;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw border - REMOVED as per request
    // context.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    // context.lineWidth = 4;
    // context.strokeRect(0, 0, canvas.width, canvas.height);

    // Draw text with outline for better visibility
    context.font = `bold ${fontSize}px 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Draw text shadow/outline for better contrast
    context.shadowColor = 'rgba(0, 0, 0, 0.8)';
    context.shadowBlur = 8;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;
    
    context.fillStyle = color;

    // Truncate text if too long
    let displayText = text;
    if (text.length > 25) {
      displayText = text.substring(0, 22) + '...';
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
    <sprite ref={spriteRef} position={position} scale={[4, 1, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
};

export default SpriteLabel;
