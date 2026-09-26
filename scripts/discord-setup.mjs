#!/usr/bin/env node
/**
 * สร้างโครง Discord ของ QVX — ยศ หมวด ห้อง และสิทธิ์ของแต่ละห้อง
 *
 *   node scripts/discord-setup.mjs            # ดูแผนก่อน ไม่แตะอะไรในเซิร์ฟเวอร์
 *   node scripts/discord-setup.mjs --apply    # สร้าง/แก้จริง
 *
 * ต้องมีใน .env: DISCORD_BOT_TOKEN, DISCORD_GUILD_ID
 * บอทต้องอยู่ในเซิร์ฟเวอร์แล้ว และมีสิทธิ์ Manage Roles + Manage Channels
 *
 * ทำไมใช้สคริปต์แทนการกดเอง:
 *   สิทธิ์ห้องของ Discord ตั้งมือพลาดง่าย — ลืมปิด Send Messages ของ @everyone
 *   ห้อง updates ก็กลายเป็นห้องแชต หรือห้องสมาชิกหลุดให้คนหมดอายุเห็น
 *   สคริปต์ตั้งถูกทุกครั้ง และรันซ้ำได้: ของที่มีแล้วจะไม่สร้างซ้ำ
 *   แต่สิทธิ์จะถูกตั้งใหม่ให้ตรงสเปกทุกรอบ ใครเผลอไปแก้ก็กลับมาถูก
 *
 * ไม่ผูกกับบัญชีใคร:
 *   ทุกสิทธิ์ผูกกับ "ยศ" เท่านั้น ไม่มีชื่อ อีเมล หรือ user ID ของคนในไฟล์นี้
 *   ใครได้ยศ QVX Active เว็บเป็นคนตัดสินจากสถานะสมาชิก (src/lib/discord.ts)
 *   ใครเป็นเจ้าของเซิร์ฟเวอร์หรือโอนไปกี่รอบก็ไม่กระทบ — Server ID ไม่เปลี่ยน
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// ── สิทธิ์ของ Discord (bit flag) ─────────────────────────────────────────────
// บางตัวเกิน 32 บิต ต้องใช้ BigInt และส่งให้ Discord เป็นสตริง
export const P = {
  ADD_REACTIONS: 1n << 6n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  MANAGE_THREADS: 1n << 34n,
  CREATE_PUBLIC_THREADS: 1n << 35n,
  CREATE_PRIVATE_THREADS: 1n << 36n,
  SEND_MESSAGES_IN_THREADS: 1n << 38n,
};

const bits = (...flags) => flags.reduce((a, b) => a | b, 0n);

/** ทุกทางที่คนพิมพ์ลงห้องได้ — ปิดทั้งหมดนี้ถึงจะเป็นห้องอ่านอย่างเดียวจริง */
const WRITE = bits(
  P.SEND_MESSAGES,
  P.CREATE_PUBLIC_THREADS,
  P.CREATE_PRIVATE_THREADS,
  P.SEND_MESSAGES_IN_THREADS
);
const READ = bits(P.VIEW_CHANNEL, P.READ_MESSAGE_HISTORY);
const TEAM = bits(
  READ,
  WRITE,
  P.MANAGE_MESSAGES,
  P.MANAGE_THREADS,
  P.EMBED_LINKS,
  P.ATTACH_FILES,
  P.ADD_REACTIONS
);

// ── โครงตามสเปก ──────────────────────────────────────────────────────────────
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://quantvisionx.com").replace(/\/$/, "");

export const ROLES = [
  { key: "team", name: "QVX Team", color: 0xf1c40f, hoist: true },
  { key: "active", name: "QVX Active", color: 0x6ee34a, hoist: true },
];

/**
 * access กำหนดว่าใครทำอะไรได้ในหมวดนั้น — ดู overwritesFor
 *   public  : ทุกคนเห็น · เฉพาะทีมงานโพสต์
 *   members : เห็นเฉพาะ QVX Active กับทีมงาน · สมาชิกไม่พิมพ์รวมกัน ใช้ปุ่มเปิด Ticket
 *
 * slug ใช้หาห้องเดิมตอนรันซ้ำ — ถ้ามีคนเปลี่ยนอีโมจิหน้าชื่อ ก็ยังหาเจอ ไม่สร้างซ้ำ
 */
