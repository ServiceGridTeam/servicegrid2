import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Receipt, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { InvoiceTable } from "@/components/invoices";
import { useInvoices } from "@/hooks/useInvoices";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export default function Invoices() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data: invoices, isLoading } = useInvoices({
    search: debouncedSearch,
    status,
  });

  const hasInvoices = invoices && invoices.length > 0;
  const showEmptyState = !isLoading && !hasInvoices && !debouncedSearch && status === "all";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">
            Create and track customer invoices
          </p>
        </div>
        <Button asChild>
          <Link to="/invoices/new">
            <Plus className="mr-2 h-4 w-4" />
            New Invoice
          </Link>
        </Button>
      </div>

      {!showEmptyState && (
        <>
          <Tabs value={status} onValueChange={setStatus}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="draft">Draft</TabsTrigger>
              <TabsTrigger value="sent">Sent</TabsTrigger>
              <TabsTrigger value="paid">Paid</TabsTrigger>
              <TabsTrigger value="overdue">Overdue</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <InvoiceTable search={debouncedSearch} status={status} />
        </>
      )}

      {showEmptyState && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <Receipt className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-1">No invoices yet</h3>
            <p className="text-muted-foreground mb-4 max-w-sm">
              Create your first invoice to bill a customer.
            </p>
            <Button asChild>
              <Link to="/invoices/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Invoice
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}