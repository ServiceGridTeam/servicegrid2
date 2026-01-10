/**
 * Arrow Tool Hook - Draw arrows on canvas
 * Part 3 of Field Photo Documentation System
 * 
 * Updated to use Canvas Abstraction Layer
 */

import { useState, useCallback, useMemo } from 'react';
import { Arrow } from 'react-konva';
import Konva from 'konva';
import { ArrowAnnotation } from '@/types/annotations';
import type { CanvasPointerEvent } from '@/types/canvas-events';
import { generateAnnotationId } from '@/lib/annotationValidation';
import { adaptKonvaEvent } from '@/lib/canvas-event-adapter';

interface UseArrowToolProps {
  stageRef: React.RefObject<Konva.Stage>;
  scale: number;
  color: string;
  strokeWidth: number;
  onComplete: (annotation: ArrowAnnotation) => void;
}

interface ArrowDrawState {
  isDrawing: boolean;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export function useArrowTool({
  stageRef,
  scale,
  color,
  strokeWidth,
  onComplete,
}: UseArrowToolProps) {
  const [drawState, setDrawState] = useState<ArrowDrawState>({
    isDrawing: false,
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
  });

  // Abstract handler using CanvasPointerEvent
  const handlePointerDown = useCallback((e: CanvasPointerEvent) => {
    setDrawState({
      isDrawing: true,
      startX: e.x,
      startY: e.y,
      endX: e.x,
      endY: e.y,
    });
  }, []);

  const handlePointerMove = useCallback((e: CanvasPointerEvent) => {
    if (!drawState.isDrawing) return;

    setDrawState(prev => ({
      ...prev,
      endX: e.x,
      endY: e.y,
    }));
  }, [drawState.isDrawing]);

  const handlePointerUp = useCallback((e: CanvasPointerEvent) => {
    if (!drawState.isDrawing) return;

    // Only create arrow if there's meaningful movement
    const dx = e.x - drawState.startX;
    const dy = e.y - drawState.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 10) {
      const arrow: ArrowAnnotation = {
        id: generateAnnotationId(),
        type: 'arrow',
        x: drawState.startX,
        y: drawState.startY,
        points: [drawState.startX, drawState.startY, e.x, e.y],
        color,
        strokeWidth,
        pointerLength: 10,
        pointerWidth: 10,
        fill: color,
      };

      onComplete(arrow);
    }

    setDrawState({
      isDrawing: false,
      startX: 0,
      startY: 0,
      endX: 0,
      endY: 0,
    });
  }, [drawState, color, strokeWidth, onComplete]);

  // Konva-specific handlers (adapters)
  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    handlePointerDown(adaptKonvaEvent(e, scale));
  }, [handlePointerDown, scale]);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    handlePointerMove(adaptKonvaEvent(e, scale));
  }, [handlePointerMove, scale]);

  const handleMouseUp = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    handlePointerUp(adaptKonvaEvent(e, scale));
  }, [handlePointerUp, scale]);

  // Preview element while drawing
  const previewElement = useMemo(() => {
    if (!drawState.isDrawing) return null;

    return (
      <Arrow
        points={[
          drawState.startX * scale,
          drawState.startY * scale,
          drawState.endX * scale,
          drawState.endY * scale,
        ]}
        stroke={color}
        strokeWidth={strokeWidth}
        fill={color}
        pointerLength={10}
        pointerWidth={10}
        listening={false}
      />
    );
  }, [drawState, color, strokeWidth, scale]);

  return {
    // Konva-specific handlers for backward compatibility
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    // Abstract handlers for future renderer implementations
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    previewElement,
    isDrawing: drawState.isDrawing,
  };
}
