import { Link } from 'react-router-dom'
import { ArrowLeft, Shield } from 'lucide-react'

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden overscroll-contain">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto fluid-px-6 fluid-py-6">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium mb-4"
          >
            <ArrowLeft className="fluid-icon-sm" />
            Volver al inicio
          </Link>
          <div className="flex items-center fluid-gap-3">
            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
              <Shield className="fluid-icon-md" />
            </div>
            <div>
              <h1 className="fluid-text-2xl font-bold text-gray-900">Aviso de Privacidad</h1>
              <p className="text-gray-500 text-sm">Última actualización: 01 de Octubre de 2014</p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto fluid-px-6 fluid-py-12">
        <div className="bg-white rounded-fluid-2xl shadow-sm border border-gray-100 fluid-p-10">
          <div className="prose prose-gray max-w-none">
            
            <section className="fluid-mb-8">
              <h2 className="fluid-text-xl font-semibold text-gray-900 fluid-mb-4">Fundamento Legal</h2>
              <p className="text-gray-700 leading-relaxed">
                De conformidad con lo previsto en los artículos 8, 12, 14, 16, 17, 23, 36 y tercero transitorio 
                de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares, el 
                Reglamento de la Ley Federal de Protección de Datos Personales en Posesión de Particulares 
                y los Lineamientos del Aviso de Privacidad, le informamos lo siguiente:
              </p>
            </section>

            <section className="fluid-mb-8">
              <h2 className="fluid-text-xl font-semibold text-gray-900 fluid-mb-4">Responsable del Tratamiento</h2>
              <p className="text-gray-700 leading-relaxed">
                Cliente, (a quién en lo sucesivo y para efectos del presente se le denominará "Plantel"), 
                señalando como domicilio el ubicado en <strong>Avenida 31 Oriente No. 618 2° Piso, Col. 
                Ladrillera de Benítez. Puebla, Pue, México. C.P. 72530</strong>, hace del conocimiento a las 
                personas físicas que le proporcionen sus datos personales y/o sensibles (a quién en lo 
                sucesivo y para efectos del presente se les denominará "Titular"), que garantiza la privacidad, 
                integridad, manejo y protección de dichos datos, y que serán utilizados única y exclusivamente 
                para el cumplimiento de las obligaciones derivadas de la relación jurídica generada con usted.
              </p>
            </section>

            <section className="fluid-mb-8">
              <h2 className="fluid-text-xl font-semibold text-gray-900 fluid-mb-4">Consentimiento</h2>
              <p className="text-gray-700 leading-relaxed">
                El tratamiento de los Datos Personales y/o Datos Personales Sensibles del Titular que se han 
                proporcionado al Plantel bajo cualquier medio o circunstancia, será efectuado en cumplimiento 
                de estos términos y condiciones, por lo que desde este momento se entiende que el Titular 
                otorga su autorización y consentimiento para dicho tratamiento, en el que se podrán incluir 
                los siguientes datos:
              </p>
            </section>

            <section className="fluid-mb-8">
              <h2 className="fluid-text-xl font-semibold text-gray-900 fluid-mb-4">Datos que se Recaban</h2>
              
              <div className="flex flex-col fluid-gap-4">
                <div className="bg-gray-50 rounded-fluid-lg fluid-p-4">
                  <h3 className="font-semibold text-gray-900 fluid-mb-2">🆔 Identidad</h3>
                  <p className="text-gray-600 text-sm">
                    Nombre, domicilio, teléfono, correo electrónico, firma, Registro Federal del Contribuyente, 
                    Clave Única del Registro de Población, número de afiliación al IMSS, fecha de nacimiento, 
                    edad, nacionalidad, estado civil.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-fluid-lg fluid-p-4">
                  <h3 className="font-semibold text-gray-900 fluid-mb-2">💼 Profesionales</h3>
                  <p className="text-gray-600 text-sm">
                    Trabajo, puesto, salario, prestaciones, correo electrónico, referencias laborales, 
                    referencias personales y referencias comerciales.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-fluid-lg fluid-p-4">
                  <h3 className="font-semibold text-gray-900 fluid-mb-2">💰 Patrimoniales</h3>
                  <p className="text-gray-600 text-sm">
                    Ingresos, egresos, número de cuenta bancaria, sucursal y plaza bancaria, seguros, 
                    créditos e información contable y financiera.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-fluid-lg fluid-p-4">
                  <h3 className="font-semibold text-gray-900 fluid-mb-2">🎓 Académicos</h3>
                  <p className="text-gray-600 text-sm">
                    Grado, titulo, cédula profesional, certificados y constancias.
                  </p>
                </div>

                <div className="bg-yellow-50 rounded-fluid-lg fluid-p-4 border border-yellow-200">
                  <h3 className="font-semibold text-yellow-800 fluid-mb-2">⚠️ Sensibles</h3>
                  <p className="text-yellow-700 text-sm">
                    Preferencias sexuales, información genética, origen étnico o racial, estado de salud, 
                    creencias religiosas, filosóficas y morales, opiniones políticas y afiliación sindical.
                  </p>
                </div>
              </div>
            </section>

            <section className="fluid-mb-8">
              <h2 className="fluid-text-xl font-semibold text-gray-900 fluid-mb-4">Datos de Familiares y Terceros</h2>
              <p className="text-gray-700 leading-relaxed">
                Asimismo le informamos que el Plantel recabará y tratará los datos personales de sus familiares 
                y/o terceros con los que usted tenga una relación que sean necesarios para cumplir con las 
                obligaciones de la relación jurídica establecida con usted. De este modo, al proporcionar los 
                datos personales necesarios relacionados con sus familiares y/o terceros usted reconoce tener 
                el consentimiento de éstos para que el Plantel trate éstos y a la vez pueda cumplir con las 
                obligaciones señaladas en el presente Aviso.
              </p>
            </section>

            <section className="fluid-mb-8">
              <h2 className="fluid-text-xl font-semibold text-gray-900 fluid-mb-4">Finalidades del Tratamiento</h2>
              <p className="text-gray-700 leading-relaxed fluid-mb-4">
                La información de Datos Personales y/o Datos Sensibles, que es proporcionada de manera directa 
                por el Titular con su plena autorización y consentimiento al Plantel, tendrá los usos que de 
                forma enunciativa pero no limitativa se puntualizan a continuación:
              </p>
              <ul className="list-disc list-inside text-gray-700 flex flex-col fluid-gap-2 fluid-ml-4">
                <li>Prestación de los servicios educativos que realice el Plantel al Titular</li>
                <li>Alta en la base de alumnos o exalumnos según sea el caso</li>
                <li>Revalidación y certificación de estudios</li>
                <li>Trámites necesarios ante las autoridades escolares correspondientes</li>
                <li>Envío de información relacionada con asuntos académicos o administrativos</li>
                <li>Inscripción a programas de vinculación con universidades en el extranjero</li>
                <li>Otorgamiento de apoyos económicos, becas o financiamiento</li>
                <li>Administración del acceso físico a las instalaciones del Plantel</li>
                <li>Administración del acceso electrónico a los sistemas e infraestructura tecnológica</li>
                <li>Contratación y/o cancelación de los seguros con los que cuenta el Plantel</li>
                <li>Contactar a familiares o terceros en caso de emergencia</li>
                <li>Gestiones de facturación y procesos de cobranza correspondientes</li>
                <li>Registro y certificación del servicio social comunitario y/o profesional</li>
                <li>Inscripción a eventos y/o actividades extracurriculares</li>
                <li>Envío de información promocional de cursos, diplomados, seminarios, simposios, talleres</li>
                <li>Difusión de felicitaciones y/o reconocimientos por logros destacados</li>
                <li>Promoción de la vida académica, de investigación, eventos deportivos, culturales, recreativos y sociales</li>
                <li>Gestión de perfil en bolsa de trabajo</li>
                <li>Aplicación de encuestas y evaluaciones para mejorar la calidad de los servicios</li>
                <li>Envío de publicidad</li>
              </ul>
            </section>

            <section className="fluid-mb-8">
              <h2 className="fluid-text-xl font-semibold text-gray-900 fluid-mb-4">Responsabilidad del Titular</h2>
              <p className="text-gray-700 leading-relaxed">
                Es responsabilidad del Titular, el garantizar que los Datos Personales y/o Sensibles proporcionados 
                al Plantel sean completos y correctos, asimismo deberá comunicar al Plantel sobre cualquier 
                modificación, a efecto de mantener la información actualizada.
              </p>
            </section>

            <section className="fluid-mb-8">
              <h2 className="fluid-text-xl font-semibold text-gray-900 fluid-mb-4">Medidas de Seguridad</h2>
              <p className="text-gray-700 leading-relaxed">
                La información que sea entregada al Plantel, será debidamente conservada y protegida, a través 
                de los medios físicos y tecnológicos adecuados y solo tendrán acceso a la información aquellas 
                personas autorizadas por el Plantel, quienes han asumido la obligación de mantener la información 
                bajo un estricto orden de confidencialidad y seguridad. Así mismo los datos otorgados por el 
                Titular, podrán ser proporcionados a las autoridades escolares y autoridades competentes en los 
                casos previstos por las leyes vigentes.
              </p>
            </section>

            <section className="fluid-mb-8">
              <h2 className="fluid-text-xl font-semibold text-gray-900 fluid-mb-4">Transferencia de Datos</h2>
              <p className="text-gray-700 leading-relaxed">
                El Titular acepta la transferencia de sus datos entre las distintas áreas del Plantel o a 
                cualquier otra institución siempre y cuando tenga como finalidad el cumplimiento de las 
                obligaciones señaladas en el presente Aviso y siempre que el receptor, asuma las mismas 
                obligaciones que correspondan al responsable que transfirió los datos.
              </p>
              <p className="text-gray-700 leading-relaxed fluid-mt-4">
                Si usted no manifiesta su oposición para que sus datos personales sean transferidos, se 
                entenderá que ha otorgado su consentimiento para ello, como lo estipula el artículo 8 de 
                Ley Federal de Protección de Datos Personales en Posesión de Particulares.
              </p>
            </section>

            <section className="fluid-mb-8">
              <h2 className="fluid-text-xl font-semibold text-gray-900 fluid-mb-4">Temporalidad</h2>
              <p className="text-gray-700 leading-relaxed">
                La temporalidad del manejo de los Datos Personales y/o Sensibles del Titular, dependerá de la 
                relación que tenga éste con el Plantel, así como de las obligaciones exigidas por la legislación 
                vigente y las autoridades competentes.
              </p>
            </section>

            <section className="fluid-mb-8">
              <h2 className="fluid-text-xl font-semibold text-gray-900 fluid-mb-4">Derechos ARCO</h2>
              <div className="bg-primary-50 rounded-fluid-lg fluid-p-6 border border-primary-100">
                <p className="text-gray-700 leading-relaxed fluid-mb-4">
                  El Titular de la información tendrá derecho a solicitar en cualquier momento el <strong>acceso, 
                  rectificación, cancelación u oposición (Derechos ARCO)</strong> respecto de los Datos Personales 
                  que le corresponden, mediante solicitud por escrito dirigida al Plantel:
                </p>
                <div className="text-gray-700">
                  <p className="font-semibold">Domicilio:</p>
                  <p className="fluid-mb-2">Avenida 31 Oriente No. 618 2° Piso, Col. Ladrillera de Benítez. Puebla, Pue, México. C.P. 72530</p>
                  <p className="font-semibold">Teléfonos:</p>
                  <p>(+52) 222 237 9492 | 01 800 808 6240</p>
                </div>
              </div>
              <p className="text-gray-700 leading-relaxed fluid-mt-4">
                El Plantel responderá a las solicitudes en un término de 20 días, prorrogables según sea el caso, 
                siempre y cuando no se actualice alguna de las excepciones contenidas en la Ley y el solicitante 
                cumpla con los requisitos establecidos en la normatividad correspondiente.
              </p>
            </section>

            <section className="fluid-mb-8">
              <h2 className="fluid-text-xl font-semibold text-gray-900 fluid-mb-4">Modificaciones al Aviso</h2>
              <p className="text-gray-700 leading-relaxed">
                El Plantel, se reserva el derecho de modificar el presente aviso de privacidad en cualquier momento. 
                Para tales efectos, se hará del conocimiento del Titular mediante la publicación respectiva en este medio.
              </p>
            </section>

            <div className="border-t border-gray-200 fluid-pt-6 fluid-mt-8">
              <p className="text-gray-500 text-sm text-center">
                <strong>Fecha última de actualización:</strong> 01 de Octubre de 2014
              </p>
            </div>

          </div>
        </div>

        {/* Back to home */}
        <div className="text-center fluid-mt-8">
          <Link 
            to="/" 
            className="inline-flex items-center fluid-gap-2 text-primary-600 hover:text-primary-700 font-medium"
          >
            <ArrowLeft className="fluid-icon-sm" />
            Volver al inicio
          </Link>
        </div>
      </main>

      {/* Simple Footer */}
      <footer className="bg-white border-t border-gray-200 fluid-py-6">
        <div className="max-w-4xl mx-auto fluid-px-4 text-center text-gray-500 fluid-text-sm">
          © {new Date().getFullYear()} Evaluaasi. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  )
}
