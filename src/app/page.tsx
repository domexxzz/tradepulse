import { Navbar } from "@/components/common/Navbar";
import { Footer } from "@/components/common/Footer";
import { Hero } from "@/components/marketing/Hero";
import { MarketTicker } from "@/components/marketing/MarketTicker";
import { LiveChart } from "@/components/marketing/LiveChart";
import { TrustStrip } from "@/components/marketing/TrustStrip";
import { ProblemSolution } from "@/components/marketing/ProblemSolution";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { CoreFeatures } from "@/components/marketing/CoreFeatures";
import { AllFeatures } from "@/components/marketing/AllFeatures";
import { Demo } from "@/components/marketing/Demo";
import { Pricing } from "@/components/marketing/Pricing";
import { Benefits } from "@/components/marketing/Benefits";
import { FAQ } from "@/components/marketing/FAQ";
import { Disclaimer } from "@/components/marketing/Disclaimer";
import { MobileStickyCTA } from "@/components/marketing/MobileStickyCTA";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <MarketTicker />
        <LiveChart />
        <TrustStrip />
        <ProblemSolution />
        <HowItWorks />
        <CoreFeatures />
        <AllFeatures />
        <Demo />
        <Pricing />
        <Benefits />
        <FAQ />
        <Disclaimer />
      </main>
      <Footer />
      <MobileStickyCTA />
    </>
  );
}
