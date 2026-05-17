import { useState, useRef } from "react";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import {
  useGetAdminStats, getGetAdminStatsQueryKey,
  useListAdminUsers, getListAdminUsersQueryKey,
  useGetMarkup, getGetMarkupQueryKey, useUpdateMarkup,
  useGetSiteSettings, getGetSiteSettingsQueryKey, useUpdateSiteSettings,
  useListSupportTickets, getListSupportTicketsQueryKey, useReplyToTicket,
  useUpdateUserRole,
} from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Users, CreditCard, Smartphone, TicketIcon, Percent, Coins, Upload, ImageIcon } from "lucide-react";

export default function Admin() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: stats } = useGetAdminStats({ query: { queryKey: getGetAdminStatsQueryKey() } });
  const { data: usersData, refetch: refetchUsers } = useListAdminUsers({ limit: 50 }, { query: { queryKey: getListAdminUsersQueryKey({ limit: 50 }) } });
  const { data: markupData, refetch: refetchMarkup } = useGetMarkup({ query: { queryKey: getGetMarkupQueryKey() } });
  const { data: settingsData, refetch: refetchSettings } = useGetSiteSettings({ query: { queryKey: getGetSiteSettingsQueryKey() } });
  const { data: ticketsData, refetch: refetchTickets } = useListSupportTickets({ all: true }, { query: { queryKey: getListSupportTicketsQueryKey({ all: true }) } });

  const updateMarkupMutation = useUpdateMarkup();
  const updateSettingsMutation = useUpdateSiteSettings();
  const updateRoleMutation = useUpdateUserRole();
  const replyTicketMutation = useReplyToTicket();

  const [markupVal, setMarkupVal] = useState("");
  const [siteName, setSiteName] = useState("");
  const [tagline, setTagline] = useState("");
  const [replyText, setReplyText] = useState("");
  const [activeTicket, setActiveTicket] = useState<any>(null);

  const [creditTarget, setCreditTarget] = useState<{ uid: string; displayName: string } | null>(null);
  const [creditAmount, setCreditAmount] = useState<number | "">("");
  const [creditReason, setCreditReason] = useState("");
  const [isCreditLoading, setIsCreditLoading] = useState(false);

  const [logoUrl, setLogoUrl] = useState("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useState(() => {
    if (settingsData?.logoUrl) setLogoUrl(settingsData.logoUrl as string);
  });

  useState(() => {
    if (markupData) setMarkupVal(markupData.markupPercentage.toString());
    if (settingsData) {
      setSiteName(settingsData.siteName);
      setTagline(settingsData.tagline || "");
    }
  });

  const handleUpdateMarkup = async () => {
    try {
      await updateMarkupMutation.mutateAsync({ data: { markupPercentage: Number(markupVal) } });
      toast({ title: "Markup updated successfully" });
      refetchMarkup();
    } catch (err: any) {
      toast({ title: "Error updating markup", description: err.message, variant: "destructive" });
    }
  };

  const handleLogoUpload = async (file: File) => {
    setIsUploadingLogo(true);
    try {
      const logoRef = storageRef(storage, `site/logo_${Date.now()}_${file.name}`);
      await uploadBytes(logoRef, file);
      const url = await getDownloadURL(logoRef);
      setLogoUrl(url);
      await updateSettingsMutation.mutateAsync({ data: { siteName, tagline, logoUrl: url } });
      toast({ title: "Logo yüklendi ve kaydedildi" });
      refetchSettings();
    } catch (err: any) {
      toast({ title: "Logo yükleme hatası", description: err.message, variant: "destructive" });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleUpdateSettings = async () => {
    try {
      await updateSettingsMutation.mutateAsync({ data: { siteName, tagline, logoUrl: logoUrl || undefined } });
      toast({ title: "Settings updated successfully" });
      refetchSettings();
    } catch (err: any) {
      toast({ title: "Error updating settings", description: err.message, variant: "destructive" });
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await updateRoleMutation.mutateAsync({ userId, data: { role } });
      toast({ title: "Role updated" });
      refetchUsers();
    } catch (err: any) {
      toast({ title: "Error updating role", description: err.message, variant: "destructive" });
    }
  };

  const handleCredit = async () => {
    if (!creditTarget || !creditAmount || Number(creditAmount) <= 0) return;
    setIsCreditLoading(true);
    try {
      const resp = await fetch(`/api/admin/users/${creditTarget.uid}/credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(creditAmount), reason: creditReason || "Admin credit" }),
      });
      if (!resp.ok) {
        const err = await resp.json() as any;
        throw new Error(err.error || "Failed to credit wallet");
      }
      const data = await resp.json() as any;
      toast({ title: `$${creditAmount} credited to ${creditTarget.displayName}`, description: `New balance: $${data.newBalance?.toFixed(2)}` });
      setCreditTarget(null);
      setCreditAmount("");
      setCreditReason("");
      refetchUsers();
    } catch (err: any) {
      toast({ title: "Error crediting wallet", description: err.message, variant: "destructive" });
    } finally {
      setIsCreditLoading(false);
    }
  };

  const handleAdminReply = async () => {
    if (!activeTicket || !replyText || !user) return;
    try {
      await replyTicketMutation.mutateAsync({
        ticketId: activeTicket.id,
        data: { userId: user.uid, message: replyText, isAdmin: true }
      });
      toast({ title: "Reply sent" });
      setReplyText("");
      refetchTickets();
      setActiveTicket(null);
    } catch (err: any) {
      toast({ title: "Error sending reply", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-primary">Admin Control Panel</h1>
        <p className="text-muted-foreground mt-2">Manage users, pricing, and system settings</p>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-8">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="tickets">Support</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-full text-primary"><Users className="h-6 w-6" /></div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Total Users</p>
                  <p className="text-2xl font-bold">{stats?.totalUsers || 0}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 dark:text-green-400"><CreditCard className="h-6 w-6" /></div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Total Revenue</p>
                  <p className="text-2xl font-bold">${stats?.totalRevenue?.toFixed(2) || "0.00"}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400"><Smartphone className="h-6 w-6" /></div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Active eSIMs</p>
                  <p className="text-2xl font-bold">{stats?.activeEsims || 0}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-full text-orange-600 dark:text-orange-400"><TicketIcon className="h-6 w-6" /></div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Open Tickets</p>
                  <p className="text-2xl font-bold">{stats?.openTickets || 0}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>View users, change roles, or manually credit wallets.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Wallet</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersData?.users?.map(u => (
                    <TableRow key={u.uid}>
                      <TableCell className="font-medium">{u.displayName || "Unknown"}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>${u.walletBalance?.toFixed(2) || "0.00"}</TableCell>
                      <TableCell>{u.totalOrders || 0}</TableCell>
                      <TableCell>
                        <Select defaultValue={u.role} onValueChange={(val) => handleRoleChange(u.uid, val)}>
                          <SelectTrigger className="w-24 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={() => setCreditTarget({ uid: u.uid, displayName: u.displayName || u.email || "User" })}
                        >
                          <Coins className="h-3.5 w-3.5" />
                          Add Credit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Global Pricing Markup</CardTitle>
              <CardDescription>
                Set the percentage markup applied to all wholesale eSIM prices.
                Current markup is {markupData?.markupPercentage || 0}%.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Markup Percentage</Label>
                <div className="relative">
                  <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    className="pl-9"
                    value={markupVal}
                    onChange={e => setMarkupVal(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={handleUpdateMarkup} disabled={updateMarkupMutation.isPending}>
                Save Pricing
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>All Tickets</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {ticketsData?.map(ticket => (
                    <div
                      key={ticket.id}
                      className={`p-4 cursor-pointer hover:bg-secondary/50 ${activeTicket?.id === ticket.id ? "bg-secondary" : ""}`}
                      onClick={() => setActiveTicket(ticket)}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-sm">{ticket.subject}</span>
                        <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full ${ticket.status === "open" ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"}`}>
                          {ticket.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">User: {ticket.userId}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {activeTicket && (
              <Card className="flex flex-col h-[600px]">
                <CardHeader className="border-b py-3">
                  <CardTitle className="text-base">{activeTicket.subject}</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                  {activeTicket.messages?.map((msg: any) => (
                    <div key={msg.id} className={`flex ${msg.senderType === "admin" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-lg p-3 text-sm ${msg.senderType === "admin" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                        {msg.senderType === "user" && <span className="text-[10px] font-bold block mb-1 opacity-70">User</span>}
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </CardContent>
                <div className="p-4 border-t space-y-3">
                  <Textarea
                    placeholder="Type admin reply..."
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    className="min-h-[80px]"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setActiveTicket(null)}>Close</Button>
                    <Button onClick={handleAdminReply} disabled={!replyText || replyTicketMutation.isPending}>Send Reply</Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Site Kimliği</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Logo Upload */}
              <div className="space-y-2">
                <Label>Site Logosu</Label>
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-secondary/30 flex-shrink-0">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="h-full w-full object-contain p-1" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-1 flex-1">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoUpload(file);
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={isUploadingLogo}
                      onClick={() => logoInputRef.current?.click()}
                    >
                      <Upload className="mr-2 h-3.5 w-3.5" />
                      {isUploadingLogo ? "Yükleniyor..." : "Logo Yükle"}
                    </Button>
                    <p className="text-xs text-muted-foreground">PNG, JPG, SVG — maks 2 MB</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Site Adı</Label>
                <Input value={siteName} onChange={e => setSiteName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Slogan</Label>
                <Input value={tagline} onChange={e => setTagline(e.target.value)} />
              </div>
              <Button onClick={handleUpdateSettings} disabled={updateSettingsMutation.isPending}>
                Ayarları Kaydet
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Credit Wallet Dialog */}
      <Dialog open={!!creditTarget} onOpenChange={(open) => !open && setCreditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Credit — {creditTarget?.displayName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Amount (USD)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className="pl-8 h-12 text-lg"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value ? Number(e.target.value) : "")}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Input
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                placeholder="e.g. Compensation, bonus, refund..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditTarget(null)}>Cancel</Button>
            <Button
              onClick={handleCredit}
              disabled={!creditAmount || Number(creditAmount) <= 0 || isCreditLoading}
            >
              <Coins className="mr-2 h-4 w-4" />
              {isCreditLoading ? "Processing..." : `Add $${creditAmount || "0"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
