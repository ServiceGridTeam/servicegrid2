import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ScanStatus = 'pending' | 'clean' | 'rejected' | 'timeout';

export interface ScanResult {
  status: ScanStatus;
  publicUrl?: string;
  rejectionReason?: string;
  dimensions?: { width: number; height: number };
}

const SCAN_TIMEOUT_MS = 30000; // 30 seconds

export function useCustomerUploadScan(uploadId: string | null) {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const checkScanStatus = useCallback(async () => {
    if (!uploadId) return null;

    const { data, error } = await supabase
      .from('customer_media_uploads')
      .select('scan_status, rejection_reason, storage_path, storage_bucket')
      .eq('id', uploadId)
      .single();

    if (error) {
      console.error('Failed to check scan status:', error);
      return null;
    }

    if (data.scan_status === 'clean') {
      const { data: urlData } = supabase.storage
        .from(data.storage_bucket)
        .getPublicUrl(data.storage_path);

      return {
        status: 'clean' as ScanStatus,
        publicUrl: urlData.publicUrl,
      };
    }

    if (data.scan_status === 'rejected') {
      return {
        status: 'rejected' as ScanStatus,
        rejectionReason: data.rejection_reason || 'File rejected during security scan',
      };
    }

    return {
      status: data.scan_status as ScanStatus,
    };
  }, [uploadId]);

  useEffect(() => {
    if (!uploadId) {
      setScanResult(null);
      setIsPolling(false);
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout>;
    let pollIntervalId: ReturnType<typeof setInterval>;
    let mounted = true;

    const startPolling = async () => {
      setIsPolling(true);
      const startTime = Date.now();

      const poll = async () => {
        if (!mounted) return;
        
        // Check for timeout
        if (Date.now() - startTime > SCAN_TIMEOUT_MS) {
          setScanResult({ status: 'timeout' });
          setIsPolling(false);
          return;
        }

        const result = await checkScanStatus();
        if (!mounted) return;

        if (result && result.status !== 'pending') {
          setScanResult(result);
          setIsPolling(false);
          return;
        }

        // Continue polling
        pollIntervalId = setTimeout(poll, 1000); // Poll every second
      };

      poll();
    };

    startPolling();

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (pollIntervalId) clearTimeout(pollIntervalId);
    };
  }, [uploadId, checkScanStatus]);

  const reset = useCallback(() => {
    setScanResult(null);
    setIsPolling(false);
  }, []);

  return {
    scanResult,
    isPolling,
    reset,
  };
}
