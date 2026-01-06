import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { LeadScoreBadge } from "./LeadScoreBadge";
import { DeleteCustomerDialog } from "./DeleteCustomerDialog";
import { SendPortalInviteDialog } from "./SendPortalInviteDialog";
import { Customer, useQualifyLead } from "@/hooks/useCustomers";
import { useBusinessContext } from "@/hooks/useBusinessContext";
import {
  MoreHorizontal,
  Search,
  Eye,
  Pencil,
  Trash2,
  CheckCircle,
  FileText,
  Briefcase,
  Mail,
  Phone,
  ExternalLink,
  Send,
} from "lucide-react";
import { format } from "date-fns";

interface CustomerTableProps {
  customers: Customer[];
  isLoading?: boolean;
  search: string;
  onSearchChange: (search: string) => void;
  status: string;
  onStatusChange: (status: string) => void;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "converted", label: "Converted" },
];

export function CustomerTable({
  customers,
  isLoading,
  search,
  onSearchChange,
  status,
  onStatusChange,
}: CustomerTableProps) {
  const navigate = useNavigate();
  const qualifyLead = useQualifyLead();
  const { activeBusinessId } = useBusinessContext();
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    customer: Customer | null;
  }>({ open: false, customer: null });
  const [inviteDialog, setInviteDialog] = useState<{
    open: boolean;
    customer: Customer | null;
  }>({ open: false, customer: null });

  const handlePreviewPortal = (customerId: string) => {
    const url = `/portal/preview?customerId=${customerId}&businessId=${activeBusinessId}`;
    window.open(url, '_blank');
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "new":
        return <Badge variant="secondary">New</Badge>;
      case "contacted":
        return <Badge variant="outline">Contacted</Badge>;
      case "qualified":
        return <Badge className="bg-green-500 hover:bg-green-600">Qualified</Badge>;
      case "converted":
        return <Badge className="bg-blue-500 hover:bg-blue-600">Converted</Badge>;
      default:
        return <Badge variant="secondary">New</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 flex-1 max-w-sm" />
          <Skeleton className="h-10 w-[180px]" />
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Lead Score</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-5 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Lead Score</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  No customers found.
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow
                  key={customer.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/customers/${customer.id}`)}
                >
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {customer.first_name} {customer.last_name}
                      </div>
                      {customer.company_name && (
                        <div className="text-sm text-muted-foreground">
                          {customer.company_name}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {customer.email && (
                        <div className="flex items-center gap-1.5 text-sm">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="truncate max-w-[180px]">
                            {customer.email}
                          </span>
                        </div>
                      )}
                      {customer.phone && (
                        <div className="flex items-center gap-1.5 text-sm">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          {customer.phone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(customer.lead_status)}</TableCell>
                  <TableCell>
                    <LeadScoreBadge
                      score={customer.lead_score ?? 0}
                      status={customer.lead_status ?? undefined}
                      showScore={false}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(customer.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/customers/${customer.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={`/customers/${customer.id}/edit`}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreviewPortal(customer.id);
                          }}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Preview Portal
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setInviteDialog({ open: true, customer });
                          }}
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Send Portal Invite
                        </DropdownMenuItem>
                        {customer.lead_status !== "qualified" &&
                          customer.lead_status !== "converted" && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                qualifyLead.mutate(customer.id);
                              }}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Qualify Lead
                            </DropdownMenuItem>
                          )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/quotes/new?customer=${customer.id}`);
                          }}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Create Quote
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/jobs/new?customer=${customer.id}`);
                          }}
                        >
                          <Briefcase className="mr-2 h-4 w-4" />
                          Create Job
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteDialog({ open: true, customer });
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Dialog */}
      {deleteDialog.customer && (
        <DeleteCustomerDialog
          customerId={deleteDialog.customer.id}
          customerName={`${deleteDialog.customer.first_name} ${deleteDialog.customer.last_name}`}
          open={deleteDialog.open}
          onOpenChange={(open) =>
            setDeleteDialog({ open, customer: open ? deleteDialog.customer : null })
          }
        />
      )}

      {/* Portal Invite Dialog */}
      {inviteDialog.customer && (
        <SendPortalInviteDialog
          customerId={inviteDialog.customer.id}
          customerName={`${inviteDialog.customer.first_name} ${inviteDialog.customer.last_name}`}
          customerEmail={inviteDialog.customer.email}
          businessId={activeBusinessId || ""}
          open={inviteDialog.open}
          onOpenChange={(open) =>
            setInviteDialog({ open, customer: open ? inviteDialog.customer : null })
          }
        />
      )}
    </div>
  );
}
