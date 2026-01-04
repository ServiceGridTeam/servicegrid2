// Pure calculation utilities for overtime

export interface OvertimeSettings {
  enabled: boolean;
  weekly_threshold_hours: number;
  daily_threshold_hours: number;
  alert_threshold_percent: number;
}

export const DEFAULT_OVERTIME_SETTINGS: OvertimeSettings = {
  enabled: true,
  weekly_threshold_hours: 40,
  daily_threshold_hours: 8,
  alert_threshold_percent: 90,
};

export interface OvertimeResult {
  regularMinutes: number;
  overtimeMinutes: number;
  totalMinutes: number;
  isApproaching: boolean;
  isOvertime: boolean;
  percentOfThreshold: number;
}

export function calculateWeeklyOvertime(
  weeklyMinutes: number,
  thresholdHours: number = 40,
  alertPercent: number = 90
): OvertimeResult {
  const thresholdMinutes = thresholdHours * 60;
  const alertThreshold = thresholdMinutes * (alertPercent / 100);

  return {
    regularMinutes: Math.min(weeklyMinutes, thresholdMinutes),
    overtimeMinutes: Math.max(0, weeklyMinutes - thresholdMinutes),
    totalMinutes: weeklyMinutes,
    isApproaching: weeklyMinutes >= alertThreshold && weeklyMinutes < thresholdMinutes,
    isOvertime: weeklyMinutes >= thresholdMinutes,
    percentOfThreshold: thresholdMinutes > 0 ? (weeklyMinutes / thresholdMinutes) * 100 : 0,
  };
}

export function calculateDailyOvertime(
  dailyMinutes: number,
  thresholdHours: number = 8
): { regular: number; overtime: number } {
  const thresholdMinutes = thresholdHours * 60;
  return {
    regular: Math.min(dailyMinutes, thresholdMinutes),
    overtime: Math.max(0, dailyMinutes - thresholdMinutes),
  };
}

export function formatMinutesToHoursDecimal(minutes: number): string {
  return (minutes / 60).toFixed(1);
}

export function getOvertimeStatus(result: OvertimeResult): "normal" | "approaching" | "overtime" {
  if (result.isOvertime) return "overtime";
  if (result.isApproaching) return "approaching";
  return "normal";
}
