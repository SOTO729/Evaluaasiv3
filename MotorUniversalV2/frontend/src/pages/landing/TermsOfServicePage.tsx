import { Link } from 'react-router-dom'
import { ArrowLeft, FileText, Scale, Shield, ShoppingBag, Headphones, CreditCard, Lock, Link2, Copyright, BookOpen, Gavel, AlertTriangle } from 'lucide-react'

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">Términos y Condiciones</h1>
          <p className="text-gray-300 text-lg">
            Grupo EduIT - ENTRENAMIENTO INFORMATICO AVANZADO SA DE CV
          </p>
          <p className="text-gray-400 text-sm mt-2">
            Actualizado el 06/06/2024
          </p>
        </div>
      </div>

      {/* Table of Contents */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Contenido</h2>
          <nav className="grid sm:grid-cols-2 gap-2 text-sm">
            {[
              { id: 'info-legal', label: '1. Información legal' },
              { id: 'proteccion-datos', label: '2. Protección de datos' },
              { id: 'productos', label: '3. Productos y Servicios' },
              { id: 'atencion', label: '4. Servicio al cliente' },
              { id: 'cancelaciones', label: '5. Cancelaciones y Reembolsos' },
              { id: 'seguridad', label: '6. Seguridad informática' },
              { id: 'enlaces', label: '7. Introducción de enlaces' },
              { id: 'propiedad-intelectual', label: '8. Propiedad intelectual' },
              { id: 'propiedad-software', label: '9. Propiedad del Software' },
              { id: 'legislacion', label: '10. Legislación y fuero' },
              { id: 'condiciones-uso', label: '11. Condiciones de Uso' },
            ].map((item) => (
              <a 
                key={item.id}
                href={`#${item.id}`}
                className="text-gray-600 hover:text-primary-600 py-1"
              >
                → {item.label}
              </a>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12">
          
          {/* Introducción */}
          <section className="mb-12">
            <div className="bg-primary-50 border border-primary-200 rounded-xl p-6 mb-6">
              <p className="text-gray-700 leading-relaxed">
                Las presentes Condiciones Generales regulan el uso de esta página web que <strong>Grupo EduIT</strong> pone 
                a disposición de los usuarios de Internet. La utilización de esta página <a href="https://www.grupoeduit.com" className="text-primary-600 hover:underline">www.grupoeduit.com</a> implica 
                la aceptación de las presentes Condiciones Generales que el usuario debe leer cada vez que se proponga 
                utilizar dicha página porque tanto la página en sí como estas condiciones están sujetos a modificaciones.
              </p>
            </div>
            <p className="text-gray-700 leading-relaxed">
              El acceso a esta página web es responsabilidad exclusiva de los <strong>USUARIOS</strong> y supone aceptar y 
              conocer las advertencias legales, condiciones y términos de uso contenidos en ella.
            </p>
          </section>

          {/* 1. Información Legal */}
          <section id="info-legal" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                <Scale className="w-5 h-5 text-primary-600" />
              </div>
              1. Información Legal
            </h2>
            <div className="bg-gray-50 rounded-xl p-6">
              <p className="text-gray-700 leading-relaxed mb-4">
                La presente página web <a href="https://www.grupoeduit.com" className="text-primary-600 hover:underline">www.grupoeduit.com</a> pertenece a:
              </p>
              <div className="space-y-2 text-gray-700">
                <p><strong>Razón Social:</strong> ENTRENAMIENTO INFORMATICO AVANZADO SA DE CV</p>
                <p><strong>Nombre Comercial:</strong> Grupo EduIT</p>
                <p><strong>Domicilio Legal:</strong> Camelias #216, Colonia Bugambilias, Ciudad Puebla, Estado Puebla, México, CP: 72580</p>
                <p><strong>Correo Electrónico:</strong> <a href="mailto:informes@grupoeduit.com" className="text-primary-600 hover:underline">informes@grupoeduit.com</a></p>
              </div>
            </div>
          </section>

          {/* 2. Protección de Datos */}
          <section id="proteccion-datos" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary-600" />
              </div>
              2. Protección de Datos
            </h2>
            <div className="space-y-4 text-gray-700 leading-relaxed">
              <p>
                Le informamos de que los datos de carácter personal recogidos voluntariamente en los formularios de 
                esta web, por contacto a nuestro número de contacto de WhatsApp o por correo electrónico, y que la 
                aceptación de su envío autorizan a <strong>Grupo EduIT</strong> a que sean incorporados a un fichero de su propiedad.
              </p>
              <p>
                Grupo EduIT cumple estrictamente el deber de secreto de los datos de carácter personal y el tratamiento 
                de los mismos confidencialmente, asumiendo a estos efectos las medidas de índole técnica, organizativa y 
                de seguridad necesarias para evitar su alteración, pérdida, tratamiento o acceso no autorizado.
              </p>
              <p>
                Grupo EduIT queda totalmente exonerada de cualquier responsabilidad si la información facilitada 
                voluntariamente fuese incompleta, no veraz o irreal por los USUARIOS de esta página web.
              </p>
              <p>
                Grupo EduIT garantiza que los datos serán tratados con la finalidad de mantener las oportunas relaciones 
                comerciales y promocionales sobre los servicios de esta empresa con usted o la entidad que usted representa.
              </p>
              <div className="mt-4">
                <Link to="/politica-privacidad" className="text-primary-600 hover:underline font-medium">
                  Más información en nuestra Política de Privacidad →
                </Link>
              </div>
            </div>
          </section>

          {/* 3. Productos y Servicios */}
          <section id="productos" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-primary-600" />
              </div>
              3. Productos y Servicios
            </h2>
            <p className="text-gray-700 leading-relaxed mb-6">
              <strong>Grupo EduIT</strong> es una empresa dedicada a la distribución de soluciones de software, soporte técnico, 
              servicios tecnológicos, venta y distribución de software y soporte técnico de empresas terceras relacionadas 
              con tecnología digital, así como de la creación de contenido digital, entrenamiento técnico y tecnológico en línea.
            </p>
            
            <div className="space-y-6">
              {/* Entrenamiento */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  Entrenamiento
                </h3>
                <div className="text-gray-700 space-y-3">
                  <p>
                    Grupo EduIT distribuye entrenamiento presencial, entrenamiento en línea en vivo y entrenamiento en 
                    línea pregrabado. Este entrenamiento está disponible en horarios especificados en cada curso, tanto 
                    en línea como de manera presencial, o de manera permanente en el caso de entrenamiento en línea pregrabado.
                  </p>
                  <p>
                    El entrenamiento en vivo (en línea o presencial) se realizará en los días y horarios indicados en el 
                    cronograma de cursos. En el caso de entrenamiento presencial, se realizará en una locación indicada con 
                    previa anticipación en el curso y está sujeto a que se complete el cupo mínimo requerido y a la coordinación 
                    de los interesados con los organizadores, los cuales pueden ser Grupo EduIT en conjunto con terceros.
                  </p>
                  <p>
                    El contenido académico está alojado en una plataforma de entrenamiento donde también se puede acceder a 
                    videos de los cursos.
                  </p>
                </div>
              </div>

              {/* Certificaciones */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-green-600" />
                  Certificaciones sobre Entrenamiento
                </h3>
                <div className="text-gray-700 space-y-3">
                  <p>
                    Grupo EduIT ofrece certificaciones dependiendo del entrenamiento solicitado, en la cual se detalla la 
                    descripción del entrenamiento, su alcance, su contenido, el instructor y toda la evidencia necesaria 
                    para que el alumno pueda corroborar a terceros que adquirió el conocimiento relacionado.
                  </p>
                  <p>
                    Las certificaciones son productos que se ofrecen en conjunto con el entrenamiento en la mayoría de las 
                    ocasiones, a menos que se especifique otra cosa. En los casos donde la certificación no se incluya en el 
                    curso, el alumno deberá pasar un examen de certificación. Al aprobarlo, el alumno tendrá la opción de 
                    pagar la certificación y recibirla.
                  </p>
                  <p>
                    Grupo EduIT podrá cobrar un derecho de examen dependiendo del curso.
                  </p>
                </div>
              </div>

              {/* Venta de equipo */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-purple-600" />
                  Venta de consumibles y equipo de cómputo
                </h3>
                <p className="text-gray-700">
                  Grupo EduIT cuenta con alianzas con varios fabricantes y mayoristas autorizados para la venta de 
                  consumibles y equipo de cómputo. En caso de adquirir alguno de estos productos, deberá solicitar la 
                  garantía que corresponda. <strong>Grupo EduIT entrega todos los productos nuevos y empaquetados por el fabricante.</strong>
                </p>
              </div>
            </div>
          </section>

          {/* 4. Servicio al Cliente */}
          <section id="atencion" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                <Headphones className="w-5 h-5 text-primary-600" />
              </div>
              4. Servicio al Cliente
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              El servicio de atención al cliente se refiere a la asistencia en activación de soporte, activación de 
              licencias, enrolamiento en cursos de entrenamiento o solicitud de estatus de entrega de un producto o servicio.
            </p>
            <div className="bg-gray-50 rounded-xl p-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Horario de Atención</h4>
                  <p className="text-gray-600">Lunes a Viernes</p>
                  <p className="text-gray-600">09:00 - 17:00 hrs</p>
                  <p className="text-gray-500 text-sm">(Horario de Ciudad de México)</p>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Contacto</h4>
                  <p className="text-gray-600">
                    <a href="mailto:informes@grupoeduit.com" className="text-primary-600 hover:underline">informes@grupoeduit.com</a>
                  </p>
                  <p className="text-gray-600">
                    <a href="tel:+522222379492" className="text-primary-600 hover:underline">+52 222 237 9492</a>
                  </p>
                </div>
              </div>
              <p className="text-gray-500 text-sm mt-4">
                Si solicita asistencia el viernes por la tarde, recibirá el contacto de nuestros ejecutivos el lunes siguiente.
              </p>
            </div>
          </section>

          {/* 5. Cancelaciones y Reembolsos */}
          <section id="cancelaciones" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-primary-600" />
              </div>
              5. Cancelaciones y Reembolsos
            </h2>
            
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
                <h3 className="font-semibold text-yellow-800 mb-2">Cursos</h3>
                <p className="text-yellow-700">
                  El cliente podrá solicitar reembolso <strong>7 días hábiles antes</strong> del inicio del curso, siempre que 
                  Grupo EduIT no haya hecho inversión en viáticos o material de estudio para el caso de cursos presenciales.
                </p>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                <h3 className="font-semibold text-red-800 mb-2">Certificaciones</h3>
                <p className="text-red-700">
                  Los derechos de examen y las certificaciones <strong>NO son reembolsables</strong>.
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-5">
                <p className="text-gray-700">
                  Para iniciar un proceso de cancelación o reembolso, deberá enviar mail al correo{' '}
                  <a href="mailto:informes@grupoeduit.com" className="text-primary-600 hover:underline">informes@grupoeduit.com</a>{' '}
                  o comunicarse al teléfono{' '}
                  <a href="tel:+522222379492" className="text-primary-600 hover:underline">+52 222 237 9492</a>.
                </p>
              </div>
            </div>
          </section>

          {/* 6. Seguridad Informática */}
          <section id="seguridad" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                <Lock className="w-5 h-5 text-primary-600" />
              </div>
              6. Seguridad Informática
            </h2>
            <div className="bg-green-50 border border-green-200 rounded-xl p-6">
              <p className="text-green-800">
                Grupo EduIT le informa que esta página <strong>no tiene virus, programas espías o software malicioso</strong> y 
                que no utiliza cookies para su navegación.
              </p>
            </div>
          </section>

          {/* 7. Introducción de Enlaces */}
          <section id="enlaces" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                <Link2 className="w-5 h-5 text-primary-600" />
              </div>
              7. Introducción de Enlaces en la Página
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Los USUARIOS de Internet que quieran introducir enlaces desde sus propias páginas web a esta página web 
              deberán cumplir con las condiciones que se detallan a continuación:
            </p>
            <ul className="space-y-3">
              {[
                'El enlace únicamente vinculará con la home page o página principal, pero no podrá reproducirla de ninguna forma (online links, copia de los textos, gráficos, etc.).',
                'Queda prohibido establecer frames o marcos de cualquier tipo que envuelvan a la página o permitan la visualización de sus contenidos a través de direcciones de Internet distintas a las de la página.',
                'No deberá producir error, confusión o engaño en los usuarios sobre la verdadera procedencia de los contenidos.',
                'No deberá suponer un acto de comparación o imitación desleal.',
                'No deberá servir para aprovecharse de la reputación de la marca y el prestigio de Grupo EduIT.',
                'En ningún caso se expresará en la página donde se ubique el enlace que Grupo EduIT ha prestado su consentimiento para la inserción del enlace o que de otra forma patrocina, colabora, verifica o supervisa los servicios del remitente.',
                'La página que establezca el enlace deberá cumplir fielmente con la ley y no podrá en ningún caso disponer o enlazar con contenidos propios o de terceros que sean ilícitos, nocivos o contrarios a la moral, el decoro y a las buenas costumbres.',
              ].map((item, index) => (
                <li key={index} className="flex items-start gap-3 text-gray-700">
                  <span className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-medium text-gray-600">
                    {index + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 8. Propiedad Intelectual */}
          <section id="propiedad-intelectual" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                <Copyright className="w-5 h-5 text-primary-600" />
              </div>
              8. Propiedad Intelectual e Industrial
            </h2>
            <div className="space-y-4 text-gray-700 leading-relaxed">
              <p>
                Todos los contenidos de la página <a href="https://www.grupoeduit.com" className="text-primary-600 hover:underline">www.grupoeduit.com</a> son 
                propiedad intelectual de <strong>Grupo EduIT</strong> o de terceros y no podrán ser reproducidos, copiados, pegados, 
                linkados, transmitidos, distribuidos o manipulados de cualquier forma y con cualquier finalidad, sin la 
                autorización previa, expresa y por escrito de Grupo EduIT, manteniendo en todo momento el «copyright» 
                intacto y cualquier otro indicador de la propiedad intelectual de los materiales o contenidos.
              </p>
              <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                <p className="text-red-800">
                  Todo uso o modificación del Material o de los Contenidos para cualquier otro fin distinto del autorizado 
                  en las Condiciones Generales será considerado una <strong>violación de las leyes internacionales del «copyright»</strong> que 
                  protegen los derechos de autor.
                </p>
              </div>
            </div>
          </section>

          {/* 9. Propiedad del Entrenamiento y Software */}
          <section id="propiedad-software" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary-600" />
              </div>
              9. Propiedad del Entrenamiento y el Software
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                El Cliente tendrá derecho a acceder al Entrenamiento o usar el Software con licencia de acuerdo con las 
                condiciones del Acuerdo de Usuario Final aplicable, para uso propio o interno del cliente, o el derecho 
                del Usuario Final del cliente de acceder al Entrenamiento o usar el Software con licencia de acuerdo con 
                las condiciones del Acuerdo de Usuario Final aplicable, si el Cliente revende el producto a un usuario final.
              </p>
              <p className="font-medium">
                Grupo EduIT se reserva todos los derechos no expresamente otorgados en y sobre el Entrenamiento y el 
                Software en este documento.
              </p>
            </div>
          </section>

          {/* 10. Legislación y Fuero */}
          <section id="legislacion" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                <Gavel className="w-5 h-5 text-primary-600" />
              </div>
              10. Legislación y Fuero
            </h2>
            <div className="bg-gray-50 rounded-xl p-6">
              <p className="text-gray-700 leading-relaxed">
                La prestación del servicio se rige por la <strong>legislación mexicana</strong>, siendo competentes los 
                <strong> Tribunales de la ciudad de Puebla</strong>, a los que el USUARIO se somete expresamente.
              </p>
            </div>
          </section>

          {/* 11. Condiciones de Uso */}
          <section id="condiciones-uso" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-primary-600" />
              </div>
              11. Condiciones de Uso
            </h2>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
              <p className="text-gray-700 leading-relaxed mb-4">
                Usted navega por este sitio y su uso del servicio es bajo su propio riesgo, y Grupo EduIT no es responsable 
                de ningún daño directo, incidental, consecuente, indirecto o punitivo que surja de su acceso o uso de este 
                sitio o cualquier información contenida en el mismo.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Todas las demás marcas comerciales, marcas de servicio y logotipos utilizados en este sitio son marcas 
                comerciales, marcas de servicio o logotipos de sus respectivos propietarios.
              </p>
            </div>
          </section>

          {/* Footer */}
          <div className="border-t border-gray-200 pt-6 mt-8 text-center">
            <p className="text-gray-500 text-sm">
              <strong>Grupo EduIT</strong> - ENTRENAMIENTO INFORMATICO AVANZADO SA DE CV
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Última actualización: 06 de Junio de 2024
            </p>
          </div>

        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-8">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </Link>
          <div className="flex gap-4 text-sm">
            <Link to="/privacidad" className="text-gray-500 hover:text-gray-700">
              Aviso de Privacidad
            </Link>
            <Link to="/politica-privacidad" className="text-gray-500 hover:text-gray-700">
              Política de Privacidad
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6">
        <div className="max-w-4xl mx-auto px-4 text-center text-gray-500 text-sm">
          © {new Date().getFullYear()} Evaluaasi / Grupo EduIT. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  )
}
