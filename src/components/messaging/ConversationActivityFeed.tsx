/**
 * ConversationActivityFeed component
 * Displays conversation activities (assignments, status changes) inline
 */

import { motion } from 'framer-motion';
import { UserPlus, UserMinus, Archive, ArchiveRestore, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type ActivityType = Database['public']['Enums']['conversation_activity_type'];

interface Activity {
  id: string;
  activity_type: ActivityType;
  actor_name: string | null;
  created_at: string;
  old_value: any;
  new_value: any;
  metadata: any;
}

interface ConversationActivityFeedProps {
  activities: Activity[];
  className?: string;
}

const activityConfig: Record<string, { icon: typeof UserPlus; label: (a: Activity) => string }> = {
  assigned: {
    icon: UserPlus,
    label: (a) => `${a.actor_name || 'Someone'} assigned ${a.new_value?.name || 'a team member'}`,
  },
  reassigned: {
    icon: RefreshCw,
    label: (a) => `${a.actor_name || 'Someone'} reassigned from ${a.old_value?.name || 'unassigned'} to ${a.new_value?.name || 'someone'}`,
  },
  participant_joined: {
    icon: UserPlus,
    label: (a) => `${a.new_value?.name || 'Someone'} joined the conversation`,
  },
  participant_left: {
    icon: UserMinus,
    label: (a) => `${a.old_value?.name || 'Someone'} left the conversation`,
  },
  status_changed: {
    icon: Archive,
    label: (a) => {
      const newStatus = a.new_value?.status;
      if (newStatus === 'archived') return `${a.actor_name || 'Someone'} archived this conversation`;
      if (newStatus === 'active') return `${a.actor_name || 'Someone'} unarchived this conversation`;
      return `${a.actor_name || 'Someone'} changed status to ${newStatus}`;
    },
  },
  archived: {
    icon: Archive,
    label: (a) => `${a.actor_name || 'Someone'} archived this conversation`,
  },
  unarchived: {
    icon: ArchiveRestore,
    label: (a) => `${a.actor_name || 'Someone'} unarchived this conversation`,
  },
  created: {
    icon: UserPlus,
    label: (a) => `${a.actor_name || 'Someone'} created this conversation`,
  },
};

export function ConversationActivityFeed({ activities, className }: ConversationActivityFeedProps) {
  if (!activities || activities.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      {activities.map((activity) => {
        const config = activityConfig[activity.activity_type];
        if (!config) return null;

        const Icon = config.icon;
        const label = config.label(activity);

        return (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 py-2"
          >
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 text-xs text-muted-foreground">
              <Icon className="h-3 w-3" />
              <span>{label}</span>
              <span className="opacity-60">
                {format(new Date(activity.created_at), 'h:mm a')}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
