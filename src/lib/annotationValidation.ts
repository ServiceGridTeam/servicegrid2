/**
 * Annotation Validation & Sanitization Utilities
 * Part 3 of Field Photo Documentation System
 */

import { AnnotationData, AnnotationObject } from '@/types/annotations';

// =============================================
// Validation Constants
// =============================================

export const MAX_OBJECTS = 500;
export const MAX_TEXT_LENGTH = 500;
export const MAX_FREEHAND_POINTS = 10000;
export const MAX_DATA_SIZE_BYTES = 1048576; // 1MB
export const MAX_CANVAS_DIMENSION = 10000;
export const MIN_STROKE_WIDTH = 1;
export const MAX_STROKE_WIDTH = 50;
export const MIN_FONT_SIZE = 8;
export const MAX_FONT_SIZE = 144;

// =============================================
// Validation Result Types
// =============================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// =============================================
// Text Sanitization
// =============================================

/**
 * Strip HTML tags and potentially dangerous content from text
 */
export function sanitizeTextContent(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  // Remove HTML tags
  let sanitized = text.replace(/<[^>]*>/g, '');
  
  // Remove script-like content
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/data:/gi, '');
  sanitized = sanitized.replace(/vbscript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  
  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Limit length
  if (sanitized.length > MAX_TEXT_LENGTH) {
    sanitized = sanitized.substring(0, MAX_TEXT_LENGTH);
  }
  
  return sanitized.trim();
}

// =============================================
// Color Validation
// =============================================

/**
 * Validate hex color format
 */
export function validateColor(color: string): boolean {
  if (!color || typeof color !== 'string') {
    return false;
  }
  
  // Accept #RGB, #RRGGBB, #RGBA, #RRGGBBAA formats
  const hexPattern = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
  return hexPattern.test(color);
}

/**
 * Normalize color to #RRGGBB format
 */
