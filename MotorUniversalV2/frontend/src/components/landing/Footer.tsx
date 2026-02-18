import { Link } from 'react-router-dom'
import { Facebook, Twitter, Linkedin, Instagram, Youtube } from 'lucide-react'

const footerLinks = {
  product: {
    title: 'Producto',
    links: [
      { name: 'Características', href: '#features' },
      { name: 'Precios', href: '#pricing' },
      { name: 'Integraciones', href: '#' },
      { name: 'Actualizaciones', href: '#' },
      { name: 'Roadmap', href: '#' },
    ],
  },
  resources: {
    title: 'Recursos',
    links: [
      { name: 'Documentación', href: '#' },
      { name: 'Tutoriales', href: '#' },
      { name: 'Blog', href: '#' },
      { name: 'Webinars', href: '#' },
      { name: 'Centro de ayuda', href: '#' },
    ],
  },
  company: {
    title: 'Empresa',
    links: [
      { name: 'Sobre nosotros', href: '#about' },
      { name: 'Carreras', href: '#' },
      { name: 'Contacto', href: '#contact' },
      { name: 'Partners', href: '#partners' },
      { name: 'Prensa', href: '#' },
    ],
  },
  legal: {
    title: 'Legal',
    links: [
      { name: 'Términos y condiciones', href: '/terminos' },
      { name: 'Aviso de privacidad', href: '/privacidad' },
      { name: 'Política de privacidad', href: '/politica-privacidad' },
      { name: 'Cookies', href: '/politica-privacidad#cookies' },
      { name: 'Seguridad', href: '/politica-privacidad#seguridad' },
    ],
  },
}

const socialLinks = [
  { name: 'Facebook', icon: Facebook, href: '#' },
  { name: 'Twitter', icon: Twitter, href: '#' },
  { name: 'LinkedIn', icon: Linkedin, href: '#' },
  { name: 'Instagram', icon: Instagram, href: '#' },
  { name: 'YouTube', icon: Youtube, href: '#' },
]

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-gray-900 text-gray-300">
      {/* Main Footer */}
      <div className="max-w-7xl mx-auto fluid-px-6 fluid-py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-6 fluid-gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center fluid-gap-2 fluid-mb-4">
              <img src="/logo.webp" alt="Evaluaasi" className="h-10 w-auto" />
              <span className="fluid-text-xl font-bold text-white">Evaluaasi</span>
            </Link>
            <p className="text-gray-400 fluid-mb-4 max-w-sm">
              <strong className="text-gray-300">Evaluaasi</strong> es un producto de <strong className="text-primary-400">Eduit</strong>. 
              Plataforma líder en evaluación educativa, certificaciones CONOCER, 
              insignias digitales y constancias de estudio.
            </p>
            <div className="text-gray-500 fluid-text-sm fluid-mb-6 max-w-sm">
              <p>Av. 31 Oriente No. 618, 2° Piso</p>
              <p>Col. Ladrillera de Benítez</p>
              <p>Puebla, Pue, México. C.P. 72530</p>
              <p className="fluid-mt-2">
                <a href="tel:+522222379492" className="hover:text-gray-300">(+52) 222 237 9492</a>
                {' · '}
                <a href="tel:018008086240" className="hover:text-gray-300">01 800 808 6240</a>
              </p>
            </div>
            
            {/* Social Links */}
            <div className="flex fluid-gap-4">
              {socialLinks.map((social) => {
                const Icon = social.icon
                return (
                  <a
                    key={social.name}
                    href={social.href}
                    className="w-10 h-10 bg-gray-800 rounded-fluid-lg flex items-center justify-center hover:bg-primary-600 transition-colors"
                    aria-label={social.name}
                  >
                    <Icon className="fluid-icon-sm" />
                  </a>
                )
              })}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([key, section]) => (
            <div key={key}>
              <h3 className="text-white font-semibold fluid-mb-4">{section.title}</h3>
              <ul className="flex flex-col fluid-gap-3">
                {section.links.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto fluid-px-6 fluid-py-6">
          <div className="flex flex-col md:flex-row justify-between items-center fluid-gap-4">
            <p className="text-gray-500 fluid-text-sm">
              © {currentYear} Evaluaasi · Un producto de <span className="text-primary-400">Eduit</span>. Todos los derechos reservados.
            </p>
            <div className="flex items-center fluid-gap-6 fluid-text-sm">
              <a href="#" className="text-gray-500 hover:text-gray-300">
                Estado del servicio
              </a>
              <span className="flex items-center fluid-gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-gray-500">Todos los sistemas operativos</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
