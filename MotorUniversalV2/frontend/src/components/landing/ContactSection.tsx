import { useState } from 'react'
import { Send, Mail, Phone, MapPin, CheckCircle2, Loader2 } from 'lucide-react'

export default function ContactSection() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    subject: 'general',
    message: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    // Simular envío (aquí conectarías con tu backend)
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    setIsSubmitting(false)
    setIsSubmitted(true)
    setFormData({ name: '', email: '', company: '', phone: '', subject: 'general', message: '' })
    
    // Reset success message after 5 seconds
    setTimeout(() => setIsSubmitted(false), 5000)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  return (
    <section id="contact" className="fluid-py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto fluid-px-6">
        <div className="grid lg:grid-cols-2 fluid-gap-12">
          {/* Info */}
          <div>
            <h2 className="fluid-text-3xl font-bold text-gray-900 fluid-mb-4">
              ¿Listo para transformar tu evaluación educativa?
            </h2>
            <p className="fluid-text-xl text-gray-600 fluid-mb-8">
              Nuestro equipo está aquí para ayudarte. Cuéntanos sobre tu institución 
              y encontraremos la mejor solución para ti.
            </p>

            {/* Contact Info */}
            <div className="flex flex-col fluid-gap-6 fluid-mb-8">
              <div className="flex items-start fluid-gap-4">
                <div className="w-12 h-12 bg-primary-100 rounded-fluid-xl flex items-center justify-center flex-shrink-0">
                  <Mail className="fluid-icon-lg text-primary-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Email</div>
                  <a href="mailto:ventas@evaluaasi.com" className="text-gray-600 hover:text-primary-600">
                    ventas@evaluaasi.com
                  </a>
                </div>
              </div>

              <div className="flex items-start fluid-gap-4">
                <div className="w-12 h-12 bg-primary-100 rounded-fluid-xl flex items-center justify-center flex-shrink-0">
                  <Phone className="fluid-icon-lg text-primary-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Teléfono</div>
                  <a href="tel:+522222379492" className="text-gray-600 hover:text-primary-600 block">
                    (+52) 222 237 9492
                  </a>
                  <a href="tel:018008086240" className="text-gray-600 hover:text-primary-600 block">
                    01 800 808 6240
                  </a>
                </div>
              </div>

              <div className="flex items-start fluid-gap-4">
                <div className="w-12 h-12 bg-primary-100 rounded-fluid-xl flex items-center justify-center flex-shrink-0">
                  <MapPin className="fluid-icon-lg text-primary-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Oficinas</div>
                  <p className="text-gray-600">
                    Av. 31 Oriente No. 618, 2° Piso<br />
                    Col. Ladrillera de Benítez<br />
                    Puebla, Pue, México. C.P. 72530<br />
                    <span className="fluid-text-sm">Lun - Vie: 9:00 - 18:00</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Response */}
            <div className="bg-primary-50 rounded-fluid-xl fluid-p-6 border border-primary-100">
              <div className="flex items-center fluid-gap-3 fluid-mb-3">
                <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="fluid-icon-sm text-white" />
                </div>
                <span className="font-semibold text-gray-900">Respuesta rápida garantizada</span>
              </div>
              <p className="text-gray-600 fluid-text-sm">
                Respondemos todas las consultas en menos de 24 horas hábiles. 
                Para urgencias, llámanos directamente.
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="bg-white rounded-fluid-2xl fluid-p-8 shadow-sm border border-gray-100">
            {isSubmitted ? (
              <div className="text-center fluid-py-12">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto fluid-mb-4">
                  <CheckCircle2 className="fluid-icon-xl text-green-600" />
                </div>
                <h3 className="fluid-text-xl font-semibold text-gray-900 fluid-mb-2">
                  ¡Mensaje enviado!
                </h3>
                <p className="text-gray-600">
                  Gracias por contactarnos. Te responderemos pronto.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col fluid-gap-5">
                <div className="grid sm:grid-cols-2 fluid-gap-5">
                  <div>
                    <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                      Nombre completo *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Tu nombre"
                    />
                  </div>
                  <div>
                    <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="tu@email.com"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 fluid-gap-5">
                  <div>
                    <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                      Institución / Empresa
                    </label>
                    <input
                      type="text"
                      name="company"
                      value={formData.company}
                      onChange={handleChange}
                      className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Nombre de tu institución"
                    />
                  </div>
                  <div>
                    <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="+52 55 1234 5678"
                    />
                  </div>
                </div>

                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                    ¿En qué podemos ayudarte?
                  </label>
                  <select
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="general">Información general</option>
                    <option value="demo">Solicitar demo</option>
                    <option value="pricing">Precios y planes</option>
                    <option value="institutional">Plan institucional</option>
                    <option value="support">Soporte técnico</option>
                    <option value="partnership">Alianzas comerciales</option>
                  </select>
                </div>

                <div>
                  <label className="block fluid-text-sm font-medium text-gray-700 fluid-mb-1">
                    Mensaje *
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={4}
                    className="w-full fluid-px-4 fluid-py-3 border border-gray-300 rounded-fluid-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                    placeholder="Cuéntanos más sobre tus necesidades..."
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center fluid-gap-2 fluid-px-6 fluid-py-3 bg-primary-600 text-white rounded-fluid-xl hover:bg-primary-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="fluid-icon-sm animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="fluid-icon-sm" />
                      Enviar mensaje
                    </>
                  )}
                </button>

                <p className="fluid-text-xs text-gray-500 text-center">
                  Al enviar este formulario, aceptas nuestra{' '}
                  <a href="/privacidad" className="text-primary-600 hover:underline">política de privacidad</a>.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
