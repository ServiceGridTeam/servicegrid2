import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";

export default function Customers() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">
            Manage your customer relationships
          </p>
        </div>
        <Button asChild>
          <Link to="/customers/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search customers..." className="pl-9" />
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-1">No customers yet</h3>
          <p className="text-muted-foreground mb-4 max-w-sm">
            Start building your customer base by adding your first customer.
          </p>
          <Button asChild>
            <Link to="/customers/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Customer
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}