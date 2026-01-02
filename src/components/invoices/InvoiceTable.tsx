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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { DeleteInvoiceDialog } from "./DeleteInvoiceDialog";
import { SendInvoiceDialog } from "./SendInvoiceDialog";
import { RecordPaymentDialog } from "./RecordPaymentDialog";
import { useInvoices, type InvoiceWithCustomer } from "@/hooks/useInvoices";
import { format } from "date-fns";
import { MoreHorizontal, Eye, Pencil, Send, CreditCard, Trash2 } from "lucide-react";

interface InvoiceTableProps {
  search?: string;
  status?: string;
}

export function InvoiceTable({ search, status }: InvoiceTableProps) {
  const navigate = useNavigate();
  const { data: invoices, isLoading } = useInvoices({ search, status });
  
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; invoice: InvoiceWithCustomer | null }>({
    open: false,
    invoice: null,
  });
  const [sendDialog, setSendDialog] = useState<{ open: boolean; invoice: InvoiceWithCustomer | null }>({
    open: false,
    invoice: null,
  });
  const [paymentDialog, setPaymentDialog] = useState<{ open: boolean; invoice: InvoiceWithCustomer | null }>({
    open: false,
    invoice: null,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!invoices || invoices.length === 0) {
    return null;
  }

  const getCustomerName = (invoice: InvoiceWithCustomer) => {
    if (!invoice.customer) return "Unknown Customer";
    return `${invoice.customer.first_name} ${invoice.customer.last_name}`;
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow
                key={invoice.id}
                className="cursor-pointer"
                onClick={() => navigate(`/invoices/${invoice.id}`)}
              >
                <TableCell className="font-medium">
                  {invoice.invoice_number}
                </TableCell>
                <TableCell>{getCustomerName(invoice)}</TableCell>
                <TableCell>
                  <InvoiceStatusBadge status={invoice.status || "draft"} />
                </TableCell>
                <TableCell>
                  {invoice.due_date
                    ? format(new Date(invoice.due_date), "MMM d, yyyy")
                    : "-"}
                </TableCell>
                <TableCell className="text-right">
                  ${Number(invoice.total).toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  <span className={Number(invoice.balance_due) > 0 ? "text-destructive" : "text-green-600"}>
                    ${Number(invoice.balance_due).toFixed(2)}
                  </span>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to={`/invoices/${invoice.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to={`/invoices/${invoice.id}/edit`}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      {invoice.status === "draft" && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setSendDialog({ open: true, invoice });
                          }}
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Send
                        </DropdownMenuItem>
                      )}
                      {(invoice.status === "sent" || invoice.status === "overdue") && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setPaymentDialog({ open: true, invoice });
                          }}
                        >
                          <CreditCard className="mr-2 h-4 w-4" />
                          Record Payment
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteDialog({ open: true, invoice });
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {deleteDialog.invoice && (
        <DeleteInvoiceDialog
          open={deleteDialog.open}
          onOpenChange={(open) => setDeleteDialog({ open, invoice: open ? deleteDialog.invoice : null })}
          invoiceId={deleteDialog.invoice.id}
          invoiceNumber={deleteDialog.invoice.invoice_number}
        />
      )}

      {sendDialog.invoice && (
        <SendInvoiceDialog
          open={sendDialog.open}
          onOpenChange={(open) => setSendDialog({ open, invoice: open ? sendDialog.invoice : null })}
          invoiceId={sendDialog.invoice.id}
          invoiceNumber={sendDialog.invoice.invoice_number}
          customerName={getCustomerName(sendDialog.invoice)}
          customerEmail={sendDialog.invoice.customer?.email}
        />
      )}

      {paymentDialog.invoice && (
        <RecordPaymentDialog
          open={paymentDialog.open}
          onOpenChange={(open) => setPaymentDialog({ open, invoice: open ? paymentDialog.invoice : null })}
          invoiceId={paymentDialog.invoice.id}
          invoiceNumber={paymentDialog.invoice.invoice_number}
          balanceDue={Number(paymentDialog.invoice.balance_due)}
        />
      )}
    </>
  );
}
