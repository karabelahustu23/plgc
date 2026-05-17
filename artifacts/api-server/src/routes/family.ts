import { Router, type IRouter } from "express";
import {
  ListFamilyMembersQueryParams,
  CreateFamilyMemberBody,
  UpdateFamilyMemberParams,
  UpdateFamilyMemberBody,
  DeleteFamilyMemberParams,
  ListMemberEsimsParams,
} from "@workspace/api-zod";
import { adminDb } from "../lib/firebase-admin";

const router: IRouter = Router();

router.get("/family/members", async (req, res): Promise<void> => {
  const parsed = ListFamilyMembersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const snap = await adminDb.collection("familyMembers")
    .where("userId", "==", parsed.data.userId)
    .orderBy("createdAt", "asc")
    .get();

  const members = snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      userId: data.userId,
      name: data.name,
      emoji: data.emoji || null,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    };
  });

  res.json(members);
});

router.post("/family/members", async (req, res): Promise<void> => {
  const parsed = CreateFamilyMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const ref = adminDb.collection("familyMembers").doc();
  const data = {
    id: ref.id,
    userId: parsed.data.userId,
    name: parsed.data.name,
    emoji: parsed.data.emoji || null,
    createdAt: new Date(),
  };
  await ref.set(data);

  res.status(201).json({ ...data, createdAt: data.createdAt.toISOString() });
});

router.patch("/family/members/:memberId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.memberId) ? req.params.memberId[0] : req.params.memberId;
  const params = UpdateFamilyMemberParams.safeParse({ memberId: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateFamilyMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const ref = adminDb.collection("familyMembers").doc(params.data.memberId);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.emoji !== undefined) updates.emoji = parsed.data.emoji;

  await ref.update(updates);
  const updated = await ref.get();
  const data = updated.data()!;

  res.json({
    id: updated.id,
    userId: data.userId,
    name: data.name,
    emoji: data.emoji || null,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
  });
});

router.delete("/family/members/:memberId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.memberId) ? req.params.memberId[0] : req.params.memberId;
  const params = DeleteFamilyMemberParams.safeParse({ memberId: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const ref = adminDb.collection("familyMembers").doc(params.data.memberId);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  await ref.delete();
  res.sendStatus(204);
});

router.get("/family/members/:memberId/esims", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.memberId) ? req.params.memberId[0] : req.params.memberId;
  const params = ListMemberEsimsParams.safeParse({ memberId: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const snap = await adminDb.collection("orders")
    .where("familyMemberId", "==", params.data.memberId)
    .orderBy("createdAt", "desc")
    .get();

  const esims = snap.docs.map(d => {
    const data = d.data();
    return {
      orderId: d.id,
      packageName: data.packageName,
      locationCode: data.locationCode,
      locationName: data.locationName || "",
      iccid: data.iccid || null,
      status: data.status,
      dataAmount: data.dataAmount || 0,
      dataUnit: data.dataUnit || "GB",
      dataRemaining: null,
      purchasedAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    };
  });

  res.json(esims);
});

export default router;
