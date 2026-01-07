import { formatDistanceToNow } from "date-fns";
import { Mail, MoreHorizontal, ArrowRight, Trash2, Eye, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ClassificationBadge, ConfidenceBar } from "./ClassificationBadge";
import { cn } from "@/lib/utils";
import type { InboundEmail } from "@/hooks/useInboundEmails";

interface EmailRowProps {
  email: InboundEmail;
  isSelected?: boolean;
  onSelect?: () => void;
  onView?: () => void;
  onConvert?: () => void;
  onMarkSpam?: () => void;
  onReclassify?: () => void;
}

export function EmailRow({
  email,
  isSelected,
  onSelect,
  onView,
  onConvert,
  onMarkSpam,
  onReclassify,
}: EmailRowProps) {
  const isNew = email.status === "new" || email.status === "processing";
  const hasRequest = !!email.job_request_id;

  // Truncate body for preview
  const bodyPreview = email.body_text?.slice(0, 150).replace(/\s+/g, " ").trim() || "";

  return (
    <div
      className={cn(
        "group flex items-start gap-4 p-4 border-b transition-colors hover:bg-muted/50 cursor-pointer",
        isSelected && "bg-muted/50",
        isNew && "bg-primary/5"
      )}
      onClick={onView}
    >
      {/* Sender info */}
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
          <Mail className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>

      {/* Email content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className={cn("font-medium truncate", isNew && "font-semibold")}>
            {email.from_name || email.from_address}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(email.received_at), { addSuffix: true })}
          </span>
        </div>

        <div className={cn("text-sm truncate", isNew ? "text-foreground" : "text-muted-foreground")}>
          {email.subject || "(No subject)"}
        </div>

        <div className="text-xs text-muted-foreground truncate">
          {bodyPreview}...
        </div>

        {/* Extracted entities preview */}
        {email.ai_extracted_data && Object.keys(email.ai_extracted_data).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {email.ai_extracted_data.service_type && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                {email.ai_extracted_data.service_type}
              </span>
            )}
            {email.ai_extracted_data.urgency && email.ai_extracted_data.urgency !== "normal" && (
              <span className={cn(
                "inline-flex items-center px-2 py-0.5 rounded text-xs",
                email.ai_extracted_data.urgency === "emergency" && "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
                email.ai_extracted_data.urgency === "high" && "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100"
              )}>
                {email.ai_extracted_data.urgency}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Classification & Actions */}
      <div className="flex-shrink-0 flex flex-col items-end gap-2">
        <ClassificationBadge
          classification={email.classification}
          confidence={email.classification_confidence}
          tier={email.classification_tier}
          stage={email.classification_stage}
          showTier
          size="sm"
        />

        {email.classification_confidence !== null && (
          <ConfidenceBar 
            confidence={email.classification_confidence} 
            className="w-24"
          />
        )}

        {hasRequest && (
          <span className="text-xs text-green-600 flex items-center gap-1">
            <ArrowRight className="h-3 w-3" />
            Request created
          </span>
        )}
      </div>

      {/* Actions dropdown */}
      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView?.(); }}>
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
            {!hasRequest && email.classification === "service_request" && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onConvert?.(); }}>
                <ArrowRight className="h-4 w-4 mr-2" />
                Convert to Request
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onReclassify?.(); }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reclassify
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); onMarkSpam?.(); }}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Mark as Spam
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