export const LAYOUT = [
  {
    category: "PUBLIC",
    access: "public",
    channels: [
      {
        slug: "start-here",
        name: "👋・start-here",
        topic: `เริ่มต้นที่นี่ — Discord นี้มีอะไรบ้าง · สมาชิก QVX เชื่อม Discord เพื่อรับยศได้ที่ ${SITE}/account/discord`,
      },
      {
        slug: "qvx-updates",
        name: "📢・qvx-updates",
        topic: "อัปเดต QVX — เวอร์ชันใหม่ ฟีเจอร์ใหม่ QVX AI อินดิเคเตอร์ และการปิดปรับปรุงระบบ",
      },
      {
        slug: "qvx-promotions",
        name: "🎁・qvx-promotions",
        topic: "โปรโมชั่น กิจกรรม และสิทธิพิเศษ",
      },
      {
        slug: "qvx-results",
        name: "🏆・qvx-results",
        topic: "ผลงานและรีวิวการบ้านที่ทีมงานคัดมา — ผลงานลูกค้าลงเมื่อได้รับอนุญาตและปิดข้อมูลส่วนตัวแล้วเท่านั้น",
      },
    ],
  },
  {
    category: "QVX MEMBER",
    access: "members",
    channels: [
      {
        slug: "private-homework",
        name: "🎫・private-homework",
        topic: "ส่งการบ้านส่วนตัว / ติดต่อทีม — กดปุ่ม Open Private Ticket เพื่อเปิดห้องส่วนตัวกับทีมงาน",
      },
    ],
  },
];

const TYPE_TEXT = 0;
const TYPE_CATEGORY = 4;
const OVERWRITE_ROLE = 0;

const ow = (id, allow, deny = 0n) => ({
  id,
  type: OVERWRITE_ROLE,
  allow: String(allow),
  deny: String(deny),
});

/**
 * สิทธิ์ของห้องตามระดับการเข้าถึง
 * @everyone ใน Discord คือยศที่มี ID เดียวกับเซิร์ฟเวอร์
 */
export function overwritesFor(access, { everyone, team, active }) {
  if (access === "public") {
    return [
      ow(everyone, bits(READ, P.ADD_REACTIONS), WRITE),
      ow(team, TEAM),
    ];
  }
  if (access === "members") {
    return [
      // คนทั่วไปกับคนหมดอายุ ต้องไม่เห็นห้องนี้เลย
      ow(everyone, 0n, P.VIEW_CHANNEL),
      // สมาชิกเห็นห้องแต่ไม่พิมพ์รวมกัน — ใช้ปุ่มเปิด Ticket ส่วนตัวแทน
      ow(active, READ, WRITE),
      ow(team, TEAM),
    ];
  }
  throw new Error(`ไม่รู้จักระดับการเข้าถึง: ${access}`);
}

/** หายศเดิมจากชื่อ (ไม่สนตัวพิมพ์เล็กใหญ่) */
export function findRole(existing, name) {
  const want = name.toLowerCase();
  return existing.find((r) => r.name.toLowerCase() === want) ?? null;
}

export function findCategory(existing, name) {
  const want = name.toLowerCase();
  return existing.find((c) => c.type === TYPE_CATEGORY && c.name.toLowerCase() === want) ?? null;
}

/** หาห้องเดิมจาก slug ท้ายชื่อ — เปลี่ยนอีโมจิข้างหน้าก็ยังหาเจอ */
export function findChannel(existing, slug) {
  const want = slug.toLowerCase();
  return (
    existing.find(
      (c) =>
        c.type === TYPE_TEXT &&
        (c.name.toLowerCase() === want || c.name.toLowerCase().endsWith(`・${want}`) || c.name.toLowerCase().endsWith(`-${want}`))
    ) ?? null
  );
}

