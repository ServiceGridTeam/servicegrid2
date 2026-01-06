import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { ModificationRequestFilters, ModificationStatus, ModificationType } from "@/hooks/useJobModificationRequests";

interface ModificationFiltersProps {
  filters: ModificationRequestFilters;
  onFiltersChange: (filters: ModificationRequestFilters) => void;
}

export function ModificationFilters({
  filters,
  onFiltersChange,
}: ModificationFiltersProps) {
  const hasFilters = filters.status || filters.modification_type;

  const handleClear = () => {
    onFiltersChange({});
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Select
        value={filters.status as string || "all"}
        onValueChange={(value) =>
          onFiltersChange({
            ...filters,
            status: value === "all" ? undefined : (value as ModificationStatus),
          })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.modification_type || "all"}
        onValueChange={(value) =>
          onFiltersChange({
            ...filters,
            modification_type: value === "all" ? undefined : (value as ModificationType),
          })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="reschedule">Reschedule</SelectItem>
          <SelectItem value="cancel">Cancel</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={handleClear} className="h-9">
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
