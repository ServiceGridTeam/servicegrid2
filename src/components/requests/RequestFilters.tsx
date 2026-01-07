import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  JobRequestFilters,
  JobRequestStatus,
  JobRequestSource,
  JobRequestUrgency,
} from "@/hooks/useJobRequests";

interface RequestFiltersProps {
  filters: JobRequestFilters;
  onFiltersChange: (filters: JobRequestFilters) => void;
}

export function RequestFilters({ filters, onFiltersChange }: RequestFiltersProps) {
  const hasFilters =
    filters.status || filters.source || filters.urgency || filters.search;

  const handleClearFilters = () => {
    onFiltersChange({});
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search requests..."
          value={filters.search || ""}
          onChange={(e) =>
            onFiltersChange({ ...filters, search: e.target.value || undefined })
          }
          className="pl-9"
        />
      </div>

      <Select
        value={filters.status as string || "all"}
        onValueChange={(value) =>
          onFiltersChange({
            ...filters,
            status: value === "all" ? undefined : (value as JobRequestStatus),
          })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="reviewing">Reviewing</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
          <SelectItem value="converted">Converted</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.source || "all"}
        onValueChange={(value) =>
          onFiltersChange({
            ...filters,
            source: value === "all" ? undefined : (value as JobRequestSource),
          })
        }
      >
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="Source" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Sources</SelectItem>
          <SelectItem value="phone">Phone</SelectItem>
          <SelectItem value="email">Email</SelectItem>
          <SelectItem value="web">Web</SelectItem>
          <SelectItem value="walk-in">Walk-in</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.urgency || "all"}
        onValueChange={(value) =>
          onFiltersChange({
            ...filters,
            urgency: value === "all" ? undefined : (value as JobRequestUrgency),
          })
        }
      >
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="Urgency" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Urgency</SelectItem>
          <SelectItem value="routine">Routine</SelectItem>
          <SelectItem value="soon">Soon</SelectItem>
          <SelectItem value="urgent">Urgent</SelectItem>
          <SelectItem value="emergency">Emergency</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearFilters}
          className="text-muted-foreground"
        >
          <X className="mr-1 h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
