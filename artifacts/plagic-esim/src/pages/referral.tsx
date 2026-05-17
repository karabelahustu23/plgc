import { useAuth } from "@/context/AuthContext";
import { useGetReferralInfo, getGetReferralInfoQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, Share2, Users, Coins } from "lucide-react";

export default function Referral() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const { data: refInfo, isLoading } = useGetReferralInfo(
    { userId: user?.uid || "" },
    { query: { enabled: !!user?.uid, queryKey: getGetReferralInfoQueryKey({ userId: user?.uid || "" }) } }
  );

  const referralCode = refInfo?.referralCode || "Loading...";
  const shareUrl = `${window.location.origin}/login?ref=${referralCode}`;

  const copyToClipboard = async (text: string, description: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ description });
    } catch (err) {
      toast({ description: "Failed to copy", variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="text-center mb-12 space-y-4">
        <h1 className="font-serif text-4xl font-bold text-primary">Refer & Earn</h1>
        <p className="text-xl text-muted-foreground max-w-xl mx-auto">
          Give your friends global connectivity. <br/>
          Earn $2 for every $20 they add to their wallet.
        </p>
      </div>

      <Card className="mb-12 border-primary/20 shadow-md">
        <CardContent className="p-8 md:p-12 text-center space-y-8">
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Your Invite Code</p>
            <div className="flex items-center justify-center gap-4">
              <div className="bg-secondary px-8 py-4 rounded-xl text-3xl font-mono tracking-widest font-bold">
                {referralCode}
              </div>
              <Button size="icon" variant="outline" className="h-16 w-16 rounded-xl" onClick={() => copyToClipboard(referralCode, "Code copied to clipboard")}>
                <Copy className="h-6 w-6" />
              </Button>
            </div>
          </div>
          
          <div className="space-y-2 pt-6 border-t">
            <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Your Invite Link</p>
            <div className="flex items-center justify-center gap-2 max-w-md mx-auto">
              <div className="bg-secondary px-4 py-3 rounded-lg text-sm truncate flex-1 text-left text-muted-foreground">
                {shareUrl}
              </div>
              <Button onClick={() => copyToClipboard(shareUrl, "Link copied to clipboard")}>
                <Share2 className="mr-2 h-4 w-4" /> Share
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6 flex items-center gap-6">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-3xl font-bold">{refInfo?.totalReferrals || 0}</p>
              <p className="text-muted-foreground">Friends Invited</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 flex items-center gap-6">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Coins className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-3xl font-bold">${refInfo?.totalEarnings?.toFixed(2) || "0.00"}</p>
              <p className="text-muted-foreground">Total Earned</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
