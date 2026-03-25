import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import IntegrationStrip from "@/components/landing/IntegrationStrip";
import HowItWorks from "@/components/landing/HowItWorks";
import MarketSection from "@/components/landing/MarketSection";
import Pricing from "@/components/landing/Pricing";
import EmailCapture from "@/components/landing/EmailCapture";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <IntegrationStrip />
      <HowItWorks />
      <MarketSection />
      <Pricing />
      <EmailCapture />
      <Footer />
    </div>
  );
};

export default Index;
