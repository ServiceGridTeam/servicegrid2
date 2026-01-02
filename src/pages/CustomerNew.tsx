import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { CustomerForm } from "@/components/customers/CustomerForm";
import { useCreateCustomer } from "@/hooks/useCustomers";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function CustomerNew() {
  const navigate = useNavigate();
  const createCustomer = useCreateCustomer();

  const handleSubmit = async (data: Parameters<typeof createCustomer.mutateAsync>[0]) => {
    const customer = await createCustomer.mutateAsync(data);
    navigate(`/customers/${customer.id}`);
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
            <BreadcrumbPage>New Customer</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/customers">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Customer</h1>
          <p className="text-muted-foreground">
            Add a new customer to your business
          </p>
        </div>
      </div>

      <div className="max-w-2xl">
        <CustomerForm onSubmit={handleSubmit} isLoading={createCustomer.isPending} />
      </div>
    </div>
  );
}
