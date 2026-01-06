import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useTeamMembers, TeamMember } from "@/hooks/useTeamManagement";
import {
  useEmployeePayRates,
  useUpsertPayRate,
  usePayRateHistory,
} from "@/hooks/useEmployeePayRates";
import { CalendarIcon, DollarSign, History, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

const payRateSchema = z.object({
  hourlyRate: z.coerce.number().min(0.01, "Hourly rate is required"),
  overtimeRate: z.coerce.number().min(0).optional().or(z.literal("")),
  doubletimeRate: z.coerce.number().min(0).optional().or(z.literal("")),
  billRate: z.coerce.number().min(0).optional().or(z.literal("")),
  effectiveFrom: z.date().optional(),
});

type PayRateFormValues = z.infer<typeof payRateSchema>;

export function PayRatesSettings() {
  const { toast } = useToast();
  const { data: teamMembers, isLoading: loadingMembers } = useTeamMembers();
  const { data: payRates, isLoading: loadingRates } = useEmployeePayRates();
  const upsertPayRate = useUpsertPayRate();

  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [historyMember, setHistoryMember] = useState<TeamMember | null>(null);

  const form = useForm<PayRateFormValues>({
    resolver: zodResolver(payRateSchema),
    defaultValues: {
      hourlyRate: 0,
      overtimeRate: "",
      doubletimeRate: "",
      billRate: "",
      effectiveFrom: new Date(),
    },
  });

  const handleEditMember = (member: TeamMember) => {
    const existingRate = payRates?.find((r) => r.user_id === member.id);
    form.reset({
      hourlyRate: existingRate?.hourly_rate ?? 0,
      overtimeRate: existingRate?.overtime_rate ?? "",
      doubletimeRate: existingRate?.double_time_rate ?? "",
      billRate: existingRate?.bill_rate ?? "",
      effectiveFrom: new Date(),
    });
    setEditingMember(member);
  };

  const onSubmit = async (values: PayRateFormValues) => {
    if (!editingMember) return;

    try {
      await upsertPayRate.mutateAsync({
        userId: editingMember.id,
        hourlyRate: values.hourlyRate,
        overtimeRate: values.overtimeRate ? Number(values.overtimeRate) : undefined,
        doubletimeRate: values.doubletimeRate ? Number(values.doubletimeRate) : undefined,
        billRate: values.billRate ? Number(values.billRate) : undefined,
        effectiveFrom: values.effectiveFrom,
      });
      toast({
        title: "Pay rate updated",
        description: `Pay rate for ${editingMember.first_name} ${editingMember.last_name} has been updated.`,
      });
      setEditingMember(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update pay rate.",
        variant: "destructive",
      });
    }
  };

  const getRateForMember = (memberId: string) => {
    return payRates?.find((r) => r.user_id === memberId);
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null) return "—";
    return `$${amount.toFixed(2)}`;
  };

  const isLoading = loadingMembers || loadingRates;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Employee Pay Rates</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Employee Pay Rates</CardTitle>
              <CardDescription>
                Set hourly rates for payroll and labor cost calculations
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Regular</TableHead>
                <TableHead className="text-right">Overtime</TableHead>
                <TableHead className="text-right">Bill Rate</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers?.map((member) => {
                const rate = getRateForMember(member.id);
                return (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {member.first_name?.[0]}
                            {member.last_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {member.first_name} {member.last_name}
                          </div>
                          {member.job_title && (
                            <div className="text-xs text-muted-foreground">
                              {member.job_title}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {rate ? (
                        formatCurrency(rate.hourly_rate)
                      ) : (
                        <span className="text-muted-foreground">Not set</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {rate ? (
                        formatCurrency(rate.overtime_rate ?? rate.hourly_rate * 1.5)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {rate ? (
                        formatCurrency(rate.bill_rate)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditMember(member)}
                        >
                          {rate ? (
                            <Pencil className="h-4 w-4" />
                          ) : (
                            "Set Rate"
                          )}
                        </Button>
                        {rate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setHistoryMember(member)}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!teamMembers || teamMembers.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No team members found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Pay Rate Dialog */}
      <Dialog open={!!editingMember} onOpenChange={() => setEditingMember(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Set Pay Rate for {editingMember?.first_name} {editingMember?.last_name}
            </DialogTitle>
            <DialogDescription>
              Configure hourly rates for payroll calculations
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="hourlyRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hourly Rate *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          min="0"
                          className="pl-9"
                          placeholder="25.00"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="overtimeRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Overtime Rate</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            type="number"
                            step="0.01"
                            min="0"
                            className="pl-9"
                            placeholder="Auto: 1.5x"
                          />
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs">
                        Defaults to 1.5x hourly
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="doubletimeRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Double Time Rate</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            {...field}
                            type="number"
                            step="0.01"
                            min="0"
                            className="pl-9"
                            placeholder="Auto: 2x"
                          />
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs">
                        Defaults to 2x hourly
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="billRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bill Rate</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          min="0"
                          className="pl-9"
                          placeholder="75.00"
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      What you charge customers per hour for this employee
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="effectiveFrom"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Effective From</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>
                      When this rate becomes effective
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingMember(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={upsertPayRate.isPending}>
                  {upsertPayRate.isPending ? "Saving..." : "Save Rate"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Rate History Dialog */}
      <RateHistoryDialog
        member={historyMember}
        onClose={() => setHistoryMember(null)}
      />
    </>
  );
}

function RateHistoryDialog({
  member,
  onClose,
}: {
  member: TeamMember | null;
  onClose: () => void;
}) {
  const { data: history, isLoading } = usePayRateHistory(member?.id);

  return (
    <Dialog open={!!member} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Rate History for {member?.first_name} {member?.last_name}
          </DialogTitle>
          <DialogDescription>
            View all historical pay rate changes
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[400px]">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : history && history.length > 0 ? (
            <div className="space-y-3">
              {history.map((rate, index) => (
                <div
                  key={rate.id}
                  className={cn(
                    "p-3 rounded-lg border",
                    index === 0 && rate.is_current && "border-primary bg-primary/5"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">
                      {format(new Date(rate.effective_from), "MMM d, yyyy")}
                      {rate.effective_to && (
                        <span className="text-muted-foreground">
                          {" → "}
                          {format(new Date(rate.effective_to), "MMM d, yyyy")}
                        </span>
                      )}
                    </span>
                    {rate.is_current && (
                      <Badge variant="secondary" className="text-xs">
                        Current
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Regular:</span>
                      <span className="ml-1 font-mono">${rate.hourly_rate.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">OT:</span>
                      <span className="ml-1 font-mono">
                        ${(rate.overtime_rate ?? rate.hourly_rate * 1.5).toFixed(2)}
                      </span>
                    </div>
                    {rate.bill_rate && (
                      <div>
                        <span className="text-muted-foreground">Bill:</span>
                        <span className="ml-1 font-mono">${rate.bill_rate.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No rate history found
            </p>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
