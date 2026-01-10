/**
 * Arrow Tool Hook - Draw arrows on canvas
 * Part 3 of Field Photo Documentation System
 */

import { useState, useCallback, useMemo } from 'react';
import { Arrow } from 'react-konva';
import Konva from 'konva';
import { ArrowAnnotation } from '@/types/annotations';
import { generateAnnotationId } from '@/lib/annotationValidation';

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

  const getPointerPosition = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = stageRef.current;
    if (!stage) return null;

    const pos = stage.getPointerPosition();
    if (!pos) return null;

    // Convert to unscaled coordinates
    return {
      x: pos.x / scale,
      y: pos.y / scale,
    };
  }, [stageRef, scale]);

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const pos = getPointerPosition(e);
    if (!pos) return;

    setDrawState({
      isDrawing: true,
      startX: pos.x,
      startY: pos.y,
      endX: pos.x,
      endY: pos.y,
    });
  }, [getPointerPosition]);

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!drawState.isDrawing) return;

    const pos = getPointerPosition(e);
    if (!pos) return;

    setDrawState(prev => ({
      ...prev,
      endX: pos.x,
      endY: pos.y,
    }));
  }, [drawState.isDrawing, getPointerPosition]);

  const handleMouseUp = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!drawState.isDrawing) return;

    const pos = getPointerPosition(e);
    if (!pos) return;

    // Only create arrow if there's meaningful movement
    const dx = pos.x - drawState.startX;
    const dy = pos.y - drawState.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 10) {
      const arrow: ArrowAnnotation = {
        id: generateAnnotationId(),
        type: 'arrow',
        x: drawState.startX,
        y: drawState.startY,
        points: [drawState.startX, drawState.startY, pos.x, pos.y],
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
  }, [drawState, color, strokeWidth, onComplete, getPointerPosition]);

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
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    previewElement,
    isDrawing: drawState.isDrawing,
  };
}
