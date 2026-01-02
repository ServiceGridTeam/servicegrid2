import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";

export default function Quotes() {
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

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search quotes..." className="pl-9" />
        </div>
      </div>

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
    </div>
  );
}