/** พื้นหลังตกแต่งแบบ 3D (perspective grid + orbs) — คงที่ ไม่รับ event */
export function Background3D() {
  return (
    <div className="bg3d" aria-hidden>
      <div className="bg3d__orb bg3d__orb--a" />
      <div className="bg3d__orb bg3d__orb--b" />
      <div className="bg3d__grid" />
    </div>
  );
}
