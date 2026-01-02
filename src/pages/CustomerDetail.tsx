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
import { Separator } from "@/components/ui/separator";
import { LeadScoreBadge } from "@/components/customers/LeadScoreBadge";
import { DeleteCustomerDialog } from "@/components/customers/DeleteCustomerDialog";
import { useCustomer, useQualifyLead } from "@/hooks/useCustomers";
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
} from "lucide-react";
import { format } from "date-fns";

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customer, isLoading } = useCustomer(id);
  const qualifyLead = useQualifyLead();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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
          <TabsTrigger value="quotes">Quotes</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
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
        </TabsContent>

        <TabsContent value="jobs">
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
        </TabsContent>

        <TabsContent value="invoices">
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
    </div>
  );
}
