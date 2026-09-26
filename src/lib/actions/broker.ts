"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { requireAdmin } from "@/lib/admin";
import {
  submitBrokerApplication,
  approveBrokerApplication,
  rejectBrokerApplication,
} from "@/lib/broker";
import { DEFAULT_BROKER } from "@/config/brokers";

export type BrokerFormState = { ok?: boolean; error?: string };

/** ลูกค้าส่งเลขบัญชีเทรด — ตรรกะทั้งหมดอยู่ใน lib/broker.ts */
export async function submitBrokerApplicationAction(
  _prev: BrokerFormState,
  formData: FormData
): Promise<BrokerFormState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "กรุณาเข้าสู่ระบบ" };

  if (formData.get("accept") !== "on") {
    return { error: "กรุณายอมรับเงื่อนไขก่อนส่งคำขอ" };
  }

  const r = await submitBrokerApplication({
    userId: session.user.id,
    broker: String(formData.get("broker") ?? DEFAULT_BROKER),
    tradingAccount: String(formData.get("tradingAccount") ?? ""),
  });
  if (!r.ok) return { error: r.error };

  revalidatePath("/account/wisdom");
  revalidatePath("/admin/wisdom");
  return { ok: true };
}

export type AdminBrokerState = { ok?: boolean; error?: string; id?: string };

export async function approveBrokerAction(
  _prev: AdminBrokerState,
  formData: FormData
): Promise<AdminBrokerState> {
  const session = await requireAdmin();
  const id = String(formData.get("applicationId") ?? "");
  const r = await approveBrokerApplication({ applicationId: id, adminId: session.user.id });

  revalidatePath("/admin/wisdom");
  revalidatePath("/admin/access-queue");
  return r.ok ? { ok: true, id } : { error: r.error, id };
}

export async function rejectBrokerAction(
  _prev: AdminBrokerState,
  formData: FormData
): Promise<AdminBrokerState> {
  const session = await requireAdmin();
  const id = String(formData.get("applicationId") ?? "");
  const r = await rejectBrokerApplication({
    applicationId: id,
    adminId: session.user.id,
    reason: String(formData.get("reason") ?? ""),
    note: String(formData.get("note") ?? ""),
  });

  revalidatePath("/admin/wisdom");
  return r.ok ? { ok: true, id } : { error: r.error, id };
}
