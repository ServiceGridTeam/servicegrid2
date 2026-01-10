// Tag and search input validation utilities for L5 security hardening

interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: string;
}

// Forbidden patterns for tag names - HTML, SQL injection, control chars
const FORBIDDEN_PATTERNS = [
  /<script/i,           // HTML script tags
  /<[^>]+>/,            // Any HTML tags
  /['";--]/,            // SQL injection patterns
  /[\x00-\x1F\x7F]/,    // Control characters
  /javascript:/i,       // JS protocol
  /data:/i,             // Data URIs
  /on\w+\s*=/i,         // Event handlers (onclick=, onerror=, etc.)
  /expression\s*\(/i,   // CSS expression
];

// Max tag name length per spec
export const MAX_TAG_NAME_LENGTH = 50;

// Max search query length
export const MAX_SEARCH_QUERY_LENGTH = 500;

// Max tags per photo
export const MAX_TAGS_PER_PHOTO = 50;

/**
 * Validates a tag name for security and format requirements
 * - Max 50 characters
 * - No HTML/script tags
 * - No SQL injection patterns
 * - No control characters
 */
export function validateTagName(name: string): ValidationResult {
  // Strip leading/trailing whitespace
  const sanitized = name.trim();
  
  // Check empty
  if (sanitized.length === 0) {
    return { valid: false, error: 'Tag name is required' };
  }
  
  // Check length
  if (sanitized.length > MAX_TAG_NAME_LENGTH) {
    return { 
      valid: false, 
      error: `Tag name must be ${MAX_TAG_NAME_LENGTH} characters or less` 
    };
  }
  
  // Check forbidden patterns
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(sanitized)) {
      return { valid: false, error: 'Tag name contains invalid characters' };
    }
  }
  
  return { valid: true, sanitized };
}

/**
 * Sanitizes a search query for PostgreSQL full-text search
 * - Escapes special tsquery characters
 * - Limits length to 500 chars
 * - Strips control characters
 */
export function sanitizeSearchQuery(query: string): string {
  if (!query) return '';
  
  return query
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Escape PostgreSQL tsquery special characters: & | ! ( ) : * " '
    .replace(/[&|!():*"'\\]/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    // Trim whitespace
    .trim()
    // Limit length
    .slice(0, MAX_SEARCH_QUERY_LENGTH);
}

/**
 * Get remaining character count for tag name
 */
export function getTagNameCharacterCount(name: string): {
  current: number;
  max: number;
  remaining: number;
  isNearLimit: boolean;
  isOverLimit: boolean;
} {
  const current = name.trim().length;
  const remaining = MAX_TAG_NAME_LENGTH - current;
  
  return {
    current,
    max: MAX_TAG_NAME_LENGTH,
    remaining,
    isNearLimit: remaining <= 10 && remaining > 0,
    isOverLimit: remaining < 0,
  };
}