// ── เรียก Discord ────────────────────────────────────────────────────────────
const API = "https://discord.com/api/v10";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeApi(token) {
  return async function api(method, path, body) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await fetch(`${API}${path}`, {
        method,
        headers: {
          Authorization: `Bot ${token}`,
          "Content-Type": "application/json",
          // audit log ของ Discord จะโชว์ข้อความนี้ ว่ารายการนี้มาจากสคริปต์ ไม่ใช่คนกด
          "X-Audit-Log-Reason": encodeURIComponent("QVX discord-setup.mjs"),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15_000),
      });

      if (res.status === 429) {
        const { retry_after = 1 } = await res.json().catch(() => ({}));
        await sleep(Math.ceil(retry_after * 1000) + 250);
        continue;
      }
      if (res.status === 204) return null;

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const err = new Error(`${method} ${path} → ${res.status} ${data?.message ?? ""}`.trim());
        err.status = res.status;
        throw err;
      }
      return data;
    }
    throw new Error(`${method} ${path} → โดนจำกัดความถี่ซ้ำหลายรอบ ลองใหม่อีกครั้ง`);
  };
}

function loadEnv() {
  try {
    for (const line of readFileSync(".env", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}

function die(msg, fix) {
  console.error(`\n✗ ${msg}`);
  if (fix) console.error(`\n${fix}\n`);
  process.exit(1);
}

async function main() {
  loadEnv();
  const apply = process.argv.includes("--apply");
  const TOKEN = process.env.DISCORD_BOT_TOKEN;
  const GUILD_ID = process.env.DISCORD_GUILD_ID;

  if (!TOKEN) die("ยังไม่ได้ตั้ง DISCORD_BOT_TOKEN ใน .env");
  if (!GUILD_ID || !/^\d{15,25}$/.test(GUILD_ID)) {
    die(
      "DISCORD_GUILD_ID ยังไม่ได้ตั้ง หรือไม่ใช่ตัวเลข",
      "  Discord → User Settings → Advanced → เปิด Developer Mode\n" +
        "  แล้วคลิกขวาที่ไอคอนเซิร์ฟเวอร์ → Copy Server ID"
    );
  }

  const api = makeApi(TOKEN);
  console.log(`\n${apply ? "สร้าง/แก้จริง" : "ดูแผนอย่างเดียว (ยังไม่แตะเซิร์ฟเวอร์) — ใส่ --apply เพื่อทำจริง"}\n`);

  // ── ตรวจว่าเชื่อมได้ก่อนทำอะไร ──
  let bot, guild;
  try {
    bot = await api("GET", "/users/@me");
  } catch (e) {
    die("token บอทใช้ไม่ได้", e.status === 401 ? "  ก๊อป token ใหม่จาก Developer Portal → Bot → Reset Token" : `  ${e.message}`);
  }
  try {
    guild = await api("GET", `/guilds/${GUILD_ID}`);
  } catch {
    die(
      "บอทยังไม่ได้อยู่ในเซิร์ฟเวอร์นี้ หรือ Server ID ผิด",
      "  เชิญบอทด้วยลิงก์จาก Developer Portal → OAuth2 → URL Generator\n" +
        "  scope: bot · permission: Manage Roles + Manage Channels (หรือ Administrator)"
    );
  }
  console.log(`บอท   : ${bot.username}`);
  console.log(`เซิร์ฟเวอร์: ${guild.name}\n`);

  // ── ยศ ──
  const roles = await api("GET", `/guilds/${GUILD_ID}/roles`);
  const roleIds = { everyone: GUILD_ID };
  for (const spec of ROLES) {
    const found = findRole(roles, spec.name);
    if (found) {
      roleIds[spec.key] = found.id;
      console.log(`  ✓ ยศ ${spec.name} มีแล้ว`);
      continue;
    }
    console.log(`  + ยศ ${spec.name} — ${apply ? "สร้าง" : "จะสร้าง"}`);
    if (apply) {
      const created = await api("POST", `/guilds/${GUILD_ID}/roles`, {
        name: spec.name,
        color: spec.color,
        hoist: spec.hoist,
        mentionable: false,
        // สิทธิ์ระดับเซิร์ฟเวอร์ปล่อยว่าง ให้สิทธิ์ทั้งหมดมาจากสิทธิ์รายห้องเท่านั้น
        permissions: "0",
      });
      roleIds[spec.key] = created.id;
    } else {
      roleIds[spec.key] = `<${spec.name}>`;
    }
  }

  // ── หมวด + ห้อง ──
  let channels = await api("GET", `/guilds/${GUILD_ID}/channels`);

  for (const group of LAYOUT) {
    const overwrites = overwritesFor(group.access, roleIds);
    let category = findCategory(channels, group.category);

    if (category) {
      console.log(`\n  ✓ หมวด ${group.category} มีแล้ว — ${apply ? "ตั้งสิทธิ์ใหม่ให้ตรงสเปก" : "จะตั้งสิทธิ์ใหม่"}`);
      if (apply) await api("PATCH", `/channels/${category.id}`, { permission_overwrites: overwrites });
    } else {
      console.log(`\n  + หมวด ${group.category} — ${apply ? "สร้าง" : "จะสร้าง"}`);
      if (apply) {
        category = await api("POST", `/guilds/${GUILD_ID}/channels`, {
          name: group.category,
          type: TYPE_CATEGORY,
          permission_overwrites: overwrites,
        });
      }
    }

    for (const [i, spec] of group.channels.entries()) {
      const found = findChannel(channels, spec.slug);
      const body = {
        topic: spec.topic,
        parent_id: category?.id,
        position: i,
        // สิทธิ์เดียวกับหมวด — ห้องที่ย้ายเข้าหมวดทีหลังก็จะถูกตั้งให้ตรงกันตอนรันรอบถัดไป
        permission_overwrites: overwrites,
      };

      if (found) {
        console.log(`    ✓ ${found.name} มีแล้ว — ${apply ? "ตั้งสิทธิ์และคำอธิบายใหม่" : "จะตั้งสิทธิ์ใหม่"}`);
        if (apply) await api("PATCH", `/channels/${found.id}`, body);
      } else {
        console.log(`    + ${spec.name} — ${apply ? "สร้าง" : "จะสร้าง"}`);
        if (apply) {
          await api("POST", `/guilds/${GUILD_ID}/channels`, { ...body, name: spec.name, type: TYPE_TEXT });
        }
      }
    }
    if (apply) channels = await api("GET", `/guilds/${GUILD_ID}/channels`);
  }

  if (!apply) {
    console.log("\nยังไม่ได้แตะเซิร์ฟเวอร์ — ถ้าแผนถูกต้อง รันซ้ำพร้อม --apply\n");
    return;
  }

  // ── ลำดับยศ: บอทต้องอยู่เหนือ QVX Active ไม่งั้นเว็บแจกยศไม่ได้ ──
  const fresh = await api("GET", `/guilds/${GUILD_ID}/roles`);
  const me = await api("GET", `/guilds/${GUILD_ID}/members/${bot.id}`);
  const botTop = Math.max(0, ...fresh.filter((r) => me.roles.includes(r.id)).map((r) => r.position));
  const activePos = fresh.find((r) => r.id === roleIds.active)?.position ?? 0;
  if (botTop <= activePos) {
    console.log(
      "\n⚠ ยศของบอทอยู่ต่ำกว่า QVX Active — เว็บจะแจก/ถอดยศไม่ได้\n" +
        "  Server Settings → Roles → ลากยศของบอทขึ้นไปไว้เหนือ QVX Active"
    );
  }

  console.log(`
เสร็จแล้ว ✓

ตั้งค่าเหล่านี้บน Vercel (และใน .env ถ้าจะทดสอบในเครื่อง):

  DISCORD_GUILD_ID=${GUILD_ID}
  DISCORD_ROLE_MEMBER=${roleIds.active}

ยศแยกตามแพ็กเกจปล่อยว่างไว้ — ระบบใช้ QVX Active ยศเดียว:

  DISCORD_ROLE_MONTH=
  DISCORD_ROLE_Q3=
  DISCORD_ROLE_H6=
  DISCORD_ROLE_YEAR=

ยศ QVX Team (${roleIds.team}) เว็บไม่ได้ใช้ — ให้ทีมงานเองในแอป Discord
`);
}

// รันเมื่อเรียกไฟล์นี้ตรง ๆ เท่านั้น — ตอนเทสต์ import เข้าไปจะไม่ยิง Discord
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => die(e.message));
}
