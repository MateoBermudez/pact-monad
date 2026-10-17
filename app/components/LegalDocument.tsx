import Link from "next/link";
const contact = "mateo_bermudez82231@elpoli.edu.co";
export function LegalDocument({ privacy = false }: { privacy?: boolean }) {
  const sections = privacy
    ? [
        [
          "Responsable y alcance",
          "Mateo Bermudez Cuartas, en Colombia, es el responsable del tratamiento de los datos personales gestionados por PACT. Esta política describe el uso de datos en el acceso, los perfiles, los acuerdos y sus evidencias. Puedes contactarlo en el correo indicado al final.",
        ],
        [
          "Datos que tratamos",
          "Al acceder mediante Google o GitHub podemos recibir el identificador de tu cuenta, nombre, correo y avatar autorizados por ese proveedor. También tratamos tu nombre público, habilidades, descripción, dirección pública de wallet, acuerdos, archivos y evidencias que envíes, y registros técnicos necesarios para operar y proteger el servicio. PACT no solicita tu contraseña de Google o GitHub, frase semilla ni clave privada de tu wallet.",
        ],
        [
          "Finalidades y autorización",
          "Usamos los datos para identificarte, mantener tu sesión, mostrar tu perfil, facilitar acuerdos y comunicaciones del servicio, almacenar evidencias, resolver incidencias y prevenir abuso. La información pública del perfil permite que otros participantes te conozcan. Antes de habilitar tratamientos que requieran autorización debe informarse su finalidad y obtenerse la autorización correspondiente; consultar esta política no sustituye ese requisito. No se autoriza publicidad ni venta de datos por el solo hecho de registrarte.",
        ],
        [
          "Proveedores e inteligencia artificial",
          "Google y GitHub procesan el acceso bajo sus propias políticas. La infraestructura puede utilizar Supabase para autenticación, base de datos y archivos, además del proveedor de alojamiento configurado. Las funciones de IA envían el texto o evidencias necesarios al servicio de IA de PACT y a Gemini. Evita incluir datos sensibles o de terceros sin permiso. Estos proveedores pueden procesar datos fuera de Colombia; el responsable debe verificar las condiciones y garantías aplicables antes de habilitarlos.",
        ],
        [
          "Blockchain y datos públicos",
          "Las direcciones, importes, estados, transacciones y hashes publicados en Monad son públicos y pueden permanecer accesibles indefinidamente. Un hash puede permitir relacionar información con una cuenta. No incluyas datos sensibles en campos destinados a blockchain. Eliminar una cuenta de PACT no elimina transacciones ni copias mantenidas por terceros.",
        ],
        [
          "Cookies, conservación y seguridad",
          "Se usan cookies técnicas para la sesión y el flujo de autenticación. Esta política no autoriza rastreadores publicitarios. Conservamos datos mientras sean necesarios para prestar el servicio, atender solicitudes y cumplir obligaciones o resolver controversias. Cuando dejen de ser necesarios, deben eliminarse o anonimizarse salvo conservación justificada. Aplicamos controles de acceso y separación de secretos del servidor; ningún sistema puede garantizar seguridad absoluta.",
        ],
        [
          "Tus derechos y solicitudes",
          "Puedes solicitar conocer, acceder, actualizar y rectificar tus datos; pedir prueba de la autorización y conocer sus usos; solicitar supresión o revocar autorización cuando proceda, y presentar reclamaciones ante la Superintendencia de Industria y Comercio conforme a la normativa aplicable. Escribe al correo de contacto con el objeto de tu solicitud y los datos mínimos para identificarte. No envíes claves ni documentos sensibles por iniciativa propia. Se responderá dentro de los plazos legales; la supresión puede tener límites por obligaciones legales y por la naturaleza pública de blockchain.",
        ],
        [
          "Menores y cambios",
          "PACT está dirigido a mayores de 18 años. Si identificas datos de un menor, comunícalo para su revisión. Los cambios sustanciales de finalidad requieren información previa y una nueva autorización cuando corresponda. La versión vigente y su fecha deben permanecer disponibles aquí.",
        ],
      ]
    : [
        [
          "Quién opera PACT",
          "PACT es operado por Mateo Bermudez Cuartas, en Colombia. Es una plataforma para estructurar y gestionar acuerdos entre clientes y prestadores de servicios. Estos términos regulan el uso de la plataforma; las condiciones específicas del trabajo las revisan y acuerdan sus participantes.",
        ],
        [
          "Cuenta y participación",
          "Debes ser mayor de 18 años, proporcionar información veraz y proteger tus cuentas de acceso y wallet. Google y GitHub permiten identificarte; conectar una wallet es una acción independiente necesaria para determinadas operaciones. No suplantes a terceros, vulneres derechos, publiques contenido ilícito ni uses la plataforma para fraude, acoso o acceso no autorizado.",
        ],
        [
          "Acuerdos e inteligencia artificial",
          "La IA propone condiciones y puede ayudar a analizar evidencias; sus resultados pueden contener errores. Revisa título, entregables, importe, plazo y proveedor antes de confirmar. La IA no debe inventar la wallet del proveedor. Las partes son responsables de acordar el trabajo, los derechos sobre los entregables y los permisos de los materiales aportados. PACT no garantiza que un resultado generado por IA sea correcto ni que un participante cumpla lo acordado.",
        ],
        [
          "Wallet, fondos y transacciones",
          "Solo se mueven fondos mediante transacciones contra el contrato. Debes revisar red, dirección, importe, comisiones y operación antes de firmar. La liberación puede realizarla el cliente o el agente de IA dentro del límite autorizado on-chain por el cliente, inicialmente cero, y únicamente al proveedor pactado. Una decisión de revisión no autoriza liberación automática. Las transacciones confirmadas pueden ser irreversibles; PACT no puede prometer su reversión.",
        ],
        [
          "Entorno de prueba y costes",
          "La interfaz identifica Monad Testnet y MON de prueba. No interpretes los saldos de prueba como dinero real ni como una promesa de rentabilidad. Comprueba la red en tu wallet. Las comisiones de red y cualquier coste del servicio deben mostrarse antes de una operación que los genere; estos términos no establecen una tarifa adicional.",
        ],
        [
          "Contenido y privacidad",
          "Conservas los derechos que tengas sobre el contenido que aportes. Concedes únicamente los permisos necesarios para almacenarlo, mostrarlo a los participantes y procesarlo para las funciones que solicites, incluida la evaluación con IA cuando se utilice. Debes contar con autorización para los datos y materiales de terceros. Consulta la Política de privacidad antes de publicar información; blockchain puede conservar datos públicos de forma permanente.",
        ],
        [
          "Disponibilidad, responsabilidad y controversias",
          "El servicio puede sufrir interrupciones o cambios. Podemos limitar accesos ante abuso o riesgos de seguridad, informando cuando resulte posible. Cada parte responde por sus propias obligaciones y actuaciones. Ninguna disposición excluye responsabilidades que la ley no permita limitar ni restringe derechos irrenunciables del consumidor o del titular de datos. Comunica los problemas al contacto indicado; se procurará una solución directa sin impedir acudir a las autoridades competentes. Se aplicará la legislación colombiana, respetando las normas imperativas que correspondan.",
        ],
        [
          "Actualizaciones y contacto",
          "Los cambios sustanciales se comunicarán antes de su aplicación cuando corresponda. La versión actualizada permanecerá disponible en esta página. Puedes dejar de usar el servicio y solicitar la supresión de los datos que proceda, sin que ello borre obligaciones pendientes ni transacciones públicas.",
        ],
      ];
  return (
    <article className="legal-document">
      <Link href="/registro">← Volver al registro</Link>
      <h1>{privacy ? "Política de privacidad" : "Términos de uso"}</h1>
      <p className="auth-muted">
        Versión del 17 de octubre de 2026
      </p>
      {sections.map(([title, body]) => (
        <section key={title}>
          <h2>{title}</h2>
          <p>{body}</p>
        </section>
      ))}
      <section>
        <h2>Contacto</h2>
        <p>
          Mateo Bermudez Cuartas · Colombia
          <br />
          <a href={`mailto:${contact}`}>{contact}</a>
        </p>
      </section>
      {privacy && (
        <p>
          Referencia normativa:{" "}
          <a
            href="https://www.cancilleria.gov.co/normograma/compilacion/docs/ley_1581_2012.htm"
            target="_blank"
            rel="noreferrer"
          >
            Ley 1581 de 2012
          </a>
          . Autoridad:{" "}
          <a href="https://www.sic.gov.co/" target="_blank" rel="noreferrer">
            Superintendencia de Industria y Comercio
          </a>
          .
        </p>
      )}
      <Link href={privacy ? "/terminos" : "/privacidad"}>
        {privacy
          ? "Consultar Términos de uso"
          : "Consultar Política de privacidad"}
      </Link>
    </article>
  );
}
