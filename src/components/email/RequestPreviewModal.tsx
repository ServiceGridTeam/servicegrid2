import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { InboundEmail, useCreateRequestFromEmail } from "@/hooks/useInboundEmails";
import { Loader2, User, Wrench, MapPin } from "lucide-react";

interface RequestPreviewModalProps {
  email: InboundEmail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const urgencyOptions = [
  { value: "routine", label: "Routine" },
  { value: "soon", label: "Soon" },
  { value: "urgent", label: "Urgent" },
  { value: "emergency", label: "Emergency" },
];

export function RequestPreviewModal({
  email,
  open,
  onOpenChange,
  onSuccess,
}: RequestPreviewModalProps) {
  const createRequest = useCreateRequestFromEmail();

  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    service_type: "",
    description: "",
    urgency: "routine",
    address_line1: "",
    address_city: "",
    address_state: "",
    address_zip: "",
  });

  // Pre-fill form when email changes
  useEffect(() => {
    if (email) {
      const extracted = email.ai_extracted_data || {};
      
      // Parse address if it's a single string
      let addressLine1 = "";
      let addressCity = "";
      let addressState = "";
      let addressZip = "";
      
      if (extracted.address) {
        // Try to parse "123 Main St, City, ST 12345" format
        const parts = extracted.address.split(",").map((p: string) => p.trim());
        addressLine1 = parts[0] || "";
        if (parts.length >= 2) {
          addressCity = parts[1] || "";
        }
        if (parts.length >= 3) {
          // Try to split "ST 12345"
          const stateZip = parts[2].split(" ");
          addressState = stateZip[0] || "";
          addressZip = stateZip[1] || "";
        }
      }

      setFormData({
        customer_name: extracted.customer_name || email.from_name || "",
        customer_phone: extracted.phone || "",
        customer_email: email.from_address || "",
        service_type: extracted.service_type || "",
        description: extracted.issue_description || "",
        urgency: extracted.urgency || "routine",
        address_line1: addressLine1,
        address_city: addressCity,
        address_state: addressState,
        address_zip: addressZip,
      });
    }
  }, [email]);

  const handleSubmit = () => {
    if (!email) return;

    createRequest.mutate(
      {
        emailId: email.id,
        overrideData: {
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          service_type: formData.service_type,
          description: formData.description,
          urgency: formData.urgency,
          address: {
            line1: formData.address_line1,
            city: formData.address_city,
            state: formData.address_state,
            zip: formData.address_zip,
          },
        },
      },
      {
        onSuccess: () => {
          onSuccess();
          onOpenChange(false);
        },
      }
    );
  };

  if (!email) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Job Request</DialogTitle>
          <DialogDescription>
            Review and edit the extracted information before creating a job request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Customer Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4" />
              Customer Information
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="customer_name">Name</Label>
                <Input
                  id="customer_name"
                  value={formData.customer_name}
                  onChange={(e) =>
                    setFormData({ ...formData, customer_name: e.target.value })
                  }
                  placeholder="Customer name"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="customer_phone">Phone</Label>
                  <Input
                    id="customer_phone"
                    value={formData.customer_phone}
                    onChange={(e) =>
                      setFormData({ ...formData, customer_phone: e.target.value })
                    }
                    placeholder="Phone number"
                  />
                </div>
                <div>
                  <Label htmlFor="customer_email">Email</Label>
                  <Input
                    id="customer_email"
                    type="email"
                    value={formData.customer_email}
                    onChange={(e) =>
                      setFormData({ ...formData, customer_email: e.target.value })
                    }
                    placeholder="Email address"
                  />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Service Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Wrench className="h-4 w-4" />
              Service Details
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="service_type">Service Type</Label>
                  <Input
                    id="service_type"
                    value={formData.service_type}
                    onChange={(e) =>
                      setFormData({ ...formData, service_type: e.target.value })
                    }
                    placeholder="e.g., Plumbing, HVAC"
                  />
                </div>
                <div>
                  <Label htmlFor="urgency">Urgency</Label>
                  <Select
                    value={formData.urgency}
                    onValueChange={(value) =>
                      setFormData({ ...formData, urgency: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {urgencyOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Describe the service request..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Address Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="h-4 w-4" />
              Location
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="address_line1">Street Address</Label>
                <Input
                  id="address_line1"
                  value={formData.address_line1}
                  onChange={(e) =>
                    setFormData({ ...formData, address_line1: e.target.value })
                  }
                  placeholder="123 Main St"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="address_city">City</Label>
                  <Input
                    id="address_city"
                    value={formData.address_city}
                    onChange={(e) =>
                      setFormData({ ...formData, address_city: e.target.value })
                    }
                    placeholder="City"
                  />
                </div>
                <div>
                  <Label htmlFor="address_state">State</Label>
                  <Input
                    id="address_state"
                    value={formData.address_state}
                    onChange={(e) =>
                      setFormData({ ...formData, address_state: e.target.value })
                    }
                    placeholder="ST"
                  />
                </div>
                <div>
                  <Label htmlFor="address_zip">ZIP</Label>
                  <Input
                    id="address_zip"
                    value={formData.address_zip}
                    onChange={(e) =>
                      setFormData({ ...formData, address_zip: e.target.value })
                    }
                    placeholder="12345"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createRequest.isPending}>
            {createRequest.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Create Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
