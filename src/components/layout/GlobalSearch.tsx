import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users, FileText, Briefcase, Receipt, X } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

interface SearchResult {
  id: string;
  type: "customer" | "quote" | "job" | "invoice";
  title: string;
  subtitle?: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<SearchResult[]>([]);
  const navigate = useNavigate();
  const debouncedQuery = useDebouncedValue(query, 200);

  // Load recent searches from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("recentSearches");
    if (stored) {
      setRecentSearches(JSON.parse(stored));
    }
  }, []);

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Search logic
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    const searchTerm = `%${searchQuery}%`;
    const allResults: SearchResult[] = [];

    try {
      // Search customers
      const { data: customers } = await supabase
        .from("customers")
        .select("id, first_name, last_name, email, company_name")
        .or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm},company_name.ilike.${searchTerm}`)
        .limit(5);

      if (customers) {
        allResults.push(
          ...customers.map((c) => ({
            id: c.id,
            type: "customer" as const,
            title: `${c.first_name} ${c.last_name}`,
            subtitle: c.company_name || c.email || undefined,
          }))
        );
      }

      // Search quotes
      const { data: quotes } = await supabase
        .from("quotes")
        .select("id, quote_number, title, customer:customers(first_name, last_name)")
        .or(`quote_number.ilike.${searchTerm},title.ilike.${searchTerm}`)
        .limit(5);

      if (quotes) {
        allResults.push(
          ...quotes.map((q) => ({
            id: q.id,
            type: "quote" as const,
            title: q.quote_number,
            subtitle: q.title || (q.customer ? `${q.customer.first_name} ${q.customer.last_name}` : undefined),
          }))
        );
      }

      // Search jobs
      const { data: jobs } = await supabase
        .from("jobs")
        .select("id, job_number, title, customer:customers(first_name, last_name)")
        .or(`job_number.ilike.${searchTerm},title.ilike.${searchTerm}`)
        .limit(5);

      if (jobs) {
        allResults.push(
          ...jobs.map((j) => ({
            id: j.id,
            type: "job" as const,
            title: j.job_number,
            subtitle: j.title || (j.customer ? `${j.customer.first_name} ${j.customer.last_name}` : undefined),
          }))
        );
      }

      // Search invoices
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, invoice_number, customer:customers(first_name, last_name)")
        .ilike("invoice_number", searchTerm)
        .limit(5);

      if (invoices) {
        allResults.push(
          ...invoices.map((i) => ({
            id: i.id,
            type: "invoice" as const,
            title: i.invoice_number,
            subtitle: i.customer ? `${i.customer.first_name} ${i.customer.last_name}` : undefined,
          }))
        );
      }

      setResults(allResults);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    performSearch(debouncedQuery);
  }, [debouncedQuery, performSearch]);

  const handleSelect = (result: SearchResult) => {
    // Add to recent searches
    const updated = [result, ...recentSearches.filter((r) => r.id !== result.id)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem("recentSearches", JSON.stringify(updated));

    // Navigate based on type
    const routes: Record<SearchResult["type"], string> = {
      customer: `/customers/${result.id}`,
      quote: `/quotes/${result.id}`,
      job: `/jobs`, // Jobs page doesn't have detail route, opens in sheet
      invoice: `/invoices/${result.id}`,
    };

    navigate(routes[result.type]);
    setOpen(false);
    setQuery("");
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem("recentSearches");
  };

  const getIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "customer":
        return <Users className="h-4 w-4" />;
      case "quote":
        return <FileText className="h-4 w-4" />;
      case "job":
        return <Briefcase className="h-4 w-4" />;
      case "invoice":
        return <Receipt className="h-4 w-4" />;
    }
  };

  const groupedResults = {
    customers: results.filter((r) => r.type === "customer"),
    quotes: results.filter((r) => r.type === "quote"),
    jobs: results.filter((r) => r.type === "job"),
    invoices: results.filter((r) => r.type === "invoice"),
  };

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-9 p-0 xl:h-10 xl:w-60 xl:justify-start xl:px-3 xl:py-2"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4 xl:mr-2" />
        <span className="hidden xl:inline-flex">Search...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-2 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 xl:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search customers, quotes, jobs, invoices..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {isLoading && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Searching...
            </div>
          )}

          {!isLoading && !query && recentSearches.length > 0 && (
            <CommandGroup heading={
              <div className="flex items-center justify-between">
                <span>Recent Searches</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-xs hover:bg-transparent"
                  onClick={clearRecentSearches}
                >
                  Clear
                </Button>
              </div>
            }>
              {recentSearches.map((result) => (
                <CommandItem
                  key={`recent-${result.id}`}
                  value={`recent-${result.type}-${result.title}`}
                  onSelect={() => handleSelect(result)}
                >
                  {getIcon(result.type)}
                  <span className="ml-2">{result.title}</span>
                  {result.subtitle && (
                    <span className="ml-2 text-muted-foreground">{result.subtitle}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!isLoading && query && results.length === 0 && (
            <CommandEmpty>No results found.</CommandEmpty>
          )}

          {!isLoading && groupedResults.customers.length > 0 && (
            <CommandGroup heading="Customers">
              {groupedResults.customers.map((result) => (
                <CommandItem
                  key={result.id}
                  value={`${result.type}-${result.title}`}
                  onSelect={() => handleSelect(result)}
                >
                  {getIcon(result.type)}
                  <span className="ml-2">{result.title}</span>
                  {result.subtitle && (
                    <span className="ml-2 text-muted-foreground">{result.subtitle}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!isLoading && groupedResults.quotes.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Quotes">
                {groupedResults.quotes.map((result) => (
                  <CommandItem
                    key={result.id}
                    value={`${result.type}-${result.title}`}
                    onSelect={() => handleSelect(result)}
                  >
                    {getIcon(result.type)}
                    <span className="ml-2">{result.title}</span>
                    {result.subtitle && (
                      <span className="ml-2 text-muted-foreground">{result.subtitle}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {!isLoading && groupedResults.jobs.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Jobs">
                {groupedResults.jobs.map((result) => (
                  <CommandItem
                    key={result.id}
                    value={`${result.type}-${result.title}`}
                    onSelect={() => handleSelect(result)}
                  >
                    {getIcon(result.type)}
                    <span className="ml-2">{result.title}</span>
                    {result.subtitle && (
                      <span className="ml-2 text-muted-foreground">{result.subtitle}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {!isLoading && groupedResults.invoices.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Invoices">
                {groupedResults.invoices.map((result) => (
                  <CommandItem
                    key={result.id}
                    value={`${result.type}-${result.title}`}
                    onSelect={() => handleSelect(result)}
                  >
                    {getIcon(result.type)}
                    <span className="ml-2">{result.title}</span>
                    {result.subtitle && (
                      <span className="ml-2 text-muted-foreground">{result.subtitle}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
