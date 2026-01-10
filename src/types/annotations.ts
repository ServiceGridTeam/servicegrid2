/**
 * Photo Annotations & Markup - Type Definitions
 * Part 3 of Field Photo Documentation System
 */

// =============================================
// Core Types
// =============================================

export type AnnotationToolType = 
  | 'select'
  | 'arrow'
  | 'line'
  | 'rect'
  | 'circle'
  | 'ellipse'
  | 'text'
  | 'freehand'
  | 'measurement';

export type ComparisonDisplayMode = 'slider' | 'side_by_side' | 'fade';

export type MeasurementUnit = 'px' | 'in' | 'cm' | 'ft' | 'm';

// =============================================
// Annotation Data Structure
// =============================================

export interface AnnotationCanvas {
  width: number;
  height: number;
  scale?: number;
}

export interface AnnotationData {
  version: number;
  objects: AnnotationObject[];
  canvas: AnnotationCanvas;
}

// =============================================
// Base Annotation Object
// =============================================

export interface BaseAnnotation {
  id: string;
  type: AnnotationToolType;
  x: number;
  y: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  color: string;
  strokeWidth: number;
  opacity?: number;
  locked?: boolean;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  createdBy?: string;
}

// =============================================
// Specific Annotation Types
// =============================================

export interface ArrowAnnotation extends BaseAnnotation {
  type: 'arrow';
  points: number[]; // [x1, y1, x2, y2]
  pointerLength?: number;
  pointerWidth?: number;
  fill?: string;
}

export interface LineAnnotation extends BaseAnnotation {
  type: 'line';
  points: number[]; // [x1, y1, x2, y2]
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
  dash?: number[];
}

export interface RectAnnotation extends BaseAnnotation {
  type: 'rect';
  width: number;
  height: number;
  fill?: string;
  cornerRadius?: number;
}

export interface CircleAnnotation extends BaseAnnotation {
  type: 'circle';
  radius: number;
  fill?: string;
}

export interface EllipseAnnotation extends BaseAnnotation {
  type: 'ellipse';
  radiusX: number;
  radiusY: number;
  fill?: string;
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily?: string;
  fontStyle?: 'normal' | 'bold' | 'italic' | 'bold italic';
  align?: 'left' | 'center' | 'right';
  fill?: string;
  width?: number;
  wrap?: 'word' | 'char' | 'none';
  padding?: number;
}

export interface FreehandAnnotation extends BaseAnnotation {
  type: 'freehand';
  points: number[]; // [x1, y1, x2, y2, x3, y3, ...]
  tension?: number;
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
  globalCompositeOperation?: string;
}

export interface MeasurementAnnotation extends BaseAnnotation {
  type: 'measurement';
  points: number[]; // [x1, y1, x2, y2]
  length: number;
  unit: MeasurementUnit;
  pixelsPerUnit?: number;
  showLabel?: boolean;
  labelPosition?: 'above' | 'below' | 'center';
  fontSize?: number;
}

// Union type for all annotation objects
export type AnnotationObject = 
  | ArrowAnnotation
  | LineAnnotation
  | RectAnnotation
  | CircleAnnotation
  | EllipseAnnotation
  | TextAnnotation
  | FreehandAnnotation
  | MeasurementAnnotation;

// =============================================
// Database Types
// =============================================

export interface MediaAnnotation {
  id: string;
  job_media_id: string;
  business_id: string;
  version: number;
  parent_version_id: string | null;
  is_current: boolean;
  annotation_data: AnnotationData;
  rendered_url: string | null;
  rendered_at: string | null;
  render_error: string | null;
  created_by: string | null;
  created_by_name: string | null;
  object_count: number;
  has_text: boolean;
  has_arrows: boolean;
  has_shapes: boolean;
  has_measurements: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BeforeAfterComparison {
  id: string;
  business_id: string;
  job_id: string;
  before_media_id: string;
  after_media_id: string;
  title: string | null;
  description: string | null;
  display_mode: ComparisonDisplayMode;
  before_crop: CropSettings;
  after_crop: CropSettings;
  is_public: boolean;
  share_token: string | null;
  share_expires_at: string | null;
  created_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CropSettings {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

export interface AnnotationLock {
  job_media_id: string;
  locked_by: string;
  locked_by_name: string;
  locked_at: string;
  expires_at: string;
}

export interface AnnotationAuditLog {
  id: string;
  business_id: string;
  annotation_id: string | null;
  comparison_id: string | null;
  action: 'create' | 'update' | 'delete' | 'restore' | 'share' | 'unshare' | 'revert';
  target_type: 'annotation' | 'comparison';
  actor_id: string | null;
  actor_name: string | null;
  changes: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// =============================================
// Editor State Types
// =============================================

export interface AnnotationEditorState {
  tool: AnnotationToolType;
  color: string;
  strokeWidth: number;
  fontSize: number;
  selectedIds: string[];
  isDrawing: boolean;
  isDragging: boolean;
  history: AnnotationData[];
  historyIndex: number;
  hasUnsavedChanges: boolean;
  lastSavedAt: string | null;
}

export interface EditorSettings {
  color: string;
  strokeWidth: number;
  fontSize: number;
  fontFamily: string;
  measurementUnit: MeasurementUnit;
  pixelsPerUnit: number;
}

// =============================================
// Lock Types
// =============================================

export interface LockAcquireResult {
  success: boolean;
  expires_at?: string;
  locked_by?: string;
  locked_by_name?: string;
  message: string;
}

export interface LockState {
  isLocked: boolean;
  isOwnLock: boolean;
  lockHolder: string | null;
  lockHolderName: string | null;
  expiresAt: string | null;
}

// =============================================
// Comparison Types with Media
// =============================================

export interface ComparisonWithMedia extends BeforeAfterComparison {
  before_media?: {
    id: string;
    url: string | null;
    thumbnail_url_md: string | null;
    thumbnail_url_lg: string | null;
  };
  after_media?: {
    id: string;
    url: string | null;
    thumbnail_url_md: string | null;
    thumbnail_url_lg: string | null;
  };
}

// =============================================
// Constants
// =============================================

export const DEFAULT_ANNOTATION_DATA: AnnotationData = {
  version: 1,
  objects: [],
  canvas: { width: 0, height: 0 },
};

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  color: '#FF0000',
  strokeWidth: 3,
  fontSize: 16,
  fontFamily: 'Inter',
  measurementUnit: 'px',
  pixelsPerUnit: 1,
};

export const ANNOTATION_COLORS = [
  '#FF0000', // Red
  '#FF6B00', // Orange
  '#FFCC00', // Yellow
  '#00CC00', // Green
  '#00CCFF', // Cyan
  '#0066FF', // Blue
  '#9900FF', // Purple
  '#FF00CC', // Pink
  '#FFFFFF', // White
  '#000000', // Black
];

export const MAX_UNDO_STEPS = 50;
export const AUTO_SAVE_INTERVAL_MS = 5000;
export const LOCK_TTL_SECONDS = 300; // 5 minutes
export const LOCK_HEARTBEAT_INTERVAL_MS = 60000; // 1 minute
