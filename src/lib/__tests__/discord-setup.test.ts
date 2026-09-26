import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  P,
  ROLES,
  LAYOUT,
  overwritesFor,
  findChannel,
  findCategory,
  findRole,
} from "../../../scripts/discord-setup.mjs";

/**
 * โครง Discord ของ QVX — ตรวจโดยไม่ต้องต่อ Discord จริง
 *
 * สิทธิ์ห้องพลาดแล้วเงียบ: ห้องสมาชิกหลุดให้คนหมดอายุเห็น หรือห้องประกาศกลายเป็นห้องแชต
 * ไม่มีอะไรฟ้องจนกว่าลูกค้าจะเจอเอง เลยต้องล็อกไว้ด้วยเทสต์
 */

const IDS = { everyone: "100000000000000001", team: "200000000000000002", active: "300000000000000003" };

type Overwrite = { id: string; type: number; allow: string; deny: string };
const has = (mask: string, flag: bigint) => (BigInt(mask) & flag) !== BigInt(0);
const of = (list: Overwrite[], id: string) => list.find((o) => o.id === id)!;

describe("ไม่ผูกกับบัญชีใคร", () => {
  it("สิทธิ์ทุกห้องผูกกับยศเท่านั้น ไม่มีสิทธิ์รายบุคคลเลย", () => {
    for (const group of LAYOUT) {
      for (const o of overwritesFor(group.access, IDS) as Overwrite[]) {
        // type 0 = ยศ · type 1 = ผู้ใช้รายคน — ต้องไม่มี 1 เด็ดขาด
        expect(o.type, `${group.category} → ${o.id}`).toBe(0);
      }
    }
  });

  it("ในไฟล์ไม่มีอีเมล ชื่อผู้ใช้ หรือ user ID ของใคร", () => {
    const src = readFileSync("scripts/discord-setup.mjs", "utf8");
    expect(src).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/);
    // snowflake ของ Discord คือตัวเลข 17-20 หลัก — ต้องไม่มีฝังอยู่ในไฟล์
    expect(src).not.toMatch(/\b\d{17,20}\b/);
  });
});

describe("ห้อง PUBLIC — ทุกคนเห็น เฉพาะทีมงานโพสต์", () => {
  const list = overwritesFor("public", IDS) as Overwrite[];

  it("คนทั่วไปเห็นและอ่านย้อนหลังได้", () => {
    const e = of(list, IDS.everyone);
    expect(has(e.allow, P.VIEW_CHANNEL)).toBe(true);
    expect(has(e.allow, P.READ_MESSAGE_HISTORY)).toBe(true);
  });

  it("คนทั่วไปพิมพ์ไม่ได้ — รวมถึงเปิดเธรดและพิมพ์ในเธรด", () => {
    const e = of(list, IDS.everyone);
    for (const flag of [P.SEND_MESSAGES, P.CREATE_PUBLIC_THREADS, P.CREATE_PRIVATE_THREADS, P.SEND_MESSAGES_IN_THREADS]) {
      expect(has(e.deny, flag)).toBe(true);
      expect(has(e.allow, flag)).toBe(false);
    }
  });

  it("ทีมงานโพสต์และจัดการข้อความได้", () => {
    const t = of(list, IDS.team);
    expect(has(t.allow, P.SEND_MESSAGES)).toBe(true);
    expect(has(t.allow, P.MANAGE_MESSAGES)).toBe(true);
  });
});

