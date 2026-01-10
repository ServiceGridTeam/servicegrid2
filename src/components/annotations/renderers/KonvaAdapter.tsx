/**
 * Konva Adapter
 * 
 * Provides Konva-specific utilities and adapters for the canvas abstraction layer.
 * This is the current renderer implementation - can be swapped for alternatives.
 * 
 * Part of Canvas Abstraction Layer for Photo Annotations
 */

import { useCallback } from 'react';
import Konva from 'konva';
import type { CanvasPointerEvent, CanvasPoint } from '@/types/canvas-events';
import { adaptKonvaEvent } from '@/lib/canvas-event-adapter';

/**
 * Hook to create event adapter functions for Konva stage
 * 
 * Usage:
 * ```tsx
 * const { adaptEvent, getPointerPosition } = useKonvaEventAdapter(stageRef, scale);
 * 
 * // In event handlers:
 * const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
 *   const canvasEvent = adaptEvent(e);
 *   // Use canvasEvent.x, canvasEvent.y, canvasEvent.shiftKey, etc.
 * };
 * ```
 */
export function useKonvaEventAdapter(
  stageRef: React.RefObject<Konva.Stage>,
  scale: number = 1
) {
  const adaptEvent = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): CanvasPointerEvent => {
      return adaptKonvaEvent(e, scale);
    },
    [scale]
  );

  const getPointerPosition = useCallback((): CanvasPoint | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    
    return {
      x: pos.x / scale,
      y: pos.y / scale,
    };
  }, [stageRef, scale]);

  return {
    adaptEvent,
    getPointerPosition,
  };
}

/**
 * Higher-order function that wraps a handler expecting CanvasPointerEvent
 * to accept Konva events directly
 * 
 * Usage:
 * ```tsx
 * const handleCanvasDown = (e: CanvasPointerEvent) => { ... };
 * <Stage onMouseDown={wrapKonvaHandler(handleCanvasDown, scale)} />
 * ```
 */
export function wrapKonvaHandler(
  handler: (e: CanvasPointerEvent) => void,
  scale: number = 1
): (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void {
  return (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const canvasEvent = adaptKonvaEvent(e, scale);
    handler(canvasEvent);
  };
}

/**
 * Type guard to check if native event is MouseEvent
 */
export function isMouseEvent(event: MouseEvent | TouchEvent): event is MouseEvent {
  return 'clientX' in event;
}

/**
 * Type guard to check if native event is TouchEvent
 */
export function isTouchEvent(event: MouseEvent | TouchEvent): event is TouchEvent {
  return 'touches' in event;
}
