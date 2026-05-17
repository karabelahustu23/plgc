import { Router, type IRouter } from "express";
import {
  ListOrdersQueryParams,
  GetOrderParams,
  CreateOrderBody,
} from "@workspace/api-zod";
import { adminDb } from "../lib/firebase-admin";
import { deductWallet, getSiteSettings, applyMarkup, creditWallet, getTierForSpend, updateUserStatsAfterOrder } from "../lib/firestore-helpers";
import { listPackages, orderEsim, queryEsimByOrderNo, getFlagEmoji, getCountryName } from "../lib/esimaccess";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function formatOrder(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    userId: data.userId,
    familyMemberId: data.familyMemberId || null,
    packageCode: data.packageCode,
    packageName: data.packageName,
    amount: data.amount,
    status: data.status,
    iccid: data.iccid || null,
    qrCode: data.qrCode || null,
    activationCode: data.activationCode || null,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    locationCode: data.locationCode,
    locationName: data.locationName || "",
    dataAmount: data.dataAmount || 0,
    dataUnit: data.dataUnit || "GB",
    duration: data.duration || 0,
    orderNo: data.orderNo || null,
    wholesaleAmount: data.wholesaleAmount || null,
  };
}

async function tryResolvePending(orderId: string, orderNo: string): Promise<boolean> {
  try {
    const result = await queryEsimByOrderNo(orderNo);
    const esim = result.esimList?.[0];
    if (esim?.iccid) {
      await adminDb.collection("orders").doc(orderId).update({
        status: "active",
        iccid: esim.iccid,
        qrCode: esim.qrCode || null,
        activationCode: esim.activationCode || null,
        updatedAt: new Date(),
      });
      logger.info({ orderId, iccid: esim.iccid }, "Pending order resolved to active");
      return true;
    }
  } catch (_err) {
    // Profile not ready yet — keep pending
  }
  return false;
}

router.get("/orders", async (req, res): Promise<void> => {
  const parsed = ListOrdersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const snap = await adminDb.collection("orders")
    .where("userId", "==", parsed.data.userId)
    .orderBy("createdAt", "desc")
    .get();

  const orders = snap.docs.map(d => formatOrder(d.id, d.data()));

  // Fire-and-forget: try to resolve any pending orders
  const pendingWithOrderNo = snap.docs.filter(d => {
    const data = d.data();
    return data.status === "pending" && data.orderNo;
  });

  if (pendingWithOrderNo.length > 0) {
    Promise.all(
      pendingWithOrderNo.map(d => tryResolvePending(d.id, d.data().orderNo))
    ).catch(err => logger.error({ err }, "Error resolving pending orders"));
  }

  res.json(orders);
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { userId, packageCode, familyMemberId } = parsed.data;

  const settings = await getSiteSettings();
  const markupPct = (settings.markupPercentage as number) ?? 20;

  const pkgResult = await listPackages({ packageCode });
  const pkg = (pkgResult.packageList || [])[0];
  if (!pkg) {
    res.status(404).json({ error: "Package not found" });
    return;
  }

  // Use wholesale price (pkg.price) as the base for markup
  const wholesalePrice = pkg.price; // raw units (e.g. 28400)
  const wholesaleUSD = wholesalePrice / 10000;
  const basePrice = applyMarkup(wholesaleUSD, markupPct);

  // Apply tier discount
  const userSnap = await adminDb.collection("users").doc(userId).get();
  const userTier = getTierForSpend(userSnap.data()?.totalSpent || 0);
  const tierDiscount = userTier.discount;
  const sellingPrice = tierDiscount > 0
    ? Math.round(basePrice * (1 - tierDiscount / 100) * 100) / 100
    : basePrice;

  const orderRef = adminDb.collection("orders").doc();

  // Deduct wallet BEFORE placing order
  await deductWallet(userId, sellingPrice, `eSIM purchase: ${pkg.name}`, orderRef.id);

  let iccid: string | null = null;
  let qrCode: string | null = null;
  let activationCode: string | null = null;
  let orderNo: string | null = null;
  let status = "pending";

  try {
    const esimResult = await orderEsim(packageCode, wholesalePrice, orderRef.id);
    orderNo = esimResult.orderNo || null;

    const firstEsim = esimResult.esimList?.[0];
    if (firstEsim?.iccid) {
      iccid = firstEsim.iccid;
      qrCode = firstEsim.qrCode ?? null;
      activationCode = firstEsim.activationCode ?? null;
      status = "active";
    } else if (orderNo) {
      // Order placed but eSIM profile not ready yet — will poll
      status = "pending";
    } else {
      // Order failed with no orderNo — refund
      throw new Error("No orderNo received from esimaccess");
    }
  } catch (err) {
    req.log.error({ err }, "esimaccess order failed — refunding wallet");
    // Refund: credit wallet back
    await creditWallet(userId, sellingPrice, "REFUND", `Refund for failed eSIM order: ${pkg.name}`);
    res.status(502).json({ error: "eSIM order failed. Your wallet has been refunded." });
    return;
  }

  const orderData = {
    id: orderRef.id,
    userId,
    familyMemberId: familyMemberId || null,
    packageCode,
    packageName: pkg.name,
    amount: sellingPrice,
    wholesaleAmount: wholesaleUSD,
    status,
    iccid,
    qrCode,
    activationCode,
    orderNo,
    createdAt: new Date(),
    locationCode: pkg.locationCode,
    locationName: pkg.location || getCountryName(pkg.locationCode),
    dataAmount: pkg.volume / 1024 / 1024 / 1024,
    dataUnit: "GB",
    duration: pkg.duration,
    flagEmoji: getFlagEmoji(pkg.locationCode),
  };

  await orderRef.set(orderData);

  // Update user stats + badges (fire-and-forget)
  if (status !== "failed") {
    updateUserStatsAfterOrder(
      userId,
      sellingPrice,
      pkg.locationCode,
      pkg.volume / 1024 / 1024 / 1024,
    ).catch(err => logger.error({ err }, "updateUserStatsAfterOrder failed"));
  }

  res.status(201).json({
    ...orderData,
    createdAt: orderData.createdAt.toISOString(),
  });
});

router.get("/orders/:orderId", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
  const params = GetOrderParams.safeParse({ orderId: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const snap = await adminDb.collection("orders").doc(params.data.orderId).get();
  if (!snap.exists) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const data = snap.data()!;

  // If pending with orderNo, try to resolve synchronously
  if (data.status === "pending" && data.orderNo) {
    const resolved = await tryResolvePending(snap.id, data.orderNo);
    if (resolved) {
      const updatedSnap = await adminDb.collection("orders").doc(snap.id).get();
      res.json(formatOrder(updatedSnap.id, updatedSnap.data()!));
      return;
    }
  }

  res.json(formatOrder(snap.id, data));
});

export default router;
