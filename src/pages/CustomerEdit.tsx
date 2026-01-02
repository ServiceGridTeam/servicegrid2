import { useParams, useNavigate, Link } from "react-router-dom";
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
import { useCustomer, useUpdateCustomer } from "@/hooks/useCustomers";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function CustomerEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customer, isLoading } = useCustomer(id);
  const updateCustomer = useUpdateCustomer();

  const handleSubmit = async (data: Omit<Parameters<typeof updateCustomer.mutateAsync>[0], "id">) => {
    if (!id) return;
    await updateCustomer.mutateAsync({ ...data, id });
    navigate(`/customers/${id}`);
  };

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
            <BreadcrumbLink asChild>
              <Link to={`/customers/${id}`}>
                {customer.first_name} {customer.last_name}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Edit</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/customers/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Customer</h1>
          <p className="text-muted-foreground">
            Update {customer.first_name} {customer.last_name}'s information
          </p>
        </div>
      </div>

      <div className="max-w-2xl">
        <CustomerForm
          customer={customer}
          onSubmit={(data) => handleSubmit(data)}
          isLoading={updateCustomer.isPending}
        />
      </div>
    </div>
  );
}
