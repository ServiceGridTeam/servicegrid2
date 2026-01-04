import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useOvertimeSettings, useUpdateOvertimeSettings } from "@/hooks/useOvertimeSettings";
import { toast } from "sonner";
import { Clock, Loader2 } from "lucide-react";

export function OvertimeSettingsCard() {
  const { settings, isLoading } = useOvertimeSettings();
  const updateSettings = useUpdateOvertimeSettings();

  const [enabled, setEnabled] = useState(true);
  const [weeklyThreshold, setWeeklyThreshold] = useState("40");
  const [dailyThreshold, setDailyThreshold] = useState("8");
  const [alertPercent, setAlertPercent] = useState("90");

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setWeeklyThreshold(String(settings.weekly_threshold_hours));
      setDailyThreshold(String(settings.daily_threshold_hours));
      setAlertPercent(String(settings.alert_threshold_percent));
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        enabled,
        weekly_threshold_hours: parseFloat(weeklyThreshold) || 40,
        daily_threshold_hours: parseFloat(dailyThreshold) || 8,
        alert_threshold_percent: parseFloat(alertPercent) || 90,
      });
      toast.success("Overtime settings saved");
    } catch {
      toast.error("Failed to save settings");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Overtime Settings
        </CardTitle>
        <CardDescription>
          Configure overtime thresholds and alerts for your team
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="overtime-enabled">Enable Overtime Tracking</Label>
            <p className="text-sm text-muted-foreground">
              Track and display overtime hours for team members
            </p>
          </div>
          <Switch
            id="overtime-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="weekly-threshold">Weekly Overtime Threshold</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="weekly-threshold"
                  type="number"
                  min="1"
                  max="168"
                  value={weeklyThreshold}
                  onChange={(e) => setWeeklyThreshold(e.target.value)}
                  className="w-24"
                  disabled={!enabled}
                />
                <span className="text-sm text-muted-foreground">hours per week</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Hours worked beyond this count as overtime
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="daily-threshold">Daily Overtime Threshold</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="daily-threshold"
                  type="number"
                  min="1"
                  max="24"
                  value={dailyThreshold}
                  onChange={(e) => setDailyThreshold(e.target.value)}
                  className="w-24"
                  disabled={!enabled}
                />
                <span className="text-sm text-muted-foreground">hours per day</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Optional daily overtime limit
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="alert-percent">Alert When Approaching</Label>
            <div className="flex items-center gap-2">
              <Input
                id="alert-percent"
                type="number"
                min="50"
                max="99"
                value={alertPercent}
                onChange={(e) => setAlertPercent(e.target.value)}
                className="w-24"
                disabled={!enabled}
              />
              <span className="text-sm text-muted-foreground">% of threshold</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Show warning badge when team members reach this percentage
            </p>
          </div>
        </div>

        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Settings
        </Button>
      </CardContent>
    </Card>
  );
}
