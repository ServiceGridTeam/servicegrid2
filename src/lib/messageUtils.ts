/**
 * Message utilities for parsing, formatting, and permission checking
 */

// Entity reference pattern: @job:JOB-0001, @quote:Q-0001, @invoice:INV-0001
const ENTITY_PATTERN = /@(job|quote|invoice):([A-Z]+-\d+)/gi;

// Mention pattern: @[Name](id)
const MENTION_PATTERN = /@\[([^\]]+)\]\(([^)]+)\)/g;

export interface EntityReference {
  type: 'job' | 'quote' | 'invoice';
  identifier: string;
  id?: string;
}

export interface Mention {
  name: string;
  profileId: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'video' | 'file';
  mimeType: string;
  size: number;
  thumbnailUrl?: string;
  processingStatus?: 'pending' | 'processing' | 'ready' | 'failed';
}

/**
 * Parse entity references from message content
 * @example "@job:JOB-0001" -> { type: 'job', identifier: 'JOB-0001' }
 */
export function parseEntityReferences(content: string): EntityReference[] {
  const refs: EntityReference[] = [];
  let match;
  
  while ((match = ENTITY_PATTERN.exec(content)) !== null) {
    refs.push({
      type: match[1].toLowerCase() as 'job' | 'quote' | 'invoice',
      identifier: match[2],
    });
  }
  
  return refs;
}

/**
 * Parse @mentions from message content
 * @example "@[John Doe](uuid-123)" -> { name: 'John Doe', profileId: 'uuid-123' }
 */
export function parseMentions(content: string): Mention[] {
  const mentions: Mention[] = [];
  let match;
  
  while ((match = MENTION_PATTERN.exec(content)) !== null) {
    mentions.push({
      name: match[1],
      profileId: match[2],
    });
  }
  
  return mentions;
}

/**
 * Format message content for preview (truncate and strip HTML/mentions)
 */
export function formatMessagePreview(content: string, maxLength: number = 80): string {
  // Strip HTML tags
  let text = content.replace(/<[^>]*>/g, '');
  
  // Replace mention syntax with just the name
  text = text.replace(MENTION_PATTERN, '@$1');
  
  // Replace entity references with readable format
  text = text.replace(ENTITY_PATTERN, '$1 $2');
  
  // Trim whitespace
  text = text.trim();
  
  // Truncate
  if (text.length > maxLength) {
    return text.substring(0, maxLength - 3) + '...';
  }
  
  return text;
}

/**
 * Format relative time (e.g., "2 min ago", "1 hour ago", "Yesterday")
 */
export function getTimeAgo(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) {
    return 'Just now';
  }
  
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }
  
  if (diffHour < 24) {
    return `${diffHour}h ago`;
  }
  
  if (diffDay === 1) {
    return 'Yesterday';
  }
  
  if (diffDay < 7) {
    return `${diffDay}d ago`;
  }
  
  // Format as date
  return then.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format timestamp for message display
 */
export function formatMessageTime(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isYesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString();
  
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  
  if (isToday) {
    return time;
  }
  
  if (isYesterday) {
    return `Yesterday ${time}`;
  }
  
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Check if user can edit a message (within 15-minute window, owns message)
 */
export function canEditMessage(
  message: { sender_profile_id: string | null; created_at: string; is_deleted?: boolean },
  userId: string | null | undefined
): boolean {
  if (!userId || !message.sender_profile_id) return false;
  if (message.sender_profile_id !== userId) return false;
  if (message.is_deleted) return false;
  
  const createdAt = new Date(message.created_at);
  const now = new Date();
  return now.getTime() - createdAt.getTime() < EDIT_WINDOW_MS;
}

/**
 * Check if user can delete a message
 * - Own messages: within 15-minute window
 * - Admin/Owner: can delete any message in their business
 */
export function canDeleteMessage(
  message: { sender_profile_id: string | null; created_at: string; is_deleted?: boolean },
  userId: string | null | undefined,
  userRole?: string | null
): boolean {
  if (!userId) return false;
  if (message.is_deleted) return false;
  
  // Admins and owners can delete any message
  if (userRole === 'owner' || userRole === 'admin') {
    return true;
  }
  
  // Own messages within window
  if (message.sender_profile_id === userId) {
    const createdAt = new Date(message.created_at);
    const now = new Date();
    return now.getTime() - createdAt.getTime() < EDIT_WINDOW_MS;
  }
  
  return false;
}

/**
 * Get remaining edit time in a human-readable format
 */
export function getRemainingEditTime(createdAt: string): string | null {
  const created = new Date(createdAt);
  const deadline = new Date(created.getTime() + EDIT_WINDOW_MS);
  const now = new Date();
  const remaining = deadline.getTime() - now.getTime();
  
  if (remaining <= 0) return null;
  
  const minutes = Math.floor(remaining / 60000);
  if (minutes < 1) return 'Less than a minute';
  if (minutes === 1) return '1 minute';
  return `${minutes} minutes`;
}

/**
 * Generate a temporary ID for optimistic updates
 */
export function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Trigger haptic feedback if available
 */
export function triggerHaptic(duration: number = 10): void {
  if (navigator.vibrate) {
    navigator.vibrate(duration);
  }
}

/**
 * Trigger error haptic pattern
 */
export function triggerErrorHaptic(): void {
  if (navigator.vibrate) {
    navigator.vibrate([50, 30, 50]);
  }
}

/**
 * Convert content to HTML with entity and mention links
 */
export function contentToHtml(content: string): string {
  let html = content;
  
  // Escape HTML first
  html = html.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Convert mentions to links
  html = html.replace(
    MENTION_PATTERN,
    '<span class="text-primary font-medium">@$1</span>'
  );
  
  // Convert entity references to styled spans
  html = html.replace(
    ENTITY_PATTERN,
    '<span class="text-primary underline cursor-pointer" data-entity-type="$1" data-entity-id="$2">$1 $2</span>'
  );
  
  // Convert newlines to <br>
  html = html.replace(/\n/g, '<br>');
  
  return html;
}

/**
 * Get file type from MIME type
 */
export function getFileType(mimeType: string): 'image' | 'video' | 'file' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'file';
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
