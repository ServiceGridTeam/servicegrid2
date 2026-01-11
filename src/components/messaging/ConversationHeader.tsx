/**
 * ConversationHeader component
 * Displays conversation info, assignment, and actions
 */

import { Users, Briefcase, User, Archive, ArchiveRestore, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ReassignWorkerDropdown } from './ReassignWorkerDropdown';
import { cn } from '@/lib/utils';
import type { ConversationWithDetails } from '@/hooks/useConversations';

interface ConversationHeaderProps {
  conversation: ConversationWithDetails | null;
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  onAssign?: (conversationId: string, workerId: string | null) => void;
  isArchiving?: boolean;
  className?: string;
}

export function ConversationHeader({
  conversation,
  onArchive,
  onUnarchive,
  onAssign,
  isArchiving,
  className,
}: ConversationHeaderProps) {
  if (!conversation) return null;

  const isArchived = conversation.status === 'archived';

  const getTypeIcon = () => {
    switch (conversation.type) {
      case 'customer_thread':
        return <User className="h-4 w-4" />;
      case 'team_chat':
        return <Users className="h-4 w-4" />;
      case 'job_discussion':
        return <Briefcase className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  const getTitle = (): string => {
    if (conversation.title) return conversation.title;
    if (conversation.customer) {
      return `${conversation.customer.first_name} ${conversation.customer.last_name}`;
    }
    if (conversation.job) {
      return conversation.job.title;
    }
    return 'Conversation';
  };

  const getSubtitle = (): string | null => {
    if (conversation.type === 'job_discussion' && conversation.job) {
      return `Job ${conversation.job.job_number}`;
    }
    if (conversation.type === 'customer_thread') {
      return 'Customer Thread';
    }
    if (conversation.type === 'team_chat') {
      return 'Team Chat';
    }
    return null;
  };

  const getTypeBadgeVariant = () => {
    switch (conversation.type) {
      case 'customer_thread':
        return 'default';
      case 'team_chat':
        return 'secondary';
      case 'job_discussion':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const handleArchiveClick = () => {
    if (isArchived) {
      onUnarchive?.(conversation.id);
    } else {
      onArchive?.(conversation.id);
    }
  };

  const showAssignment = conversation.type === 'customer_thread';

  return (
    <div className={cn('flex items-center justify-between px-4 py-3 border-b bg-background', className)}>
      {/* Left side - Info */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
          {getTypeIcon()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold truncate">{getTitle()}</h2>
            <Badge variant={getTypeBadgeVariant()} className="shrink-0 text-[10px] h-5">
              {conversation.type.replace('_', ' ')}
            </Badge>
            {isArchived && (
              <Badge variant="outline" className="shrink-0 text-[10px] h-5">
                Archived
              </Badge>
            )}
          </div>
          {getSubtitle() && (
            <p className="text-sm text-muted-foreground truncate">{getSubtitle()}</p>
          )}
        </div>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Assignment dropdown for customer threads */}
        {showAssignment && onAssign && (
          <ReassignWorkerDropdown
            conversationId={conversation.id}
            assignedWorkerId={conversation.assigned_to}
            assignedWorker={conversation.assigned_worker}
            onAssign={onAssign}
          />
        )}

        {/* More actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleArchiveClick} disabled={isArchiving}>
              {isArchived ? (
                <>
                  <ArchiveRestore className="h-4 w-4 mr-2" />
                  Restore
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
