import { BgParticles } from "./BgParticles";

/** พื้นหลังตกแต่งแบบเลเยอร์ (glow orbs + grid + grain + particles) — โทนเขียว */
export function Background3D() {
  return (
    <div className="bg3d" aria-hidden>
      <div className="bg3d__orb bg3d__orb--a" />
      <div className="bg3d__orb bg3d__orb--b" />
      <div className="bg3d__orb bg3d__orb--c" />
      <div className="bg3d__grid" />
      <BgParticles />
      <div className="bg3d__grain" />
    </div>
  );
}
