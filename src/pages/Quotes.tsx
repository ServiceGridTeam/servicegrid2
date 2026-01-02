import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { useQuotes } from "@/hooks/useQuotes";
import { QuoteTable } from "@/components/quotes/QuoteTable";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
];

export default function Quotes() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data: quotes, isLoading } = useQuotes({
    search: debouncedSearch,
    status,
  });

  const hasQuotes = quotes && quotes.length > 0;
  const showEmptyState = !isLoading && !hasQuotes && !debouncedSearch && status === "all";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quotes</h1>
          <p className="text-muted-foreground">
            Create and manage customer quotes
          </p>
        </div>
        <Button asChild>
          <Link to="/quotes/new">
            <Plus className="mr-2 h-4 w-4" />
            New Quote
          </Link>
        </Button>
      </div>

      {!showEmptyState && (
        <>
          <Tabs value={status} onValueChange={setStatus}>
            <TabsList>
              {STATUS_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search quotes..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </>
      )}

      {showEmptyState ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-1">No quotes yet</h3>
            <p className="text-muted-foreground mb-4 max-w-sm">
              Create your first quote to send to a customer.
            </p>
            <Button asChild>
              <Link to="/quotes/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Quote
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {!isLoading && !hasQuotes ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-muted-foreground">
                  No quotes found matching your criteria.
                </p>
              </div>
            ) : (
              <QuoteTable quotes={quotes} isLoading={isLoading} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
