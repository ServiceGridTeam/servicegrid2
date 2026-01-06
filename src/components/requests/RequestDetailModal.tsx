import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Phone, Globe, Store, User, MapPin, Calendar, Clock } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
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
import {
  JobRequest,
  JobRequestUrgency,
  useUpdateJobRequest,
  useApproveJobRequest,
} from "@/hooks/useJobRequests";

interface RequestDetailModalProps {
  request: JobRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReject: () => void;
}

const sourceIcons = {
  phone: Phone,
  web: Globe,
  "walk-in": Store,
};

const sourceLabels = {
  phone: "Phone",
  web: "Web",
  "walk-in": "Walk-in",
};

const urgencyOptions: { value: JobRequestUrgency; label: string }[] = [
  { value: "routine", label: "Routine" },
  { value: "soon", label: "Soon" },
  { value: "urgent", label: "Urgent" },
  { value: "emergency", label: "Emergency" },
];

export function RequestDetailModal({
  request,
  open,
  onOpenChange,
  onReject,
}: RequestDetailModalProps) {
  const updateRequest = useUpdateJobRequest();
  const approveRequest = useApproveJobRequest();

  const [formData, setFormData] = useState({
    service_type: "",
    description: "",
    urgency: "routine" as JobRequestUrgency,
    preferred_date: "",
    preferred_time: "",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
  });

  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleData, setScheduleData] = useState({
    date: "",
    time: "",
    duration: "60",
  });

  useEffect(() => {
    if (request) {
      setFormData({
        service_type: request.service_type || "",
        description: request.description || "",
        urgency: request.urgency,
        preferred_date: request.preferred_date || "",
        preferred_time: request.preferred_time || "",
        customer_name:
          request.customer_name ||
          (request.customer
            ? `${request.customer.first_name} ${request.customer.last_name}`
            : ""),
        customer_phone: request.customer_phone || request.customer?.phone || "",
        customer_email: request.customer_email || request.customer?.email || "",
      });
      setShowSchedule(false);
      setScheduleData({ date: "", time: "", duration: "60" });
    }
  }, [request]);

  if (!request) return null;

  const SourceIcon = sourceIcons[request.source] || Phone;
  const isPending = request.status === "pending" || request.status === "reviewing";

  const handleSave = () => {
    updateRequest.mutate({
      requestId: request.id,
      updates: formData,
    });
  };

  const handleApprove = (createJob: boolean) => {
    approveRequest.mutate(
      {
        requestId: request.id,
        convertToJob: createJob,
        scheduleData: createJob && scheduleData.date && scheduleData.time
          ? {
              date: scheduleData.date,
              time: scheduleData.time,
              durationMinutes: parseInt(scheduleData.duration, 10),
            }
          : undefined,
        customerData: {
          name: formData.customer_name,
          phone: formData.customer_phone,
          email: formData.customer_email,
        },
        address: request.address,
        serviceType: formData.service_type,
        description: formData.description,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  const addressString = request.address
    ? [
        request.address.line1,
        request.address.line2,
        request.address.city,
        request.address.state,
        request.address.zip,
      ]
        .filter(Boolean)
        .join(", ")
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Request Details
            <Badge variant="outline" className="gap-1 text-xs ml-2">
              <SourceIcon className="h-3 w-3" />
              {sourceLabels[request.source]}
            </Badge>
          </SheetTitle>
          <SheetDescription>
            Created {format(new Date(request.created_at), "PPp")}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Customer Section */}
          <div>
            <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
              <User className="h-4 w-4" />
              Customer Information
            </h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="customer_name">Name</Label>
                <Input
                  id="customer_name"
                  value={formData.customer_name}
                  onChange={(e) =>
                    setFormData({ ...formData, customer_name: e.target.value })
                  }
                  disabled={!isPending}
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
                    disabled={!isPending}
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
                    disabled={!isPending}
                  />
                </div>
              </div>
              {request.customer_id && (
                <Badge variant="secondary" className="mt-1">
                  Linked to existing customer
                </Badge>
              )}
            </div>
          </div>

          <Separator />

          {/* Request Details */}
          <div>
            <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
              Request Details
            </h3>
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
                    disabled={!isPending}
                  />
                </div>
                <div>
                  <Label htmlFor="urgency">Urgency</Label>
                  <Select
                    value={formData.urgency}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        urgency: value as JobRequestUrgency,
                      })
                    }
                    disabled={!isPending}
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
                  rows={3}
                  disabled={!isPending}
                />
              </div>
            </div>
          </div>

          {/* Address */}
          {addressString && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                  <MapPin className="h-4 w-4" />
                  Address
                </h3>
                <p className="text-sm text-muted-foreground">{addressString}</p>
              </div>
            </>
          )}

          {/* Preferred Schedule */}
          <Separator />
          <div>
            <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4" />
              Preferred Schedule
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="preferred_date">Date</Label>
                <Input
                  id="preferred_date"
                  type="date"
                  value={formData.preferred_date}
                  onChange={(e) =>
                    setFormData({ ...formData, preferred_date: e.target.value })
                  }
                  disabled={!isPending}
                />
              </div>
              <div>
                <Label htmlFor="preferred_time">Time</Label>
                <Input
                  id="preferred_time"
                  value={formData.preferred_time}
                  onChange={(e) =>
                    setFormData({ ...formData, preferred_time: e.target.value })
                  }
                  placeholder="e.g., Morning, 2PM"
                  disabled={!isPending}
                />
              </div>
            </div>
          </div>

          {/* Source Info */}
          {request.source_metadata && Object.keys(request.source_metadata).length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-medium mb-3">Source Information</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  {request.source_metadata.handled_by && (
                    <p>Handled by: {String(request.source_metadata.handled_by)}</p>
                  )}
                  {request.source_metadata.call_duration && (
                    <p>Call duration: {String(request.source_metadata.call_duration)}</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Scheduling Section (for approval) */}
          {isPending && showSchedule && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4" />
                  Schedule Job
                </h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="schedule_date">Date</Label>
                      <Input
                        id="schedule_date"
                        type="date"
                        value={scheduleData.date}
                        onChange={(e) =>
                          setScheduleData({ ...scheduleData, date: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="schedule_time">Time</Label>
                      <Input
                        id="schedule_time"
                        type="time"
                        value={scheduleData.time}
                        onChange={(e) =>
                          setScheduleData({ ...scheduleData, time: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <Select
                      value={scheduleData.duration}
                      onValueChange={(value) =>
                        setScheduleData({ ...scheduleData, duration: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="90">1.5 hours</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
                        <SelectItem value="180">3 hours</SelectItem>
                        <SelectItem value="240">4 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Actions */}
          <Separator />
          <div className="flex flex-col gap-2">
            {isPending && (
              <>
                {!showSchedule ? (
                  <>
                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={() => handleApprove(false)}>
                        Approve
                      </Button>
                      <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={() => setShowSchedule(true)}
                      >
                        Schedule & Approve
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={handleSave}
                        disabled={updateRequest.isPending}
                      >
                        {updateRequest.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                      <Button
                        variant="ghost"
                        className="flex-1 text-destructive hover:text-destructive"
                        onClick={onReject}
                      >
                        Reject
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <Button
                      className="w-full"
                      onClick={() => handleApprove(true)}
                      disabled={!scheduleData.date || !scheduleData.time}
                    >
                      Approve & Create Job
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowSchedule(false)}
                    >
                      Back
                    </Button>
                  </>
                )}
              </>
            )}
            {!isPending && (
              <div className="text-sm text-muted-foreground text-center py-2">
                This request has been {request.status}
                {request.reviewed_at && (
                  <> on {format(new Date(request.reviewed_at), "PPp")}</>
                )}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
