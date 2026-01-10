/**
 * Framework-agnostic canvas event types
 * Can be mapped from Konva, Fabric.js, native Canvas, etc.
 * 
 * Part of Canvas Abstraction Layer for Photo Annotations
 */

/**
 * Normalized pointer event for canvas interactions
 * All coordinates are in unscaled canvas space
 */
export interface CanvasPointerEvent {
  /** X coordinate in unscaled canvas space */
  x: number;
  /** Y coordinate in unscaled canvas space */
  y: number;
  
  /** Original native event */
  nativeEvent: MouseEvent | TouchEvent;
  
  /** Keyboard modifiers */
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  
  /** ID of the shape clicked, null if background */
  targetId: string | null;
  /** True if clicked on canvas background */
  isBackground: boolean;
  
  /** Prevent default browser behavior */
  preventDefault: () => void;
}

/**
 * Extended pointer event with drag delta information
 */
export interface CanvasDragEvent extends CanvasPointerEvent {
  /** Change in X from drag start */
  deltaX: number;
  /** Change in Y from drag start */
  deltaY: number;
}

/**
 * Canvas keyboard event abstraction
 */
export interface CanvasKeyEvent {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  preventDefault: () => void;
}

/**
 * Point in canvas coordinate space
 */
export interface CanvasPoint {
  x: number;
  y: number;
}

/**
 * Function signature for getting current pointer position
 */
export type GetPointerPosition = () => CanvasPoint | null;
