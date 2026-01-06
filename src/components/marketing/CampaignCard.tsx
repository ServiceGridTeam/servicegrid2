import { formatDistanceToNow, format } from "date-fns";
import {
  MoreHorizontal,
  Send,
  Copy,
  Trash2,
  BarChart3,
  Edit,
  XCircle,
  Clock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Database } from "@/integrations/supabase/types";

type Campaign = Database["public"]["Tables"]["campaigns"]["Row"] & {
  template?: { id: string; name: string; subject: string } | null;
  segment?: { id: string; name: string } | null;
};

interface CampaignCardProps {
  campaign: Campaign;
  onSend?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
  onCancel?: (id: string) => void;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", variant: "outline" },
  scheduled: { label: "Scheduled", variant: "secondary" },
  sending: { label: "Sending", variant: "default" },
  sent: { label: "Sent", variant: "default" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

export function CampaignCard({
  campaign,
  onSend,
  onDuplicate,
  onDelete,
  onCancel,
}: CampaignCardProps) {
  const navigate = useNavigate();
  const status = statusConfig[campaign.status] || statusConfig.draft;

  const openRate = campaign.sent_count && campaign.sent_count > 0
    ? Math.round(((campaign.opened_count || 0) / campaign.sent_count) * 100)
    : 0;

  const clickRate = campaign.sent_count && campaign.sent_count > 0
    ? Math.round(((campaign.clicked_count || 0) / campaign.sent_count) * 100)
    : 0;

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{campaign.name}</h3>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate">{campaign.subject}</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {campaign.status === "draft" && (
                <>
                  <DropdownMenuItem onClick={() => navigate(`/marketing/campaigns/${campaign.id}`)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSend?.(campaign.id)}>
                    <Send className="h-4 w-4 mr-2" />
                    Send Now
                  </DropdownMenuItem>
                </>
              )}
              {campaign.status === "scheduled" && (
                <DropdownMenuItem onClick={() => onCancel?.(campaign.id)}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel Schedule
                </DropdownMenuItem>
              )}
              {campaign.status === "sent" && (
                <DropdownMenuItem onClick={() => navigate(`/marketing/campaigns/${campaign.id}/report`)}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Report
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onDuplicate?.(campaign.id)}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete?.(campaign.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Template Info */}
        {campaign.template && (
          <div className="text-sm text-muted-foreground">
            Template: {campaign.template.name}
          </div>
        )}

        {/* Segment Info */}
        {campaign.segment && (
          <div className="text-sm text-muted-foreground">
            Audience: {campaign.segment.name}
          </div>
        )}

        {/* Status-specific info */}
        {campaign.status === "scheduled" && campaign.scheduled_at && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Scheduled for {format(new Date(campaign.scheduled_at), "MMM d, yyyy 'at' h:mm a")}
          </div>
        )}

        {campaign.status === "sent" && campaign.sent_at && (
          <div className="text-sm text-muted-foreground">
            Sent {formatDistanceToNow(new Date(campaign.sent_at), { addSuffix: true })}
          </div>
        )}

        {/* Metrics for sent campaigns */}
        {campaign.status === "sent" && (
          <div className="flex items-center gap-4 pt-2 border-t">
            <div className="text-center">
              <div className="text-lg font-semibold">{campaign.sent_count || 0}</div>
              <div className="text-xs text-muted-foreground">Sent</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">{openRate}%</div>
              <div className="text-xs text-muted-foreground">Opened</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">{clickRate}%</div>
              <div className="text-xs text-muted-foreground">Clicked</div>
            </div>
          </div>
        )}

        {/* Recipients count for drafts */}
        {campaign.status === "draft" && campaign.total_recipients !== null && (
          <div className="text-sm text-muted-foreground">
            {campaign.total_recipients} recipients selected
          </div>
        )}
      </CardContent>
    </Card>
  );
}
