import { Router, type IRouter } from "express";
import { createHmac } from "crypto";
import {
  GetWalletBalanceQueryParams,
  ListWalletTransactionsQueryParams,
  TopupWalletBody,
} from "@workspace/api-zod";
import { adminDb } from "../lib/firebase-admin";
import { getWalletBalance, creditWallet, processReferralReward } from "../lib/firestore-helpers";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/wallet/balance", async (req, res): Promise<void> => {
  const parsed = GetWalletBalanceQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const balance = await getWalletBalance(parsed.data.userId);
  res.json({ userId: parsed.data.userId, balance, currency: "USD" });
});

router.get("/wallet/transactions", async (req, res): Promise<void> => {
  const parsed = ListWalletTransactionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const limit = parsed.data.limit || 20;
  const snap = await adminDb.collection("walletTransactions")
    .where("userId", "==", parsed.data.userId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  const transactions = snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      userId: data.userId,
      amount: data.amount,
      type: data.type,
      description: data.description,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      relatedOrderId: data.relatedOrderId || null,
    };
  });

  res.json(transactions);
});

router.post("/wallet/topup", async (req, res): Promise<void> => {
  const parsed = TopupWalletBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { userId, amount, paddleTransactionId } = parsed.data;

  const existing = await adminDb.collection("paddleTransactions").doc(paddleTransactionId).get();
  if (existing.exists) {
    res.status(409).json({ error: "Transaction already processed" });
    return;
  }

  await adminDb.collection("paddleTransactions").doc(paddleTransactionId).set({
    userId,
    amount,
    processedAt: new Date(),
  });

  const newBalance = await creditWallet(userId, amount, "TOPUP", `Wallet top-up via Paddle`);
  await processReferralReward(userId, amount);

  res.json({ userId, balance: newBalance, currency: "USD" });
});

router.post("/wallet/paddle-checkout", async (req, res): Promise<void> => {
  const { userId, amount } = req.body;

  if (!userId || !amount || Number(amount) < 5) {
    res.status(400).json({ error: "Invalid request. userId and amount (min $5) required." });
    return;
  }

  const paddleApiKey = process.env.PADDLE_API_KEY;
  if (!paddleApiKey) {
    res.status(500).json({ error: "Paddle API key not configured" });
    return;
  }

  const amountInCents = Math.round(Number(amount) * 100).toString();

  const response = await fetch("https://api.paddle.com/transactions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${paddleApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [{
        price: {
          description: `Wallet Top-up $${amount}`,
          unit_price: { amount: amountInCents, currency_code: "USD" },
          quantity: { minimum: 1, maximum: 1 },
          tax_mode: "account_setting",
        },
        quantity: 1,
      }],
      custom_data: { userId, topupAmount: String(amount) },
    }),
  });

  if (!response.ok) {
    const err = await response.json() as any;
    logger.error({ err }, "Paddle create transaction failed");
    res.status(500).json({ error: "Failed to create Paddle checkout", details: err?.error?.detail });
    return;
  }

  const data = await response.json() as any;
  res.json({
    transactionId: data.data.id,
    checkoutUrl: data.data.checkout?.url || null,
  });
});

router.post("/wallet/paddle-webhook", async (req, res): Promise<void> => {
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.warn("PADDLE_WEBHOOK_SECRET not configured");
    res.status(500).json({ error: "Webhook not configured" });
    return;
  }

  const signature = req.headers["paddle-signature"] as string;
  if (!signature) {
    res.status(400).json({ error: "Missing Paddle-Signature header" });
    return;
  }

  const rawBody = (req as any).rawBody?.toString() || JSON.stringify(req.body);

  const parts: Record<string, string> = {};
  for (const part of signature.split(";")) {
    const [k, v] = part.split("=");
    if (k && v) parts[k] = v;
  }

  const ts = parts["ts"];
  const h1 = parts["h1"];
  if (!ts || !h1) {
    res.status(400).json({ error: "Invalid signature format" });
    return;
  }

  const signedPayload = `${ts}:${rawBody}`;
  const expected = createHmac("sha256", webhookSecret).update(signedPayload).digest("hex");

  if (expected !== h1) {
    logger.warn({ expected, h1 }, "Paddle webhook signature mismatch");
    res.status(403).json({ error: "Invalid webhook signature" });
    return;
  }

  const event = req.body as any;

  if (event.event_type === "transaction.completed") {
    const transaction = event.data;
    const customData = transaction?.custom_data;
    const transactionId: string = transaction?.id;

    if (customData?.userId && customData?.topupAmount && transactionId) {
      const existing = await adminDb.collection("paddleTransactions").doc(transactionId).get();
      if (!existing.exists) {
        const topupAmount = parseFloat(customData.topupAmount);
        await adminDb.collection("paddleTransactions").doc(transactionId).set({
          userId: customData.userId,
          amount: topupAmount,
          processedAt: new Date(),
        });
        await creditWallet(customData.userId, topupAmount, "TOPUP", `Wallet top-up via Paddle`);
        await processReferralReward(customData.userId, topupAmount);
        logger.info({ userId: customData.userId, amount: topupAmount }, "Paddle topup credited");
      }
    }
  }

  res.json({ received: true });
});

export default router;
