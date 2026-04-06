import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const faqs = [
  {
    question: '¿Qué productos ofrece Evaluaasi?',
    answer: 'Evaluaasi ofrece cuatro productos principales: Certificados de Competencias CONOCER (con validez oficial ante la SEP), Insignias Digitales (estándar Open Badges 3.0), Constancias de Evaluación y Certificados digitales verificables. Próximamente también ofreceremos Hosting de Insignias Digitales para terceros y un LMS para escuelas.',
  },
  {
    question: '¿Qué son los certificados CONOCER y cómo los emiten?',
    answer: 'Los certificados CONOCER son certificaciones de competencias laborales con validez oficial ante la SEP, emitidas por el Consejo Nacional de Normalización y Certificación de Competencias Laborales. Evaluaasi los puede emitir gracias a su alianza con EduIT, que es Centro Evaluador autorizado. Nosotros gestionamos todo el proceso: estudio, evaluación, trámite ante CONOCER y entrega del certificado.',
  },
  {
    question: '¿Cómo funciona el modelo de Partners?',
    answer: 'Como partner, tú vendes nuestros productos (certificaciones, insignias, constancias, certificados) a tus clientes finales. Pagas un precio reducido a Evaluaasi y estableces tu propio precio de venta, quedándote con la diferencia. Nosotros proporcionamos toda la plataforma, infraestructura, trámites gubernamentales y soporte.',
  },
  {
    question: '¿Cómo funciona la venta directa?',
    answer: 'En el modelo de venta directa, el usuario final accede al catálogo de certificaciones y productos disponibles en Evaluaasi, paga en línea con MercadoPago, estudia el material, presenta su evaluación y recibe su certificado, insignia o constancia automáticamente.',
  },
  {
    question: '¿Qué son las insignias digitales?',
    answer: 'Las insignias digitales son credenciales verificables bajo el estándar Open Badges 3.0 que reconocen competencias, logros o habilidades específicas. Pueden verificarse públicamente mediante un enlace o código, y compartirse en LinkedIn, portafolios digitales o currículums.',
  },
  {
    question: '¿Cualquier persona puede verificar un certificado o insignia?',
    answer: 'Sí. Todos los certificados, insignias y constancias emitidos por Evaluaasi incluyen un código de verificación y/o URL pública. Cualquier persona puede verificar su autenticidad sin necesidad de crear una cuenta, a través de nuestra página de verificación pública.',
  },
  {
    question: '¿Qué necesito para ser Partner de Evaluaasi?',
    answer: 'Contáctanos a través del formulario o por teléfono. Analizaremos tu caso, configuraremos tu cuenta de partner con tu branding personalizado, y te daremos acceso a la plataforma para que comiences a registrar candidatos y vender nuestros productos.',
  },
  {
    question: '¿Evaluaasi es un producto de EduIT?',
    answer: 'Sí. Evaluaasi es desarrollado y operado por EduIT (Grupo EduIT / ENTRENAMIENTO INFORMATICO AVANZADO S.A. DE C.V.), empresa mexicana con más de 20 años de experiencia en tecnología educativa, Microsoft Partner Gold, y Centro Evaluador CONOCER autorizado.',
  },
  {
    question: '¿Mis datos están seguros?',
    answer: 'Absolutamente. La plataforma está alojada en Microsoft Azure con encriptación de datos, autenticación segura (JWT + Argon2), y cumplimiento de estándares de protección de datos. Nuestros servidores están en centros de datos certificados.',
  },
  {
    question: '¿En qué estados operan?',
    answer: 'Evaluaasi opera a nivel nacional en México a través de su red de partners y venta directa. Actualmente tenemos presencia en 28+ estados de la República. Al ser una plataforma 100% digital, los candidatos pueden estudiar y evaluarse desde cualquier lugar.',
  },
]

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section id="faq" className="fluid-py-20 bg-white">
      <div className="max-w-5xl mx-auto fluid-px-8 2xl:fluid-px-16">
        {/* Header */}
        <div className="text-center fluid-mb-16">
          <h2 className="fluid-text-3xl font-bold text-gray-900 fluid-mb-4">
            Preguntas Frecuentes
          </h2>
          <p className="fluid-text-xl text-gray-600">
            ¿Tienes dudas? Aquí respondemos las más comunes.
          </p>
        </div>

        {/* FAQ List */}
        <div className="flex flex-col fluid-gap-4">
          {faqs.map((faq, index) => (
            <div 
              key={index}
              className="border border-gray-200 rounded-fluid-xl overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between fluid-p-5 text-left bg-white hover:bg-gray-50 transition-colors"
              >
                <span className="font-semibold text-gray-900 fluid-pr-4">{faq.question}</span>
                <ChevronDown 
                  className={`fluid-icon-sm text-gray-500 flex-shrink-0 transition-transform ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                />
              </button>
              
              {openIndex === index && (
                <div className="fluid-px-5 fluid-pb-5 text-gray-600 leading-relaxed">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center fluid-mt-12">
          <p className="text-gray-600 fluid-mb-4">¿No encontraste lo que buscabas?</p>
          <a 
            href="#contact"
            className="text-primary-600 font-semibold hover:text-primary-700"
          >
            Contáctanos directamente →
          </a>
        </div>
      </div>
    </section>
  )
}
