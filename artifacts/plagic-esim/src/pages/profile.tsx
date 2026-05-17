import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { updateProfile } from "firebase/auth";
import { User, LogOut, Settings, Globe, Moon, Trophy, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const USER_TIERS = [
  { id: "silver",   name: "Silver",   badge: "🥈", minSpend: 0,    maxSpend: 50,   discount: 0,  bg: "from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700" },
  { id: "gold",     name: "Gold",     badge: "🥇", minSpend: 50,   maxSpend: 200,  discount: 3,  bg: "from-yellow-50 to-yellow-100 dark:from-yellow-900/30 dark:to-yellow-800/30" },
  { id: "platinum", name: "Platinum", badge: "💎", minSpend: 200,  maxSpend: 500,  discount: 7,  bg: "from-cyan-50 to-cyan-100 dark:from-cyan-900/30 dark:to-cyan-800/30" },
  { id: "diamond",  name: "Diamond",  badge: "💠", minSpend: 500,  maxSpend: Infinity, discount: 12, bg: "from-violet-50 to-violet-100 dark:from-violet-900/30 dark:to-violet-800/30" },
];

const ALL_BADGES = [
  { id: "first_trip",     name: "İlk Seyahat",  icon: "✈️", description: "İlk eSIM satın alındı" },
  { id: "data_monster",   name: "Veri Canavarı", icon: "🦖", description: "10 GB toplam data satın alındı" },
  { id: "globe_trotter",  name: "Gezgin",        icon: "🌍", description: "5 farklı ülke için eSIM alındı" },
  { id: "gold_member",    name: "Altın Üye",     icon: "🥇", description: "Gold seviyesine ulaşıldı" },
  { id: "diamond_member", name: "Elmas Üye",     icon: "💠", description: "Diamond seviyesine ulaşıldı" },
  { id: "loyal_shopper",  name: "Sadık Müşteri", icon: "💖", description: "10 sipariş tamamlandı" },
];

export default function Profile() {
  const { user, profile, refreshProfile, logout } = useAuth();
  const { i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState(profile?.displayName || "");
  const [isSaving, setIsSaving] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ["userStats", user?.uid],
    queryFn: async () => {
      if (!user) return null;
      const snap = await getDoc(doc(db, "users", user.uid));
      return snap.data() || null;
    },
    enabled: !!user,
  });

  const totalSpent = stats?.totalSpent || 0;
  const tierData = [...USER_TIERS].reverse().find(t => totalSpent >= t.minSpend) || USER_TIERS[0];
  const nextTier = USER_TIERS.find(t => t.minSpend > totalSpent);
  const earnedBadges: string[] = stats?.badges || [];
  const progressPct = nextTier
    ? Math.min(100, ((totalSpent - tierData.minSpend) / (nextTier.minSpend - tierData.minSpend)) * 100)
    : 100;

  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateProfile(user, { displayName });
      await refreshProfile();
      toast({ title: "Profil güncellendi" });
    } catch (err: any) {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold">Profil Ayarları</h1>
        <p className="text-muted-foreground mt-2">Hesabınızı ve tercihlerinizi yönetin</p>
      </div>

      <div className="space-y-6">
        {/* Tier Card */}
        <Card className={cn("bg-gradient-to-br border-0 overflow-hidden", tierData.bg)}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Mevcut Seviye</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-3xl">{tierData.badge}</span>
                  <span className="text-2xl font-bold font-serif">{tierData.name}</span>
                </div>
                {tierData.discount > 0 && (
                  <p className="text-sm text-primary font-medium mt-1">
                    %{tierData.discount} indirim aktif
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Toplam harcama</p>
                <p className="text-xl font-bold">${totalSpent.toFixed(2)}</p>
              </div>
            </div>
            {nextTier && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{tierData.name}</span>
                  <span>{nextTier.badge} ${nextTier.minSpend} harcayınca {nextTier.name}</span>
                </div>
                <Progress value={progressPct} className="h-2" />
                <p className="text-xs text-muted-foreground text-right">
                  ${(nextTier.minSpend - totalSpent).toFixed(2)} kaldı
                </p>
              </div>
            )}
            {!nextTier && (
              <p className="text-sm font-medium text-primary">En yüksek seviyedesiniz! 🎉</p>
            )}
          </CardContent>
        </Card>

        {/* Badges */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="h-5 w-5" /> Rozetler & Başarımlar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TooltipProvider>
              <div className="grid grid-cols-3 gap-3">
                {ALL_BADGES.map(badge => {
                  const earned = earnedBadges.includes(badge.id);
                  return (
                    <Tooltip key={badge.id}>
                      <TooltipTrigger asChild>
                        <div className={cn(
                          "flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 cursor-default transition-all",
                          earned
                            ? "border-primary/30 bg-primary/5"
                            : "border-dashed border-muted-foreground/20 opacity-40 grayscale"
                        )}>
                          <span className="text-2xl">{badge.icon}</span>
                          <p className="text-xs font-medium text-center leading-tight">{badge.name}</p>
                          {earned && <Star className="h-2.5 w-2.5 fill-primary text-primary" />}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{badge.description}</p>
                        {!earned && <p className="text-xs opacity-70 mt-0.5">Henüz kazanılmadı</p>}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>
          </CardContent>
        </Card>

        {/* Personal Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5" /> Kişisel Bilgiler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>E-posta</Label>
              <Input value={user?.email || ""} disabled className="bg-secondary/50" />
              <p className="text-xs text-muted-foreground">E-posta adresi değiştirilemez.</p>
            </div>
            <div className="space-y-2">
              <Label>Görünen Ad</Label>
              <Input value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <Button onClick={handleUpdateProfile} disabled={isSaving || displayName === profile?.displayName}>
              {isSaving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
            </Button>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5" /> Tercihler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> Dil</Label>
                <p className="text-sm text-muted-foreground">Uygulama dilini seçin.</p>
              </div>
              <Select value={i18n.language} onValueChange={lang => i18n.changeLanguage(lang)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="tr">Türkçe</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="zh">中文</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="space-y-0.5">
                <Label className="text-base flex items-center gap-2"><Moon className="h-4 w-4" /> Karanlık Mod</Label>
                <p className="text-sm text-muted-foreground">Açık ve karanlık tema arasında geçiş yapın.</p>
              </div>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/20">
          <CardContent className="p-6">
            <Button variant="destructive" className="w-full sm:w-auto" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" /> Çıkış Yap
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
