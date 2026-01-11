/**
 * ConversationList component
 * Unified inbox with filters, search, and conversation rows
 */

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Search,
  Plus,
  MoreHorizontal,
  Archive,
  MessageSquare,
  Users,
  Briefcase,
  User,
  BellOff,
  ArchiveRestore,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  useConversations, 
  type ConversationFilter, 
  type ConversationWithDetails,
  type ConversationStatus,
} from '@/hooks/useConversations';
import { getTimeAgo, formatMessagePreview } from '@/lib/messageUtils';

interface ConversationListProps {
  selectedId?: string;
  onSelect: (conversation: ConversationWithDetails) => void;
  onCreateNew?: () => void;
  className?: string;
}

const FILTER_OPTIONS: { value: ConversationFilter; label: string; icon: React.ElementType }[] = [
  { value: 'all', label: 'All', icon: MessageSquare },
  { value: 'my_direct', label: 'My Direct', icon: User },
  { value: 'customer', label: 'Customer', icon: Users },
  { value: 'team', label: 'Team', icon: Users },
  { value: 'job', label: 'Jobs', icon: Briefcase },
];

export function ConversationList({
  selectedId,
  onSelect,
  onCreateNew,
  className,
}: ConversationListProps) {
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const status: ConversationStatus = showArchived ? 'archived' : 'active';

  const {
    conversations,
    isLoading,
    totalUnread,
    totalUnreadMentions,
    archiveConversation,
    unarchiveConversation,
  } = useConversations({ filter, status });

  // Filter by search
  const filteredConversations = useMemo(() => {
    if (!search.trim()) return conversations;
    
    const searchLower = search.toLowerCase();
    return conversations.filter((conv) => {
      const title = conv.title?.toLowerCase() || '';
      const customerName = conv.customer
        ? `${conv.customer.first_name} ${conv.customer.last_name}`.toLowerCase()
        : '';
      const jobTitle = conv.job?.title?.toLowerCase() || '';
      const lastMessage = conv.last_message_preview?.toLowerCase() || '';
      
      return (
        title.includes(searchLower) ||
        customerName.includes(searchLower) ||
        jobTitle.includes(searchLower) ||
        lastMessage.includes(searchLower)
      );
    });
  }, [conversations, search]);

  const handleFilterChange = useCallback((value: string) => {
    setFilter(value as ConversationFilter);
  }, []);

  const getConversationTitle = (conv: ConversationWithDetails): string => {
    if (conv.title) return conv.title;
    if (conv.customer) {
      return `${conv.customer.first_name} ${conv.customer.last_name}`;
    }
    if (conv.job) {
      return conv.job.title;
    }
    return 'Untitled Conversation';
  };

  const getConversationSubtitle = (conv: ConversationWithDetails): string => {
    if (conv.type === 'job_discussion' && conv.job) {
      return `Job ${conv.job.job_number}`;
    }
    if (conv.type === 'customer_thread' && conv.assigned_worker) {
      return `Assigned to ${conv.assigned_worker.first_name || 'Unassigned'}`;
    }
    return conv.type.replace('_', ' ');
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'customer_thread':
        return <User className="h-3 w-3" />;
      case 'team_chat':
        return <Users className="h-3 w-3" />;
      case 'job_discussion':
        return <Briefcase className="h-3 w-3" />;
      default:
        return <MessageSquare className="h-3 w-3" />;
    }
  };

  return (
    <div className={cn('flex flex-col h-full border-r bg-background', className)}>
      {/* Header */}
      <div className="p-4 border-b space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Messages</h2>
            {totalUnread > 0 && (
              <Badge variant="default" className="h-5 min-w-[20px] px-1.5">
                {totalUnread > 99 ? '99+' : totalUnread}
              </Badge>
            )}
          </div>
          {onCreateNew && (
            <Button size="icon" variant="ghost" onClick={onCreateNew}>
              <Plus className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filter tabs */}
        <Tabs value={filter} onValueChange={handleFilterChange}>
          <TabsList className="w-full grid grid-cols-5">
            {FILTER_OPTIONS.map((opt) => (
              <TabsTrigger
                key={opt.value}
                value={opt.value}
                className="text-xs px-2"
              >
                {opt.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Show archived toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="show-archived" className="text-sm text-muted-foreground">
            Show archived
          </Label>
          <Switch
            id="show-archived"
            checked={showArchived}
            onCheckedChange={setShowArchived}
          />
        </div>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-center px-4">
            <MessageSquare className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No conversations</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search ? 'Try a different search' : 'Start a new conversation'}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            <AnimatePresence mode="popLayout">
              {filteredConversations.map((conv, idx) => {
                const isSelected = conv.id === selectedId;
                const unreadCount = conv.my_participant?.unread_count || 0;
                const unreadMentions = conv.my_participant?.unread_mention_count || 0;
                const hasUnread = unreadCount > 0;

                return (
                  <motion.div
                    key={conv.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.15, delay: idx * 0.02 }}
                    className={cn(
                      'flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors group',
                      isSelected && 'bg-muted'
                    )}
                    onClick={() => onSelect(conv)}
                  >
                    {/* Avatar */}
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={undefined} />
                        <AvatarFallback className="bg-muted">
                          {getTypeIcon(conv.type)}
                        </AvatarFallback>
                      </Avatar>
                      {hasUnread && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-1 -right-1"
                        >
                          <Badge
                            variant="default"
                            className="h-5 min-w-[20px] px-1.5 text-[10px]"
                          >
                            {unreadMentions > 0 ? (
                              <span className="flex items-center gap-0.5">
                                @{unreadMentions}
                              </span>
                            ) : (
                              unreadCount
                            )}
                          </Badge>
                        </motion.div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3
                          className={cn(
                            'text-sm font-medium truncate',
                            hasUnread && 'font-semibold'
                          )}
                        >
                          {getConversationTitle(conv)}
                        </h3>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {conv.last_message_at
                            ? getTimeAgo(conv.last_message_at)
                            : ''}
                        </span>
                      </div>
                      
                      <p className="text-xs text-muted-foreground truncate">
                        {getConversationSubtitle(conv)}
                      </p>
                      
                      {conv.last_message_preview && (
                        <p
                          className={cn(
                            'text-xs mt-1 truncate',
                            hasUnread
                              ? 'text-foreground'
                              : 'text-muted-foreground'
                          )}
                        >
                          {conv.last_message_sender_name && (
                            <span className="font-medium">
                              {conv.last_message_sender_name}:{' '}
                            </span>
                          )}
                          {formatMessagePreview(conv.last_message_preview, 60)}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <BellOff className="h-4 w-4 mr-2" />
                            Mute
                          </DropdownMenuItem>
                          {showArchived ? (
                            <DropdownMenuItem
                              onClick={() => unarchiveConversation(conv.id)}
                            >
                              <ArchiveRestore className="h-4 w-4 mr-2" />
                              Restore
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => archiveConversation(conv.id)}
                            >
                              <Archive className="h-4 w-4 mr-2" />
                              Archive
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
