/**
 * Photo Watcher Hook - Realtime monitoring for photo changes during editing
 * Part 3 of Field Photo Documentation System
 */

import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface PhotoWatcherCallbacks {
  onDeleted?: () => void;
  onUpdated?: (payload: PhotoUpdatePayload) => void;
  onPermissionRevoked?: () => void;
}

interface PhotoUpdatePayload {
  id: string;
  status?: string;
  deleted_at?: string | null;
  is_visible?: boolean;
}

/**
 * Watch for realtime changes to a photo during editing
 * Handles deletion, status changes, and permission revocation
 */
export function usePhotoWatcher(
  mediaId: string | undefined,
  callbacks: PhotoWatcherCallbacks = {}
) {
  const { onDeleted, onUpdated, onPermissionRevoked } = callbacks;
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!mediaId) return;

    // Subscribe to realtime changes on this specific photo
    const channel = supabase
      .channel(`photo-watcher-${mediaId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'job_media',
          filter: `id=eq.${mediaId}`,
        },
        (payload) => {
          const newRecord = payload.new as PhotoUpdatePayload;

          // Check if photo was soft-deleted
          if (newRecord.deleted_at) {
            onDeleted?.();
            return;
          }

          // Check if visibility was revoked
          if (newRecord.is_visible === false) {
            onPermissionRevoked?.();
            return;
          }

          // General update callback
          onUpdated?.(newRecord);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'job_media',
          filter: `id=eq.${mediaId}`,
        },
        () => {
          onDeleted?.();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [mediaId, onDeleted, onUpdated, onPermissionRevoked]);

  return {
    isWatching: !!channelRef.current,
  };
}

/**
 * Watch for lock changes on a photo
 * Used to detect when another user takes over editing
 */
export function useLockWatcher(
  mediaId: string | undefined,
  callbacks: {
    onLockAcquired?: (lockHolder: string, lockHolderName: string) => void;
    onLockReleased?: () => void;
  } = {}
) {
  const { onLockAcquired, onLockReleased } = callbacks;
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!mediaId) return;

    const channel = supabase
      .channel(`lock-watcher-${mediaId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'annotation_locks',
          filter: `job_media_id=eq.${mediaId}`,
        },
        (payload) => {
          const lock = payload.new as {
            locked_by: string;
            locked_by_name: string;
          };
          onLockAcquired?.(lock.locked_by, lock.locked_by_name);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'annotation_locks',
          filter: `job_media_id=eq.${mediaId}`,
        },
        (payload) => {
          const lock = payload.new as {
            locked_by: string;
            locked_by_name: string;
          };
          onLockAcquired?.(lock.locked_by, lock.locked_by_name);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'annotation_locks',
          filter: `job_media_id=eq.${mediaId}`,
        },
        () => {
          onLockReleased?.();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [mediaId, onLockAcquired, onLockReleased]);

  return {
    isWatching: !!channelRef.current,
  };
}