export function normalizeColor(color: string): string {
  if (!validateColor(color)) {
    return '#FF0000'; // Default to red
  }
  
  // Expand 3-digit hex to 6-digit
  if (color.length === 4) {
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  
  return color.toUpperCase();
}

// =============================================
// Coordinate Validation
// =============================================

/**
 * Validate coordinates are within bounds
 */
export function validateCoordinates(
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number
): boolean {
  if (typeof x !== 'number' || typeof y !== 'number') {
    return false;
  }
  
  if (isNaN(x) || isNaN(y)) {
    return false;
  }
  
  // Allow some overflow for objects that extend beyond canvas
  const margin = Math.max(canvasWidth, canvasHeight) * 0.5;
  
  return (
    x >= -margin &&
    x <= canvasWidth + margin &&
    y >= -margin &&
    y <= canvasHeight + margin
  );
}

/**
 * Clamp coordinates to valid range
 */
export function clampCoordinates(
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  const margin = Math.max(canvasWidth, canvasHeight) * 0.5;
  
  return {
    x: Math.max(-margin, Math.min(canvasWidth + margin, x)),
    y: Math.max(-margin, Math.min(canvasHeight + margin, y)),
  };
}

// =============================================
// Object Validation
// =============================================

/**
 * Validate a single annotation object
 */
export function validateAnnotationObject(
  obj: AnnotationObject,
  canvasWidth: number,
  canvasHeight: number
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate ID
  if (!obj.id || typeof obj.id !== 'string') {
    errors.push('Object missing valid ID');
  }
  
  // Validate type
  const validTypes = ['arrow', 'line', 'rect', 'circle', 'ellipse', 'text', 'freehand', 'measurement'];
  if (!validTypes.includes(obj.type)) {
    errors.push(`Invalid object type: ${obj.type}`);
  }
  
  // Validate coordinates
  if (!validateCoordinates(obj.x, obj.y, canvasWidth, canvasHeight)) {
    warnings.push(`Object ${obj.id} has coordinates outside canvas bounds`);
  }
  
  // Validate color
  if (!validateColor(obj.color)) {
    errors.push(`Object ${obj.id} has invalid color: ${obj.color}`);
  }
  
  // Validate stroke width
  if (obj.strokeWidth < MIN_STROKE_WIDTH || obj.strokeWidth > MAX_STROKE_WIDTH) {
    warnings.push(`Object ${obj.id} stroke width clamped to valid range`);
  }
  
  // Type-specific validation
  switch (obj.type) {
    case 'text': {
      const textObj = obj;
      if (textObj.text && textObj.text.length > MAX_TEXT_LENGTH) {
        errors.push(`Text object ${obj.id} exceeds max length of ${MAX_TEXT_LENGTH}`);
      }
      if (textObj.fontSize < MIN_FONT_SIZE || textObj.fontSize > MAX_FONT_SIZE) {
        warnings.push(`Text object ${obj.id} font size clamped to valid range`);
      }
      break;
    }
    case 'freehand': {
      const freehandObj = obj;
      if (freehandObj.points && freehandObj.points.length > MAX_FREEHAND_POINTS * 2) {
        errors.push(`Freehand object ${obj.id} exceeds max points of ${MAX_FREEHAND_POINTS}`);
      }
      break;
    }
    case 'arrow':
    case 'line':
    case 'measurement': {
      const lineObj = obj as { points?: number[] };
      if (!lineObj.points || lineObj.points.length < 4) {
        errors.push(`Line-based object ${obj.id} missing valid points array`);
      }
      break;
    }
    case 'rect': {
      const rectObj = obj;
      if (rectObj.width <= 0 || rectObj.height <= 0) {
        errors.push(`Rectangle ${obj.id} has invalid dimensions`);
      }
      break;
    }
    case 'circle': {
      const circleObj = obj;
      if (circleObj.radius <= 0) {
        errors.push(`Circle ${obj.id} has invalid radius`);
      }
      break;
    }
    case 'ellipse': {
      const ellipseObj = obj;
      if (ellipseObj.radiusX <= 0 || ellipseObj.radiusY <= 0) {
        errors.push(`Ellipse ${obj.id} has invalid radii`);
      }
      break;
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================
// Full Annotation Data Validation
// =============================================

/**
 * Validate complete annotation data structure
 */
export function validateAnnotationData(data: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check basic structure
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: ['Annotation data must be an object'],
      warnings: [],
    };
  }
  
  const annotationData = data as AnnotationData;
  
  // Validate version
  if (typeof annotationData.version !== 'number' || annotationData.version < 1) {
    errors.push('Invalid annotation version');
  }
  
  // Validate canvas
  if (!annotationData.canvas || typeof annotationData.canvas !== 'object') {
    errors.push('Missing canvas configuration');
  } else {
    if (annotationData.canvas.width <= 0 || annotationData.canvas.width > MAX_CANVAS_DIMENSION) {
      errors.push(`Canvas width must be between 1 and ${MAX_CANVAS_DIMENSION}`);
    }
    if (annotationData.canvas.height <= 0 || annotationData.canvas.height > MAX_CANVAS_DIMENSION) {
      errors.push(`Canvas height must be between 1 and ${MAX_CANVAS_DIMENSION}`);
    }
  }
  
  // Validate objects array
  if (!Array.isArray(annotationData.objects)) {
    errors.push('Annotation objects must be an array');
  } else {
    // Check object count
    if (annotationData.objects.length > MAX_OBJECTS) {
      errors.push(`Too many objects: ${annotationData.objects.length} (max: ${MAX_OBJECTS})`);
    }
    
    // Validate each object
    const canvasWidth = annotationData.canvas?.width || 0;
    const canvasHeight = annotationData.canvas?.height || 0;
    
    for (const obj of annotationData.objects) {
      const objResult = validateAnnotationObject(obj, canvasWidth, canvasHeight);
      errors.push(...objResult.errors);
      warnings.push(...objResult.warnings);
    }
    
    // Check for duplicate IDs
    const ids = annotationData.objects.map(obj => obj.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicates.length > 0) {
      errors.push(`Duplicate object IDs found: ${[...new Set(duplicates)].join(', ')}`);
    }
  }
  
  // Check total size
  const jsonSize = JSON.stringify(data).length;
  if (jsonSize > MAX_DATA_SIZE_BYTES) {
    errors.push(`Annotation data too large: ${jsonSize} bytes (max: ${MAX_DATA_SIZE_BYTES})`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =============================================
// Sanitization
// =============================================

/**
 * Sanitize annotation data, fixing issues where possible
 */
export function sanitizeAnnotationData(data: AnnotationData): AnnotationData {
  const sanitized: AnnotationData = {
    version: Math.max(1, Math.floor(data.version || 1)),
    canvas: {
      width: Math.min(MAX_CANVAS_DIMENSION, Math.max(1, data.canvas?.width || 0)),
      height: Math.min(MAX_CANVAS_DIMENSION, Math.max(1, data.canvas?.height || 0)),
      scale: data.canvas?.scale,
    },
    objects: [],
  };
  
  if (!Array.isArray(data.objects)) {
    return sanitized;
  }
  
  // Limit objects
  const objectsToProcess = data.objects.slice(0, MAX_OBJECTS);
  
  for (const obj of objectsToProcess) {
    const sanitizedObj = sanitizeAnnotationObject(obj, sanitized.canvas.width, sanitized.canvas.height);
    if (sanitizedObj) {
      sanitized.objects.push(sanitizedObj);
    }
  }
  
  return sanitized;
}

/**
 * Sanitize a single annotation object
 */
function sanitizeAnnotationObject(
  obj: AnnotationObject,
  canvasWidth: number,
  canvasHeight: number
): AnnotationObject | null {
  if (!obj || typeof obj !== 'object') {
    return null;
  }
  
  // Ensure valid ID
  const id = obj.id || crypto.randomUUID();
  
  // Validate and clamp coordinates
  const coords = clampCoordinates(obj.x || 0, obj.y || 0, canvasWidth, canvasHeight);
  
  // Normalize color
  const color = normalizeColor(obj.color || '#FF0000');
  
  // Clamp stroke width
  const strokeWidth = Math.max(
    MIN_STROKE_WIDTH,
    Math.min(MAX_STROKE_WIDTH, obj.strokeWidth || 3)
  );
  
  // Base properties
  const base = {
    id,
    type: obj.type,
    x: coords.x,
    y: coords.y,
    rotation: obj.rotation || 0,
    scaleX: obj.scaleX || 1,
    scaleY: obj.scaleY || 1,
    color,
    strokeWidth,
    opacity: Math.max(0, Math.min(1, obj.opacity ?? 1)),
    locked: obj.locked || false,
    metadata: obj.metadata,
    createdAt: obj.createdAt,
    createdBy: obj.createdBy,
  };
  
  // Type-specific sanitization
  switch (obj.type) {
    case 'text': {
      const textObj = obj;
      return {
        ...base,
        type: 'text',
        text: sanitizeTextContent(textObj.text || ''),
        fontSize: Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, textObj.fontSize || 16)),
        fontFamily: textObj.fontFamily || 'Inter',
        fontStyle: textObj.fontStyle || 'normal',
        align: textObj.align || 'left',
        fill: textObj.fill ? normalizeColor(textObj.fill) : undefined,
        width: textObj.width,
        wrap: textObj.wrap || 'word',
        padding: textObj.padding || 0,
      };
    }
    case 'freehand': {
      const freehandObj = obj;
      let points = freehandObj.points || [];
      if (points.length > MAX_FREEHAND_POINTS * 2) {
        // Downsample points
        const step = Math.ceil(points.length / (MAX_FREEHAND_POINTS * 2));
        const downsampled: number[] = [];
        for (let i = 0; i < points.length; i += step * 2) {
          downsampled.push(points[i], points[i + 1] || 0);
        }
        points = downsampled;
      }
      return {
        ...base,
        type: 'freehand',
        points,
        tension: freehandObj.tension ?? 0.5,
        lineCap: freehandObj.lineCap || 'round',
        lineJoin: freehandObj.lineJoin || 'round',
      };
    }
    case 'arrow':
    case 'line':
    case 'measurement': {
      const lineObj = obj as AnnotationObject & { points?: number[] };
      return {
        ...base,
        type: obj.type,
        points: lineObj.points || [0, 0, 100, 100],
        ...(obj.type === 'arrow' && {
          pointerLength: (obj as any).pointerLength || 10,
          pointerWidth: (obj as any).pointerWidth || 10,
        }),
        ...(obj.type === 'measurement' && {
          length: (obj as any).length || 0,
          unit: (obj as any).unit || 'px',
          pixelsPerUnit: (obj as any).pixelsPerUnit || 1,
          showLabel: (obj as any).showLabel ?? true,
          labelPosition: (obj as any).labelPosition || 'above',
          fontSize: (obj as any).fontSize || 14,
        }),
      } as AnnotationObject;
    }
    case 'rect':
      return {
        ...base,
        type: 'rect',
        width: Math.max(1, obj.width || 100),
        height: Math.max(1, obj.height || 100),
        fill: obj.fill ? normalizeColor(obj.fill) : undefined,
        cornerRadius: obj.cornerRadius || 0,
      };
    case 'circle':
      return {
        ...base,
        type: 'circle',
        radius: Math.max(1, obj.radius || 50),
        fill: obj.fill ? normalizeColor(obj.fill) : undefined,
      };
    case 'ellipse':
      return {
        ...base,
        type: 'ellipse',
        radiusX: Math.max(1, obj.radiusX || 50),
        radiusY: Math.max(1, obj.radiusY || 30),
        fill: obj.fill ? normalizeColor(obj.fill) : undefined,
      };
    default:
      return null;
  }
}

// =============================================
// Utility Functions
// =============================================

/**
 * Generate unique annotation object ID
 */
export function generateAnnotationId(): string {
  return `ann_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
}

/**
 * Calculate distance between two points
 */
export function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

/**
 * Convert pixels to specified unit
 */
export function pixelsToUnit(pixels: number, unit: string, pixelsPerUnit: number): number {
  if (unit === 'px') return pixels;
  return pixels / pixelsPerUnit;
}

/**
 * Format measurement for display
 */
export function formatMeasurement(value: number, unit: string): string {
  const precision = unit === 'px' ? 0 : 2;
  return `${value.toFixed(precision)} ${unit}`;
}
