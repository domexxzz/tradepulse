/**
 * สถิติผลงาน (Backtest) จาก TradingView Strategy Tester
 * ⚠️ published=false → section ถูกซ่อน (ห้ามโชว์ตัวเลขปลอม)
 *    เมื่อมีตัวเลขจริงแล้ว: ใส่ value + ตั้ง published=true
 */
export interface StatMetric {
  label: string;
  tv: string;      // ชื่อใน TradingView Strategy Tester
  value: string;   // ค่าจริง (เว้นว่างถ้ายังไม่มี)
  suffix?: string;
  good?: boolean;  // ไฮไลต์เขียวถ้าเป็นค่าที่ดี
}

export const backtest = {
  published: false, // ← ตั้ง true เมื่อกรอกค่าจริงครบ
  context: {
    symbol: "XAUUSD",
    timeframe: "",   // เช่น "1D"
    period: "",      // เช่น "ย้อนหลัง 1 ปี"
  },
  metrics: [
    { label: "Win Rate", tv: "Percent Profitable", value: "", suffix: "%", good: true },
    { label: "จำนวนเทรด", tv: "Total Closed Trades", value: "" },
    { label: "Profit Factor", tv: "Profit Factor", value: "", good: true },
    { label: "กำไรสุทธิ", tv: "Net Profit", value: "", suffix: "%", good: true },
    { label: "Drawdown สูงสุด", tv: "Max Drawdown", value: "", suffix: "%" },
    { label: "Avg Risk:Reward", tv: "Ratio Avg Win / Avg Loss", value: "" },
  ] as StatMetric[],
};
