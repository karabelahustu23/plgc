import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useGetWalletBalance, getGetWalletBalanceQueryKey, useListWalletTransactions, getListWalletTransactionsQueryKey, useApplyRedeemCode } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownRight, Gift, History, CreditCard } from "lucide-react";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";

export default function Wallet() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [isTopupOpen, setIsTopupOpen] = useState(false);
  const [isRedeemOpen, setIsRedeemOpen] = useState(false);
  const [amount, setAmount] = useState<number | "">("");
  const [redeemCode, setRedeemCode] = useState("");
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  const { data: balance, refetch: refetchBalance } = useGetWalletBalance(
    { userId: user?.uid || "" },
    { query: { enabled: !!user?.uid, queryKey: getGetWalletBalanceQueryKey({ userId: user?.uid || "" }) } }
  );

  const { data: transactions, isLoading: isTxLoading, refetch: refetchTx } = useListWalletTransactions(
    { userId: user?.uid || "" },
    { query: { enabled: !!user?.uid, queryKey: getListWalletTransactionsQueryKey({ userId: user?.uid || "" }) } }
  );

  const applyRedeemMutation = useApplyRedeemCode();

  const onPaymentSuccess = useCallback(() => {
    toast({ title: "Ödeme başarılı!", description: "Bakiyeniz güncellendi." });
    refetchBalance();
    refetchTx();
  }, [refetchBalance, refetchTx, toast]);

  useEffect(() => {
    initializePaddle({
      environment: "production",
      token: import.meta.env.VITE_PADDLE_CLIENT_TOKEN || "",
      eventCallback: (event) => {
        if (event.name === "checkout.completed") {
          onPaymentSuccess();
        }
      },
    })
      .then((p) => { if (p) setPaddle(p); })
      .catch((err) => console.error("Paddle init failed:", err));
  }, [onPaymentSuccess]);

  const handleTopup = async () => {
    if (!amount || Number(amount) < 5) {
      toast({ title: "Geçersiz tutar", description: "Minimum yükleme $5'tır.", variant: "destructive" });
      return;
    }

    setIsCheckoutLoading(true);
    setIsTopupOpen(false);

    try {
      const resp = await fetch("/api/wallet/paddle-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user!.uid, amount: Number(amount) }),
      });

      if (!resp.ok) {
        const err = await resp.json() as any;
        throw new Error(err.error || "Ödeme başlatılamadı");
      }

      const { transactionId, checkoutUrl } = await resp.json() as { transactionId: string; checkoutUrl: string | null };

      if (paddle && transactionId) {
        paddle.Checkout.open({
          transactionId,
          settings: { displayMode: "overlay", theme: "light" },
        });
      } else if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        throw new Error("Paddle henüz yapılandırılmamış — PADDLE_API_KEY gerekli.");
      }

      setAmount("");
    } catch (error: any) {
      toast({ title: "Ödeme hatası", description: error.message, variant: "destructive" });
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const handleRedeem = async () => {
    if (!redeemCode || !user) return;

    try {
      await applyRedeemMutation.mutateAsync({
        data: { userId: user.uid, code: redeemCode }
      });

      toast({ title: "Kod başarıyla kullanıldı!" });
      setIsRedeemOpen(false);
      setRedeemCode("");
      refetchBalance();
      refetchTx();
    } catch (error: any) {
      toast({ title: "Kod kullanılamadı", description: error.message, variant: "destructive" });
    }
  };

  const presetAmounts = [10, 20, 50, 100];

  const getTxIcon = (type: string) => {
    const isCredit = ["TOPUP", "REFERRAL", "REDEEM", "ADMIN_CREDIT"].includes(type?.toUpperCase());
    return isCredit
      ? <ArrowDownRight className="h-5 w-5" />
      : <ArrowUpRight className="h-5 w-5" />;
  };

  const isCreditTx = (type: string) => ["TOPUP", "REFERRAL", "REDEEM", "ADMIN_CREDIT"].includes(type?.toUpperCase());

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold">Cüzdan</h1>
        <p className="text-muted-foreground mt-2">Bakiyenizi yönetin ve işlemleri görüntüleyin</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="md:col-span-2 bg-primary text-primary-foreground border-transparent">
          <CardContent className="p-8 flex flex-col justify-between h-full">
            <div className="flex items-center gap-2 text-primary-foreground/80 mb-8">
              <WalletIcon className="h-5 w-5" />
              <span className="font-medium uppercase tracking-wider text-sm">Mevcut Bakiye</span>
            </div>
            <div>
              <p className="text-5xl font-bold tracking-tight">${balance?.balance?.toFixed(2) || "0.00"}</p>
              <p className="text-primary-foreground/80 mt-2">Bu bakiyeyi herhangi bir eSIM satın almak için kullanın</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Button
            className="h-full min-h-[100px] text-lg rounded-xl shadow-sm flex-col gap-2"
            onClick={() => setIsTopupOpen(true)}
            disabled={isCheckoutLoading}
          >
            <CreditCard className="h-6 w-6" />
            {isCheckoutLoading ? "Yükleniyor..." : "Bakiye Yükle"}
          </Button>
          <Button variant="outline" className="h-full min-h-[100px] text-lg rounded-xl flex-col gap-2" onClick={() => setIsRedeemOpen(true)}>
            <Gift className="h-6 w-6" />
            Kod Kullan
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> İşlem Geçmişi
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isTxLoading ? (
            <div className="text-center py-8 text-muted-foreground">Yükleniyor...</div>
          ) : !transactions?.length ? (
            <div className="text-center py-12 text-muted-foreground">Henüz işlem yok.</div>
          ) : (
            <div className="space-y-1">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                      isCreditTx(tx.type)
                        ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                    }`}>
                      {getTxIcon(tx.type)}
                    </div>
                    <div>
                      <p className="font-medium">{tx.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</span>
                        <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                          {tx.type}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={`font-bold tabular-nums ${isCreditTx(tx.type) ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {isCreditTx(tx.type) ? "+" : "-"}${Math.abs(tx.amount).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Topup Dialog */}
      <Dialog open={isTopupOpen} onOpenChange={setIsTopupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bakiye Yükle</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-3">
              {presetAmounts.map(preset => (
                <Button
                  key={preset}
                  variant={amount === preset ? "default" : "outline"}
                  className="h-14 text-lg"
                  onClick={() => setAmount(preset)}
                >
                  ${preset}
                </Button>
              ))}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Özel Tutar</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  min="5"
                  className="pl-8 text-lg h-12"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
                  placeholder="Min $5"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Güvenli ödeme Paddle tarafından işleniyor
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTopupOpen(false)}>İptal</Button>
            <Button
              onClick={handleTopup}
              disabled={!amount || Number(amount) < 5 || isCheckoutLoading}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              {isCheckoutLoading ? "Yükleniyor..." : `$${amount || "0"} Öde`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Redeem Dialog */}
      <Dialog open={isRedeemOpen} onOpenChange={setIsRedeemOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kod Kullan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Hediye Kartı veya Promosyon Kodu</label>
              <Input
                className="uppercase h-12 text-lg tracking-wider"
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value)}
                placeholder="XXXX-XXXX-XXXX"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRedeemOpen(false)}>İptal</Button>
            <Button onClick={handleRedeem} disabled={!redeemCode || applyRedeemMutation.isPending}>
              {applyRedeemMutation.isPending ? "Uygulanıyor..." : "Kodu Kullan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
