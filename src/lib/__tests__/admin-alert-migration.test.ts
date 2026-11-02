import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * ห้องแอดมินถูกอัปเกรดเป็น supergroup = แจ้งเตือนทุกชนิดตายเงียบ
 *
 * Telegram เปลี่ยน chat id ใหม่ทั้งก้อนเมื่อกลุ่มถูกอัปเกรด ซึ่งเกิดได้เองเมื่อกลุ่มโต
 * ไม่ต้องมีใครตั้งใจกด ค่าเดิมใน env จึงใช้ไม่ได้อีกเลย และไม่มีอะไรฟ้อง
 * นอกจากข้อความปฏิเสธที่ไม่มีใครเห็น เพราะตัวที่ควรบอกคือตัวที่ตาย
 *
 * เจอจริง 2 พ.ย. 69: บริดจ์ล่ม · สลิปใหม่ · งานค้าง · สำรองฐานข้อมูลพัง 12 วัน
 * · ตัวจับความล้มเหลวเป็นวง — เงียบหมดทุกตัวพร้อมกัน
 *
 * Telegram บอก id ใหม่มาให้ใน parameters.migrate_to_chat_id อยู่แล้ว
 * ของเดิมอ่านแค่ description แล้วทิ้งคำตอบที่อยู่ในมือ
 */

const OLD_CHAT = "-123456789";
const NEW_CHAT = "-1001234567890";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  process.env.TELEGRAM_ADMIN_CHAT_ID = OLD_CHAT;
  delete process.env.TELEGRAM_ADMIN_TOPIC_ID;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** chat_id ที่ถูกส่งไปในการเรียกครั้งที่ n (เริ่มนับ 0) */
const chatIdOfCall = (n: number) =>
  JSON.parse((fetchMock.mock.calls[n]?.[1] as { body: string }).body).chat_id;

describe("แจ้งเตือนแอดมินเมื่อห้องย้ายเป็น supergroup", () => {
  it("ย้ายตาม id ใหม่แล้วส่งให้สำเร็จ พร้อมบอก id ที่ต้องเอาไปใส่ env", async () => {
    fetchMock
      .mockResolvedValueOnce({
        status: 400,
        json: async () => ({
          ok: false,
          description: "Bad Request: group chat was upgraded to a supergroup chat",
          parameters: { migrate_to_chat_id: Number(NEW_CHAT) },
        }),
      })
      .mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true }) });

    const { sendAdminAlert } = await import("@/lib/telegram");
    const res = await sendAdminAlert("บริดจ์ล่ม");

    expect(res.sent).toBe(true);
    expect(res.movedTo).toBe(NEW_CHAT);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(chatIdOfCall(0)).toBe(OLD_CHAT);
    expect(chatIdOfCall(1)).toBe(NEW_CHAT);
  });

  it("ข้อความถัดไปยิงเข้า id ใหม่เลย ไม่ต้องเสียรอบลองของเดิมซ้ำ", async () => {
    fetchMock
      .mockResolvedValueOnce({
        status: 400,
        json: async () => ({
          ok: false,
          description: "Bad Request: group chat was upgraded to a supergroup chat",
          parameters: { migrate_to_chat_id: Number(NEW_CHAT) },
        }),
      })
      .mockResolvedValue({ status: 200, json: async () => ({ ok: true }) });

    const { sendAdminAlert } = await import("@/lib/telegram");
    await sendAdminAlert("ครั้งแรก");
    fetchMock.mockClear();
    await sendAdminAlert("ครั้งที่สอง");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(chatIdOfCall(0)).toBe(NEW_CHAT);
  });

  it("ปฏิเสธด้วยเหตุผลอื่น = ห้ามลองซ้ำมั่ว ต้องคืนเหตุผลตรง ๆ", async () => {
    fetchMock.mockResolvedValueOnce({
      status: 403,
      json: async () => ({ ok: false, description: "Forbidden: bot was kicked from the group chat" }),
    });

    const { sendAdminAlert } = await import("@/lib/telegram");
    const res = await sendAdminAlert("งานค้าง");

    expect(res.sent).toBe(false);
    expect(res.reason).toContain("kicked");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
