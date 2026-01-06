import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const faqs = [
  {
    question: '¿Cómo empiezo a usar Evaluaasi?',
    answer: 'Simplemente crea una cuenta gratuita y podrás comenzar a crear tu primer examen en minutos. No necesitas tarjeta de crédito ni instalación. Ofrecemos tutoriales en video y documentación completa para ayudarte.',
  },
  {
    question: '¿Qué son los certificados CONOCER y cómo puedo emitirlos?',
    answer: 'Los certificados CONOCER tienen validez oficial ante la Secretaría de Educación Pública y son emitidos por el Consejo Nacional de Normalización y Certificación de Competencias Laborales. Evaluaasi te permite crear evaluaciones alineadas a Estándares de Competencia (EC) y generar los certificados automáticamente una vez aprobada la evaluación.',
  },
  {
    question: '¿Qué son las insignias digitales?',
    answer: 'Las insignias digitales son credenciales verificables que reconocen logros, habilidades o competencias específicas. Son compatibles con el estándar Open Badges y pueden compartirse en LinkedIn, portafolios digitales o currículums. Cada insignia incluye metadatos sobre el criterio de otorgamiento y puede verificarse en línea.',
  },
  {
    question: '¿Cómo funcionan las constancias de estudio?',
    answer: 'Las constancias se generan automáticamente cuando un estudiante completa un curso o evaluación. Incluyen un código QR de verificación, datos del participante, fecha de emisión y puedes personalizar el diseño con tu logo institucional.',
  },
  {
    question: '¿Puedo importar mis exámenes existentes?',
    answer: 'Sí, Evaluaasi permite importar preguntas desde archivos Excel, Word o CSV. También tenemos integraciones con otras plataformas populares como Moodle y Google Forms.',
  },
  {
    question: '¿Qué tipos de preguntas puedo crear?',
    answer: 'Ofrecemos Verdadero/Falso, Opción Múltiple, Selección Múltiple (varias respuestas correctas), Ordenamiento, y ejercicios interactivos paso a paso. Cada tipo soporta imágenes, videos y texto enriquecido.',
  },
  {
    question: '¿Cómo funciona el plan institucional?',
    answer: 'El plan institucional se adapta a las necesidades de tu organización. Incluye implementación personalizada, capacitación para tu equipo, integración con sistemas existentes (LMS, SSO), certificación CONOCER y soporte dedicado.',
  },
  {
    question: '¿Mis datos están seguros?',
    answer: 'Absolutamente. Usamos encriptación AES-256 para datos en reposo, TLS 1.3 para transmisión, autenticación JWT, y cumplimos con GDPR y regulaciones de protección de datos educativos.',
  },
  {
    question: '¿Evaluaasi es un producto de Eduit?',
    answer: 'Sí, Evaluaasi es desarrollado y operado por Eduit (Grupo EduIT / ENTRENAMIENTO INFORMATICO AVANZADO S.A. DE C.V.), empresa mexicana especializada en soluciones tecnológicas para educación y capacitación empresarial.',
  },
  {
    question: '¿Ofrecen descuentos para instituciones educativas?',
    answer: 'Sí, ofrecemos descuentos especiales para escuelas públicas, ONGs educativas y programas de becas. Contáctanos para conocer las opciones disponibles.',
  },
]

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section id="faq" className="py-20 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Preguntas Frecuentes
          </h2>
          <p className="text-xl text-gray-600">
            ¿Tienes dudas? Aquí respondemos las más comunes.
          </p>
        </div>

        {/* FAQ List */}
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div 
              key={index}
              className="border border-gray-200 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-5 text-left bg-white hover:bg-gray-50 transition-colors"
              >
                <span className="font-semibold text-gray-900 pr-4">{faq.question}</span>
                <ChevronDown 
                  className={`w-5 h-5 text-gray-500 flex-shrink-0 transition-transform ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                />
              </button>
              
              {openIndex === index && (
                <div className="px-5 pb-5 text-gray-600 leading-relaxed">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <p className="text-gray-600 mb-4">¿No encontraste lo que buscabas?</p>
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
