import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MoreHorizontal, Pencil, Trash2, Send, Eye, Copy } from "lucide-react";
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
import { QuoteStatusBadge } from "./QuoteStatusBadge";
import { DeleteQuoteDialog } from "./DeleteQuoteDialog";
import { SendQuoteDialog } from "./SendQuoteDialog";
import { QuoteWithCustomer, useDuplicateQuote } from "@/hooks/useQuotes";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface QuoteTableProps {
  quotes: QuoteWithCustomer[] | undefined;
  isLoading: boolean;
}

export function QuoteTable({ quotes, isLoading }: QuoteTableProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deleteQuote, setDeleteQuote] = useState<QuoteWithCustomer | null>(null);
  const [sendQuote, setSendQuote] = useState<QuoteWithCustomer | null>(null);
  const duplicateQuote = useDuplicateQuote();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!quotes || quotes.length === 0) {
    return null;
  }

  const getCustomerName = (quote: QuoteWithCustomer) => {
    if (!quote.customer) return "Unknown Customer";
    return `${quote.customer.first_name} ${quote.customer.last_name}`;
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quote #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotes.map((quote) => (
            <TableRow
              key={quote.id}
              className="cursor-pointer"
              onClick={() => navigate(`/quotes/${quote.id}`)}
            >
              <TableCell className="font-medium">{quote.quote_number}</TableCell>
              <TableCell>{getCustomerName(quote)}</TableCell>
              <TableCell className="max-w-[200px] truncate">
                {quote.title || "-"}
              </TableCell>
              <TableCell>
                <QuoteStatusBadge status={quote.status || "draft"} />
              </TableCell>
              <TableCell className="text-right">
                ${(quote.total || 0).toFixed(2)}
              </TableCell>
              <TableCell>
                {format(new Date(quote.created_at), "MMM d, yyyy")}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover">
                    <DropdownMenuItem asChild>
                      <Link
                        to={`/quotes/${quote.id}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        to={`/quotes/${quote.id}/edit`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Link>
                    </DropdownMenuItem>
                    {quote.status === "draft" && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setSendQuote(quote);
                        }}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Send
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateQuote.mutate(quote.id, {
                          onSuccess: (newQuote) => {
                            toast({
                              title: "Quote duplicated",
                              description: `Created ${newQuote.quote_number}`,
                            });
                            navigate(`/quotes/${newQuote.id}/edit`);
                          },
                          onError: () => {
                            toast({
                              title: "Failed to duplicate",
                              description: "Please try again.",
                              variant: "destructive",
                            });
                          },
                        });
                      }}
                      disabled={duplicateQuote.isPending}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      {duplicateQuote.isPending ? "Duplicating..." : "Duplicate"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteQuote(quote);
                      }}
                      className="text-destructive focus:text-destructive"
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

      {deleteQuote && (
        <DeleteQuoteDialog
          open={!!deleteQuote}
          onOpenChange={(open) => !open && setDeleteQuote(null)}
          quoteId={deleteQuote.id}
          quoteNumber={deleteQuote.quote_number}
        />
      )}

      {sendQuote && (
        <SendQuoteDialog
          open={!!sendQuote}
          onOpenChange={(open) => !open && setSendQuote(null)}
          quoteId={sendQuote.id}
          quoteNumber={sendQuote.quote_number}
          customerName={getCustomerName(sendQuote)}
          customerEmail={sendQuote.customer?.email}
        />
      )}
    </>
  );
}
