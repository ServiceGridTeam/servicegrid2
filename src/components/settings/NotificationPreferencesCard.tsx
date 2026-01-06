import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotificationPreferences, useUpdateNotificationPreference, NotificationPreferences } from "@/hooks/useNotificationPreferences";
import { Mail, Bell, Calendar, ClipboardCheck } from "lucide-react";

interface PreferenceToggleProps {
  label: string;
  description?: string;
  field: keyof NotificationPreferences;
  checked: boolean;
  onCheckedChange: (field: keyof NotificationPreferences, value: boolean) => void;
  disabled?: boolean;
}

function PreferenceToggle({ label, description, field, checked, onCheckedChange, disabled }: PreferenceToggleProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="space-y-0.5">
        <Label htmlFor={field} className="text-sm font-medium cursor-pointer">
          {label}
        </Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch
        id={field}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(field, value)}
        disabled={disabled}
      />
    </div>
  );
}

function PreferenceSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="divide-y divide-border">
        {children}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="h-5 w-32" />
            {[1, 2, 3].map((j) => (
              <div key={j} className="flex items-center justify-between py-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-6 w-10 rounded-full" />
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function NotificationPreferencesCard() {
  const { data: prefs, isLoading } = useNotificationPreferences();
  const updatePreference = useUpdateNotificationPreference();

  const handleToggle = (field: keyof NotificationPreferences, value: boolean) => {
    updatePreference.mutate({ field, value });
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!prefs) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>Unable to load preferences</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const isPending = updatePreference.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>
          Choose how you want to be notified about activity
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Email Notifications */}
        <PreferenceSection title="Email Notifications" icon={<Mail className="h-4 w-4 text-muted-foreground" />}>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-2">Invoices & Payments</p>
            <PreferenceToggle
              label="Invoice sent to customer"
              field="email_invoice_sent"
              checked={prefs.email_invoice_sent}
              onCheckedChange={handleToggle}
              disabled={isPending}
            />
            <PreferenceToggle
              label="Payment reminders"
              field="email_invoice_reminder"
              checked={prefs.email_invoice_reminder}
              onCheckedChange={handleToggle}
              disabled={isPending}
            />
            <PreferenceToggle
              label="Overdue invoice alerts"
              field="email_invoice_overdue"
              checked={prefs.email_invoice_overdue}
              onCheckedChange={handleToggle}
              disabled={isPending}
            />
            <PreferenceToggle
              label="Payment received"
              field="email_payment_received"
              checked={prefs.email_payment_received}
              onCheckedChange={handleToggle}
              disabled={isPending}
            />
            <PreferenceToggle
              label="Payment failed"
              field="email_payment_failed"
              checked={prefs.email_payment_failed}
              onCheckedChange={handleToggle}
              disabled={isPending}
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-4">Quotes</p>
            <PreferenceToggle
              label="Quote sent notifications"
              field="email_quote_sent"
              checked={prefs.email_quote_sent}
              onCheckedChange={handleToggle}
              disabled={isPending}
            />
            <PreferenceToggle
              label="Quote approved by customer"
              field="email_quote_approved"
              checked={prefs.email_quote_approved}
              onCheckedChange={handleToggle}
              disabled={isPending}
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-4">Jobs & Team</p>
            <PreferenceToggle
              label="Job assigned to you"
              field="email_job_assigned"
              checked={prefs.email_job_assigned}
              onCheckedChange={handleToggle}
              disabled={isPending}
            />
            <PreferenceToggle
              label="Job status changes"
              field="email_job_status_changed"
              checked={prefs.email_job_status_changed}
              onCheckedChange={handleToggle}
              disabled={isPending}
            />
            <PreferenceToggle
              label="Delay notifications"
              field="email_delay_notification"
              checked={prefs.email_delay_notification}
              onCheckedChange={handleToggle}
              disabled={isPending}
            />
            <PreferenceToggle
              label="Team invitations"
              field="email_team_invite"
              checked={prefs.email_team_invite}
              onCheckedChange={handleToggle}
              disabled={isPending}
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-4">Timesheets</p>
            <PreferenceToggle
              label="Timesheet submitted for review"
              description="When a team member submits their timesheet"
              field="email_timesheet_submitted"
              checked={prefs.email_timesheet_submitted}
              onCheckedChange={handleToggle}
              disabled={isPending}
            />
            <PreferenceToggle
              label="Timesheet approved"
              description="When your timesheet is approved"
              field="email_timesheet_approved"
              checked={prefs.email_timesheet_approved}
              onCheckedChange={handleToggle}
              disabled={isPending}
            />
            <PreferenceToggle
              label="Timesheet rejected"
              description="When your timesheet is rejected"
              field="email_timesheet_rejected"
              checked={prefs.email_timesheet_rejected}
              onCheckedChange={handleToggle}
              disabled={isPending}
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider pt-4">Customer Portal</p>
            <PreferenceToggle
              label="First login alerts"
              description="When a customer logs into their portal for the first time"
              field="email_portal_first_login"
              checked={prefs.email_portal_first_login}
              onCheckedChange={handleToggle}
              disabled={isPending}
            />
            <PreferenceToggle
              label="All login alerts"
              description="Every time a customer logs into their portal"
              field="email_portal_login"
              checked={prefs.email_portal_login}
              onCheckedChange={handleToggle}
              disabled={isPending}
            />
          </div>
        </PreferenceSection>

        <Separator />

        {/* In-App Notifications */}
        <PreferenceSection title="In-App Notifications" icon={<Bell className="h-4 w-4 text-muted-foreground" />}>
          <PreferenceToggle
            label="Invoice activity"
            description="New invoices, status changes"
            field="inapp_invoice_activity"
            checked={prefs.inapp_invoice_activity}
            onCheckedChange={handleToggle}
            disabled={isPending}
          />
          <PreferenceToggle
            label="Payment activity"
            description="Payments received, failed payments"
            field="inapp_payment_activity"
            checked={prefs.inapp_payment_activity}
            onCheckedChange={handleToggle}
            disabled={isPending}
          />
          <PreferenceToggle
            label="Quote activity"
            description="Quote approvals, expirations"
            field="inapp_quote_activity"
            checked={prefs.inapp_quote_activity}
            onCheckedChange={handleToggle}
            disabled={isPending}
          />
          <PreferenceToggle
            label="Job activity"
            description="Assignments, status updates"
            field="inapp_job_activity"
            checked={prefs.inapp_job_activity}
            onCheckedChange={handleToggle}
            disabled={isPending}
          />
          <PreferenceToggle
            label="Team activity"
            description="New members, role changes"
            field="inapp_team_activity"
            checked={prefs.inapp_team_activity}
            onCheckedChange={handleToggle}
            disabled={isPending}
          />
          <PreferenceToggle
            label="Geofence alerts"
            description="Clock-in/out location warnings"
            field="inapp_geofence_alerts"
            checked={prefs.inapp_geofence_alerts}
            onCheckedChange={handleToggle}
            disabled={isPending}
          />
          <PreferenceToggle
            label="Timesheet activity"
            description="Submissions, approvals, rejections"
            field="inapp_timesheet_activity"
            checked={prefs.inapp_timesheet_activity}
            onCheckedChange={handleToggle}
            disabled={isPending}
          />
          <PreferenceToggle
            label="Portal activity"
            description="Customer logins, invite acceptances"
            field="inapp_portal_activity"
            checked={prefs.inapp_portal_activity}
            onCheckedChange={handleToggle}
            disabled={isPending}
          />
        </PreferenceSection>

        <Separator />

        {/* Digests */}
        <PreferenceSection title="Digests" icon={<Calendar className="h-4 w-4 text-muted-foreground" />}>
          <PreferenceToggle
            label="Daily activity digest"
            description="Summary of the day's activity each morning"
            field="daily_digest"
            checked={prefs.daily_digest}
            onCheckedChange={handleToggle}
            disabled={isPending}
          />
          <PreferenceToggle
            label="Weekly summary email"
            description="Weekly overview sent on Mondays"
            field="weekly_summary"
            checked={prefs.weekly_summary}
            onCheckedChange={handleToggle}
            disabled={isPending}
          />
        </PreferenceSection>
      </CardContent>
    </Card>
  );
}
