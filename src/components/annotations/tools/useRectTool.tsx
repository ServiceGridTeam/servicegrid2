/**
 * Rectangle Tool - Draw rectangles on the annotation canvas
 * Part of Field Photo Documentation System
 */

import { useState, useCallback, useRef } from 'react';
import Konva from 'konva';
import type { RectAnnotation } from '@/types/annotations';

interface UseRectToolProps {
  stageRef: React.RefObject<Konva.Stage>;
  color: string;
  strokeWidth: number;
  onComplete: (annotation: Omit<RectAnnotation, 'id'>) => void;
}

interface RectToolState {
  isDrawing: boolean;
  preview: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

interface RectToolHandlers {
  handleMouseDown: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  handleMouseMove: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  handleMouseUp: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  state: RectToolState;
}

export function useRectTool({
  stageRef,
  color,
  strokeWidth,
  onComplete,
}: UseRectToolProps): RectToolHandlers {
  const [state, setState] = useState<RectToolState>({
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
        width: 0,
        height: 0,
      },
    });
  }, [getPointerPosition]);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!state.isDrawing || !startPointRef.current) return;

    const pos = getPointerPosition();
    if (!pos) return;

    const start = startPointRef.current;
    const isShiftHeld = (e.evt as MouseEvent).shiftKey;
    
    let width = pos.x - start.x;
    let height = pos.y - start.y;
    
    // If shift is held, make it a square
    if (isShiftHeld) {
      const size = Math.max(Math.abs(width), Math.abs(height));
      width = width >= 0 ? size : -size;
      height = height >= 0 ? size : -size;
    }

    // Calculate top-left corner (handle negative dimensions)
    const x = width >= 0 ? start.x : start.x + width;
    const y = height >= 0 ? start.y : start.y + height;

    setState({
      isDrawing: true,
      preview: {
        x,
        y,
        width: Math.abs(width),
        height: Math.abs(height),
      },
    });
  }, [state.isDrawing, getPointerPosition]);

  const handleMouseUp = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!state.isDrawing || !state.preview) {
      setState({ isDrawing: false, preview: null });
      return;
    }

    const { x, y, width, height } = state.preview;

    // Only create if rectangle has meaningful size
    if (width > 5 && height > 5) {
      const annotation: Omit<RectAnnotation, 'id'> = {
        type: 'rect',
        x,
        y,
        width,
        height,
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
