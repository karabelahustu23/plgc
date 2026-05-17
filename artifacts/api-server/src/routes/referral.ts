import { Router, type IRouter } from "express";
import {
  GetReferralInfoQueryParams,
  ApplyReferralCodeBody,
} from "@workspace/api-zod";
import { adminDb } from "../lib/firebase-admin";
import { checkReferralAndReward } from "../lib/firestore-helpers";

const router: IRouter = Router();

router.get("/referral/info", async (req, res): Promise<void> => {
  const parsed = GetReferralInfoQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userSnap = await adminDb.collection("users").doc(parsed.data.userId).get();
  if (!userSnap.exists) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const user = userSnap.data()!;
  const referralCode = user.referralCode || `PLG${parsed.data.userId.slice(0, 6).toUpperCase()}`;

  const referralsSnap = await adminDb.collection("users")
    .where("referredBy", "==", parsed.data.userId)
    .get();

  const txSnap = await adminDb.collection("walletTransactions")
    .where("userId", "==", parsed.data.userId)
    .where("type", "==", "referral")
    .get();

  const totalEarnings = txSnap.docs.reduce((sum, d) => sum + (d.data().amount || 0), 0);

  res.json({
    userId: parsed.data.userId,
    referralCode,
    totalReferrals: referralsSnap.size,
    totalEarnings,
    pendingEarnings: 0,
  });
});

router.post("/referral/apply", async (req, res): Promise<void> => {
  const parsed = ApplyReferralCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await checkReferralAndReward(parsed.data.userId, parsed.data.referralCode);

  const userSnap = await adminDb.collection("users").doc(parsed.data.userId).get();
  const user = userSnap.data()!;
  const referralCode = user.referralCode || `PLG${parsed.data.userId.slice(0, 6).toUpperCase()}`;

  res.json({
    userId: parsed.data.userId,
    referralCode,
    totalReferrals: 0,
    totalEarnings: 0,
    pendingEarnings: 0,
  });
});

export default router;
