/**
 * Messages Page - Unified inbox for team messaging
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Plus, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConversationList, MessageThread } from '@/components/messaging';
import { NewChatDialog } from '@/components/messaging/NewChatDialog';
import type { ConversationWithDetails } from '@/hooks/useConversations';

export default function Messages() {
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithDetails | null>(null);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');

  const handleSelectConversation = useCallback((conversation: ConversationWithDetails) => {
    setSelectedConversation(conversation);
    setMobileView('thread');
  }, []);

  const handleBackToList = useCallback(() => {
    setMobileView('list');
  }, []);

  const handleConversationCreated = useCallback((conversation: ConversationWithDetails) => {
    setSelectedConversation(conversation);
    setMobileView('thread');
    setShowNewChatDialog(false);
  }, []);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background">
        <div className="flex items-center gap-3">
          {/* Mobile back button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={handleBackToList}
            style={{ visibility: mobileView === 'thread' ? 'visible' : 'hidden' }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <MessageSquare className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-xl font-semibold">Messages</h1>
        </div>
        <Button onClick={() => setShowNewChatDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>

      {/* Main content - split view */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation List - hidden on mobile when viewing thread */}
        <div
          className={`w-full md:w-[360px] lg:w-[400px] border-r bg-background flex-shrink-0 ${
            mobileView === 'thread' ? 'hidden md:flex' : 'flex'
          }`}
        >
          <ConversationList
            selectedId={selectedConversation?.id}
            onSelect={handleSelectConversation}
            onCreateNew={() => setShowNewChatDialog(true)}
            className="flex-1"
          />
        </div>

        {/* Message Thread - hidden on mobile when viewing list */}
        <div
          className={`flex-1 ${
            mobileView === 'list' ? 'hidden md:flex' : 'flex'
          }`}
        >
          <AnimatePresence mode="wait">
            {selectedConversation ? (
              <motion.div
                key={selectedConversation.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15 }}
                className="flex-1"
              >
                <MessageThread
                  conversationId={selectedConversation.id}
                  className="h-full"
                />
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center text-muted-foreground"
              >
                <MessageSquare className="h-16 w-16 mb-4 opacity-20" />
                <h3 className="text-lg font-medium mb-1">No conversation selected</h3>
                <p className="text-sm">Choose a conversation from the list or start a new chat</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setShowNewChatDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Start New Chat
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* New Chat Dialog */}
      <NewChatDialog
        open={showNewChatDialog}
        onOpenChange={setShowNewChatDialog}
        onCreated={handleConversationCreated}
      />
    </div>
  );
}
