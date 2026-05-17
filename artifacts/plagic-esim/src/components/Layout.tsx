import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "react-i18next";
import { Globe, Wifi, Users, Wallet, User as UserIcon, LogOut, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetWalletBalance, getGetWalletBalanceQueryKey } from "@workspace/api-client-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function TopNav() {
  const [location] = useLocation();
  const { user, profile, logout } = useAuth();
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  const { data: balance } = useGetWalletBalance(
    { userId: user?.uid || "" },
    { query: { enabled: !!user?.uid, queryKey: getGetWalletBalanceQueryKey({ userId: user?.uid || "" }) } }
  );

  if (!user) return null;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 hidden md:block">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-serif text-xl font-bold text-primary">Plagic eSIM</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link href="/" className={`transition-colors hover:text-foreground/80 ${location === "/" ? "text-foreground" : "text-foreground/60"}`}>
              {t("nav.store")}
            </Link>
            <Link href="/my-esims" className={`transition-colors hover:text-foreground/80 ${location === "/my-esims" ? "text-foreground" : "text-foreground/60"}`}>
              {t("nav.myEsims")}
            </Link>
            <Link href="/family" className={`transition-colors hover:text-foreground/80 ${location === "/family" ? "text-foreground" : "text-foreground/60"}`}>
              {t("nav.family")}
            </Link>
            <Link href="/wallet" className={`transition-colors hover:text-foreground/80 ${location === "/wallet" ? "text-foreground" : "text-foreground/60"}`}>
              {t("nav.wallet")}
            </Link>
            <Link href="/support" className={`transition-colors hover:text-foreground/80 ${location === "/support" ? "text-foreground" : "text-foreground/60"}`}>
              {t("nav.support")}
            </Link>
            {profile?.role === "admin" && (
              <Link href="/admin" className={`transition-colors hover:text-foreground/80 ${location === "/admin" ? "text-foreground" : "text-foreground/60"}`}>
                {t("admin.title")}
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/wallet" className="flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-sm font-medium transition-colors hover:bg-secondary/80">
            <Wallet className="h-4 w-4 text-primary" />
            <span>${balance?.balance?.toFixed(2) || "0.00"}</span>
          </Link>
          
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary">{profile?.displayName?.charAt(0)?.toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{profile?.displayName}</p>
                  <p className="text-xs leading-none text-muted-foreground">{profile?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="w-full cursor-pointer">
                  <UserIcon className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/referral" className="w-full cursor-pointer">
                  <Users className="mr-2 h-4 w-4" />
                  <span>Refer & Earn</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logout()} className="text-destructive cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation();

  if (!user) return null;

  return (
    <div className="fixed bottom-0 left-0 z-50 w-full border-t bg-background pb-safe md:hidden">
      <div className="flex h-16 justify-around">
        <Link href="/" className={`flex flex-col items-center justify-center w-full space-y-1 ${location === "/" ? "text-primary" : "text-muted-foreground"}`}>
          <Globe className="h-5 w-5" />
          <span className="text-[10px] font-medium">{t("nav.store")}</span>
        </Link>
        <Link href="/my-esims" className={`flex flex-col items-center justify-center w-full space-y-1 ${location === "/my-esims" ? "text-primary" : "text-muted-foreground"}`}>
          <Wifi className="h-5 w-5" />
          <span className="text-[10px] font-medium">{t("nav.myEsims")}</span>
        </Link>
        <Link href="/family" className={`flex flex-col items-center justify-center w-full space-y-1 ${location === "/family" ? "text-primary" : "text-muted-foreground"}`}>
          <Users className="h-5 w-5" />
          <span className="text-[10px] font-medium">{t("nav.family")}</span>
        </Link>
        <Link href="/wallet" className={`flex flex-col items-center justify-center w-full space-y-1 ${location === "/wallet" ? "text-primary" : "text-muted-foreground"}`}>
          <Wallet className="h-5 w-5" />
          <span className="text-[10px] font-medium">{t("nav.wallet")}</span>
        </Link>
        <Link href="/profile" className={`flex flex-col items-center justify-center w-full space-y-1 ${location === "/profile" ? "text-primary" : "text-muted-foreground"}`}>
          <UserIcon className="h-5 w-5" />
          <span className="text-[10px] font-medium">Profile</span>
        </Link>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (user && profile && !profile.onboardingCompleted && location !== "/onboarding" && location !== "/login") {
      setLocation("/onboarding");
    }
  }, [user, profile, location, setLocation]);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <TopNav />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <BottomNav />
    </div>
  );
}
