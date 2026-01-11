import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Clock, Mail, AlertCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAutomationRules, useToggleAutomationRule, useUpdateAutomationConfig } from '@/hooks/useAutomationRules';
import { useAutomationLogStats } from '@/hooks/useAutomationLogs';
import { AutomationLogTable } from './AutomationLogTable';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const INTERVAL_OPTIONS = [
  { value: '3', label: '3 days' },
  { value: '5', label: '5 days' },
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
];

export function AutomationSettingsCard() {
  const { data: rules, isLoading, error, refetch } = useAutomationRules();
  const toggleMutation = useToggleAutomationRule();
  const updateConfigMutation = useUpdateAutomationConfig();

  // Find the invoice reminder rule
  const invoiceRule = rules?.find(
    (r) => r.trigger_type === 'invoice_overdue' && r.action_type === 'send_reminder_email'
  );

  const { data: stats } = useAutomationLogStats(invoiceRule?.id);

  const [localConfig, setLocalConfig] = useState({
    interval_days: 3,
    max_reminders: 3,
  });
  const [logsOpen, setLogsOpen] = useState(false);
  const [configDirty, setConfigDirty] = useState(false);

  // Sync local config with server data
  useEffect(() => {
    if (invoiceRule?.action_config) {
      setLocalConfig({
        interval_days: invoiceRule.action_config.interval_days ?? 3,
        max_reminders: invoiceRule.action_config.max_reminders ?? 3,
      });
      setConfigDirty(false);
    }
  }, [invoiceRule?.action_config]);

  // Debounced config update
  useEffect(() => {
    if (!configDirty || !invoiceRule) return;

    const timeout = setTimeout(() => {
      updateConfigMutation.mutate({
        ruleId: invoiceRule.id,
        config: localConfig,
      });
      setConfigDirty(false);
    }, 800);

    return () => clearTimeout(timeout);
  }, [localConfig, configDirty, invoiceRule?.id]);

  const handleToggle = (checked: boolean) => {
    if (!invoiceRule) return;
    toggleMutation.mutate({ ruleId: invoiceRule.id, isActive: checked });
  };

  const handleIntervalChange = (value: string) => {
    setLocalConfig((prev) => ({ ...prev, interval_days: parseInt(value, 10) }));
    setConfigDirty(true);
  };

  const handleMaxRemindersChange = (value: string) => {
    const num = parseInt(value, 10);
    if (num >= 1 && num <= 10) {
      setLocalConfig((prev) => ({ ...prev, max_reminders: num }));
      setConfigDirty(true);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Automations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Failed to load automation settings</span>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // No rules state (shouldn't happen with auto-seeding, but handle gracefully)
  if (!invoiceRule) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Automations
          </CardTitle>
          <CardDescription>Automate routine business tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No automation rules configured</p>
            <p className="text-sm mt-1">Automation rules will be available soon</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasRecentError = invoiceRule.last_error_at &&
    new Date(invoiceRule.last_error_at) > new Date(Date.now() - 24 * 60 * 60 * 1000);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Automations
        </CardTitle>
        <CardDescription>Configure automatic actions for your business</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invoice Payment Reminders Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <Label className="text-base font-medium">Invoice Payment Reminders</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically send reminder emails for overdue invoices
                </p>
              </div>
            </div>
            <Switch
              checked={invoiceRule.is_active ?? false}
              onCheckedChange={handleToggle}
              disabled={toggleMutation.isPending}
              aria-label="Toggle invoice reminders"
            />
          </div>

          {/* Settings Panel - Animated */}
          <AnimatePresence>
            {invoiceRule.is_active && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <div className="pl-12 space-y-4 pt-2">
                  {/* Error Warning */}
                  {hasRecentError && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        Last run had errors: {invoiceRule.last_error_message}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Interval Setting */}
                  <div className="flex items-center gap-4">
                    <Label htmlFor="interval" className="min-w-32">
                      Send every
                    </Label>
                    <Select
                      value={String(localConfig.interval_days)}
                      onValueChange={handleIntervalChange}
                    >
                      <SelectTrigger id="interval" className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INTERVAL_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {updateConfigMutation.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {/* Max Reminders Setting */}
                  <div className="flex items-center gap-4">
                    <Label htmlFor="max-reminders" className="min-w-32">
                      Maximum reminders
                    </Label>
                    <Input
                      id="max-reminders"
                      type="number"
                      min={1}
                      max={10}
                      value={localConfig.max_reminders}
                      onChange={(e) => handleMaxRemindersChange(e.target.value)}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">per invoice</span>
                  </div>

                  {/* Preview Text */}
                  <motion.p
                    key={`${localConfig.interval_days}-${localConfig.max_reminders}`}
                    initial={{ opacity: 0.5 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                    className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3"
                  >
                    Overdue invoices will receive up to{' '}
                    <strong>{localConfig.max_reminders}</strong> reminder emails, sent every{' '}
                    <strong>{localConfig.interval_days} days</strong> after the due date.
                  </motion.p>

                  {/* Execution Stats */}
                  <div className="flex items-center gap-4 text-sm">
                    {invoiceRule.last_executed_at && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>
                          Last run:{' '}
                          {formatDistanceToNow(new Date(invoiceRule.last_executed_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    )}
                    {stats && stats.total > 0 && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          {stats.success} sent
                        </Badge>
                        {stats.failed > 0 && (
                          <Badge variant="outline" className="text-red-600 border-red-200">
                            {stats.failed} failed
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Activity Log Collapsible */}
        <Collapsible open={logsOpen} onOpenChange={setLogsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                'w-full justify-between text-muted-foreground hover:text-foreground',
                logsOpen && 'text-foreground'
              )}
            >
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Activity Log
              </span>
              {logsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="pt-4"
            >
              <AutomationLogTable ruleId={invoiceRule.id} />
            </motion.div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
