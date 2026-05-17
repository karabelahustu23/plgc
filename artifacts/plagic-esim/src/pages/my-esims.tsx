import { useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useListOrders } from "@workspace/api-client-react";
import { Loader2, RefreshCw, AlertCircle, QrCode, Package } from "lucide-react";
import { safeArray } from "@/lib/safeArray";

const normalizeStatus = (s: string) => s?.toLowerCase?.() || "";

function PendingCard({ order, onRefresh }: { order: any; onRefresh: () => void }) {
  const [isChecking, setIsChecking] = useState(false);
  const checkStatus = async () => {
    setIsChecking(true);
    try { await fetch(`/api/orders/${order.id}`); setTimeout(() => { onRefresh(); setIsChecking(false); }, 1000); }
    catch { setIsChecking(false); }
  };
  return (
    <Card className="overflow-hidden border-orange-200 dark:border-orange-800/40">
      <CardHeader className="bg-orange-50 dark:bg-orange-900/20 pb-4">
        <div className="flex justify-between items-start">
          <div><CardTitle className="font-serif text-xl">{order.locationName || order.locationCode} eSIM</CardTitle><p className="text-sm text-muted-foreground mt-1">{order.packageName}</p></div>
          <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900/50 dark:text-orange-300">Hazırlanıyor</span>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="flex items-start gap-3 text-sm text-muted-foreground mb-4"><AlertCircle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" /><p>eSIM'iniz hazırlanıyor. Bu birkaç dakika sürebilir.</p></div>
        <div className="text-sm text-muted-foreground space-y-1 mb-4"><p>Satın alma: {new Date(order.createdAt).toLocaleString()}</p><p>Tutar: ${order.amount?.toFixed(2) || "0.00"}</p></div>
        <Button variant="outline" className="w-full gap-2" onClick={checkStatus} disabled={isChecking}>{isChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{isChecking ? "Kontrol ediliyor..." : "Durumu Kontrol Et"}</Button>
      </CardContent>
    </Card>
  );
}

export default function MyEsims() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: ordersResp, isLoading, refetch } = useListOrders({ userId: user?.uid || "" }, {
    query: {
      enabled: !!user?.uid,
      queryKey: ["listOrders", { userId: user?.uid || "" }],
      select: (data: any) => safeArray<any>(data?.data || data)
    }
  });

  const orders = useMemo(() => safeArray(ordersResp), [ordersResp]);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground flex items-center justify-center min-h-[200px]"><Loader2 className="h-6 w-6 animate-spin mr-2" />Yükleniyor...</div>;

  const activeOrders = orders.filter(o => ["active", "completed"].includes(normalizeStatus(o.status)));
  const pendingOrders = orders.filter(o => normalizeStatus(o.status) === "pending");
  const inactiveOrders = orders.filter(o => !["active", "completed", "pending"].includes(normalizeStatus(o.status)));

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["listOrders", { userId: user?.uid || "" }] });
    refetch();
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">eSIM'lerim</h1>
      <Tabs defaultValue={pendingOrders.length > 0 && activeOrders.length === 0 ? "pending" : "active"} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="active">Aktif ({activeOrders.length})</TabsTrigger>
          {pendingOrders.length > 0 && <TabsTrigger value="pending">Hazırlanıyor ({pendingOrders.length})</TabsTrigger>}
          <TabsTrigger value="inactive">Geçmiş ({inactiveOrders.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-6">
          {safeArray(activeOrders).length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground"><Package className="h-12 w-12 mx-auto mb-3 opacity-50" /><p>Aktif eSIM'iniz yok.</p></CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {safeArray(activeOrders).map(order => (
                <Card key={order.id} className="hover-elevate">
                  <CardHeader className="pb-3"><div className="flex justify-between items-start"><CardTitle className="text-lg">{order.locationName} eSIM</CardTitle><Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Aktif</Badge></div></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg"><QrCode className="h-8 w-8 text-primary" /><div className="text-sm"><p className="font-medium">QR Kod</p><p className="text-muted-foreground">Kameralı cihazla okutun</p></div></div>
                    <div className="text-sm text-muted-foreground space-y-1"><p>Data: {order.dataAmount} GB</p><p>Süre: {order.duration} gün</p><p>Bakiye: ${order.remainingBalance?.toFixed(2) || "0.00"}</p></div>
                    <Button variant="outline" className="w-full">QR Kodu Göster</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {pendingOrders.length > 0 && (
          <TabsContent value="pending" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {safeArray(pendingOrders).map(order => <PendingCard key={order.id} order={order} onRefresh={handleRefresh} />)}
            </div>
          </TabsContent>
        )}

        <TabsContent value="inactive" className="space-y-6">
          {inactiveOrders.length === 0 ? <Card><CardContent className="p-8 text-center text-muted-foreground"><p>Geçmiş siparişiniz yok.</p></CardContent></Card> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {safeArray(inactiveOrders).map(order => (
                <Card key={order.id} className="opacity-75">
                  <CardHeader className="pb-3"><div className="flex justify-between items-start"><CardTitle className="text-lg">{order.locationName} eSIM</CardTitle><Badge variant="secondary">{order.status}</Badge></div></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()} • ${order.amount?.toFixed(2)}</p></CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}