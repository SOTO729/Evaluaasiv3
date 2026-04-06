import LandingNavbar from '../../components/landing/LandingNavbar'
import HeroSection from '../../components/landing/HeroSection'
import StatsSection from '../../components/landing/StatsSection'
import FeaturesSection from '../../components/landing/FeaturesSection'
import CertificationsSection from '../../components/landing/CertificationsSection'
import PartnersSection from '../../components/landing/PartnersSection'
import AboutSection from '../../components/landing/AboutSection'
import TestimonialsSection from '../../components/landing/TestimonialsSection'
import FAQSection from '../../components/landing/FAQSection'
import ContactSection from '../../components/landing/ContactSection'
import Footer from '../../components/landing/Footer'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white scroll-smooth" style={{ scrollPaddingTop: '3.5rem' }}>
      <LandingNavbar />
      <main className="pt-14">
        <HeroSection />
        <StatsSection />
        <CertificationsSection />
        <FeaturesSection />
        <PartnersSection />
        <AboutSection />
        <TestimonialsSection />
        <FAQSection />
        <ContactSection />
      </main>
      <Footer />
    </div>
  )
}
