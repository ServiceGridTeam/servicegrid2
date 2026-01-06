import { useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Download, Loader2, Users, Clock, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { PayPeriod } from "@/hooks/usePayPeriods";

type ExportFormat = "csv" | "quickbooks_desktop" | "quickbooks_online" | "gusto" | "adp";

interface PayrollExportDialogProps {
  period: PayPeriod;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PayrollExportDialog({ period, open, onOpenChange }: PayrollExportDialogProps) {
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [includeRegular, setIncludeRegular] = useState(true);
  const [includeOvertime, setIncludeOvertime] = useState(true);
  const [includeDoubleTime, setIncludeDoubleTime] = useState(true);
  const [includeRates, setIncludeRates] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-payroll", {
        body: {
          payPeriodId: period.id,
          format: exportFormat,
          options: {
            includeRegular,
            includeOvertime,
            includeDoubleTime,
            includeRates,
          },
        },
      });

      if (error) throw error;

      // Download the file
      const blob = new Blob([data.content], { type: data.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Payroll exported successfully");
      onOpenChange(false);
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export payroll");
    } finally {
      setIsExporting(false);
    }
  };

  const formatLabel = {
    csv: "CSV (Generic Spreadsheet)",
    quickbooks_desktop: "QuickBooks Desktop (IIF)",
    quickbooks_online: "QuickBooks Online",
    gusto: "Gusto",
    adp: "ADP",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Payroll
          </DialogTitle>
          <DialogDescription>
            {format(new Date(period.start_date), "MMM d")} -{" "}
            {format(new Date(period.end_date), "MMM d, yyyy")}
          </DialogDescription>
        </DialogHeader>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 py-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-lg font-semibold">--</div>
            <div className="text-xs text-muted-foreground">Employees</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <Clock className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-lg font-semibold">
              {period.total_hours?.toFixed(1) || "0.0"}
            </div>
            <div className="text-xs text-muted-foreground">Total Hours</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <DollarSign className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-lg font-semibold">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(period.total_labor_cost || 0)}
            </div>
            <div className="text-xs text-muted-foreground">Labor Cost</div>
          </div>
        </div>

        <Separator />

        {/* Export Format */}
        <div className="space-y-3">
          <Label>Export Format</Label>
          <RadioGroup value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)}>
            {Object.entries(formatLabel).map(([value, label]) => (
              <div key={value} className="flex items-center space-x-2">
                <RadioGroupItem value={value} id={value} />
                <Label htmlFor={value} className="font-normal cursor-pointer">
                  {label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <Separator />

        {/* Include Options */}
        <div className="space-y-3">
          <Label>Include in Export</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="regular"
                checked={includeRegular}
                onCheckedChange={(c) => setIncludeRegular(!!c)}
              />
              <Label htmlFor="regular" className="font-normal cursor-pointer">
                Regular hours
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="overtime"
                checked={includeOvertime}
                onCheckedChange={(c) => setIncludeOvertime(!!c)}
              />
              <Label htmlFor="overtime" className="font-normal cursor-pointer">
                Overtime
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="doubletime"
                checked={includeDoubleTime}
                onCheckedChange={(c) => setIncludeDoubleTime(!!c)}
              />
              <Label htmlFor="doubletime" className="font-normal cursor-pointer">
                Double-time
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="rates"
                checked={includeRates}
                onCheckedChange={(c) => setIncludeRates(!!c)}
              />
              <Label htmlFor="rates" className="font-normal cursor-pointer">
                Pay rates
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
