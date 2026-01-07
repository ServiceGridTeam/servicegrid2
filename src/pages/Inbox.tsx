import { useState } from "react";
import { useInboundEmails, useFilteredEmails, useEmailRealtimeUpdates, useUnprocessedEmailCount, useClassifyEmail, useMarkEmailAsSpam, EmailFilters, InboundEmail } from "@/hooks/useInboundEmails";
import { EmailRow } from "@/components/email/EmailRow";
import { ThreadView } from "@/components/email/ThreadView";
import { RequestPreviewModal } from "@/components/email/RequestPreviewModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Search, Mail, RefreshCw, Settings, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useTriggerEmailSync } from "@/hooks/useEmailConnections";

export default function Inbox() {
  const [filters, setFilters] = useState<EmailFilters>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<InboundEmail | null>(null);
  const [showRequestPreview, setShowRequestPreview] = useState(false);
  
  const { data: emails, isLoading } = useInboundEmails(filters);
  const { data: unprocessedCount } = useUnprocessedEmailCount();
  const filteredEmails = useFilteredEmails(emails || [], searchTerm);
  const classifyEmail = useClassifyEmail();
  const { markAsSpam } = useMarkEmailAsSpam();
  const triggerSync = useTriggerEmailSync();
  
  // Subscribe to realtime updates
  useEmailRealtimeUpdates();

  const hasFilters = filters.classification || filters.status || searchTerm;

  const handleClearFilters = () => {
    setFilters({});
    setSearchTerm("");
  };

  const handleReclassify = (emailId: string) => {
    classifyEmail.mutate(emailId);
  };

  const handleMarkAsSpam = (emailId: string) => {
    markAsSpam.mutate(emailId);
  };

  const handleSync = () => {
    triggerSync.mutate(undefined);
  };

  const handleViewEmail = (email: InboundEmail) => {
    setSelectedEmail(email);
  };

  const handleConvertToRequest = () => {
    setShowRequestPreview(true);
  };

  const handleRequestSuccess = () => {
    setShowRequestPreview(false);
    setSelectedEmail(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
            <p className="text-muted-foreground">Review and process incoming emails</p>
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
            {unprocessedCount && unprocessedCount > 0 && (
              <Badge variant="secondary">{unprocessedCount} unprocessed</Badge>
            )}
          </div>
          <p className="text-muted-foreground">Review and process incoming emails</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleSync}
            disabled={triggerSync.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${triggerSync.isPending ? "animate-spin" : ""}`} />
            Sync
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/settings?tab=integrations">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search emails..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={filters.classification || "all"}
          onValueChange={(value) =>
            setFilters({
              ...filters,
              classification: value === "all" ? undefined : value as EmailFilters["classification"],
            })
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Classification" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="service_request">Service Request</SelectItem>
            <SelectItem value="inquiry">Inquiry</SelectItem>
            <SelectItem value="spam">Spam</SelectItem>
            <SelectItem value="out_of_scope">Out of Scope</SelectItem>
            <SelectItem value="unclassified">Unclassified</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.status || "all"}
          onValueChange={(value) =>
            setFilters({
              ...filters,
              status: value === "all" ? undefined : value as EmailFilters["status"],
            })
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="processed">Processed</SelectItem>
            <SelectItem value="request_created">Converted</SelectItem>
            <SelectItem value="ignored">Ignored</SelectItem>
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

      {/* Email List */}
      {filteredEmails.length === 0 ? (
        <EmptyState
          icon={Mail}
          title={hasFilters ? "No emails match your filters" : "No emails yet"}
          description={
            hasFilters
              ? "Try adjusting your filters or search term"
              : "Connect your email account in Settings to start receiving emails"
          }
          action={
            !hasFilters
              ? { label: "Connect Email", href: "/settings?tab=integrations" }
              : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {filteredEmails.map((email) => (
            <EmailRow
              key={email.id}
              email={email}
              onSelect={() => handleViewEmail(email)}
              onView={() => handleViewEmail(email)}
              onConvert={() => {
                setSelectedEmail(email);
                setShowRequestPreview(true);
              }}
              onMarkSpam={() => handleMarkAsSpam(email.id)}
              onReclassify={() => handleReclassify(email.id)}
            />
          ))}
        </div>
      )}

      {/* Thread View Sheet */}
      <ThreadView
        email={selectedEmail}
        open={!!selectedEmail && !showRequestPreview}
        onOpenChange={(open) => !open && setSelectedEmail(null)}
        onConvertToRequest={handleConvertToRequest}
        onReclassify={() => selectedEmail && handleReclassify(selectedEmail.id)}
        onMarkAsSpam={() => {
          if (selectedEmail) {
            handleMarkAsSpam(selectedEmail.id);
            setSelectedEmail(null);
          }
        }}
        isReclassifying={classifyEmail.isPending}
      />

      {/* Request Preview Modal */}
      <RequestPreviewModal
        email={selectedEmail}
        open={showRequestPreview}
        onOpenChange={setShowRequestPreview}
        onSuccess={handleRequestSuccess}
      />
    </div>
  );
}