describe("ห้อง QVX MEMBER — เฉพาะ QVX Active กับทีมงาน", () => {
  const list = overwritesFor("members", IDS) as Overwrite[];

  it("คนทั่วไปและคนหมดอายุมองไม่เห็นห้องเลย", () => {
    const e = of(list, IDS.everyone);
    expect(has(e.deny, P.VIEW_CHANNEL)).toBe(true);
    expect(has(e.allow, P.VIEW_CHANNEL)).toBe(false);
  });

  it("QVX Active เห็นห้อง แต่ไม่พิมพ์รวมกัน (ใช้ปุ่มเปิด Ticket)", () => {
    const a = of(list, IDS.active);
    expect(has(a.allow, P.VIEW_CHANNEL)).toBe(true);
    expect(has(a.deny, P.SEND_MESSAGES)).toBe(true);
  });

  it("ทีมงานเห็นและตอบได้", () => {
    const t = of(list, IDS.team);
    expect(has(t.allow, P.VIEW_CHANNEL)).toBe(true);
    expect(has(t.allow, P.SEND_MESSAGES)).toBe(true);
  });

  it("ห้องสมาชิกไม่มีสิทธิ์ของยศอื่นหลุดเข้ามา", () => {
    expect(list.map((o) => o.id).sort()).toEqual([IDS.everyone, IDS.team, IDS.active].sort());
  });
});

describe("ความถูกต้องของรูปแบบที่ส่งให้ Discord", () => {
  it("ค่าสิทธิ์เป็นสตริงตัวเลข (บางบิตเกิน 32 บิต ส่งเป็น number จะเพี้ยน)", () => {
    for (const group of LAYOUT) {
      for (const o of overwritesFor(group.access, IDS) as Overwrite[]) {
        expect(typeof o.allow).toBe("string");
        expect(typeof o.deny).toBe("string");
        expect(() => BigInt(o.allow)).not.toThrow();
      }
    }
  });

  it("คำอธิบายห้องไม่เกิน 1024 ตัวอักษรตามที่ Discord รับ", () => {
    for (const group of LAYOUT) for (const c of group.channels) expect(c.topic.length).toBeLessThanOrEqual(1024);
  });

  it("มีครบตามสเปก — 2 ยศ 2 หมวด 5 ห้อง", () => {
    expect(ROLES.map((r) => r.name)).toEqual(["QVX Team", "QVX Active"]);
    expect(LAYOUT.map((g) => g.category)).toEqual(["PUBLIC", "QVX MEMBER"]);
    expect(LAYOUT.flatMap((g) => g.channels.map((c) => c.slug))).toEqual([
      "start-here",
      "qvx-updates",
      "qvx-promotions",
      "qvx-results",
      "private-homework",
    ]);
  });
});

describe("รันซ้ำแล้วไม่สร้างของซ้ำ", () => {
  it("ห้องที่สคริปต์สร้างเอง รอบถัดไปต้องหาเจอ", () => {
    // ถ้าชื่อกับ slug ไม่ตรงกัน รอบสองจะหาไม่เจอแล้วสร้างห้องซ้ำ
    const created = LAYOUT.flatMap((g) => g.channels.map((c, i) => ({ id: String(i), name: c.name, type: 0 })));
    for (const group of LAYOUT) {
      for (const c of group.channels) expect(findChannel(created, c.slug)?.name).toBe(c.name);
    }
  });

  it("มีคนเปลี่ยนอีโมจิหน้าชื่อ ก็ยังหาห้องเดิมเจอ", () => {
    expect(findChannel([{ id: "1", name: "🚀・start-here", type: 0 }], "start-here")?.id).toBe("1");
  });

  it("ไม่หยิบห้องที่ชื่อคล้ายแต่เป็นคนละห้อง", () => {
    const existing = [{ id: "9", name: "private-homework-archive", type: 0 }];
    expect(findChannel(existing, "private-homework")).toBeNull();
  });

  it("ไม่หยิบหมวดมาเป็นห้อง และไม่หยิบห้องมาเป็นหมวด", () => {
    const existing = [
      { id: "1", name: "start-here", type: 4 },
      { id: "2", name: "PUBLIC", type: 0 },
    ];
    expect(findChannel(existing, "start-here")).toBeNull();
    expect(findCategory(existing, "PUBLIC")).toBeNull();
  });

  it("หายศเดิมได้โดยไม่สนตัวพิมพ์เล็กใหญ่", () => {
    expect(findRole([{ id: "7", name: "qvx active" }], "QVX Active")?.id).toBe("7");
  });
});
