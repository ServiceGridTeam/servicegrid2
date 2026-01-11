/**
 * TypingIndicator component
 * Displays animated typing dots with user names
 */

import { motion, AnimatePresence } from 'framer-motion';

interface TypingIndicatorProps {
  users: Map<string, { profileId: string; name: string; timestamp: number }>;
}

export function TypingIndicator({ users }: TypingIndicatorProps) {
  const typingList = Array.from(users.values());
  
  if (typingList.length === 0) return null;

  const getTypingText = () => {
    if (typingList.length === 1) {
      return `${typingList[0].name} is typing`;
    }
    if (typingList.length === 2) {
      return `${typingList[0].name} and ${typingList[1].name} are typing`;
    }
    return `${typingList[0].name} and ${typingList.length - 1} others are typing`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 5 }}
        transition={{ duration: 0.15 }}
        className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground"
      >
        <div className="flex gap-1">
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
          />
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
          />
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
          />
        </div>
        <span className="italic">{getTypingText()}</span>
      </motion.div>
    </AnimatePresence>
  );
}
