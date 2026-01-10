/**
 * Line Tool - Draw straight lines on the annotation canvas
 * Part of Field Photo Documentation System
 * 
 * Updated to use Canvas Abstraction Layer
 */

import { useState, useCallback, useRef } from 'react';
import Konva from 'konva';
import type { LineAnnotation } from '@/types/annotations';
import type { CanvasPointerEvent, CanvasPoint } from '@/types/canvas-events';
import { adaptKonvaEvent } from '@/lib/canvas-event-adapter';

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
  handlePointerDown: (e: CanvasPointerEvent) => void;
  handlePointerMove: (e: CanvasPointerEvent) => void;
  handlePointerUp: (e: CanvasPointerEvent) => void;
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
        points: [0, 0, 0, 0],
      },
    });
  }, []);

  const handlePointerMove = useCallback((e: CanvasPointerEvent) => {
    if (!state.isDrawing || !startPointRef.current) return;

    const start = startPointRef.current;
    
    let endX = e.x;
    let endY = e.y;
    
    // If shift is held, constrain to 45-degree angles
    if (e.shiftKey) {
      const dx = e.x - start.x;
      const dy = e.y - start.y;
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
  }, [state.isDrawing]);

  const handlePointerUp = useCallback((e: CanvasPointerEvent) => {
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
