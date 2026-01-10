/**
 * Canvas Event Adapter
 * Adapts framework-specific events to framework-agnostic CanvasPointerEvent
 * 
 * Part of Canvas Abstraction Layer for Photo Annotations
 */

import Konva from 'konva';
import type { CanvasPointerEvent, CanvasPoint } from '@/types/canvas-events';

/**
 * Adapts a Konva event to a framework-agnostic CanvasPointerEvent
 */
export function adaptKonvaEvent(
  e: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
  scale: number = 1
): CanvasPointerEvent {
  const stage = e.target.getStage();
  const pos = stage?.getPointerPosition();
  const target = e.target;
  const isBackground = target === stage;
  
  const nativeEvent = e.evt;
  const mouseEvent = nativeEvent as MouseEvent;
  
  return {
    x: pos ? pos.x / scale : 0,
    y: pos ? pos.y / scale : 0,
    nativeEvent,
    shiftKey: mouseEvent.shiftKey ?? false,
    ctrlKey: mouseEvent.ctrlKey ?? false,
    metaKey: mouseEvent.metaKey ?? false,
    altKey: mouseEvent.altKey ?? false,
    targetId: isBackground ? null : target.id?.() ?? null,
    isBackground,
    preventDefault: () => nativeEvent.preventDefault(),
  };
}

/**
 * Gets the current pointer position from a Konva stage in unscaled coordinates
 */
export function getKonvaPointerPosition(
  stage: Konva.Stage | null,
  scale: number
): CanvasPoint | null {
  if (!stage) return null;
  const pos = stage.getPointerPosition();
  if (!pos) return null;
  return { 
    x: pos.x / scale, 
    y: pos.y / scale 
  };
}

/**
 * Creates a getPointerPosition function bound to a specific stage and scale
 */
export function createPointerPositionGetter(
  stageRef: React.RefObject<Konva.Stage>
): () => CanvasPoint | null {
  return () => {
    const stage = stageRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    
    const scale = stage.scaleX();
    return {
      x: pos.x / scale,
      y: pos.y / scale,
    };
  };
}

/**
 * Extracts keyboard modifiers from a CanvasPointerEvent
 */
export function getEventModifiers(e: CanvasPointerEvent): {
  shift: boolean;
  ctrl: boolean;
  meta: boolean;
  alt: boolean;
} {
  return {
    shift: e.shiftKey,
    ctrl: e.ctrlKey,
    meta: e.metaKey,
    alt: e.altKey,
  };
}

/**
 * Checks if the event is from a touch device
 */
export function isTouchEvent(e: CanvasPointerEvent): boolean {
  return 'touches' in e.nativeEvent;
}
