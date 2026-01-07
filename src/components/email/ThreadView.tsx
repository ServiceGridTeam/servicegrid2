import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClassificationBadge, ConfidenceBar } from "./ClassificationBadge";
import { InboundEmail } from "@/hooks/useInboundEmails";
import {
  User,
  MapPin,
  Phone,
  Wrench,
  AlertTriangle,
  Mail,
  ArrowRight,
  RefreshCw,
  Ban,
  CheckCircle2,
  Loader2,
} from "lucide-react";

interface ThreadViewProps {
  email: InboundEmail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConvertToRequest: () => void;
  onReclassify: () => void;
  onMarkAsSpam: () => void;
  isReclassifying?: boolean;
}

export function ThreadView({
  email,
  open,
  onOpenChange,
  onConvertToRequest,
  onReclassify,
  onMarkAsSpam,
  isReclassifying = false,
}: ThreadViewProps) {
  if (!email) return null;

  const extractedData = email.ai_extracted_data || {};
  const hasExtractedData = Object.keys(extractedData).length > 0;
  const isServiceRequest = email.classification === "service_request";
  const canConvert = isServiceRequest && email.status !== "request_created";

  const renderClassificationStage = () => {
    const stage = email.classification_stage;
    if (stage === "complete" || stage === "failed") return null;

    const stageLabels: Record<string, string> = {
      pending: "Waiting to classify...",
      analyzing: "Analyzing email content...",
      reading: "Reading email details...",
      extracting: "Extracting information...",
    };

    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded-md">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{stageLabels[stage] || "Processing..."}</span>
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg truncate">
                {email.subject || "(No subject)"}
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2 mt-1">
                <span className="font-medium text-foreground">
                  {email.from_name || email.from_address}
                </span>
                {email.from_name && (
                  <span className="text-muted-foreground">
                    &lt;{email.from_address}&gt;
                  </span>
                )}
              </SheetDescription>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs text-muted-foreground">
                {format(new Date(email.received_at), "MMM d, h:mm a")}
              </span>
              {email.classification && (
                <ClassificationBadge classification={email.classification} />
              )}
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Classification Progress */}
            {renderClassificationStage()}

            {/* Confidence & Status */}
            {email.classification && email.classification_confidence !== null && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Classification Confidence</span>
                  <span className="font-medium">{Math.round(email.classification_confidence * 100)}%</span>
                </div>
                <ConfidenceBar confidence={email.classification_confidence} />
                {email.classification_tier && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Classified by:</span>
                    <Badge variant="outline" className="text-xs">
                      {email.classification_tier === "ai" ? "AI" : email.classification_tier === "rules" ? "Rules" : "Keywords"}
                    </Badge>
                  </div>
                )}
              </div>
            )}

            {/* Extracted Data */}
            {hasExtractedData && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Extracted Information</h3>
                  <div className="grid gap-3">
                    {extractedData.customer_name && (
                      <div className="flex items-start gap-3">
                        <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Customer</p>
                          <p className="text-sm">{extractedData.customer_name}</p>
                        </div>
                      </div>
                    )}
                    {extractedData.phone && (
                      <div className="flex items-start gap-3">
                        <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Phone</p>
                          <p className="text-sm">{extractedData.phone}</p>
                        </div>
                      </div>
                    )}
                    {extractedData.address && (
                      <div className="flex items-start gap-3">
                        <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Address</p>
                          <p className="text-sm">{extractedData.address}</p>
                        </div>
                      </div>
                    )}
                    {extractedData.service_type && (
                      <div className="flex items-start gap-3">
                        <Wrench className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Service Type</p>
                          <p className="text-sm">{extractedData.service_type}</p>
                        </div>
                      </div>
                    )}
                    {extractedData.urgency && (
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Urgency</p>
                          <p className="text-sm capitalize">{extractedData.urgency}</p>
                        </div>
                      </div>
                    )}
                    {extractedData.issue_description && (
                      <div className="flex items-start gap-3">
                        <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-xs text-muted-foreground">Issue Description</p>
                          <p className="text-sm">{extractedData.issue_description}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Request Created Status */}
            {email.status === "request_created" && email.job_request_id && (
              <>
                <Separator />
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-700 dark:text-green-400">
                    Job request created from this email
                  </span>
                </div>
              </>
            )}

            {/* Email Body */}
            <Separator />
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Email Content</h3>
              <div className="rounded-lg border bg-muted/30 p-4">
                {email.body_html ? (
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: email.body_html }}
                  />
                ) : email.body_text ? (
                  <pre className="whitespace-pre-wrap font-sans text-sm">
                    {email.body_text}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No content</p>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Actions Footer */}
        <div className="border-t p-4 flex flex-wrap gap-2">
          {canConvert && (
            <Button onClick={onConvertToRequest} className="gap-2">
              <ArrowRight className="h-4 w-4" />
              Convert to Request
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onReclassify}
            disabled={isReclassifying}
            className="gap-2"
          >
            {isReclassifying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Reclassify
          </Button>
          {email.status !== "spam" && (
            <Button
              variant="ghost"
              onClick={onMarkAsSpam}
              className="gap-2 text-destructive hover:text-destructive"
            >
              <Ban className="h-4 w-4" />
              Mark as Spam
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
