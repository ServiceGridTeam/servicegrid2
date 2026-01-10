/**
 * Rectangle Tool - Draw rectangles on the annotation canvas
 * Part of Field Photo Documentation System
 * 
 * Updated to use Canvas Abstraction Layer
 */

import { useState, useCallback, useRef } from 'react';
import Konva from 'konva';
import type { RectAnnotation } from '@/types/annotations';
import type { CanvasPointerEvent, CanvasPoint } from '@/types/canvas-events';

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
  handlePointerDown: (e: CanvasPointerEvent) => void;
  handlePointerMove: (e: CanvasPointerEvent) => void;
  handlePointerUp: (e: CanvasPointerEvent) => void;
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
  
  const startPointRef = useRef<CanvasPoint | null>(null);

  const getPointerPosition = useCallback((): CanvasPoint | null => {
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

  // Abstract handler using CanvasPointerEvent
  const handlePointerDown = useCallback((e: CanvasPointerEvent) => {
    startPointRef.current = { x: e.x, y: e.y };
    setState({
      isDrawing: true,
      preview: {
        x: e.x,
        y: e.y,
        width: 0,
        height: 0,
      },
    });
  }, []);

  const handlePointerMove = useCallback((e: CanvasPointerEvent) => {
    if (!state.isDrawing || !startPointRef.current) return;

    const start = startPointRef.current;
    
    let width = e.x - start.x;
    let height = e.y - start.y;
    
    // If shift is held, make it a square
    if (e.shiftKey) {
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
  }, [state.isDrawing]);

  const handlePointerUp = useCallback((e: CanvasPointerEvent) => {
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

  // Konva-specific handlers (adapters)
  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const pos = getPointerPosition();
    if (!pos) return;
    handlePointerDown({ ...createBaseEvent(e), x: pos.x, y: pos.y });
  }, [getPointerPosition, handlePointerDown]);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const pos = getPointerPosition();
    if (!pos) return;
    handlePointerMove({ ...createBaseEvent(e), x: pos.x, y: pos.y });
  }, [getPointerPosition, handlePointerMove]);

  const handleMouseUp = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const pos = getPointerPosition();
    if (!pos) return;
    handlePointerUp({ ...createBaseEvent(e), x: pos.x, y: pos.y });
  }, [getPointerPosition, handlePointerUp]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    state,
  };
}

// Helper to create base event properties
function createBaseEvent(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): Omit<CanvasPointerEvent, 'x' | 'y'> {
  const nativeEvent = e.evt;
  const mouseEvent = nativeEvent as MouseEvent;
  return {
    nativeEvent,
    shiftKey: mouseEvent.shiftKey ?? false,
    ctrlKey: mouseEvent.ctrlKey ?? false,
    metaKey: mouseEvent.metaKey ?? false,
    altKey: mouseEvent.altKey ?? false,
    targetId: null,
    isBackground: true,
    preventDefault: () => nativeEvent.preventDefault(),
  };
}
