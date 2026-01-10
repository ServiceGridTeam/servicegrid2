/**
 * Circle/Ellipse Tool - Draw circles and ellipses on the annotation canvas
 * Part of Field Photo Documentation System
 */

import { useState, useCallback, useRef } from 'react';
import Konva from 'konva';
import type { CircleAnnotation } from '@/types/annotations';

interface UseCircleToolProps {
  stageRef: React.RefObject<Konva.Stage>;
  color: string;
  strokeWidth: number;
  onComplete: (annotation: Omit<CircleAnnotation, 'id'>) => void;
}

interface CircleToolState {
  isDrawing: boolean;
  preview: {
    x: number;
    y: number;
    radius: number;
  } | null;
}

interface CircleToolHandlers {
  handleMouseDown: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  handleMouseMove: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  handleMouseUp: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  state: CircleToolState;
}

export function useCircleTool({
  stageRef,
  color,
  strokeWidth,
  onComplete,
}: UseCircleToolProps): CircleToolHandlers {
  const [state, setState] = useState<CircleToolState>({
    isDrawing: false,
    preview: null,
  });
  
  const centerRef = useRef<{ x: number; y: number } | null>(null);

  const getPointerPosition = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    
    const scale = stage.scaleX();
    return {
      x: pos.x / scale,
      y: pos.y / scale,
    };
  }, [stageRef]);

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const pos = getPointerPosition();
    if (!pos) return;

    centerRef.current = pos;
    setState({
      isDrawing: true,
      preview: {
        x: pos.x,
        y: pos.y,
        radius: 0,
      },
    });
  }, [getPointerPosition]);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!state.isDrawing || !centerRef.current) return;

    const pos = getPointerPosition();
    if (!pos) return;

    const center = centerRef.current;
    
    // Calculate radius from center to current position
    const dx = pos.x - center.x;
    const dy = pos.y - center.y;
    const radius = Math.sqrt(dx * dx + dy * dy);

    setState({
      isDrawing: true,
      preview: {
        x: center.x,
        y: center.y,
        radius,
      },
    });
  }, [state.isDrawing, getPointerPosition]);

  const handleMouseUp = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!state.isDrawing || !state.preview) {
      setState({ isDrawing: false, preview: null });
      return;
    }

    const { x, y, radius } = state.preview;

    // Only create if circle has meaningful size
    if (radius > 5) {
      const annotation: Omit<CircleAnnotation, 'id'> = {
        type: 'circle',
        x,
        y,
        radius,
        color,
        strokeWidth,
        rotation: 0,
      };

      onComplete(annotation);
    }

    setState({ isDrawing: false, preview: null });
    centerRef.current = null;
  }, [state.isDrawing, state.preview, color, strokeWidth, onComplete]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    state,
  };
}
