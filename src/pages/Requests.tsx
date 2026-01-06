import { useState } from "react";
import { Inbox } from "lucide-react";
import {
  RequestStats,
  RequestFilters,
  RequestCard,
  RequestDetailModal,
  RejectRequestDialog,
} from "@/components/requests";
import { EmptyState } from "@/components/ui/empty-state";
import {
  useJobRequests,
  useJobRequestsRealtime,
  useRejectJobRequest,
  useApproveJobRequest,
  JobRequest,
  JobRequestFilters,
} from "@/hooks/useJobRequests";

export default function Requests() {
  const [filters, setFilters] = useState<JobRequestFilters>({});
  const [selectedRequest, setSelectedRequest] = useState<JobRequest | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [requestToReject, setRequestToReject] = useState<string | null>(null);

  const { data: requests, isLoading } = useJobRequests(filters);
  const rejectRequest = useRejectJobRequest();
  const approveRequest = useApproveJobRequest();

  // Subscribe to realtime updates
  useJobRequestsRealtime();

  const handleViewDetails = (request: JobRequest) => {
    setSelectedRequest(request);
    setDetailModalOpen(true);
  };

  const handleApprove = (requestId: string) => {
    approveRequest.mutate({ requestId, convertToJob: false });
  };

  const handleScheduleApprove = (request: JobRequest) => {
    setSelectedRequest(request);
    setDetailModalOpen(true);
    // The modal will handle showing the schedule section
  };

  const handleRejectClick = (requestId: string) => {
    setRequestToReject(requestId);
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = (reason: string) => {
    if (requestToReject) {
      rejectRequest.mutate(
        { requestId: requestToReject, reason },
        {
          onSuccess: () => {
            setRejectDialogOpen(false);
            setRequestToReject(null);
            if (detailModalOpen) {
              setDetailModalOpen(false);
            }
          },
        }
      );
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Requests</h1>
          <p className="text-muted-foreground">
            Manage incoming job requests from phone, web, and walk-in sources
          </p>
        </div>
      </div>

      {/* Stats */}
      <RequestStats />

      {/* Filters */}
      <RequestFilters filters={filters} onFiltersChange={setFilters} />

      {/* Request List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 rounded-lg border border-border/50 bg-muted/30 animate-pulse"
            />
          ))}
        </div>
      ) : requests && requests.length > 0 ? (
        <div className="space-y-3">
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              onApprove={() => handleApprove(request.id)}
              onScheduleApprove={() => handleScheduleApprove(request)}
              onViewDetails={() => handleViewDetails(request)}
              onReject={() => handleRejectClick(request.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Inbox}
          title="No requests found"
          description={
            filters.status || filters.source || filters.urgency || filters.search
              ? "Try adjusting your filters to find what you're looking for"
              : "Job requests from phone calls, web forms, and walk-ins will appear here"
          }
        />
      )}

      {/* Detail Modal */}
      <RequestDetailModal
        request={selectedRequest}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        onReject={() => {
          if (selectedRequest) {
            handleRejectClick(selectedRequest.id);
          }
        }}
      />

      {/* Reject Dialog */}
      <RejectRequestDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        onConfirm={handleRejectConfirm}
        isLoading={rejectRequest.isPending}
      />
    </div>
  );
}
