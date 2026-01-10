import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LeadScoreBadge } from "@/components/customers/LeadScoreBadge";
import { DeleteCustomerDialog } from "@/components/customers/DeleteCustomerDialog";
import { CustomerInvoiceTable } from "@/components/customers/CustomerInvoiceTable";
import { PortalStatusBadge } from "@/components/customers/PortalStatusBadge";
import { PortalInviteHistoryDialog } from "@/components/customers/PortalInviteHistoryDialog";
import { RevokePortalAccessDialog } from "@/components/customers/RevokePortalAccessDialog";
import { QuoteTable } from "@/components/quotes/QuoteTable";
import { JobTable } from "@/components/jobs/JobTable";
import { JobDetailSheet } from "@/components/jobs/JobDetailSheet";
import { JobFormDialog } from "@/components/jobs/JobFormDialog";
import { CustomerPhotoTimeline } from "@/components/photos/CustomerPhotoTimeline";
import { useCustomer, useQualifyLead } from "@/hooks/useCustomers";
import { useQuotes } from "@/hooks/useQuotes";
import { useJobs, type JobWithCustomer } from "@/hooks/useJobs";
import { useInvoices } from "@/hooks/useInvoices";
import { useSingleCustomerPortalStatus } from "@/hooks/useCustomerPortalStatus";
import { useBusinessContext } from "@/hooks/useBusinessContext";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  CheckCircle,
  FileText,
  Briefcase,
  Receipt,
  Mail,
  Phone,
  MapPin,
  Building,
  Calendar,
  Clock,
  Tag,
  Loader2,
  History,
  Send,
  Globe,
  ShieldX,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customer, isLoading } = useCustomer(id);
  const qualifyLead = useQualifyLead();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const { activeBusinessId } = useBusinessContext();
  
  // Fetch related data
  const { data: quotes, isLoading: quotesLoading } = useQuotes({ customerId: id });
  const { data: jobs, isLoading: jobsLoading } = useJobs({ customerId: id });
  const { data: invoices, isLoading: invoicesLoading } = useInvoices({ customerId: id });
  const { data: portalStatus } = useSingleCustomerPortalStatus(id);
  
  // Job interaction state
  const [selectedJob, setSelectedJob] = useState<JobWithCustomer | null>(null);
  const [editJob, setEditJob] = useState<JobWithCustomer | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Customer not found</h2>
          <p className="text-muted-foreground mt-2">
            The customer you're looking for doesn't exist.
          </p>
          <Button asChild className="mt-4">
            <Link to="/customers">Back to Customers</Link>
          </Button>
        </div>
      </div>
    );
  }

  const fullAddress = [
    customer.address_line1,
    customer.address_line2,
    customer.city,
    customer.state,
    customer.zip,
  ]
    .filter(Boolean)
    .join(", ");

  const DAYS_MAP: Record<string, string> = {
    monday: "Mon",
    tuesday: "Tue",
    wednesday: "Wed",
    thursday: "Thu",
    friday: "Fri",
    saturday: "Sat",
    sunday: "Sun",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/customers">Customers</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {customer.first_name} {customer.last_name}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild className="mt-1">
            <Link to="/customers">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {customer.first_name} {customer.last_name}
              </h1>
              <LeadScoreBadge
                score={customer.lead_score ?? 0}
                status={customer.lead_status ?? undefined}
              />
            </div>
            {customer.company_name && (
              <p className="text-muted-foreground flex items-center gap-1.5 mt-1">
                <Building className="h-4 w-4" />
                {customer.company_name}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {customer.lead_status !== "qualified" &&
            customer.lead_status !== "converted" && (
              <Button
                variant="outline"
                onClick={() => qualifyLead.mutate(customer.id)}
                disabled={qualifyLead.isPending}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Qualify Lead
              </Button>
            )}
          <Button variant="outline" asChild>
            <Link to={`/customers/${customer.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to={`/quotes/new?customer=${customer.id}`}>
            <FileText className="mr-2 h-4 w-4" />
            Create Quote
          </Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link to={`/jobs/new?customer=${customer.id}`}>
            <Briefcase className="mr-2 h-4 w-4" />
            Create Job
          </Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link to={`/invoices/new?customer=${customer.id}`}>
            <Receipt className="mr-2 h-4 w-4" />
            Create Invoice
          </Link>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="quotes">
            Quotes {quotes?.length ? `(${quotes.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="jobs">
            Jobs {jobs?.length ? `(${jobs.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="invoices">
            Invoices {invoices?.length ? `(${invoices.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="photos">
            Photos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Activity Summary */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Activity Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{quotes?.length ?? 0}</p>
                    <p className="text-sm text-muted-foreground">Quotes</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{jobs?.length ?? 0}</p>
                    <p className="text-sm text-muted-foreground">Jobs</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{invoices?.length ?? 0}</p>
                    <p className="text-sm text-muted-foreground">Invoices</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {customer.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`mailto:${customer.email}`}
                      className="text-primary hover:underline"
                    >
                      {customer.email}
                    </a>
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`tel:${customer.phone}`}
                      className="text-primary hover:underline"
                    >
                      {customer.phone}
                    </a>
                  </div>
                )}
                {fullAddress && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span>{fullAddress}</span>
                  </div>
                )}
                {!customer.email && !customer.phone && !fullAddress && (
                  <p className="text-muted-foreground text-sm">
                    No contact information provided
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="capitalize">
                    Prefers{" "}
                    {customer.preferred_contact_method || "email"} contact
                  </span>
                </div>
                {customer.preferred_schedule_days &&
                  customer.preferred_schedule_days.length > 0 && (
                    <div className="flex items-start gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="flex flex-wrap gap-1">
                        {customer.preferred_schedule_days.map((day) => (
                          <Badge key={day} variant="secondary">
                            {DAYS_MAP[day] || day}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                {customer.preferred_schedule_time && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="capitalize">
                      {customer.preferred_schedule_time}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Status</span>
                    <div className="mt-1">
                      <Badge variant="outline" className="capitalize">
                        {customer.lead_status || "new"}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Lead Score</span>
                    <div className="mt-1 font-medium">
                      {customer.lead_score ?? 0}/100
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Source</span>
                    <div className="mt-1 capitalize">
                      {customer.source || "—"}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created</span>
                    <div className="mt-1">
                      {format(new Date(customer.created_at), "MMM d, yyyy")}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tags */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                {customer.tags && customer.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {customer.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No tags added</p>
                )}
              </CardContent>
            </Card>

            {/* Portal Access */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Portal Access
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <PortalStatusBadge
                    hasPortalAccess={portalStatus?.hasPortalAccess ?? false}
                    pendingInvite={portalStatus?.pendingInvite ?? false}
                  />
                </div>
                {portalStatus?.hasPortalAccess && portalStatus.accountEmail && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Account Email</span>
                    <span className="text-sm font-medium">{portalStatus.accountEmail}</span>
                  </div>
                )}
                {portalStatus?.lastLogin && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Last Login</span>
                    <span className="text-sm">
                      {formatDistanceToNow(new Date(portalStatus.lastLogin), { addSuffix: true })}
                    </span>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setHistoryDialogOpen(true)}
                  >
                    <History className="mr-2 h-3.5 w-3.5" />
                    History
                  </Button>
                  {portalStatus?.hasPortalAccess ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-destructive hover:text-destructive"
                      onClick={() => setRevokeDialogOpen(true)}
                    >
                      <ShieldX className="mr-2 h-3.5 w-3.5" />
                      Revoke
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setHistoryDialogOpen(true)}
                      disabled={!customer.email}
                    >
                      <Send className="mr-2 h-3.5 w-3.5" />
                      Invite
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Notes */}
          {customer.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{customer.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="quotes">
          {quotesLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : quotes && quotes.length > 0 ? (
            <QuoteTable quotes={quotes} isLoading={false} />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-1">No quotes yet</h3>
                <p className="text-muted-foreground mb-4 max-w-sm">
                  Create your first quote for this customer.
                </p>
                <Button asChild>
                  <Link to={`/quotes/new?customer=${customer.id}`}>
                    <FileText className="mr-2 h-4 w-4" />
                    Create Quote
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="jobs">
          {jobsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : jobs && jobs.length > 0 ? (
            <JobTable
              jobs={jobs}
              onViewJob={(job) => setSelectedJob(job)}
              onEditJob={(job) => setEditJob(job)}
            />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-1">No jobs yet</h3>
                <p className="text-muted-foreground mb-4 max-w-sm">
                  Schedule your first job for this customer.
                </p>
                <Button asChild>
                  <Link to={`/jobs/new?customer=${customer.id}`}>
                    <Briefcase className="mr-2 h-4 w-4" />
                    Create Job
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="invoices">
          {invoicesLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : invoices && invoices.length > 0 ? (
            <CustomerInvoiceTable invoices={invoices} />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-1">No invoices yet</h3>
                <p className="text-muted-foreground mb-4 max-w-sm">
                  Create your first invoice for this customer.
                </p>
                <Button asChild>
                  <Link to={`/invoices/new?customer=${customer.id}`}>
                    <Receipt className="mr-2 h-4 w-4" />
                    Create Invoice
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="photos">
          <CustomerPhotoTimeline customerId={customer.id} />
        </TabsContent>
      </Tabs>

      {/* Delete Dialog */}
      <DeleteCustomerDialog
        customerId={customer.id}
        customerName={`${customer.first_name} ${customer.last_name}`}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={() => navigate("/customers")}
      />

      {/* Job Detail Sheet */}
      <JobDetailSheet
        job={selectedJob}
        open={!!selectedJob}
        onOpenChange={(open) => !open && setSelectedJob(null)}
        onEdit={(job) => {
          setSelectedJob(null);
          setEditJob(job);
        }}
      />

      {/* Job Edit Dialog */}
      <JobFormDialog
        job={editJob}
        open={!!editJob}
        onOpenChange={(open) => !open && setEditJob(null)}
      />

      {/* Portal History Dialog */}
      <PortalInviteHistoryDialog
        customerId={customer.id}
        customerName={`${customer.first_name} ${customer.last_name}`}
        customerEmail={customer.email}
        businessId={activeBusinessId || ""}
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
      />

      {/* Revoke Portal Access Dialog */}
      <RevokePortalAccessDialog
        customerId={customer.id}
        customerName={`${customer.first_name} ${customer.last_name}`}
        businessId={activeBusinessId || ""}
        open={revokeDialogOpen}
        onOpenChange={setRevokeDialogOpen}
      />
    </div>
  );
}
