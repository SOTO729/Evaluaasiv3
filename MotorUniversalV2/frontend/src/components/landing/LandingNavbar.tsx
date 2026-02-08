import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'

export default function LandingNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const navLinks = [
    { name: 'Nosotros', href: '#about' },
    { name: 'Características', href: '#features' },
    { name: 'Certificaciones', href: '#certifications' },
    { name: 'Partners', href: '#partners' },
    { name: 'Precios', href: '#pricing' },
    { name: 'Contacto', href: '#contact' },
  ]

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault()
    const element = document.querySelector(href)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
    setIsMenuOpen(false)
  }

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white/95  border-b border-gray-100 z-50">
      <div className="max-w-7xl mx-auto fluid-px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center fluid-gap-3">
            <img src="/logo.png" alt="Evaluaasi" className="h-12 w-auto" />
            <span className="fluid-text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">Evaluaasi</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center fluid-gap-8">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={(e) => scrollToSection(e, link.href)}
                className="text-gray-600 hover:text-primary-600 transition-colors font-medium"
              >
                {link.name}
              </a>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center fluid-gap-3">
            <Link
              to="/login"
              className="fluid-px-4 fluid-py-2 text-gray-700 hover:text-primary-600 font-medium transition-colors"
            >
              Iniciar Sesión
            </Link>
            <Link
              to="/register"
              className="fluid-px-5 fluid-py-2 bg-primary-600 text-white rounded-fluid-lg hover:bg-primary-700 transition-colors font-medium shadow-sm hover:shadow-md"
            >
              Comenzar Gratis
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden fluid-p-2 text-gray-600 hover:text-gray-900"
          >
            {isMenuOpen ? <X className="fluid-icon-lg" /> : <Menu className="fluid-icon-lg" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden fluid-py-4 border-t border-gray-100">
            <div className="flex flex-col fluid-gap-3">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={(e) => scrollToSection(e, link.href)}
                  className="text-gray-600 hover:text-primary-600 transition-colors font-medium fluid-py-2"
                >
                  {link.name}
                </a>
              ))}
              <hr className="fluid-my-2" />
              <Link
                to="/login"
                className="text-gray-700 hover:text-primary-600 font-medium fluid-py-2"
              >
                Iniciar Sesión
              </Link>
              <Link
                to="/register"
                className="fluid-px-5 fluid-py-2 bg-primary-600 text-white rounded-fluid-lg hover:bg-primary-700 transition-colors font-medium text-center"
              >
                Comenzar Gratis
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
