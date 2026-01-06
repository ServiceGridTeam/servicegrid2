import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, Mail, MousePointer, Eye, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCampaign, useCampaignEmailSends } from "@/hooks/useCampaigns";

export default function CampaignReport() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { data: campaign, isLoading: loadingCampaign } = useCampaign(id);
  const { data: emailSends, isLoading: loadingEmails } = useCampaignEmailSends(id);

  if (loadingCampaign) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Campaign not found</p>
        <Button className="mt-4" onClick={() => navigate("/marketing/campaigns")}>
          Back to Campaigns
        </Button>
      </div>
    );
  }

  const sentCount = campaign.sent_count || 0;
  const deliveredCount = campaign.delivered_count || 0;
  const openedCount = campaign.opened_count || 0;
  const clickedCount = campaign.clicked_count || 0;
  const bouncedCount = campaign.bounced_count || 0;

  const openRate = sentCount > 0 ? Math.round((openedCount / sentCount) * 100) : 0;
  const clickRate = sentCount > 0 ? Math.round((clickedCount / sentCount) * 100) : 0;
  const deliveryRate = sentCount > 0 ? Math.round((deliveredCount / sentCount) * 100) : 0;
  const bounceRate = sentCount > 0 ? Math.round((bouncedCount / sentCount) * 100) : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "delivered":
        return <Badge variant="secondary">Delivered</Badge>;
      case "opened":
        return <Badge className="bg-blue-500">Opened</Badge>;
      case "clicked":
        return <Badge className="bg-green-500">Clicked</Badge>;
      case "bounced":
        return <Badge variant="destructive">Bounced</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleExportCSV = () => {
    if (!emailSends || emailSends.length === 0) return;
    
    const headers = ["Recipient", "Email", "Status", "Opened At", "Clicked At", "Sent At"];
    const rows = emailSends.map((send) => [
      send.customer ? `${send.customer.first_name} ${send.customer.last_name}` : send.to_name || "",
      send.to_email,
      send.status,
      send.opened_at ? format(new Date(send.opened_at), "yyyy-MM-dd HH:mm:ss") : "",
      send.clicked_at ? format(new Date(send.clicked_at), "yyyy-MM-dd HH:mm:ss") : "",
      send.sent_at ? format(new Date(send.sent_at), "yyyy-MM-dd HH:mm:ss") : "",
    ]);
    
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${campaign.name}-recipients-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/marketing/campaigns")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{campaign.name}</h1>
            <p className="text-sm text-muted-foreground">
              {campaign.sent_at
                ? `Sent ${format(new Date(campaign.sent_at), "MMM d, yyyy 'at' h:mm a")}`
                : "Not sent yet"}
            </p>
          </div>
        </div>

        <Button variant="outline" onClick={handleExportCSV} disabled={!emailSends?.length}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sent</p>
                <p className="text-2xl font-bold">{sentCount}</p>
                <p className="text-xs text-muted-foreground">{deliveryRate}% delivered</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-500/10">
                <Eye className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Opened</p>
                <p className="text-2xl font-bold">{openedCount}</p>
                <p className="text-xs text-muted-foreground">{openRate}% open rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <MousePointer className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Clicked</p>
                <p className="text-2xl font-bold">{clickedCount}</p>
                <p className="text-xs text-muted-foreground">{clickRate}% click rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bounced</p>
                <p className="text-2xl font-bold">{bouncedCount}</p>
                <p className="text-xs text-muted-foreground">{bounceRate}% bounce rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recipients Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recipients</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingEmails ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : emailSends && emailSends.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Clicked</TableHead>
                  <TableHead>Sent At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emailSends.map((send) => (
                  <TableRow key={send.id}>
                    <TableCell>
                      {send.customer
                        ? `${send.customer.first_name} ${send.customer.last_name}`
                        : send.to_name || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {send.to_email}
                    </TableCell>
                    <TableCell>{getStatusBadge(send.status)}</TableCell>
                    <TableCell>
                      {send.opened_at
                        ? format(new Date(send.opened_at), "MMM d, h:mm a")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {send.clicked_at
                        ? format(new Date(send.clicked_at), "MMM d, h:mm a")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {send.sent_at
                        ? format(new Date(send.sent_at), "MMM d, h:mm a")
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No recipient data available
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
