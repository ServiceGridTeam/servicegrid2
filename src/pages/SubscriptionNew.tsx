import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateSubscriptionForm } from "@/components/subscriptions";

export default function SubscriptionNew() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(true);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      navigate("/subscriptions?tab=subscriptions");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/subscriptions?tab=subscriptions")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            New Subscription
          </h1>
          <p className="text-muted-foreground">
            Create a recurring service subscription for a customer
          </p>
        </div>
      </div>

      <CreateSubscriptionForm open={isOpen} onOpenChange={handleOpenChange} />
    </div>
  );
}
