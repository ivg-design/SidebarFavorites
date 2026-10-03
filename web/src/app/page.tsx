import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import BeforeAfter from "@/components/BeforeAfter";
import DemoVideo from "@/components/DemoVideo";
import HowItWorks from "@/components/HowItWorks";
import CustomIcons from "@/components/CustomIcons";
import Everywhere from "@/components/Everywhere";
import BothIcons from "@/components/BothIcons";
import UnderTheHood from "@/components/UnderTheHood";
import Install from "@/components/Install";
import StructuredData from "@/components/StructuredData";
import { getSiteRelease } from "@/lib/github";

export default async function Home() {
  const release = await getSiteRelease();
  return (
    <>
      <Header />
      <main id="main">
        <Hero release={release} />
        <BeforeAfter />
        <DemoVideo />
        <HowItWorks />
        <CustomIcons />
        <Everywhere />
        <BothIcons />
        <UnderTheHood />
        <Install release={release} />
      </main>
      <Footer />
      <StructuredData release={release} />
    </>
  );
}
