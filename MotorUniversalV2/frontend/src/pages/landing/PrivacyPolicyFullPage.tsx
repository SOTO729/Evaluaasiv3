import { Link } from 'react-router-dom'
import { ArrowLeft, Shield, Cookie, Mail, Globe, Users, Database, Lock, Scale } from 'lucide-react'

export default function PrivacyPolicyFullPage() {
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
      <div className="bg-gradient-to-br from-primary-600 to-primary-800 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">Política de Privacidad</h1>
          <p className="text-primary-100 text-lg">
            Grupo EduIT - ENTRENAMIENTO INFORMATICO AVANZADO SA DE CV
          </p>
          <p className="text-primary-200 text-sm mt-2">
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
              { id: 'introduccion', label: 'Introducción' },
              { id: 'definiciones', label: 'Definiciones y Términos Clave' },
              { id: 'informacion-recopilada', label: '¿Qué información recopilamos?' },
              { id: 'uso-informacion', label: '¿Cómo usamos la información?' },
              { id: 'terceros', label: 'Información de terceros' },
              { id: 'compartir', label: '¿Compartimos la información?' },
              { id: 'correo', label: 'Uso de correo electrónico' },
              { id: 'retencion', label: 'Retención de información' },
              { id: 'seguridad', label: 'Protección de información' },
              { id: 'transferencia', label: 'Transferencia internacional' },
              { id: 'actualizacion', label: 'Actualizar información' },
              { id: 'cookies', label: 'Cookies' },
              { id: 'ninos', label: 'Privacidad de niños' },
              { id: 'rgpd', label: 'RGPD' },
              { id: 'california', label: 'Residentes de California' },
              { id: 'contacto', label: 'Contacto' },
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
          <section id="introduccion" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <Shield className="w-6 h-6 text-primary-600" />
              Introducción
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>Grupo EduIT</strong> con razón social <strong>ENTRENAMIENTO INFORMATICO AVANZADO SA DE CV</strong> se 
              compromete a proteger su privacidad. Esta Política de privacidad explica cómo Grupo EduIT recopila, 
              usa y divulga su información personal.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Esta Política de privacidad se aplica a nuestro sitio web, <a href="https://www.grupoeduit.com" className="text-primary-600 hover:underline">www.grupoeduit.com</a> y 
              sus subdominios asociados (colectivamente, nuestro «Servicio») junto con nuestra aplicación, Grupo EduIT. 
              Al acceder o utilizar nuestro Servicio, usted indica que ha leído, comprendido y aceptado nuestra recopilación, 
              almacenamiento, uso y divulgación de su información personal como se describe en esta Política de privacidad 
              y en nuestros Términos de servicio.
            </p>
          </section>

          {/* Definiciones */}
          <section id="definiciones" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <Database className="w-6 h-6 text-primary-600" />
              Definiciones y Términos Clave
            </h2>
            <p className="text-gray-700 leading-relaxed mb-6">
              Para ayudar a explicar las cosas de la manera más clara posible en esta Política de privacidad, 
              cada vez que se hace referencia a cualquiera de estos términos, se definen estrictamente como:
            </p>
            
            <div className="space-y-4">
              {[
                {
                  term: 'Cookie',
                  definition: 'Pequeña cantidad de datos generados por un sitio web y guardados por su navegador web. Se utiliza para identificar su navegador, proporcionar análisis, recordar información sobre usted, como su preferencia de idioma o información de inicio de sesión.'
                },
                {
                  term: 'Compañía',
                  definition: 'Cuando esta política menciona «Compañía», «nosotros», «nos» o «nuestro», se refiere a Grupo EduIT (Calle Camelias #216 colonia Bugambilias, Puebla, Puebla, México), que es responsable de su información en virtud de esta Política de privacidad.'
                },
                {
                  term: 'Plataforma',
                  definition: 'Sitio web de Internet, aplicación web o aplicación digital de cara al público de Grupo EduIT.'
                },
                {
                  term: 'País',
                  definition: 'Donde se encuentra Grupo EduIT o los propietarios / fundadores de Grupo EduIT, en este caso es México.'
                },
                {
                  term: 'Cliente',
                  definition: 'Se refiere a la empresa, organización o persona que se registra para utilizar el Servicio Grupo EduIT para gestionar las relaciones con sus consumidores o usuarios del servicio.'
                },
                {
                  term: 'Dispositivo',
                  definition: 'Cualquier dispositivo conectado a Internet, como un teléfono, tablet, computadora o cualquier otro dispositivo que se pueda usar para visitar Grupo EduIT y usar los servicios.'
                },
                {
                  term: 'Dirección IP',
                  definition: 'A cada dispositivo conectado a Internet se le asigna un número conocido como dirección de protocolo de Internet (IP). Estos números generalmente se asignan en bloques geográficos. A menudo, se puede utilizar una dirección IP para identificar la ubicación desde la que un dispositivo se conecta a Internet.'
                },
                {
                  term: 'Personal',
                  definition: 'Se refiere a aquellas personas que son empleadas por Grupo EduIT o están bajo contrato para realizar un servicio en nombre de una de las partes.'
                },
                {
                  term: 'Datos personales',
                  definition: 'Cualquier información que directa, indirectamente o en conexión con otra información, incluido un número de identificación personal, permita la identificación de una persona física.'
                },
                {
                  term: 'Servicio',
                  definition: 'Se refiere al servicio brindado por Grupo EduIT como se describe en los términos relativos (si están disponibles) y en esta plataforma.'
                },
                {
                  term: 'Terceros',
                  definition: 'Se refiere a anunciantes, patrocinadores de concursos, socios promocionales y de marketing, y otros que brindan nuestro contenido o cuyos productos o servicios que creemos que pueden interesarle.'
                },
                {
                  term: 'Sitio web',
                  definition: 'El sitio de Grupo EduIT, al que se puede acceder a través de esta URL: www.grupoeduit.com'
                },
                {
                  term: 'Usted',
                  definition: 'Una persona o entidad que está registrada con Grupo EduIT para utilizar los Servicios.'
                },
              ].map((item, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4">
                  <dt className="font-semibold text-gray-900">{item.term}</dt>
                  <dd className="text-gray-600 text-sm mt-1">{item.definition}</dd>
                </div>
              ))}
            </div>
          </section>

          {/* Información recopilada */}
          <section id="informacion-recopilada" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">¿Qué información recopilamos?</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Recopilamos información suya cuando visita nuestra plataforma, se registra en nuestro sitio, 
              realiza un pedido, se suscribe a nuestro boletín, responde a una encuesta o completa un formulario.
            </p>
            <ul className="grid sm:grid-cols-2 gap-2">
              {[
                'Nombre / nombre de usuario',
                'Números de teléfono',
                'Correos electrónicos',
                'Direcciones de correo',
                'Direcciones de facturación',
              ].map((item, index) => (
                <li key={index} className="flex items-center gap-2 text-gray-700">
                  <span className="w-2 h-2 bg-primary-500 rounded-full"></span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* Uso de información */}
          <section id="uso-informacion" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">¿Cómo usamos la información que recopilamos?</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Cualquier información que recopilamos de usted puede usarse de una de las siguientes maneras:
            </p>
            <ul className="space-y-3">
              {[
                'Para personalizar su experiencia (su información nos ayuda a responder mejor a sus necesidades individuales)',
                'Para mejorar nuestra plataforma (nos esforzamos continuamente por mejorar lo que ofrece nuestra plataforma en función de la información y los comentarios que recibimos de usted)',
                'Para mejorar el servicio al cliente (su información nos ayuda a responder de manera más efectiva a sus solicitudes de servicio al cliente y necesidades de soporte)',
                'Para procesar transacciones',
                'Para administrar un concurso, promoción, encuesta u otra característica del sitio',
                'Para enviar correos electrónicos periódicos',
              ].map((item, index) => (
                <li key={index} className="flex items-start gap-3 text-gray-700">
                  <span className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-primary-600 text-sm font-semibold">{index + 1}</span>
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* Información de terceros */}
          <section id="terceros" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <Users className="w-6 h-6 text-primary-600" />
              Información de Terceros
            </h2>
            
            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">
              ¿Cuándo usa Grupo EduIT la información del usuario final de terceros?
            </h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              Grupo EduIT recopilará los datos del usuario final necesarios para proporcionar los servicios de 
              Grupo EduIT a nuestros clientes.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Los usuarios finales pueden proporcionarnos voluntariamente la información que han puesto a disposición 
              en los sitios web de las redes sociales. Si nos proporciona dicha información, podemos recopilar información 
              disponible públicamente de los sitios web de redes sociales que ha indicado. Usted puede controlar la cantidad 
              de información que los sitios web de redes sociales hacen pública visitando estos sitios web y cambiando su 
              configuración de privacidad.
            </p>

            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">
              ¿Cuándo usa Grupo EduIT la información del cliente de terceros?
            </h3>
            <p className="text-gray-700 leading-relaxed">
              Recibimos información de terceros cuando se comunican con nosotros. Por ejemplo, cuando nos envía su 
              dirección de correo electrónico para mostrar interés en convertirse en cliente de Grupo EduIT, recibimos 
              información de un tercero que brinda servicios automáticos de detección de fraude a Grupo EduIT. 
              Ocasionalmente, también recopilamos información que se pone a disposición del público en los sitios web 
              de redes sociales, o cuando nos contacta a través de un formulario web, o por contacto a nuestro número 
              comercial de WhatsApp. Usted puede controlar la cantidad de información que los sitios web de redes 
              sociales hacen pública visitando estos sitios web y cambiando su configuración de privacidad.
            </p>
          </section>

          {/* Compartir información */}
          <section id="compartir" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">¿Compartimos la información que recopilamos con terceros?</h2>
            
            <div className="space-y-4 text-gray-700 leading-relaxed">
              <p>
                Podemos compartir la información que recopilamos, tanto personal como no personal, con nuestras compañías 
                afiliadas y socios comerciales actuales y futuros, y si estamos involucrados en una fusión, venta de activos 
                u otra reorganización comercial, también podemos compartir o transferir su información personal y no personal 
                a nuestros sucesores en interés.
              </p>
              <p>
                Podemos contratar proveedores de servicios de terceros de confianza para que realicen funciones y nos brinden 
                servicios, como el alojamiento y el mantenimiento de nuestros servidores y la plataforma, almacenamiento y 
                administración de bases de datos, administración de correo electrónico, marketing de almacenamiento, 
                procesamiento de tarjetas de crédito, servicio y cumplimiento de pedidos de productos y servicios que puede 
                comprar a través de la plataforma. Es probable que compartamos su información personal, y posiblemente alguna 
                información no personal, con estos terceros para permitirles realizar estos servicios para nosotros y para usted.
              </p>
              <p>
                Podemos compartir partes de los datos de nuestro archivo de registro, incluidas las direcciones IP, con fines 
                analíticos con terceros, como socios de análisis web, desarrolladores de aplicaciones y redes publicitarias. 
                Si se comparte su dirección IP, se puede utilizar para estimar la ubicación general y otros datos tecnológicos, 
                como la velocidad de conexión, si ha visitado la plataforma en una ubicación compartida y el tipo de dispositivo 
                utilizado para visitar la plataforma. Pueden agregar información sobre nuestra publicidad y lo que ve en la 
                plataforma y luego proporcionar auditorías, investigaciones e informes para nosotros y nuestros anunciantes.
              </p>
              <p>
                También podemos divulgar información personal y no personal sobre usted al gobierno, a funcionarios encargados 
                de hacer cumplir la ley o a terceros privados, según consideremos, a nuestro exclusivo criterio, necesario o 
                apropiado para responder a reclamos, procesos legales (incluidas citaciones), para proteger nuestros derechos 
                e intereses o los de un tercero, la seguridad del público o de cualquier persona, para prevenir o detener 
                cualquier actividad ilegal, poco ética o legalmente procesable, o para cumplir con las órdenes judiciales, 
                leyes, reglas y regulaciones aplicables.
              </p>
            </div>
          </section>

          {/* Correo electrónico */}
          <section id="correo" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <Mail className="w-6 h-6 text-primary-600" />
              ¿Cómo utilizamos su dirección de correo electrónico?
            </h2>
            <div className="space-y-4 text-gray-700 leading-relaxed">
              <p>
                Al enviar su dirección de correo electrónico en esta plataforma, acepta recibir nuestros correos electrónicos. 
                Puede cancelar su participación en cualquiera de estas listas de correo electrónico enviando la solicitud al 
                correo <a href="mailto:informes@grupoeduit.com" className="text-primary-600 hover:underline">informes@grupoeduit.com</a>. 
                Solo enviamos correos electrónicos a personas que nos han autorizado a contactarlos, ya sea directamente o a 
                través de un tercero.
              </p>
              <p>
                Al enviar su dirección de correo electrónico, también acepta permitirnos usar su dirección de correo electrónico 
                para la orientación de la audiencia del cliente en sitios como Facebook, donde mostramos publicidad personalizada 
                a personas específicas que han optado por recibir nuestras comunicaciones.
              </p>
              <p>
                Las direcciones de correo electrónico enviadas solo a través de la página de procesamiento de pedidos se utilizarán 
                con el único propósito de enviarle información y actualizaciones relacionadas con su pedido. Sin embargo, si nos ha 
                proporcionado el mismo correo electrónico a través de otro método, podemos usarlo para cualquiera de los fines 
                establecidos en esta Política.
              </p>
            </div>
          </section>

          {/* Retención */}
          <section id="retencion" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">¿Cuánto tiempo conservamos su información?</h2>
            <p className="text-gray-700 leading-relaxed">
              Conservamos su información solo mientras la necesitemos para proporcionarle Grupo EduIT y cumplir con los 
              propósitos descritos en esta política. Este también es el caso de cualquier persona con la que compartamos 
              su información y que lleve a cabo servicios en nuestro nombre. Cuando ya no necesitemos usar su información 
              y no sea necesario que la conservemos para cumplir con nuestras obligaciones legales o reglamentarias, la 
              eliminaremos de nuestros sistemas o la despersonalizaremos para que no podamos identificarlo.
            </p>
          </section>

          {/* Seguridad */}
          <section id="seguridad" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <Lock className="w-6 h-6 text-primary-600" />
              ¿Cómo protegemos su información?
            </h2>
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-4">
              <p className="text-gray-700 leading-relaxed">
                Implementamos una variedad de medidas de seguridad para mantener la seguridad de su información personal 
                cuando realiza un pedido, ingresa, envía o accede a su información personal. Ofrecemos el uso de un 
                servidor seguro. Toda la información suministrada se transmite a través de la tecnología 
                <strong> Secure Socket Layer (SSL)</strong>.
              </p>
            </div>
            <p className="text-gray-700 leading-relaxed">
              Sin embargo, no podemos garantizar la seguridad absoluta de la información que transmita a Grupo EduIT ni 
              garantizar que su información en el servicio no sea accedida, divulgada, alterada o destruida por una 
              infracción de cualquiera de nuestras condiciones físicas, salvaguardias técnicas o de gestión.
            </p>
          </section>

          {/* Transferencia */}
          <section id="transferencia" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <Globe className="w-6 h-6 text-primary-600" />
              ¿Podría transferirse mi información a otros países?
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Grupo EduIT está incorporada en México. La información recopilada a través de nuestro sitio web, a través 
              de interacciones directas con usted o del uso de nuestros servicios de ayuda puede transferirse de vez en 
              cuando a nuestras oficinas o personal, o a terceros, ubicados en todo el mundo, y puede verse y alojarse 
              en cualquier lugar del mundo, incluidos los países que pueden no tener leyes de aplicación general que 
              regulen el uso y la transferencia de dichos datos.
            </p>
            <p className="text-gray-700 leading-relaxed">
              En la mayor medida permitida por la ley aplicable, al utilizar cualquiera de los anteriores, usted acepta 
              voluntariamente la transferencia transfronteriza y el alojamiento de dicha información.
            </p>
          </section>

          {/* Actualizar información */}
          <section id="actualizacion" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">¿Puedo actualizar o corregir mi información?</h2>
            <div className="space-y-4 text-gray-700 leading-relaxed">
              <p>
                Los derechos que tienes para solicitar actualizaciones o correcciones de la información que recopila 
                Grupo EduIT dependen de tu relación con Grupo EduIT. El personal puede actualizar o corregir su 
                información según se detalla en nuestras políticas de empleo internas de la empresa.
              </p>
              <p>
                Los clientes tienen derecho a solicitar la restricción de ciertos usos y divulgaciones de información 
                de identificación personal de la siguiente manera. Puede comunicarse con nosotros para:
              </p>
              <ol className="list-decimal list-inside space-y-2 ml-4">
                <li>Actualizar o corregir su información de identificación personal</li>
                <li>Cambiar sus preferencias con respecto a las comunicaciones y otra información que recibe de nosotros</li>
                <li>Eliminar la información de identificación personal que se mantiene sobre usted en nuestro sistema</li>
              </ol>
              <p>
                Dichas actualizaciones, correcciones, cambios y eliminaciones no tendrán ningún efecto sobre otra información 
                que mantenemos o información que hayamos proporcionado a terceros de acuerdo con esta Política de privacidad 
                antes de dicha actualización, corrección, cambio o eliminación.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mt-4">
                <p className="text-yellow-800 text-sm">
                  <strong>Nota:</strong> Tecnológicamente no es posible eliminar todos y cada uno de los registros de la 
                  información que nos ha proporcionado de nuestro sistema. La necesidad de realizar copias de seguridad 
                  de nuestros sistemas para proteger la información de pérdidas involuntarias significa que puede existir 
                  una copia de su información en una forma que no se pueda borrar.
                </p>
              </div>
            </div>
          </section>

          {/* Personal */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Personal</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Si es un trabajador o solicitante de Grupo EduIT, recopilamos la información que nos proporciona 
              voluntariamente. Usamos la información recopilada con fines de recursos humanos para administrar 
              los beneficios a los trabajadores y seleccionar a los solicitantes.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Puede comunicarse con nosotros para (1) actualizar o corregir su información, (2) cambiar sus preferencias 
              con respecto a las comunicaciones y otra información que reciba de nosotros, o (3) recibir un registro de 
              la información que tenemos relacionada con usted.
            </p>
          </section>

          {/* Venta de Negocio */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Venta de Negocio</h2>
            <p className="text-gray-700 leading-relaxed">
              Nos reservamos el derecho de transferir información a un tercero en el caso de una venta, fusión u otra 
              transferencia de todos o sustancialmente todos los activos de Grupo EduIT o cualquiera de sus afiliadas 
              corporativas, o la porción de Grupo EduIT o cualquiera de sus Afiliadas corporativas con las que se 
              relaciona el Servicio, o en el caso de que discontinuemos nuestro negocio o presentemos una petición o 
              hayamos presentado una petición contra nosotros en caso de quiebra, reorganización o procedimiento similar, 
              siempre que el tercero acepte adherirse a los términos de esta Política de privacidad.
            </p>
          </section>

          {/* Afiliados */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Afiliados</h2>
            <p className="text-gray-700 leading-relaxed">
              Podemos divulgar información (incluida la información personal) sobre usted a nuestros afiliados corporativos. 
              Para los propósitos de esta Política de Privacidad, «Afiliado Corporativo» significa cualquier persona o 
              entidad que directa o indirectamente controla, está controlada por o está bajo control común con Grupo EduIT, 
              ya sea por propiedad o de otra manera. Cualquier información relacionada con usted que proporcionemos a 
              nuestros afiliados corporativos será tratada por dichos afiliados corporativos de acuerdo con los términos 
              de esta política de privacidad.
            </p>
          </section>

          {/* Ley que Rige */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <Scale className="w-6 h-6 text-primary-600" />
              Ley que Rige
            </h2>
            <div className="space-y-4 text-gray-700 leading-relaxed">
              <p>
                Esta Política de privacidad se rige por las leyes de <strong>México</strong> sin tener en cuenta su 
                disposición sobre conflicto de leyes. Usted acepta la jurisdicción exclusiva de los tribunales en 
                relación con cualquier acción o disputa que surja entre las partes en virtud de esta Política de 
                privacidad o en relación con ella, excepto aquellas personas que puedan tener derecho a presentar 
                reclamaciones en virtud del Escudo de privacidad o el marco suizo-estadounidense.
              </p>
              <p>
                Las leyes de México, excluyendo sus conflictos de leyes, regirán este Acuerdo y su uso de la plataforma. 
                Su uso de la plataforma también puede estar sujeto a otras leyes locales, estatales, nacionales o internacionales.
              </p>
              <p>
                Al usar Grupo EduIT o comunicarse con nosotros directamente, significa que acepta esta Política de privacidad. 
                Si no está de acuerdo con esta Política de privacidad, no debe interactuar con nuestro sitio web ni utilizar 
                nuestros servicios.
              </p>
            </div>
          </section>

          {/* Consentimiento */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Tu consentimiento</h2>
            <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
              <p className="text-gray-700 leading-relaxed">
                Hemos actualizado nuestra Política de privacidad para brindarle total transparencia sobre lo que se establece 
                cuando visita nuestro sitio y cómo se utiliza. Al utilizar nuestra plataforma, registrar una cuenta o realizar 
                una compra, por la presente acepta nuestra Política de privacidad y acepta sus términos.
              </p>
            </div>
          </section>

          {/* Enlaces */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Enlaces a otros Sitios Web</h2>
            <p className="text-gray-700 leading-relaxed">
              Esta Política de privacidad se aplica solo a los Servicios. Los Servicios pueden contener enlaces a otros 
              sitios web que Grupo EduIT no opera ni controla. No somos responsables por el contenido, la precisión o las 
              opiniones expresadas en dichos sitios web, y dichos sitios web no son investigados, monitoreados o verificados 
              por nuestra precisión o integridad. Recuerde que cuando utiliza un enlace para ir desde los Servicios a otro 
              sitio web, nuestra Política de privacidad deja de estar en vigor. Su navegación e interacción en cualquier 
              otro sitio web, incluidos aquellos que tienen un enlace en nuestra plataforma, están sujetos a las propias 
              reglas y políticas de ese sitio web.
            </p>
          </section>

          {/* Cookies */}
          <section id="cookies" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
              <Cookie className="w-6 h-6 text-primary-600" />
              Cookies
            </h2>
            <div className="space-y-4 text-gray-700 leading-relaxed">
              <p>
                Grupo EduIT utiliza «cookies» para identificar las áreas de nuestro sitio web que ha visitado. Una cookie 
                es una pequeña porción de datos que su navegador web almacena en su computadora o dispositivo móvil. 
                Usamos cookies para mejorar el rendimiento y la funcionalidad de nuestra plataforma, pero no son esenciales 
                para su uso. La mayoría de los navegadores web se pueden configurar para desactivar el uso de cookies.
              </p>
              <p>
                Sin embargo, si desactiva las cookies, es posible que no pueda acceder a la funcionalidad de nuestro sitio 
                web correctamente o en absoluto. <strong>Nunca colocamos información de identificación personal en cookies.</strong>
              </p>
              
              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Bloquear y deshabilitar Cookies</h3>
              <p>
                Donde sea que se encuentre, también puede configurar su navegador para bloquear cookies y tecnologías 
                similares, pero esta acción puede bloquear nuestras cookies esenciales e impedir que nuestro sitio web 
                funcione correctamente, y es posible que no pueda utilizar todas sus funciones y servicios por completo. 
                También debe tener en cuenta que también puede perder información guardada (por ejemplo, detalles de inicio 
                de sesión guardados, preferencias del sitio) si bloquea las cookies en su navegador.
              </p>
            </div>
          </section>

          {/* Niños */}
          <section id="ninos" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Privacidad de los Niños</h2>
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
              <p className="text-gray-700 leading-relaxed">
                No nos dirigimos a ninguna persona menor de 13 años. No recopilamos información de identificación personal 
                de ninguna persona menor de 13 años. Si usted es padre o tutor y sabe que su hijo nos ha proporcionado 
                Datos personales, comuníquese con nosotros. Si nos damos cuenta de que hemos recopilado datos personales 
                de cualquier persona menor de 13 años sin la verificación del consentimiento de los padres, tomamos medidas 
                para eliminar esa información de nuestros servidores.
              </p>
            </div>
          </section>

          {/* Cambios */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Cambios en nuestra Política de Privacidad</h2>
            <p className="text-gray-700 leading-relaxed">
              Podemos cambiar nuestro Servicio y nuestras políticas, y es posible que debamos realizar cambios en esta 
              Política de privacidad para que reflejen con precisión nuestro Servicio y nuestras políticas. A menos que 
              la ley exija lo contrario, le notificaremos (por ejemplo, a través de este apartado) la última fecha de 
              actualización, por lo que es su responsabilidad entrar a revisar si hubo alguna actualización adicional 
              a la última que revisó.
            </p>
          </section>

          {/* Servicios de terceros */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Servicios de terceros</h2>
            <p className="text-gray-700 leading-relaxed">
              Podemos mostrar, incluir o poner a disposición contenido de terceros (incluidos datos, información, 
              aplicaciones y otros servicios de productos) o proporcionar enlaces a sitios web o servicios de terceros 
              («Servicios de terceros»). Usted reconoce y acepta que Grupo EduIT no será responsable de ningún Servicio 
              de terceros, incluida su precisión, integridad, puntualidad, validez, cumplimiento de los derechos de autor, 
              legalidad, decencia, calidad o cualquier otro aspecto de los mismos. Grupo EduIT no asume ni tendrá ninguna 
              obligación o responsabilidad ante usted o cualquier otra persona o entidad por los Servicios de terceros. 
              Los Servicios de terceros y los enlaces a los mismos se brindan únicamente para su conveniencia y usted 
              accede a ellos y los usa completamente bajo su propio riesgo y sujeto a los términos y condiciones de dichos terceros.
            </p>
          </section>

          {/* RGPD */}
          <section id="rgpd" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Información sobre el Reglamento General de Protección de Datos (RGPD)
            </h2>
            <div className="space-y-4 text-gray-700 leading-relaxed">
              <p>
                Es posible que recopilemos y utilicemos información suya si pertenece al Espacio Económico Europeo (EEE), 
                y en esta sección de nuestra Política de privacidad vamos a explicar exactamente cómo y por qué se 
                recopilan estos datos, y cómo los mantenemos bajo protección contra la replicación o el uso incorrecto.
              </p>
              
              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">¿Qué es RGPD?</h3>
              <p>
                RGPD es una ley de privacidad y protección de datos en toda la UE que regula cómo las empresas protegen 
                los datos de los residentes de la UE y mejora el control que los residentes de la UE tienen sobre sus 
                datos personales. El RGPD es relevante para cualquier empresa que opere a nivel mundial y no solo para 
                las empresas con sede en la UE y los residentes de la UE.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">¿Qué son los Datos Personales?</h3>
              <p>
                Cualquier dato que se relacione con un individuo identificable o identificable. El RGPD cubre un amplio 
                espectro de información que podría usarse por sí sola o en combinación con otras piezas de información 
                para identificar a una persona. Los datos personales van más allá del nombre o la dirección de correo 
                electrónico de una persona. Algunos ejemplos incluyen información financiera, opiniones políticas, datos 
                genéticos, datos biométricos, direcciones IP, dirección física, orientación sexual y origen étnico.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Principios de protección de datos</h3>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Los datos personales recopilados deben procesarse de manera justa, legal y transparente y solo deben 
                usarse de la manera que una persona esperaría razonablemente.</li>
                <li>Los datos personales solo deben recopilarse para cumplir con un propósito específico y solo deben 
                usarse para ese propósito.</li>
                <li>Los datos personales no deben conservarse más tiempo del necesario para cumplir con su propósito.</li>
                <li>Las personas cubiertas por el RGPD tienen derecho a acceder a sus propios datos personales. También 
                pueden solicitar una copia de sus datos y que sus datos se actualicen, eliminen, restrinjan o muevan a 
                otra organización.</li>
              </ul>

              <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">
                Derechos individuales del interesado: acceso, portabilidad y eliminación de datos
              </h3>
              <p>
                Estamos comprometidos a ayudar a nuestros clientes a cumplir con los requisitos de derechos de los sujetos 
                de datos de RGPD. Grupo EduIT procesa o almacena todos los datos personales en proveedores que cumplen con 
                DPA y han sido examinados por completo. Almacenamos todas las conversaciones y los datos personales durante 
                un máximo de 6 años, en cuyo caso eliminamos todos los datos de acuerdo con nuestros Términos de servicio y 
                Política de privacidad, pero no los conservaremos por más de 60 días.
              </p>
            </div>
          </section>

          {/* California */}
          <section id="california" className="mb-12 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Residentes de California</h2>
            <div className="space-y-4 text-gray-700 leading-relaxed">
              <p>
                La Ley de Privacidad del Consumidor de California (CCPA) requiere que divulguemos las categorías de 
                Información personal que recopilamos y cómo la usamos, las categorías de fuentes de las que recopilamos 
                Información personal y los terceros con quienes la compartimos.
              </p>
              
              <p>También estamos obligados a comunicar información sobre los derechos que tienen los residentes de California:</p>
              
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Derecho a conocer y acceder:</strong> Puede enviar una solicitud verificable de información con 
                respecto a: categorías de Información personal que recopilamos, usamos o compartimos; fines para los que 
                recopilamos o utilizamos categorías de información personal; categorías de fuentes de las que recopilamos 
                información personal; y piezas específicas de información personal que hemos recopilado sobre usted.</li>
                <li><strong>Derecho a la igualdad de servicio:</strong> No lo discriminaremos si ejerce sus derechos de privacidad.</li>
                <li><strong>Derecho a eliminar:</strong> Puede enviar una solicitud verificable y eliminaremos la Información 
                personal sobre usted que hayamos recopilado.</li>
                <li><strong>Derecho a no vender datos:</strong> Solicite que una empresa que vende los datos personales de un 
                consumidor, no venda los datos personales del consumidor.</li>
              </ul>

              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mt-4">
                <p className="text-green-800 font-semibold">
                  ✓ No vendemos la información personal de nuestros usuarios.
                </p>
              </div>
            </div>
          </section>

          {/* Contacto */}
          <section id="contacto" className="mb-8 scroll-mt-24">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Contáctenos</h2>
            <p className="text-gray-700 leading-relaxed mb-6">
              No dude en contactarnos si tiene alguna pregunta sobre esta política de privacidad.
            </p>
            <div className="bg-gray-50 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-primary-600" />
                <div>
                  <div className="text-sm text-gray-500">Email</div>
                  <a href="mailto:informes@grupoeduit.com" className="text-primary-600 hover:underline font-medium">
                    informes@grupoeduit.com
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-primary-600" />
                <div>
                  <div className="text-sm text-gray-500">Sitio web</div>
                  <a href="https://www.grupoeduit.com/contacto" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline font-medium">
                    www.grupoeduit.com/contacto
                  </a>
                </div>
              </div>
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
          <Link 
            to="/privacidad" 
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            Ver Aviso de Privacidad Simplificado →
          </Link>
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
