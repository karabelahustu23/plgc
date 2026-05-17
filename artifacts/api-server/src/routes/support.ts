import { Router, type IRouter } from "express";
import {
  ListSupportTicketsQueryParams,
  CreateSupportTicketBody,
  ReplyToTicketParams,
  ReplyToTicketBody,
} from "@workspace/api-zod";
import { adminDb } from "../lib/firebase-admin";

const router: IRouter = Router();

router.get("/support/tickets", async (req, res): Promise<void> => {
  const parsed = ListSupportTicketsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let query = adminDb.collection("supportTickets").orderBy("updatedAt", "desc") as FirebaseFirestore.Query;

  if (!parsed.data.all) {
    query = query.where("userId", "==", parsed.data.userId);
  }

  const snap = await query.get();

  const tickets = snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      userId: data.userId,
      subject: data.subject,
      status: data.status,
      priority: data.priority || "normal",
      messages: (data.messages || []).map((m: Record<string, unknown>) => ({
        id: m.id,
        senderType: m.senderType,
        senderName: m.senderName,
        content: m.content,
        createdAt: (m.createdAt as { toDate?: () => Date } | null)?.toDate?.()?.toISOString() || m.createdAt,
      })),
      createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    };
  });

  res.json(tickets);
});

router.post("/support/tickets", async (req, res): Promise<void> => {
  const parsed = CreateSupportTicketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userSnap = await adminDb.collection("users").doc(parsed.data.userId).get();
  const userName = userSnap.data()?.displayName || "User";

  const ref = adminDb.collection("supportTickets").doc();
  const now = new Date();
  const data = {
    id: ref.id,
    userId: parsed.data.userId,
    subject: parsed.data.subject,
    status: "open",
    priority: parsed.data.priority || "normal",
    messages: [{
      id: `msg_${Date.now()}`,
      senderType: "user",
      senderName: userName,
      content: parsed.data.message,
      createdAt: now,
    }],
    createdAt: now,
    updatedAt: now,
  };

  await ref.set(data);

  res.status(201).json({
    ...data,
    createdAt: data.createdAt.toISOString(),
    updatedAt: data.updatedAt.toISOString(),
    messages: data.messages.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })),
  });
});

router.post("/support/tickets/:ticketId/reply", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.ticketId) ? req.params.ticketId[0] : req.params.ticketId;
  const params = ReplyToTicketParams.safeParse({ ticketId: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = ReplyToTicketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const ref = adminDb.collection("supportTickets").doc(params.data.ticketId);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const userSnap = await adminDb.collection("users").doc(parsed.data.userId).get();
  const userName = parsed.data.isAdmin ? "Support Team" : (userSnap.data()?.displayName || "User");

  const now = new Date();
  const newMsg = {
    id: `msg_${Date.now()}`,
    senderType: parsed.data.isAdmin ? "admin" : "user",
    senderName: userName,
    content: parsed.data.message,
    createdAt: now,
  };

  const updates: Record<string, unknown> = {
    updatedAt: now,
    messages: [...(snap.data()!.messages || []), newMsg],
  };

  if (parsed.data.isAdmin) {
    updates.status = "answered";
  }

  await ref.update(updates);
  const updated = await ref.get();
  const data = updated.data()!;

  res.json({
    id: updated.id,
    userId: data.userId,
    subject: data.subject,
    status: data.status,
    priority: data.priority || "normal",
    messages: (data.messages || []).map((m: Record<string, unknown>) => ({
      id: m.id,
      senderType: m.senderType,
      senderName: m.senderName,
      content: m.content,
      createdAt: (m.createdAt as { toDate?: () => Date } | null)?.toDate?.()?.toISOString() || m.createdAt,
    })),
    createdAt: data.createdAt?.toDate?.()?.toISOString() || now.toISOString(),
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || now.toISOString(),
  });
});

export default router;
