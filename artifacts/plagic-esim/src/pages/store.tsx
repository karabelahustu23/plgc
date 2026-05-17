import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useListPackages, useGetWalletBalance, useListFamilyMembers } from "@workspace/api-client-react";
import { Loader2, ChevronLeft, Users } from "lucide-react";
import { safeArray } from "@/lib/safeArray";

export default function Store() {
  const { t } = useTranslation();
  const { locationCode } = useParams<{ locationCode: string }>();
  const { user } = useAuth();
  const [sortMode, setSortMode] = useState<"best_value" | "most_data" | "longest" | "cheapest">("best_value");
  const [selectedMember, setSelectedMember] = useState<string>("myself");
  const [showFamilyDialog, setShowFamilyDialog] = useState(false);

  const { data: packagesResp, isLoading } = useListPackages({ locationCode }, {
    query: {
      enabled: !!locationCode,
      queryKey: ["listPackages", { locationCode }],
      select: (data: any) => safeArray<any>(data?.data || data)
    }
  });

  const { data: balance } = useGetWalletBalance({ userId: user?.uid || "" }, {
    query: { enabled: !!user?.uid, queryKey: ["getWalletBalance", { userId: user?.uid || "" }] }
  });

  const { data: familyMembersResp } = useListFamilyMembers({ userId: user?.uid || "" }, {
    query: {
      enabled: !!user?.uid,
      queryKey: ["listFamilyMembers", { userId: user?.uid || "" }],
      select: (data: any) => safeArray<any>(data?.data || data)
    }
  });

  const familyMembers = useMemo(() => safeArray(familyMembersResp), [familyMembersResp]);
  const packages = useMemo(() => safeArray(packagesResp), [packagesResp]);

  const sortedPackages = useMemo(() => {
    const pkgs = [...packages];
    switch (sortMode) {
      case "best_value": return pkgs.sort((a, b) => (b.dataAmount * b.duration) / (b.price || 1) - (a.dataAmount * a.duration) / (a.price || 1));
      case "most_data": return pkgs.sort((a, b) => b.dataAmount - a.dataAmount);
      case "longest": return pkgs.sort((a, b) => b.duration - a.duration || b.dataAmount - a.dataAmount);
      case "cheapest": return pkgs.sort((a, b) => a.price - b.price);
      default: return pkgs;
    }
  }, [packages, sortMode]);

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground flex items-center justify-center min-h-[200px]"><Loader2 className="h-6 w-6 animate-spin mr-2" />{t("loading_packages")}...</div>;
  }

  const locationName = packages[0]?.locationName || locationCode || "";

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/"><Button variant="ghost" size="icon" className="shrink-0"><ChevronLeft className="h-5 w-5" /></Button></Link>
        <div><h1 className="text-2xl font-bold">{locationName} eSIM Paketleri</h1><p className="text-muted-foreground">{packages.length} paket bulundu</p></div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6 items-start sm:items-center justify-between">
        <Select value={sortMode} onValueChange={(v: any) => setSortMode(v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Sıralama" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="best_value">🏆 En İyi Değer</SelectItem>
            <SelectItem value="most_data">📦 En Çok Data</SelectItem>
            <SelectItem value="longest">📅 En Uzun Süre</SelectItem>
            <SelectItem value="cheapest">💰 En Ucuz</SelectItem>
          </SelectContent>
        </Select>

        <Dialog open={showFamilyDialog} onOpenChange={setShowFamilyDialog}>
          <DialogTrigger asChild><Button variant="outline" className="gap-2"><Users className="h-4 w-4" />{selectedMember === "myself" ? "Kendim" : familyMembers.find(m => m.id === selectedMember)?.name}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>eSIM'i Kimin İçin Alıyorsunuz?</DialogTitle></DialogHeader>
            <Select value={selectedMember} onValueChange={setSelectedMember}>
              <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="myself">👤 Kendim</SelectItem>
                {safeArray(familyMembers).map(member => <SelectItem key={member.id} value={member.id}>{member.emoji || "👤"} {member.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </DialogContent>
        </Dialog>
      </div>

      {safeArray(sortedPackages).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">{t("no_packages_available")}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {safeArray(sortedPackages).map((pkg: any, idx: number) => (
            <Card key={pkg.id || idx} className="hover-elevate transition-all">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{pkg.dataAmount} GB • {pkg.duration} {t("days")}</CardTitle>
                  <Badge variant={pkg.isPopular ? "default" : "secondary"}>{pkg.isPopular ? "🔥 Popüler" : pkg.category}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-3xl font-bold text-primary">${pkg.price?.toFixed(2)}</div>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>✓ {pkg.coverage || "Global"} kapsama</li>
                  <li>✓ Hemen aktivasyon</li>
                  <li>✓ QR kod ile kurulum</li>
                </ul>
                <Button className="w-full" asChild><Link href={`/checkout?package=${pkg.id}&member=${selectedMember}`}>{t("buy_now")}</Link></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}