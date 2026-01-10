/**
 * Generic canvas renderer contract
 * Implementations: KonvaRenderer, FabricRenderer, NativeCanvasRenderer
 * 
 * Part of Canvas Abstraction Layer for Photo Annotations
 */

import type { AnnotationObject } from './annotations';
import type { CanvasPointerEvent } from './canvas-events';

/**
 * Renderer lifecycle and configuration options
 */
export interface RendererOptions {
  width: number;
  height: number;
  imageUrl?: string;
  interactive?: boolean;
}

/**
 * Export options for canvas content
 */
export interface ExportOptions {
  pixelRatio?: number;
  mimeType?: 'image/png' | 'image/jpeg' | 'image/webp';
  quality?: number;
}

/**
 * Canvas renderer interface - abstracts the underlying rendering library
 */
export interface CanvasRenderer {
  // Lifecycle
  mount(container: HTMLElement): void;
  unmount(): void;
  destroy(): void;
  
  // Configuration
  setSize(width: number, height: number): void;
  setScale(scale: number): void;
  setImage(imageUrl: string): Promise<void>;
  
  // Rendering
  render(annotations: AnnotationObject[]): void;
  clear(): void;
  batchDraw(): void;
  
  // Selection
  select(ids: string[]): void;
  getSelectedIds(): string[];
  clearSelection(): void;
  
  // Export
  toDataURL(options?: ExportOptions): string;
  toSVG(): string;
  
  // Events
  on(event: 'pointerdown' | 'pointermove' | 'pointerup', handler: (e: CanvasPointerEvent) => void): void;
  off(event: string, handler: Function): void;
  
  // Hit detection
  getObjectAtPoint(x: number, y: number): AnnotationObject | null;
  
  // Pointer position
  getPointerPosition(): { x: number; y: number } | null;
  
  // Direct access (escape hatch for complex operations)
  getNativeInstance(): unknown;
}

/**
 * Factory for creating canvas renderers
 */
export interface CanvasRendererFactory {
  create(options: RendererOptions): CanvasRenderer;
}

/**
 * Configuration for renderer factory
 */
export interface RendererConfig {
  type: 'konva' | 'fabric' | 'native';
  options?: Record<string, unknown>;
}
