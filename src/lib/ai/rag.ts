/**
 * RAG ของ QVX AI — ค้นชิ้นความรู้ที่เกี่ยวกับคำถาม แล้วแนบให้โมเดลอ่านก่อนตอบ
 *
 * ทำไมไม่ใช้ vector embedding: คลังความรู้ของเรามีไม่กี่สิบชิ้น และต้องค้นได้เสมอ
 * ไม่ว่าคำตอบจะมาจากเครื่องบ้านหรือคลาวด์ — ถ้าพึ่งโมเดล embedding บนเครื่องบ้าน
 * วันที่เครื่องบ้านดับ RAG ก็ดับตาม · วิธีนี้รันบน Vercel ได้เลย ไม่มีอะไรต้องพัง
 *
 * วิธีค้น: TF-IDF ของ "ตัวอักษรติดกัน 2-3 ตัว" — ภาษาไทยไม่เว้นวรรคระหว่างคำ
 * ตัดคำก็ต้องใช้พจนานุกรม ส่วน n-gram ตัวอักษรใช้ได้กับทุกภาษาทันที
 * + คำภาษาอังกฤษทั้งคำ (FVG, OB, ICT) ให้น้ำหนักตรงตัวเพิ่ม
 */

export type KnowledgeDoc = { id: string; title: string; text: string };
export type Retrieved = { doc: KnowledgeDoc; score: number };

type Vec = Map<string, number>;

/**
 * คำถาม/คำลงท้ายที่เจอในทุกคำถาม ("คืออะไร" "ยังไง") — ถ้าไม่ตัดทิ้ง n-gram ของคำพวกนี้
 * จะไปตรงกับชื่อเรื่องแนว "QVX คืออะไร" แทนที่จะตรงกับหัวข้อที่ถามจริง
 * เรียงคำยาวก่อน ตัดคำยาวออกก่อนคำสั้นที่อยู่ข้างใน
 */
const STOPWORDS = [
  "คืออะไร", "หมายถึงอะไร", "อย่างไร", "ยังไง", "ได้ไหม", "หรือไม่", "หรือเปล่า", "ต่างกัน",
  "ครับ", "ค่ะ", "คะ", "หน่อย", "บ้าง", "ไหม", "อะไร", "คือ", "กับ", "ของ", "และ", "ที่",
].sort((a, b) => b.length - a.length);

function normalize(s: string): string {
  let out = s.normalize("NFC").toLowerCase();
  for (const w of STOPWORDS) out = out.split(w).join(" ");
  return out;
}

function features(raw: string): Vec {
  const s = normalize(raw);
  const v: Vec = new Map();
  const add = (k: string, w = 1) => v.set(k, (v.get(k) ?? 0) + w);

  // คำอังกฤษ/ตัวเลขทั้งคำ — ชื่อฟีเจอร์ (fvg, ob, choch) ต้องตรงกันแม่น
  for (const w of s.match(/[a-z0-9]+/g) ?? []) if (w.length >= 2) add(`w:${w}`, 2);

  // n-gram ตัวอักษรของข้อความไทย+อังกฤษที่ตัดช่องว่างและเครื่องหมายทิ้ง
  const compact = s.replace(/[^฀-๿a-z0-9]+/g, "");
  for (const n of [2, 3]) {
    for (let i = 0; i + n <= compact.length; i++) add(compact.slice(i, i + n));
  }
  return v;
}

export class KnowledgeIndex {
  private readonly docs: KnowledgeDoc[];
  private readonly vecs: Vec[];
  private readonly idf = new Map<string, number>();

  constructor(docs: KnowledgeDoc[]) {
    this.docs = docs;
    // ชื่อเรื่องนับซ้ำ 3 เท่า — คำถามส่วนใหญ่ถามตรงชื่อฟีเจอร์
    const raw = docs.map((d) => features(`${d.title} ${d.title} ${d.title} ${d.text}`));
    const df = new Map<string, number>();
    for (const v of raw) for (const k of v.keys()) df.set(k, (df.get(k) ?? 0) + 1);
    const N = docs.length;
    for (const [k, n] of df) this.idf.set(k, Math.log(1 + N / n));
    this.vecs = raw.map((v) => this.weigh(v));
  }

  private weigh(v: Vec): Vec {
    const out: Vec = new Map();
    let norm = 0;
    for (const [k, tf] of v) {
      const w = (1 + Math.log(tf)) * (this.idf.get(k) ?? 0);
      if (w > 0) {
        out.set(k, w);
        norm += w * w;
      }
    }
    norm = Math.sqrt(norm) || 1;
    for (const [k, w] of out) out.set(k, w / norm);
    return out;
  }

  /**
   * minScore 0.125 + ต้องได้อย่างน้อย 35% ของอันดับหนึ่ง — วัดจากคำถามจริง: ชิ้นที่ถูกได้ 0.13-0.65
   * ชิ้นที่ไม่เกี่ยวได้ 0.04-0.12 · คำถามเรื่องกราฟตอนนี้จึงไม่มีชิ้นขยะติดไปกวนโมเดล
   */
  search(query: string, k = 4, minScore = 0.125): Retrieved[] {
    const q = this.weigh(features(query));
    if (!q.size) return [];
    return this.vecs
      .map((v, i) => {
        let dot = 0;
        for (const [key, w] of q) dot += w * (v.get(key) ?? 0);
        return { doc: this.docs[i], score: dot };
      })
      .filter((r) => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .filter((r, _, all) => r.score >= all[0].score * 0.35)
      .slice(0, k);
  }
}

/** จัดชิ้นที่ค้นเจอเป็นข้อความให้โมเดล — ใส่ชื่อเรื่องนำ ไม่ใส่ id (โมเดลชอบยกมาพูด) */
export function formatRetrieved(hits: Retrieved[]): string {
  if (!hits.length) return "";
  return hits.map((h) => `### ${h.doc.title}\n${h.doc.text}`).join("\n\n");
}
