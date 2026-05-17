import { Router, type IRouter } from "express";
import {
  CreateRedeemCodeBody,
  ApplyRedeemCodeBody,
  ListRedeemCodesQueryParams,
} from "@workspace/api-zod";
import { adminDb } from "../lib/firebase-admin";
import { deductWallet, creditWallet } from "../lib/firestore-helpers";
import { randomBytes } from "crypto";

const router: IRouter = Router();

function generateCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

router.post("/redeem/create", async (req, res): Promise<void> => {
  const parsed = CreateRedeemCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { userId, amount } = parsed.data;

  await deductWallet(userId, amount, `Redeem code purchase: $${amount}`);

  const code = generateCode() + "-" + generateCode();
  const ref = adminDb.collection("redeemCodes").doc();
  const data = {
    id: ref.id,
    code,
    amount,
    currency: "USD",
    createdBy: userId,
    usedBy: null,
    usedAt: null,
    status: "active",
    createdAt: new Date(),
  };

  await ref.set(data);

  res.status(201).json({
    ...data,
    createdAt: data.createdAt.toISOString(),
    usedAt: null,
  });
});

router.post("/redeem/apply", async (req, res): Promise<void> => {
  const parsed = ApplyRedeemCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { userId, code } = parsed.data;

  const snap = await adminDb.collection("redeemCodes")
    .where("code", "==", code)
    .where("status", "==", "active")
    .limit(1)
    .get();

  if (snap.empty) {
    res.status(404).json({ error: "Invalid or already used redeem code" });
    return;
  }

  const codeDoc = snap.docs[0];
  const codeData = codeDoc.data();

  if (codeData.createdBy === userId) {
    res.status(400).json({ error: "Cannot redeem your own code" });
    return;
  }

  await codeDoc.ref.update({ status: "used", usedBy: userId, usedAt: new Date() });
  const newBalance = await creditWallet(userId, codeData.amount, "redeem", `Redeemed code: ${code}`);

  res.json({ userId, balance: newBalance, currency: "USD" });
});

router.get("/redeem/list", async (req, res): Promise<void> => {
  const parsed = ListRedeemCodesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const snap = await adminDb.collection("redeemCodes")
    .where("createdBy", "==", parsed.data.userId)
    .orderBy("createdAt", "desc")
    .get();

  const codes = snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      code: data.code,
      amount: data.amount,
      currency: data.currency || "USD",
      createdBy: data.createdBy,
      usedBy: data.usedBy || null,
      usedAt: data.usedAt?.toDate?.()?.toISOString() || null,
      status: data.status,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    };
  });

  res.json(codes);
});

export default router;
