import LandingNavbar from '../../components/landing/LandingNavbar'
import HeroSection from '../../components/landing/HeroSection'
import StatsSection from '../../components/landing/StatsSection'
import AboutSection from '../../components/landing/AboutSection'
import FeaturesSection from '../../components/landing/FeaturesSection'
import CertificationsSection from '../../components/landing/CertificationsSection'
import PartnersSection from '../../components/landing/PartnersSection'
import PricingSection from '../../components/landing/PricingSection'
import TestimonialsSection from '../../components/landing/TestimonialsSection'
import FAQSection from '../../components/landing/FAQSection'
import ContactSection from '../../components/landing/ContactSection'
import Footer from '../../components/landing/Footer'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden overscroll-contain 3xl:text-lg 4xl:text-xl">
      <LandingNavbar />
      <main>
        <HeroSection />
        <StatsSection />
        <AboutSection />
        <FeaturesSection />
        <CertificationsSection />
        <PartnersSection />
        <PricingSection />
        <TestimonialsSection />
        <FAQSection />
        <ContactSection />
      </main>
      <Footer />
    </div>
  )
}
