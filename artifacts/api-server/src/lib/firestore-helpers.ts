import { adminDb } from "./firebase-admin";
import { logger } from "./logger";

// ─── Tier & Badge System ────────────────────────────────────────────────────

export const USER_TIERS = [
  { id: "silver",   name: "Silver",   badge: "🥈", minSpend: 0,    discount: 0,  color: "slate" },
  { id: "gold",     name: "Gold",     badge: "🥇", minSpend: 50,   discount: 3,  color: "yellow" },
  { id: "platinum", name: "Platinum", badge: "💎", minSpend: 200,  discount: 7,  color: "cyan" },
  { id: "diamond",  name: "Diamond",  badge: "💠", minSpend: 500,  discount: 12, color: "violet" },
] as const;

export const BADGES = [
  { id: "first_trip",       name: "İlk Seyahat",       icon: "✈️",  description: "İlk eSIM satın alındı" },
  { id: "data_monster",     name: "Veri Canavarı",      icon: "🦖",  description: "Toplam 10 GB satın alındı" },
  { id: "globe_trotter",    name: "Gezgin",             icon: "🌍",  description: "5 farklı ülke için eSIM alındı" },
  { id: "gold_member",      name: "Altın Üye",          icon: "🥇",  description: "Gold seviyesine ulaşıldı" },
  { id: "diamond_member",   name: "Elmas Üye",          icon: "💠",  description: "Diamond seviyesine ulaşıldı" },
  { id: "loyal_shopper",    name: "Sadık Müşteri",      icon: "💖",  description: "10 sipariş tamamlandı" },
] as const;

export type TierId = typeof USER_TIERS[number]["id"];
export type BadgeId = typeof BADGES[number]["id"];

export function getTierForSpend(totalSpent: number): typeof USER_TIERS[number] {
  const tiers = [...USER_TIERS];
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (totalSpent >= tiers[i].minSpend) return tiers[i];
  }
  return USER_TIERS[0];
}

export async function updateUserStatsAfterOrder(
  userId: string,
  orderAmount: number,
  locationCode: string,
  dataGB: number,
): Promise<void> {
  try {
    const userRef = adminDb.collection("users").doc(userId);
    const snap = await userRef.get();
    const data = snap.data() || {};

    const totalSpent    = (data.totalSpent    || 0) + orderAmount;
    const orderCount    = (data.orderCount    || 0) + 1;
    const totalDataGB   = (data.totalDataGB   || 0) + dataGB;
    const visitedCountries = new Set<string>([...(data.visitedCountries || []), locationCode]);
    const tier = getTierForSpend(totalSpent);
    const badges = new Set<string>(data.badges || []);

    if (orderCount >= 1)                    badges.add("first_trip");
    if (totalDataGB >= 10)                  badges.add("data_monster");
    if (visitedCountries.size >= 5)         badges.add("globe_trotter");
    if (orderCount >= 10)                   badges.add("loyal_shopper");
    if (tier.id === "gold" || tier.id === "platinum" || tier.id === "diamond") badges.add("gold_member");
    if (tier.id === "diamond")              badges.add("diamond_member");

    await userRef.update({
      totalSpent,
      orderCount,
      totalDataGB,
      visitedCountries: Array.from(visitedCountries),
      tier: tier.id,
      badges: Array.from(badges),
    });

    logger.info({ userId, tier: tier.id, totalSpent, orderCount }, "User stats updated");
  } catch (err) {
    logger.error({ err }, "Failed to update user stats");
  }
}

export async function getWalletBalance(userId: string): Promise<number> {
  const snap = await adminDb.collection("wallets").doc(userId).get();
  if (!snap.exists) {
    await adminDb.collection("wallets").doc(userId).set({ balance: 0, currency: "USD", updatedAt: new Date() });
    return 0;
  }
  return snap.data()?.balance ?? 0;
}

export async function deductWallet(userId: string, amount: number, description: string, relatedOrderId?: string): Promise<number> {
  const walletRef = adminDb.collection("wallets").doc(userId);
  const transactionRef = adminDb.collection("walletTransactions").doc();

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(walletRef);
    const current = snap.data()?.balance ?? 0;

    if (current < amount) {
      throw new Error("Insufficient wallet balance");
    }

    const newBalance = current - amount;
    tx.update(walletRef, { balance: newBalance, updatedAt: new Date() });
    tx.set(transactionRef, {
      id: transactionRef.id,
      userId,
      amount: -amount,
      type: "purchase",
      description,
      relatedOrderId: relatedOrderId || null,
      createdAt: new Date(),
    });

    return newBalance;
  });
}

export async function creditWallet(userId: string, amount: number, type: string, description: string, relatedOrderId?: string): Promise<number> {
  const walletRef = adminDb.collection("wallets").doc(userId);
  const transactionRef = adminDb.collection("walletTransactions").doc();

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(walletRef);
    const current = snap.data()?.balance ?? 0;
    const newBalance = current + amount;

    tx.update(walletRef, { balance: newBalance, updatedAt: new Date() });
    tx.set(transactionRef, {
      id: transactionRef.id,
      userId,
      amount,
      type,
      description,
      relatedOrderId: relatedOrderId || null,
      createdAt: new Date(),
    });

    return newBalance;
  });
}

export async function getSiteSettings(): Promise<Record<string, unknown>> {
  const snap = await adminDb.collection("settings").doc("site").get();
  if (!snap.exists) {
    const defaults = {
      siteName: "Plagic eSIM",
      logoUrl: null,
      primaryColor: "#D97757",
      accentColor: "#D97757",
      tagline: "Leave the SIM card. Take the world.",
      supportEmail: "support@plagicesim.com",
      markupPercentage: 20,
    };
    await adminDb.collection("settings").doc("site").set(defaults);
    return defaults;
  }
  return snap.data() as Record<string, unknown>;
}

export function applyMarkup(price: number, markupPct: number): number {
  return Math.round((price * (1 + markupPct / 100)) * 100) / 100;
}

export async function getUserRole(userId: string): Promise<string> {
  const snap = await adminDb.collection("users").doc(userId).get();
  return snap.data()?.role ?? "user";
}

export async function checkReferralAndReward(newUserId: string, referralCode: string): Promise<void> {
  try {
    const usersSnap = await adminDb.collection("users")
      .where("referralCode", "==", referralCode)
      .limit(1)
      .get();

    if (usersSnap.empty) return;

    const referrer = usersSnap.docs[0];
    if (referrer.id === newUserId) return;

    await adminDb.collection("users").doc(newUserId).update({ referredBy: referrer.id });

    logger.info({ referrerId: referrer.id, newUserId }, "Referral code applied");
  } catch (err) {
    logger.error({ err }, "Error applying referral code");
  }
}

export async function processReferralReward(userId: string, topupAmount: number): Promise<void> {
  try {
    const userSnap = await adminDb.collection("users").doc(userId).get();
    const referrerId = userSnap.data()?.referredBy;
    if (!referrerId) return;

    const REWARD_PER_20 = 2;
    const THRESHOLD = 20;
    const rewardsCount = Math.floor(topupAmount / THRESHOLD);
    if (rewardsCount < 1) return;

    const rewardAmount = rewardsCount * REWARD_PER_20;
    await creditWallet(referrerId, rewardAmount, "referral", `Referral reward for user topup of $${topupAmount}`);
    logger.info({ referrerId, userId, rewardAmount }, "Referral reward credited");
  } catch (err) {
    logger.error({ err }, "Error processing referral reward");
  }
}
