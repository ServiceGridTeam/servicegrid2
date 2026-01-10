/**
 * Line Tool - Draw straight lines on the annotation canvas
 * Part of Field Photo Documentation System
 */

import { useState, useCallback, useRef } from 'react';
import Konva from 'konva';
import type { LineAnnotation } from '@/types/annotations';

interface UseLineToolProps {
  stageRef: React.RefObject<Konva.Stage>;
  color: string;
  strokeWidth: number;
  onComplete: (annotation: Omit<LineAnnotation, 'id'>) => void;
}

interface LineToolState {
  isDrawing: boolean;
  preview: {
    x: number;
    y: number;
    points: number[];
  } | null;
}

interface LineToolHandlers {
  handleMouseDown: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  handleMouseMove: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  handleMouseUp: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  state: LineToolState;
}

export function useLineTool({
  stageRef,
  color,
  strokeWidth,
  onComplete,
}: UseLineToolProps): LineToolHandlers {
  const [state, setState] = useState<LineToolState>({
    isDrawing: false,
    preview: null,
  });
  
  const startPointRef = useRef<{ x: number; y: number } | null>(null);

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

    startPointRef.current = pos;
    setState({
      isDrawing: true,
      preview: {
        x: pos.x,
        y: pos.y,
        points: [0, 0, 0, 0],
      },
    });
  }, [getPointerPosition]);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!state.isDrawing || !startPointRef.current) return;

    const pos = getPointerPosition();
    if (!pos) return;

    const start = startPointRef.current;
    const isShiftHeld = (e.evt as MouseEvent).shiftKey;
    
    let endX = pos.x;
    let endY = pos.y;
    
    // If shift is held, constrain to 45-degree angles
    if (isShiftHeld) {
      const dx = pos.x - start.x;
      const dy = pos.y - start.y;
      const angle = Math.atan2(dy, dx);
      const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
      const distance = Math.sqrt(dx * dx + dy * dy);
      endX = start.x + Math.cos(snappedAngle) * distance;
      endY = start.y + Math.sin(snappedAngle) * distance;
    }

    setState({
      isDrawing: true,
      preview: {
        x: start.x,
        y: start.y,
        points: [0, 0, endX - start.x, endY - start.y],
      },
    });
  }, [state.isDrawing, getPointerPosition]);

  const handleMouseUp = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!state.isDrawing || !state.preview) {
      setState({ isDrawing: false, preview: null });
      return;
    }

    const { x, y, points } = state.preview;
    const length = Math.sqrt(points[2] ** 2 + points[3] ** 2);

    // Only create if line has meaningful length
    if (length > 5) {
      const annotation: Omit<LineAnnotation, 'id'> = {
        type: 'line',
        x,
        y,
        points,
        color,
        strokeWidth,
        rotation: 0,
      };

      onComplete(annotation);
    }

    setState({ isDrawing: false, preview: null });
    startPointRef.current = null;
  }, [state.isDrawing, state.preview, color, strokeWidth, onComplete]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    state,
  };
}
