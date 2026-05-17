import { Router, type IRouter } from "express";
import {
  UpdateSiteSettingsBody,
  UpdateMarkupBody,
  ListAdminUsersQueryParams,
  UpdateUserRoleParams,
  UpdateUserRoleBody,
} from "@workspace/api-zod";
import { adminDb, adminAuth } from "../lib/firebase-admin";
import { getSiteSettings, creditWallet, getWalletBalance } from "../lib/firestore-helpers";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/site/settings", async (_req, res): Promise<void> => {
  const settings = await getSiteSettings();
  res.json(settings);
});

router.patch("/admin/settings", async (req, res): Promise<void> => {
  const parsed = UpdateSiteSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.siteName !== undefined) updates.siteName = parsed.data.siteName;
  if (parsed.data.logoUrl !== undefined) updates.logoUrl = parsed.data.logoUrl;
  if (parsed.data.primaryColor !== undefined) updates.primaryColor = parsed.data.primaryColor;
  if (parsed.data.accentColor !== undefined) updates.accentColor = parsed.data.accentColor;
  if (parsed.data.tagline !== undefined) updates.tagline = parsed.data.tagline;
  if (parsed.data.supportEmail !== undefined) updates.supportEmail = parsed.data.supportEmail;

  await adminDb.collection("settings").doc("site").set(updates, { merge: true });
  const settings = await getSiteSettings();
  res.json(settings);
});

router.get("/admin/markup", async (_req, res): Promise<void> => {
  const settings = await getSiteSettings();
  res.json({
    markupPercentage: (settings.markupPercentage as number) ?? 20,
    updatedAt: new Date().toISOString(),
  });
});

router.patch("/admin/markup", async (req, res): Promise<void> => {
  const parsed = UpdateMarkupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await adminDb.collection("settings").doc("site").set(
    { markupPercentage: parsed.data.markupPercentage },
    { merge: true }
  );

  res.json({
    markupPercentage: parsed.data.markupPercentage,
    updatedAt: new Date().toISOString(),
  });
});

router.get("/admin/users", async (req, res): Promise<void> => {
  const parsed = ListAdminUsersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const limit = parsed.data.limit || 50;
  const snap = await adminDb.collection("users").limit(limit).get();

  const users = await Promise.all(snap.docs.map(async (d) => {
    const data = d.data();
    const walletSnap = await adminDb.collection("wallets").doc(d.id).get();
    const ordersSnap = await adminDb.collection("orders").where("userId", "==", d.id).get();

    return {
      uid: d.id,
      email: data.email || "",
      displayName: data.displayName || null,
      role: data.role || "user",
      walletBalance: walletSnap.data()?.balance ?? 0,
      totalOrders: ordersSnap.size,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    };
  }));

  res.json({ users, total: snap.size });
});

router.patch("/admin/users/:userId/role", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const params = UpdateUserRoleParams.safeParse({ userId: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateUserRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await adminDb.collection("users").doc(params.data.userId).update({ role: parsed.data.role });

  const snap = await adminDb.collection("users").doc(params.data.userId).get();
  const data = snap.data()!;
  const walletSnap = await adminDb.collection("wallets").doc(params.data.userId).get();
  const ordersSnap = await adminDb.collection("orders").where("userId", "==", params.data.userId).get();

  res.json({
    uid: snap.id,
    email: data.email || "",
    displayName: data.displayName || null,
    role: data.role || "user",
    walletBalance: walletSnap.data()?.balance ?? 0,
    totalOrders: ordersSnap.size,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
  });
});

router.post("/admin/users/:userId/credit", async (req, res): Promise<void> => {
  const { userId } = req.params;
  const { amount, reason } = req.body;

  const parsedAmount = Number(amount);
  if (!userId || !parsedAmount || parsedAmount <= 0) {
    res.status(400).json({ error: "Valid userId and positive amount required" });
    return;
  }

  const newBalance = await creditWallet(
    userId,
    parsedAmount,
    "ADMIN_CREDIT",
    reason?.trim() || "Admin credit"
  );

  logger.info({ userId, amount: parsedAmount, reason }, "Admin credited wallet");
  res.json({ success: true, newBalance });
});

router.get("/admin/stats", async (_req, res): Promise<void> => {
  const usersSnap = await adminDb.collection("users").get();
  const ordersSnap = await adminDb.collection("orders").get();
  const activeOrdersSnap = await adminDb.collection("orders").where("status", "==", "active").get();
  const openTicketsSnap = await adminDb.collection("supportTickets").where("status", "==", "open").get();
  const walletsSnap = await adminDb.collection("wallets").get();

  const totalRevenue = ordersSnap.docs.reduce((sum, d) => sum + (d.data().amount || 0), 0);
  const totalWalletBalance = walletsSnap.docs.reduce((sum, d) => sum + (d.data().balance || 0), 0);

  res.json({
    totalUsers: usersSnap.size,
    totalOrders: ordersSnap.size,
    totalRevenue,
    activeEsims: activeOrdersSnap.size,
    totalWalletBalance,
    openTickets: openTicketsSnap.size,
  });
});

export default router;
