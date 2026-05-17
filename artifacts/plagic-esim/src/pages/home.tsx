import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { safeArray } from "@/lib/safeArray";

interface CountryDeal {
  locationCode: string;
  name: string;
  flagEmoji: string;
  fromPrice: number;
  pricePerGB: number;
  bestDuration: number;
  dataGB: number;
}

const DURATION_OPTIONS = [
  { label: "Tümü", value: 0 },
  { label: "7 gün", value: 7 },
  { label: "15 gün", value: 15 },
  { label: "30 gün", value: 30 },
];

export default function Home() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [minDuration, setMinDuration] = useState(0);
  const [deals, setDeals] = useState<CountryDeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDeals = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/esim/country-deals");
        const json = await res.json();
        setDeals(safeArray<CountryDeal>(json?.data || json));
      } catch (err) {
        console.error("Deals fetch error:", err);
        setDeals([]);
      } finally {
        setLoading(false);
      }
    };
    fetchDeals();
  }, []);

  const filtered = useMemo(() => {
    const safeDeals = safeArray(deals);
    return safeDeals
      .filter(d => minDuration === 0 || d.bestDuration >= minDuration)
      .filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
  }, [deals, search, minDuration]);

  const displayed = search ? filtered : safeArray(deals).slice(0, 60);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="relative max-w-md mx-auto mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("search_country")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-semibold">{t("popular_destinations")}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {DURATION_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setMinDuration(opt.value)} className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium border transition-colors",
              minDuration === opt.value ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:border-primary/50"
            )}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : displayed.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {safeArray(displayed).map((deal, idx) => (
            <Link key={deal.locationCode || idx} href={`/store/${deal.locationCode}`}>
              <Card className="hover-elevate cursor-pointer border-transparent transition-all hover:border-primary/30 hover:shadow-md relative">
                <CardContent className="p-4 flex flex-col items-center text-center space-y-2">
                  <span className="text-3xl">{deal.flagEmoji || "🌍"}</span>
                  <p className="font-medium text-sm leading-tight">{deal.name}</p>
                  <p className="text-xs font-semibold text-primary">${deal.fromPrice?.toFixed(2) || "0.00"}'den</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">{search ? t("no_results") : t("no_deals_available")}</div>
      )}
    </div>
  );
}