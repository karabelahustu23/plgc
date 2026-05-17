import { Router, type IRouter } from "express";
import {
  ListPackagesQueryParams,
  GetPackageParams,
  GetEsimUsageQueryParams,
} from "@workspace/api-zod";
import {
  listPackages as esimListPackages,
  queryEsimUsage,
  getFlagEmoji,
  getCountryName,
  type EsimAccessPackage,
} from "../lib/esimaccess";
import { getSiteSettings, applyMarkup } from "../lib/firestore-helpers";
import { adminDb } from "../lib/firebase-admin";

const router: IRouter = Router();

router.get("/esim/packages", async (req, res): Promise<void> => {
  const parsed = ListPackagesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { locationCode, type, page = 1, pageSize = 20 } = parsed.data;

  const settings = await getSiteSettings();
  const markupPct = (settings.markupPercentage as number) ?? 20;

  const result = await esimListPackages({
    locationCode: locationCode || "",
    type: type || "BASE",
  });

  const packages = (result.packageList || []).map((pkg: EsimAccessPackage) => ({
    packageCode: pkg.packageCode,
    name: pkg.name,
    price: applyMarkup((pkg.retailPrice ?? pkg.price) / 10000, markupPct),
    originalPrice: (pkg.retailPrice ?? pkg.price) / 10000,
    currency: pkg.currencyCode || "USD",
    dataAmount: pkg.volume / 1024 / 1024 / 1024,
    dataUnit: "GB",
    duration: pkg.duration,
    durationUnit: pkg.durationUnit || "DAY",
    locationCode: pkg.locationCode,
    locationName: getCountryName(pkg.locationCode),
    networkType: pkg.speed || pkg.locationNetworkList?.[0]?.operatorList?.[0]?.networkType || "4G/LTE",
    type: "BASE",
    slug: pkg.slug || "",
    flagEmoji: getFlagEmoji(pkg.locationCode),
  }));

  const p = Number(page);
  const ps = Number(pageSize);
  const start = (p - 1) * ps;
  const paged = packages.slice(start, start + ps);

  res.json({ packages: paged, total: packages.length, page: p, pageSize: ps });
});

router.get("/esim/packages/:packageCode", async (req, res): Promise<void> => {
  const params = GetPackageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const settings = await getSiteSettings();
  const markupPct = (settings.markupPercentage as number) ?? 20;

  const result = await esimListPackages({ packageCode: params.data.packageCode });
  const pkg = (result.packageList || [])[0];

  if (!pkg) {
    res.status(404).json({ error: "Package not found" });
    return;
  }

  res.json({
    packageCode: pkg.packageCode,
    name: pkg.name,
    price: applyMarkup((pkg.retailPrice ?? pkg.price) / 10000, markupPct),
    originalPrice: (pkg.retailPrice ?? pkg.price) / 10000,
    currency: pkg.currencyCode || "USD",
    dataAmount: pkg.volume / 1024 / 1024 / 1024,
    dataUnit: "GB",
    duration: pkg.duration,
    durationUnit: pkg.durationUnit || "DAY",
    locationCode: pkg.locationCode,
    locationName: getCountryName(pkg.locationCode),
    networkType: pkg.speed || pkg.locationNetworkList?.[0]?.operatorList?.[0]?.networkType || "4G/LTE",
    type: "BASE",
    slug: pkg.slug || "",
    flagEmoji: getFlagEmoji(pkg.locationCode),
  });
});

router.get("/esim/countries", async (req, res): Promise<void> => {
  const result = await esimListPackages({ locationCode: "", type: "BASE" });
  const packages = result.packageList || [];

  const countryMap = new Map<string, { count: number }>();
  for (const pkg of packages) {
    if (!pkg.locationCode) continue;
    const existing = countryMap.get(pkg.locationCode);
    if (existing) {
      existing.count++;
    } else {
      countryMap.set(pkg.locationCode, { count: 1 });
    }
  }

  const countries = Array.from(countryMap.entries()).map(([code, info]) => ({
    locationCode: code,
    name: getCountryName(code),
    flagEmoji: getFlagEmoji(code),
    packageCount: info.count,
  }));

  res.json(countries);
});

