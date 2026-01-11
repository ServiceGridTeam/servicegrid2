/**
 * MessageComposer component
 * Text input with attachment support, reply context, and typing indicator
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Send, 
  Paperclip, 
  X, 
  Image as ImageIcon,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/lib/messageUtils';
import type { MessageWithDetails } from '@/hooks/useMessages';
import type { Attachment } from '@/lib/messageUtils';

interface MessageComposerProps {
  onSend: (content: string, attachments?: Attachment[], replyToId?: string) => void;
  onTyping?: (isTyping: boolean) => void;
  replyTo?: MessageWithDetails | null;
  onCancelReply?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function MessageComposer({
  onSend,
  onTyping,
  replyTo,
  onCancelReply,
  disabled = false,
  placeholder = 'Type a message...',
  className,
}: MessageComposerProps) {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [content]);

  // Focus on reply
  useEffect(() => {
    if (replyTo && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyTo]);

  const handleTyping = useCallback(() => {
    if (onTyping) {
      onTyping(true);
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set new timeout to stop typing
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 2000);
    }
  }, [onTyping]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    handleTyping();
  }, [handleTyping]);

  const handleSend = useCallback(() => {
    if (!content.trim() && attachments.length === 0) return;
    
    // 0ms haptic feedback
    triggerHaptic();
    
    // Stop typing indicator
    if (onTyping) {
      onTyping(false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
    
    onSend(content.trim(), attachments.length > 0 ? attachments : undefined, replyTo?.id);
    
    // Reset state
    setContent('');
    setAttachments([]);
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [content, attachments, replyTo?.id, onSend, onTyping]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Convert files to attachments (mock - would upload in real implementation)
    const newAttachments: Attachment[] = Array.from(files).map((file) => ({
      id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      url: URL.createObjectURL(file),
      type: file.type.startsWith('image/') ? 'image' as const : 
            file.type.startsWith('video/') ? 'video' as const : 'file' as const,
      mimeType: file.type,
      size: file.size,
      processingStatus: 'pending' as const,
    }));

    setAttachments((prev) => [...prev, ...newAttachments]);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleRemoveAttachment = useCallback((attachmentId: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
  }, []);

  const canSend = (content.trim() || attachments.length > 0) && !disabled;

  return (
    <div className={cn('border-t bg-background', className)}>
      {/* Reply context */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b">
              <div className="flex-1 min-w-0">
                <span className="text-xs text-muted-foreground">
                  Replying to <span className="font-medium">{replyTo.sender_name}</span>
                </span>
                <p className="text-sm truncate text-muted-foreground">
                  {replyTo.content}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={onCancelReply}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attachments preview */}
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 px-4 py-2 overflow-x-auto border-b">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="relative shrink-0 group"
                >
                  {attachment.type === 'image' ? (
                    <img
                      src={attachment.url}
                      alt={attachment.name}
                      className="h-16 w-16 object-cover rounded-md"
                    />
                  ) : (
                    <div className="h-16 w-16 flex flex-col items-center justify-center bg-muted rounded-md">
                      {attachment.type === 'video' ? (
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      ) : (
                        <FileText className="h-6 w-6 text-muted-foreground" />
                      )}
                      <span className="text-[10px] text-muted-foreground mt-1 max-w-[56px] truncate">
                        {attachment.name}
                      </span>
                    </div>
                  )}
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemoveAttachment(attachment.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="flex items-end gap-2 p-4">
        {/* Attachment button */}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
        />

        {/* Text input */}
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="min-h-[40px] max-h-[150px] resize-none py-2"
          rows={1}
        />

        {/* Send button */}
        <Button
          size="icon"
          className="shrink-0"
          onClick={handleSend}
          disabled={!canSend}
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
