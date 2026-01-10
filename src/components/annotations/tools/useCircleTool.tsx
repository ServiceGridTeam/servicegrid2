/**
 * Circle/Ellipse Tool - Draw circles and ellipses on the annotation canvas
 * Part of Field Photo Documentation System
 * 
 * Updated to use Canvas Abstraction Layer
 */

import { useState, useCallback, useRef } from 'react';
import Konva from 'konva';
import type { CircleAnnotation } from '@/types/annotations';
import type { CanvasPointerEvent, CanvasPoint } from '@/types/canvas-events';

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
  handlePointerDown: (e: CanvasPointerEvent) => void;
  handlePointerMove: (e: CanvasPointerEvent) => void;
  handlePointerUp: (e: CanvasPointerEvent) => void;
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
  
  const centerRef = useRef<CanvasPoint | null>(null);

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
    centerRef.current = { x: e.x, y: e.y };
    setState({
      isDrawing: true,
      preview: {
        x: e.x,
        y: e.y,
        radius: 0,
      },
    });
  }, []);

  const handlePointerMove = useCallback((e: CanvasPointerEvent) => {
    if (!state.isDrawing || !centerRef.current) return;

    const center = centerRef.current;
    
    // Calculate radius from center to current position
    const dx = e.x - center.x;
    const dy = e.y - center.y;
    const radius = Math.sqrt(dx * dx + dy * dy);

    setState({
      isDrawing: true,
      preview: {
        x: center.x,
        y: center.y,
        radius,
      },
    });
  }, [state.isDrawing]);

  const handlePointerUp = useCallback((e: CanvasPointerEvent) => {
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