router.get("/esim/country-deals", async (req, res): Promise<void> => {
  const minDuration = parseInt(req.query.minDuration as string) || 0;

  const settings = await getSiteSettings();
  const markupPct = (settings.markupPercentage as number) ?? 20;

  const result = await esimListPackages({ locationCode: "", type: "BASE" });
  const packages = result.packageList || [];

  interface CountryDeal {
    fromPrice: number;
    pricePerGB: number;
    bestDuration: number;
    dataGB: number;
  }

  const countryMap = new Map<string, CountryDeal>();

  for (const pkg of packages) {
    if (!pkg.locationCode) continue;
    if (minDuration > 0 && pkg.duration < minDuration) continue;
    if (minDuration > 0 && pkg.duration > minDuration * 2.5) continue;

    const wholesaleUSD = pkg.price / 10000;
    const priceUSD = applyMarkup(wholesaleUSD, markupPct);
    const gbAmount = pkg.volume / 1024 / 1024 / 1024;
    const pricePerGB = gbAmount > 0 ? priceUSD / gbAmount : Infinity;

    const existing = countryMap.get(pkg.locationCode);
    if (!existing || pricePerGB < existing.pricePerGB) {
      countryMap.set(pkg.locationCode, {
        fromPrice: priceUSD,
        pricePerGB,
        bestDuration: pkg.duration,
        dataGB: gbAmount,
      });
    }
  }

  const deals = Array.from(countryMap.entries()).map(([code, info]) => ({
    locationCode: code,
    name: getCountryName(code),
    flagEmoji: getFlagEmoji(code),
    fromPrice: Math.round(info.fromPrice * 100) / 100,
    pricePerGB: Math.round(info.pricePerGB * 100) / 100,
    bestDuration: info.bestDuration,
    dataGB: Math.round(info.dataGB * 10) / 10,
  }));

  deals.sort((a, b) => a.pricePerGB - b.pricePerGB);
  res.json(deals);
});

router.get("/esim/usage", async (req, res): Promise<void> => {
  const parsed = GetEsimUsageQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const usage = await queryEsimUsage(parsed.data.iccid);

  const totalGB = (usage.totalVolume || 0) / 1024 / 1024 / 1024;
  const usedGB = (usage.usedVolume || 0) / 1024 / 1024 / 1024;
  const remainingGB = (usage.residualVolume || 0) / 1024 / 1024 / 1024;

  res.json({
    iccid: usage.iccid,
    dataTotal: totalGB,
    dataUsed: usedGB,
    dataRemaining: remainingGB,
    dataUnit: "GB",
    status: usage.expiredTime ? "active" : "unknown",
    expiryDate: usage.expiredTime || null,
    countryHistory: (usage.locationInfoList || []).map((loc) => ({
      country: loc.name,
      countryCode: loc.countryCode,
      dataUsed: loc.usedVolume / 1024 / 1024 / 1024,
      lastSeen: new Date().toISOString(),
    })),
  });
});

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const userId = req.query.userId as string;
  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const walletSnap = await adminDb.collection("wallets").doc(userId).get();
  const walletBalance = walletSnap.data()?.balance ?? 0;

  const ordersSnap = await adminDb.collection("orders")
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(5)
    .get();

  const allOrdersSnap = await adminDb.collection("orders")
    .where("userId", "==", userId)
    .get();

  const activeOrders = allOrdersSnap.docs.filter(d => d.data().status === "active");

  const familySnap = await adminDb.collection("familyMembers")
    .where("userId", "==", userId)
    .get();

  const recentOrders = ordersSnap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
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
      locationName: data.locationName,
      dataAmount: data.dataAmount,
      dataUnit: data.dataUnit || "GB",
      duration: data.duration,
    };
  });

  res.json({
    walletBalance,
    activeEsims: activeOrders.length,
    totalOrders: allOrdersSnap.size,
    familyMemberCount: familySnap.size,
    recentOrders,
  });
});

export default router;
