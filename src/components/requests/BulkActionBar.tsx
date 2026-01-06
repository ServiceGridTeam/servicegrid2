import { X, CheckCircle, XCircle, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onApprove: () => void;
  onReject: () => void;
  isApproving?: boolean;
}

export function BulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onApprove,
  onReject,
  isApproving,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  const allSelected = selectedCount === totalCount;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-3 bg-background border border-border shadow-lg rounded-lg px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClearSelection}
        >
          <X className="h-4 w-4" />
        </Button>

        <span className="text-sm font-medium">
          {selectedCount} selected
        </span>

        <div className="h-4 w-px bg-border" />

        <Button
          variant="ghost"
          size="sm"
          onClick={allSelected ? onClearSelection : onSelectAll}
          className="gap-1.5"
        >
          <CheckSquare className="h-4 w-4" />
          {allSelected ? "Deselect All" : "Select All"}
        </Button>

        <div className="h-4 w-px bg-border" />

        <Button
          size="sm"
          onClick={onApprove}
          disabled={isApproving}
          className="gap-1.5"
        >
          <CheckCircle className="h-4 w-4" />
          Approve Selected
        </Button>

        <Button
          size="sm"
          variant="destructive"
          onClick={onReject}
          disabled={isApproving}
          className="gap-1.5"
        >
          <XCircle className="h-4 w-4" />
          Reject Selected
        </Button>
      </div>
    </div>
  );
}
