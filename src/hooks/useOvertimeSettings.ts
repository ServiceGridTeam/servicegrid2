import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBusiness, useUpdateBusiness } from "./useBusiness";
import { DEFAULT_OVERTIME_SETTINGS, OvertimeSettings } from "./useOvertimeCalculations";

export function useOvertimeSettings() {
  const { data: business, isLoading } = useBusiness();

  const settings: OvertimeSettings = {
    ...DEFAULT_OVERTIME_SETTINGS,
    ...(business?.settings as Record<string, unknown>)?.overtime as Partial<OvertimeSettings>,
  };

  return {
    settings,
    isLoading,
  };
}

export function useUpdateOvertimeSettings() {
  const { data: business } = useBusiness();
  const updateBusiness = useUpdateBusiness();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (overtimeSettings: Partial<OvertimeSettings>) => {
      if (!business) throw new Error("No business found");

      const currentSettings = (business.settings as Record<string, unknown>) || {};
      const currentOvertime = (currentSettings.overtime as Partial<OvertimeSettings>) || {};

      const newSettings = {
        ...currentSettings,
        overtime: {
          ...DEFAULT_OVERTIME_SETTINGS,
          ...currentOvertime,
          ...overtimeSettings,
        },
      };

      return updateBusiness.mutateAsync({ settings: newSettings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business"] });
    },
  });
}
