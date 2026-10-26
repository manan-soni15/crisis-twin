import SiteNav from "@/components/landing/SiteNav";
import Hero from "@/components/landing/Hero";
import { Pitch, Features, DebateBand, VoiceBand, Proof, How, Footer } from "@/components/landing/Sections";

export const metadata = {
  title: "Crisis Twin: rehearse the crash before it happens",
};

export default function Home() {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <Pitch />
        <Features />
        <DebateBand />
        <VoiceBand />
        <Proof />
        <How />
      </main>
      <Footer />
    </>
  );
}
