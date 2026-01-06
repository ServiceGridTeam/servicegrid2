import { useState, useMemo } from "react";
import { Inbox, CalendarClock } from "lucide-react";
import {
  RequestStats,
  RequestFilters,
  RequestCard,
  RequestDetailModal,
  RejectRequestDialog,
  ModificationRequestCard,
  ModificationApprovalDialog,
  ModificationRejectDialog,
  ModificationFilters,
  BulkActionBar,
  BulkRejectDialog,
} from "@/components/requests";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  useJobRequests,
  useJobRequestsRealtime,
  useRejectJobRequest,
  useApproveJobRequest,
  useBulkApproveRequests,
  useBulkRejectRequests,
  JobRequest,
  JobRequestFilters,
} from "@/hooks/useJobRequests";
import {
  useJobModificationRequests,
  usePendingModificationsCount,
  useApproveModification,
  useRejectModification,
  JobModificationRequest,
  ModificationRequestFilters,
} from "@/hooks/useJobModificationRequests";

export default function Requests() {
  // Job request state
  const [filters, setFilters] = useState<JobRequestFilters>({});
  const [selectedRequest, setSelectedRequest] = useState<JobRequest | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [requestToReject, setRequestToReject] = useState<string | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);

  // Modification request state
  const [modFilters, setModFilters] = useState<ModificationRequestFilters>({});
  const [selectedModification, setSelectedModification] = useState<JobModificationRequest | null>(null);
  const [modApprovalOpen, setModApprovalOpen] = useState(false);
  const [modRejectOpen, setModRejectOpen] = useState(false);

  // Job request queries
  const { data: requests, isLoading } = useJobRequests(filters);
  const rejectRequest = useRejectJobRequest();
  const approveRequest = useApproveJobRequest();
  const bulkApprove = useBulkApproveRequests();
  const bulkReject = useBulkRejectRequests();

  // Modification request queries
  const { data: modifications, isLoading: modLoading } = useJobModificationRequests(modFilters);
  const { data: pendingModCount } = usePendingModificationsCount();
  const approveModification = useApproveModification();
  const rejectModification = useRejectModification();

  // Subscribe to realtime updates
  useJobRequestsRealtime();

  // Get pending requests for bulk selection
  const pendingRequests = useMemo(
    () => requests?.filter((r) => r.status === "pending" || r.status === "reviewing") || [],
    [requests]
  );

  // Selection handlers
  const toggleSelection = (id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(pendingRequests.map((r) => r.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Bulk action handlers
  const handleBulkApprove = () => {
    const ids = Array.from(selectedIds);
    bulkApprove.mutate(ids, {
      onSuccess: () => clearSelection(),
    });
  };

  const handleBulkRejectClick = () => {
    setBulkRejectOpen(true);
  };

  const handleBulkRejectConfirm = (reason: string) => {
    const ids = Array.from(selectedIds);
    bulkReject.mutate(
      { requestIds: ids, reason },
      {
        onSuccess: () => {
          clearSelection();
          setBulkRejectOpen(false);
        },
      }
    );
  };

  // Job request handlers
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

  // Modification request handlers
  const handleModApprove = (modification: JobModificationRequest) => {
    setSelectedModification(modification);
    setModApprovalOpen(true);
  };

  const handleModReject = (modification: JobModificationRequest) => {
    setSelectedModification(modification);
    setModRejectOpen(true);
  };

  const handleModApprovalConfirm = (newScheduledStart?: string, newScheduledEnd?: string) => {
    if (selectedModification) {
      approveModification.mutate(
        {
          requestId: selectedModification.id,
          newScheduledStart,
          newScheduledEnd,
        },
        {
          onSuccess: () => {
            setModApprovalOpen(false);
            setSelectedModification(null);
          },
        }
      );
    }
  };

  const handleModRejectConfirm = (reason?: string) => {
    if (selectedModification) {
      rejectModification.mutate(
        { requestId: selectedModification.id, reason },
        {
          onSuccess: () => {
            setModRejectOpen(false);
            setSelectedModification(null);
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
            Manage incoming job requests and modification requests
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="job-requests" className="space-y-4">
        <TabsList>
          <TabsTrigger value="job-requests" className="gap-2">
            <Inbox className="h-4 w-4" />
            Job Requests
          </TabsTrigger>
          <TabsTrigger value="modifications" className="gap-2">
            <CalendarClock className="h-4 w-4" />
            Modifications
            {pendingModCount && pendingModCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1 text-xs">
                {pendingModCount > 99 ? "99+" : pendingModCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Job Requests Tab */}
        <TabsContent value="job-requests" className="space-y-4">
          <RequestStats />
          <RequestFilters filters={filters} onFiltersChange={setFilters} />

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
                  selectable={pendingRequests.length > 0}
                  selected={selectedIds.has(request.id)}
                  onSelectionChange={(selected) => toggleSelection(request.id, selected)}
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
        </TabsContent>

        {/* Modifications Tab */}
        <TabsContent value="modifications" className="space-y-4">
          <ModificationFilters filters={modFilters} onFiltersChange={setModFilters} />

          {modLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-32 rounded-lg border border-border/50 bg-muted/30 animate-pulse"
                />
              ))}
            </div>
          ) : modifications && modifications.length > 0 ? (
            <div className="space-y-3">
              {modifications.map((modification) => (
                <ModificationRequestCard
                  key={modification.id}
                  request={modification}
                  onApprove={() => handleModApprove(modification)}
                  onReject={() => handleModReject(modification)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CalendarClock}
              title="No modification requests"
              description={
                modFilters.status || modFilters.modification_type
                  ? "Try adjusting your filters to find what you're looking for"
                  : "Customer reschedule and cancellation requests will appear here"
              }
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalCount={pendingRequests.length}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        onApprove={handleBulkApprove}
        onReject={handleBulkRejectClick}
        isApproving={bulkApprove.isPending}
      />

      {/* Bulk Reject Dialog */}
      <BulkRejectDialog
        open={bulkRejectOpen}
        onOpenChange={setBulkRejectOpen}
        onConfirm={handleBulkRejectConfirm}
        count={selectedIds.size}
        isLoading={bulkReject.isPending}
      />

      {/* Job Request Dialogs */}
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

      <RejectRequestDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        onConfirm={handleRejectConfirm}
        isLoading={rejectRequest.isPending}
      />

      {/* Modification Request Dialogs */}
      <ModificationApprovalDialog
        request={selectedModification}
        open={modApprovalOpen}
        onOpenChange={setModApprovalOpen}
        onConfirm={handleModApprovalConfirm}
        isLoading={approveModification.isPending}
      />

      <ModificationRejectDialog
        open={modRejectOpen}
        onOpenChange={setModRejectOpen}
        onConfirm={handleModRejectConfirm}
        isLoading={rejectModification.isPending}
        modificationType={selectedModification?.modification_type}
      />
    </div>
  );
}
