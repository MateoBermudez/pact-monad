// Datos de ejemplo para la demo: perfiles, solicitudes abiertas con reglas, postulaciones y calificaciones.
//   pnpm db:seed                reemplaza los datos de ejemplo anteriores por un juego nuevo (es idempotente)
//   pnpm db:seed -- --clean     borra solo los datos de ejemplo
//
// Todo lo sembrado se reconoce por el correo `*@demo.pact.invalid` y no tiene wallet: nadie puede firmar por esas
// cuentas ni recibir dinero, así que el flujo real de la demo (escrow, pago del agente) usa siempre wallets reales.
// Los acuerdos sembrados nacen "Approved" sin id en la cadena solo para que existan calificaciones y reputación;
// el indexador los ignora porque no tienen `chain_agreement_id`.
import { keccak256, toUtf8Bytes } from "ethers";
import pg from "pg";

const DEMO_DOMAIN = "demo.pact.invalid";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type Role = "client" | "provider";
type Availability = "available" | "busy" | "unavailable";

type DemoUser = {
  username: string;
  name: string;
  headline: string;
  bio: string;
  roles: Role[];
  location: string;
  availability: Availability;
  keywords: string[];
  skills: Array<[slug: string, level: number]>;
  links: Array<{ label: string; url: string }>;
  isAgent?: boolean;
};

type DemoRule = { criterion: string; weight: number; source: "ai" | "human" };

type DemoListing = {
  key: string;
  client: string;
  title: string;
  description: string;
  category: string;
  keywords: string[];
  budgetMon: number;
  deadlineDays: number;
  daysAgo: number;
  rules: DemoRule[];
};

type DemoApplication = {
  listing: string;
  provider: string;
  message: string;
  priceMon: number;
  days: number;
  status?: "submitted" | "shortlisted";
};

type DemoPortfolioItem = { provider: string; title: string; description: string; url?: string; tags: string[] };

// Un acuerdo ya terminado entre dos partes, con la calificación de cada una a la otra.
type DemoDeal = {
  provider: string;
  client: string;
  amountMon: number;
  daysAgo: number;
  description: string;
  providerScore: number;
  providerComment: string;
  clientScore?: number;
  clientComment?: string;
};

const users: DemoUser[] = [
  {
    username: "cafe_ceiba",
    name: "Café Ceiba",
    headline: "Cafetería de especialidad en El Poblado",
    bio: "Tostamos café de fincas del Suroeste antioqueño y estamos abriendo nuestra segunda sede.",
    roles: ["client"],
    location: "Medellín, Colombia",
    availability: "available",
    keywords: ["café", "gastronomía", "marca"],
    skills: [],
    links: [],
  },
  {
    username: "aburra_pay",
    name: "Aburrá Pay",
    headline: "Startup fintech de pagos para comercios pequeños",
    bio: "Ayudamos a tiendas de barrio a cobrar con QR y a entender sus ventas. Equipo de 9 personas.",
    roles: ["client"],
    location: "Medellín, Colombia",
    availability: "available",
    keywords: ["fintech", "pagos", "startup"],
    skills: [],
    links: [],
  },
  {
    username: "estudio_laureles",
    name: "Estudio Laureles",
    headline: "Agencia creativa que subcontrata especialistas",
    bio: "Producimos campañas para marcas locales y contratamos freelancers por proyecto.",
    roles: ["client", "provider"],
    location: "Medellín, Colombia",
    availability: "busy",
    keywords: ["agencia", "campañas", "producción"],
    skills: [["project-management", 4]],
    links: [],
  },
  {
    username: "lucia_diseno",
    name: "Lucía Restrepo",
    headline: "Diseñadora de marca e ilustradora",
    bio: "Diez años creando identidades para negocios locales. Entrego logos, manual de marca y piezas listas para imprimir.",
    roles: ["provider"],
    location: "Medellín, Colombia",
    availability: "available",
    keywords: ["logo", "identidad visual", "branding", "ilustración", "packaging"],
    skills: [["branding", 5], ["graphic-design", 5], ["illustration", 4], ["packaging", 4]],
    links: [{ label: "Portafolio", url: "https://example.com/lucia" }],
  },
  {
    username: "andres_dev",
    name: "Andrés Gómez",
    headline: "Desarrollador full-stack con TypeScript",
    bio: "Next.js, Node y Postgres. Me gustan los proyectos con plazos claros y criterios de aceptación escritos.",
    roles: ["provider"],
    location: "Envigado, Colombia",
    availability: "available",
    keywords: ["next.js", "typescript", "react", "postgres", "api", "landing"],
    skills: [["full-stack", 5], ["frontend", 5], ["backend", 4], ["qa-testing", 3]],
    links: [{ label: "GitHub", url: "https://example.com/andres" }],
  },
  {
    username: "valentina_web3",
    name: "Valentina Ospina",
    headline: "Ingeniera de contratos inteligentes y auditora",
    bio: "Solidity y Foundry. Reviso contratos de escrow, pagos y tokens: pruebas, fuzzing y reporte con hallazgos priorizados.",
    roles: ["provider"],
    location: "Medellín, Colombia",
    availability: "available",
    keywords: ["solidity", "foundry", "auditoría", "escrow", "monad", "evm"],
    skills: [["smart-contracts", 5], ["security-audit", 5], ["web3-frontend", 3]],
    links: [{ label: "Reportes públicos", url: "https://example.com/valentina" }],
  },
  {
    username: "camilo_datos",
    name: "Camilo Duque",
    headline: "Analista de datos y agentes de IA",
    bio: "Dashboards en BI, limpieza de datos y automatizaciones con modelos de lenguaje para operaciones.",
    roles: ["provider"],
    location: "Bello, Colombia",
    availability: "busy",
    keywords: ["dashboard", "bi", "sql", "python", "ia", "automatización"],
    skills: [["data-analysis", 5], ["bi-dashboards", 5], ["ai-agents", 4], ["prompt-engineering", 4]],
    links: [],
  },
  {
    username: "sofia_video",
    name: "Sofía Marín",
    headline: "Editora de video y motion graphics",
    bio: "Edito reels, videos corporativos y tutoriales. Subtitulado incluido en español e inglés.",
    roles: ["provider"],
    location: "Medellín, Colombia",
    availability: "available",
    keywords: ["video", "edición", "subtítulos", "motion", "reels"],
    skills: [["video-editing", 5], ["motion-graphics", 4], ["subtitling", 4]],
    links: [{ label: "Showreel", url: "https://example.com/sofia" }],
  },
  {
    username: "mateo_texto",
    name: "Mateo Zuluaga",
    headline: "Redactor, traductor y especialista SEO",
    bio: "Textos claros para web y documentación técnica. Traducción español-inglés con glosario acordado.",
    roles: ["provider"],
    location: "Sabaneta, Colombia",
    availability: "available",
    keywords: ["copywriting", "seo", "traducción", "documentación", "inglés"],
    skills: [["copywriting", 5], ["translation", 5], ["technical-writing", 4], ["seo", 4]],
    links: [],
  },
  {
    username: "daniela_ux",
    name: "Daniela Vélez",
    headline: "Diseñadora UI/UX para productos digitales",
    bio: "Investigación rápida, prototipos en Figma y sistemas de diseño que los desarrolladores sí pueden implementar.",
    roles: ["provider"],
    location: "Medellín, Colombia",
    availability: "available",
    keywords: ["ui", "ux", "figma", "prototipo", "sistema de diseño", "landing"],
    skills: [["ui-ux", 5], ["graphic-design", 4], ["presentations", 3]],
    links: [{ label: "Casos de estudio", url: "https://example.com/daniela" }],
  },
  {
    username: "nuevo_talento",
    name: "Juan Pablo Cano",
    headline: "Desarrollador frontend junior",
    bio: "Recién egresado. Busco mis primeros proyectos pagos y entrego rápido con comunicación constante.",
    roles: ["provider"],
    location: "Itagüí, Colombia",
    availability: "available",
    keywords: ["react", "css", "landing", "frontend"],
    skills: [["frontend", 3], ["no-code", 3]],
    links: [],
  },
  {
    username: "agente_traductor",
    name: "Traductor Autónomo",
    headline: "Agente de IA para traducción técnica ES↔EN",
    bio: "Agente autónomo que traduce documentación y subtítulos. Se contrata y cobra por la misma API que las personas.",
    roles: ["provider"],
    location: "En línea",
    availability: "available",
    keywords: ["traducción", "documentación", "subtítulos", "inglés", "agente"],
    skills: [["translation", 4], ["subtitling", 4], ["technical-writing", 3]],
    links: [],
    isAgent: true,
  },
];

const listings: DemoListing[] = [
  {
    key: "logo",
    client: "cafe_ceiba",
    title: "Logo e identidad visual para nueva sede de cafetería",
    description:
      "Necesitamos un logo y una identidad visual básica (paleta, tipografías y dos aplicaciones: vaso y fachada) para nuestra segunda sede. Queremos algo cálido, con referencias a la ceiba y al café de Antioquia.",
    category: "Diseño",
    keywords: ["logo", "identidad visual", "branding", "café", "packaging"],
    budgetMon: 12,
    deadlineDays: 10,
    daysAgo: 1,
    rules: [
      { criterion: "Entrega el logo en formatos vectorial (SVG o PDF) y PNG con fondo transparente", weight: 5, source: "ai" },
      { criterion: "Incluye una paleta de colores con códigos HEX y dos tipografías indicadas", weight: 4, source: "ai" },
      { criterion: "Muestra el logo aplicado en un vaso y en una fachada", weight: 3, source: "human" },
    ],
  },
  {
    key: "landing",
    client: "aburra_pay",
    title: "Landing page en Next.js para lanzamiento de cobros con QR",
    description:
      "Una página de aterrizaje rápida y accesible para presentar nuestro producto de cobros con QR a comercios pequeños. Debe cargar en menos de 2 segundos en móvil y tener un formulario de contacto.",
    category: "Programación",
    keywords: ["landing", "next.js", "typescript", "frontend", "formulario"],
    budgetMon: 20,
    deadlineDays: 7,
    daysAgo: 2,
    rules: [
      { criterion: "El código está en un repositorio público de GitHub con instrucciones para ejecutarlo", weight: 5, source: "ai" },
      { criterion: "La página está publicada en una URL accesible y funciona en móvil", weight: 4, source: "ai" },
      { criterion: "El formulario de contacto valida los campos y muestra un mensaje de confirmación", weight: 3, source: "ai" },
      { criterion: "Obtiene al menos 90 en rendimiento en Lighthouse móvil", weight: 2, source: "human" },
    ],
  },
  {
    key: "audit",
    client: "aburra_pay",
    title: "Revisión de seguridad de un contrato de escrow en Solidity",
    description:
      "Tenemos un contrato de escrow de unas 300 líneas con liberación por árbitro y por plazo. Queremos una revisión de seguridad con hallazgos priorizados y recomendaciones concretas antes de desplegar en testnet.",
    category: "Blockchain",
    keywords: ["solidity", "auditoría", "escrow", "seguridad", "foundry"],
    budgetMon: 35,
    deadlineDays: 12,
    daysAgo: 3,
    rules: [
      { criterion: "El reporte clasifica cada hallazgo por severidad (crítica, alta, media, baja)", weight: 5, source: "ai" },
      { criterion: "Cada hallazgo incluye la línea afectada y una recomendación de corrección", weight: 4, source: "ai" },
      { criterion: "Se entregan pruebas en Foundry que reproducen al menos los hallazgos altos", weight: 4, source: "human" },
    ],
  },
  {
    key: "video",
    client: "estudio_laureles",
    title: "Edición de video de 3 minutos con subtítulos en inglés y español",
    description:
      "Tenemos 40 minutos de material en bruto de un evento de emprendimiento. Se necesita un resumen de 3 minutos con música libre de derechos, rotulación de los ponentes y subtítulos en ambos idiomas.",
    category: "Contenido",
    keywords: ["video", "edición", "subtítulos", "evento", "motion"],
    budgetMon: 15,
    deadlineDays: 6,
    daysAgo: 1,
    rules: [
      { criterion: "El video final dura entre 2:45 y 3:15 y se entrega en MP4 1080p", weight: 4, source: "ai" },
      { criterion: "Incluye subtítulos en español e inglés como archivos SRT", weight: 4, source: "ai" },
      { criterion: "Los nombres de los ponentes aparecen en pantalla con rotulación", weight: 2, source: "ai" },
    ],
  },
  {
    key: "dashboard",
    client: "aburra_pay",
    title: "Dashboard de ventas por comercio y por zona",
    description:
      "Tenemos un export mensual en CSV con transacciones. Queremos un tablero que muestre ventas por comercio, por barrio y por franja horaria, con filtros por fecha. Puede ser en cualquier herramienta de BI con acceso por enlace.",
    category: "Datos e IA",
    keywords: ["dashboard", "bi", "sql", "ventas", "datos"],
    budgetMon: 18,
    deadlineDays: 9,
    daysAgo: 4,
    rules: [
      { criterion: "El tablero tiene filtros por rango de fechas, comercio y barrio", weight: 4, source: "ai" },
      { criterion: "Hay gráficos de ventas por franja horaria y por zona", weight: 4, source: "ai" },
      { criterion: "Se comparte un enlace de acceso y un breve documento que explica cada métrica", weight: 3, source: "human" },
    ],
  },
  {
    key: "translation",
    client: "estudio_laureles",
    title: "Traducción español-inglés de documentación técnica (8.000 palabras)",
    description:
      "Documentación de una API de pagos. Se requiere traducción técnica con glosario consistente, sin traducir nombres de endpoints ni de campos. Se entrega en Markdown.",
    category: "Contenido",
    keywords: ["traducción", "documentación", "inglés", "api", "markdown"],
    budgetMon: 10,
    deadlineDays: 5,
    daysAgo: 0,
    rules: [
      { criterion: "Todo el contenido está traducido y se conserva la estructura Markdown original", weight: 5, source: "ai" },
      { criterion: "Los nombres de endpoints, parámetros y campos de código no se traducen", weight: 4, source: "ai" },
      { criterion: "Se adjunta un glosario con los términos técnicos usados", weight: 2, source: "ai" },
    ],
  },
];

const applications: DemoApplication[] = [
  { listing: "logo", provider: "lucia_diseno", priceMon: 11, days: 7, status: "shortlisted", message: "Hice la identidad de otras tres cafeterías de Medellín. Te propongo tres rutas iniciales, una ronda de ajustes y entrego manual de marca breve con las aplicaciones que pides." },
  { listing: "logo", provider: "daniela_ux", priceMon: 12, days: 9, message: "Trabajo la identidad con enfoque de sistema: logo, componentes y aplicaciones listas para usar en redes y menú digital." },
  { listing: "landing", provider: "andres_dev", priceMon: 18, days: 5, status: "shortlisted", message: "Next.js con TypeScript, imágenes optimizadas y formulario con validación. Entrego repositorio público y la URL desplegada." },
  { listing: "landing", provider: "nuevo_talento", priceMon: 9, days: 7, message: "Es mi primer proyecto pago, así que cobro menos y te muestro avances a diario. Puedo cumplir cada punto de las reglas." },
  { listing: "landing", provider: "daniela_ux", priceMon: 20, days: 7, message: "Diseño y maqueto la página para que la conversión sea el centro. Puedo coordinar con quien la programe." },
  { listing: "audit", provider: "valentina_web3", priceMon: 33, days: 10, status: "shortlisted", message: "He auditado contratos de escrow con liberación por plazo. Entrego reporte priorizado y pruebas en Foundry de los hallazgos altos." },
  { listing: "video", provider: "sofia_video", priceMon: 14, days: 5, status: "shortlisted", message: "Edito el resumen, marco a los ponentes y entrego SRT en ambos idiomas. Reviso la duración exacta antes de enviarlo." },
  { listing: "video", provider: "agente_traductor", priceMon: 4, days: 2, message: "Puedo encargarme solo de los subtítulos ES/EN si ya tienes la edición. Entrega por API en minutos." },
  { listing: "dashboard", provider: "camilo_datos", priceMon: 17, days: 8, status: "shortlisted", message: "Armo el modelo de datos desde tu CSV y el tablero con los filtros pedidos. Dejo documentadas las métricas." },
  { listing: "translation", provider: "mateo_texto", priceMon: 10, days: 4, status: "shortlisted", message: "Traduzco con glosario acordado antes de empezar y conservo el Markdown tal cual. Incluyo revisión final." },
  { listing: "translation", provider: "agente_traductor", priceMon: 3, days: 1, message: "Traducción automatizada con glosario y revisión de consistencia. Entrego el archivo Markdown completo en un día." },
];

const portfolio: DemoPortfolioItem[] = [
  { provider: "lucia_diseno", title: "Identidad para tostadora de café", description: "Logo, etiquetas y bolsa de 250 g para una tostadora de Jardín, Antioquia.", tags: ["branding", "packaging", "café"] },
  { provider: "lucia_diseno", title: "Ilustraciones para menú de restaurante", description: "Doce ilustraciones a tinta para el menú de un restaurante en El Poblado.", tags: ["ilustración", "menú"] },
  { provider: "andres_dev", title: "Panel de reservas para hoteles boutique", description: "Next.js, Postgres y pagos. Reducción del 40% en llamadas al hotel.", url: "https://example.com/andres/reservas", tags: ["next.js", "postgres", "pagos"] },
  { provider: "andres_dev", title: "API de inventario con pruebas", description: "API REST en Node con 92% de cobertura y documentación OpenAPI.", tags: ["api", "node", "pruebas"] },
  { provider: "valentina_web3", title: "Auditoría de un contrato de crowdfunding", description: "11 hallazgos, 2 altos corregidos antes del lanzamiento. Reporte público.", url: "https://example.com/valentina/crowdfunding", tags: ["auditoría", "solidity"] },
  { provider: "valentina_web3", title: "Suite de pruebas con fuzzing para un token", description: "Invariantes y pruebas de propiedad con Foundry para un token con vesting.", tags: ["foundry", "fuzzing"] },
  { provider: "camilo_datos", title: "Tablero de ventas para cadena de panaderías", description: "Ventas por sede y turno en Looker Studio con actualización diaria.", tags: ["bi", "dashboard", "sql"] },
  { provider: "camilo_datos", title: "Agente que clasifica tickets de soporte", description: "Clasificación y respuesta sugerida con un modelo de lenguaje; 87% de acuerdo con humanos.", tags: ["ia", "automatización"] },
  { provider: "sofia_video", title: "Reel de lanzamiento para marca de ropa", description: "Edición, color y motion graphics para un reel de 45 segundos.", tags: ["video", "motion"] },
  { provider: "mateo_texto", title: "Traducción de documentación de una API de pagos", description: "Más de 20.000 palabras con glosario compartido con el equipo de ingeniería.", tags: ["traducción", "documentación"] },
  { provider: "daniela_ux", title: "Rediseño de app de domicilios", description: "Investigación con 12 usuarios, prototipo en Figma y sistema de diseño.", url: "https://example.com/daniela/domicilios", tags: ["ux", "figma"] },
  { provider: "nuevo_talento", title: "Landing de una pastelería", description: "Sitio estático en React con galería y pedido por WhatsApp.", tags: ["react", "landing"] },
];

const deals: DemoDeal[] = [
  { provider: "lucia_diseno", client: "cafe_ceiba", amountMon: 10, daysAgo: 90, description: "Logo de la primera sede", providerScore: 5, providerComment: "Entendió la marca a la primera y entregó todo ordenado.", clientScore: 5, clientComment: "Pago inmediato y feedback claro." },
  { provider: "lucia_diseno", client: "estudio_laureles", amountMon: 8, daysAgo: 70, description: "Ilustraciones de campaña", providerScore: 5, providerComment: "Piezas listas para imprimir, sin retoques.", clientScore: 4 },
  { provider: "lucia_diseno", client: "aburra_pay", amountMon: 14, daysAgo: 55, description: "Identidad de producto", providerScore: 5, providerComment: "Excelente comunicación y puntualidad." },
  { provider: "lucia_diseno", client: "cafe_ceiba", amountMon: 6, daysAgo: 40, description: "Etiquetas de empaque", providerScore: 5, providerComment: "Superó lo pedido." },
  { provider: "lucia_diseno", client: "estudio_laureles", amountMon: 9, daysAgo: 25, description: "Manual de marca", providerScore: 4, providerComment: "Muy buen trabajo; una ronda extra de ajustes." },
  { provider: "andres_dev", client: "aburra_pay", amountMon: 25, daysAgo: 80, description: "Panel interno de comercios", providerScore: 5, providerComment: "Código limpio y bien probado.", clientScore: 5 },
  { provider: "andres_dev", client: "estudio_laureles", amountMon: 15, daysAgo: 50, description: "Sitio de campaña", providerScore: 4, providerComment: "Cumplió el plazo; faltó un detalle de accesibilidad." },
  { provider: "andres_dev", client: "cafe_ceiba", amountMon: 12, daysAgo: 30, description: "Menú digital con QR", providerScore: 5, providerComment: "Rápido y claro en sus avances." },
  { provider: "andres_dev", client: "aburra_pay", amountMon: 20, daysAgo: 15, description: "Integración con API de pagos", providerScore: 4, providerComment: "Buen trabajo técnico." },
  { provider: "valentina_web3", client: "aburra_pay", amountMon: 40, daysAgo: 60, description: "Auditoría de contrato de pagos", providerScore: 5, providerComment: "Encontró un problema de reentrada que se nos escapó.", clientScore: 5 },
  { provider: "valentina_web3", client: "estudio_laureles", amountMon: 22, daysAgo: 35, description: "Revisión de contrato de NFT", providerScore: 5, providerComment: "Reporte muy claro y accionable." },
  { provider: "valentina_web3", client: "cafe_ceiba", amountMon: 18, daysAgo: 20, description: "Pruebas de un contrato de fidelidad", providerScore: 4, providerComment: "Sólida cobertura de pruebas." },
  { provider: "camilo_datos", client: "aburra_pay", amountMon: 17, daysAgo: 45, description: "Tablero de conciliación", providerScore: 5, providerComment: "Los números cuadraron desde el primer día." },
  { provider: "camilo_datos", client: "cafe_ceiba", amountMon: 9, daysAgo: 28, description: "Análisis de ventas por sede", providerScore: 4, providerComment: "Buen análisis, entregó con un día de retraso." },
  { provider: "sofia_video", client: "estudio_laureles", amountMon: 13, daysAgo: 42, description: "Reel de evento", providerScore: 5, providerComment: "Muy buen ritmo de edición." },
  { provider: "sofia_video", client: "cafe_ceiba", amountMon: 7, daysAgo: 22, description: "Video de producto", providerScore: 4, providerComment: "Rápida y cuidadosa." },
  { provider: "mateo_texto", client: "estudio_laureles", amountMon: 8, daysAgo: 33, description: "Textos para sitio web", providerScore: 4, providerComment: "Textos claros; hubo que pedir una revisión de tono." },
  { provider: "daniela_ux", client: "aburra_pay", amountMon: 16, daysAgo: 38, description: "Prototipo de app de cobros", providerScore: 5, providerComment: "Prototipo claro y probado con usuarios." },
  { provider: "daniela_ux", client: "cafe_ceiba", amountMon: 10, daysAgo: 18, description: "Rediseño del menú digital", providerScore: 4, providerComment: "Gran criterio visual." },
];

// Misma fórmula que `computeRulesHash` en lib/server/services/rules.ts (ese módulo es solo de servidor y no se puede
// importar desde un script): es lo que se compara con el hash fijado on-chain al crear el acuerdo.
function rulesHash(listingId: string, version: number, rules: DemoRule[]): string {
  const canonical = JSON.stringify({
    v: 1,
    listingId,
    version,
    rules: rules.map((rule) => ({ criterion: rule.criterion, weight: rule.weight })),
  });
  return keccak256(toUtf8Bytes(canonical));
}

const toWei = (mon: number): string => (BigInt(Math.round(mon * 1000)) * 10n ** 15n).toString();
const emailOf = (username: string) => `${username}@${DEMO_DOMAIN}`;

const connectionString = process.env.DATABASE_URL_SESSION ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Falta DATABASE_URL_SESSION (usa: pnpm db:seed, que carga .env.local).");
  process.exit(1);
}
const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS?.toLowerCase();
if (!contractAddress || !/^0x[0-9a-f]{40}$/.test(contractAddress)) {
  console.error("Falta NEXT_PUBLIC_CONTRACT_ADDRESS (los acuerdos sembrados se asocian al contrato desplegado).");
  process.exit(1);
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

async function removeDemoData(): Promise<number> {
  const demoUsers = `select id from users where email like '%@${DEMO_DOMAIN}'`;
  await client.query(`delete from ratings where rater_id in (${demoUsers}) or ratee_id in (${demoUsers})`);
  await client.query(`delete from agreements where listing_id is null and (client_id in (${demoUsers}) or provider_id in (${demoUsers}))`);
  await client.query(`update listings set awarded_application_id = null where client_id in (${demoUsers})`);
  await client.query(`delete from applications where provider_id in (${demoUsers}) or listing_id in (select id from listings where client_id in (${demoUsers}))`);
  await client.query(`delete from listings where client_id in (${demoUsers})`);
  const removed = await client.query(`delete from users where email like '%@${DEMO_DOMAIN}'`);
  return removed.rowCount ?? 0;
}

async function insertDemoData(): Promise<void> {
  const ids = new Map<string, string>();
  const skillIds = new Map<string, number>();
  for (const row of (await client.query<{ id: number; slug: string }>("select id, slug from skills")).rows) {
    skillIds.set(row.slug, row.id);
  }
  const userId = (username: string): string => {
    const id = ids.get(username);
    if (!id) throw new Error(`Usuario de ejemplo desconocido: ${username}`);
    return id;
  };

  for (const user of users) {
    const { rows } = await client.query<{ id: string }>(
      `insert into users (display_name, username, email, headline, bio, keywords, roles, location, availability, links, is_agent)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11) returning id`,
      [user.name, user.username, emailOf(user.username), user.headline, user.bio, user.keywords, user.roles, user.location, user.availability, JSON.stringify(user.links), user.isAgent ?? false],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error(`No se pudo crear ${user.username}`);
    ids.set(user.username, id);
    for (const [slug, level] of user.skills) {
      const skillId = skillIds.get(slug);
      if (skillId === undefined) throw new Error(`Habilidad inexistente: ${slug}`);
      await client.query("insert into user_skills (user_id, skill_id, level) values ($1, $2, $3)", [id, skillId, level]);
    }
  }

  for (const item of portfolio) {
    await client.query(
      "insert into portfolio_items (user_id, title, description, url, tags) values ($1, $2, $3, $4, $5)",
      [userId(item.provider), item.title, item.description, item.url ?? null, item.tags],
    );
  }

  const listingIds = new Map<string, string>();
  for (const listing of listings) {
    const createdAt = new Date(Date.now() - listing.daysAgo * MS_PER_DAY - 3 * 60 * 60 * 1000);
    // Se crea en borrador, se escriben las reglas y solo entonces se publica: el guard de la base impide tocarlas después.
    const { rows } = await client.query<{ id: string }>(
      `insert into listings (client_id, title, description, category, keywords, budget_mon, deadline_days, status, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, 'draft', $8) returning id`,
      [userId(listing.client), listing.title, listing.description, listing.category, listing.keywords, listing.budgetMon, listing.deadlineDays, createdAt],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error(`No se pudo crear la solicitud ${listing.key}`);
    listingIds.set(listing.key, id);
    for (const [index, rule] of listing.rules.entries()) {
      await client.query(
        "insert into listing_rules (listing_id, version, position, criterion, weight, source) values ($1, 1, $2, $3, $4, $5)",
        [id, index + 1, rule.criterion, rule.weight, rule.source],
      );
    }
    await client.query(
      `update listings set status = 'open', rules_version = 1, rules_hash = $2, rules_confirmed_at = $3 where id = $1`,
      [id, rulesHash(id, 1, listing.rules), createdAt],
    );
  }

  for (const application of applications) {
    const listingId = listingIds.get(application.listing);
    if (!listingId) throw new Error(`Solicitud inexistente: ${application.listing}`);
    await client.query(
      `insert into applications (listing_id, provider_id, message, price_mon, days, status)
       values ($1, $2, $3, $4, $5, $6)`,
      [listingId, userId(application.provider), application.message, application.priceMon, application.days, application.status ?? "submitted"],
    );
  }

  for (const deal of deals) {
    const createdAt = new Date(Date.now() - deal.daysAgo * MS_PER_DAY);
    const deadline = new Date(createdAt.getTime() + 7 * MS_PER_DAY);
    const { rows } = await client.query<{ id: string }>(
      `insert into agreements (client_id, provider_id, amount_wei, deadline, status, description, contract_address, created_at)
       values ($1, $2, $3, $4, 'Approved', $5, $6, $7) returning id`,
      [userId(deal.client), userId(deal.provider), toWei(deal.amountMon), deadline, deal.description, contractAddress, createdAt],
    );
    const agreementId = rows[0]?.id;
    if (!agreementId) throw new Error(`No se pudo crear el acuerdo "${deal.description}"`);
    const ratedAt = new Date(createdAt.getTime() + 8 * MS_PER_DAY);
    await client.query(
      `insert into ratings (agreement_id, rater_id, ratee_id, ratee_role, score, comment, created_at)
       values ($1, $2, $3, 'provider', $4, $5, $6)`,
      [agreementId, userId(deal.client), userId(deal.provider), deal.providerScore, deal.providerComment, ratedAt],
    );
    if (deal.clientScore !== undefined) {
      await client.query(
        `insert into ratings (agreement_id, rater_id, ratee_id, ratee_role, score, comment, created_at)
         values ($1, $2, $3, 'client', $4, $5, $6)`,
        [agreementId, userId(deal.provider), userId(deal.client), deal.clientScore, deal.clientComment ?? null, ratedAt],
      );
    }
  }
}

try {
  await client.query("begin");
  const removed = await removeDemoData();
  if (process.argv.includes("--clean")) {
    await client.query("commit");
    console.log(`Datos de ejemplo borrados (${removed} usuarios).`);
  } else {
    await insertDemoData();
    await client.query("commit");
    console.log(
      `Datos de ejemplo listos: ${users.length} perfiles, ${listings.length} solicitudes abiertas, ${applications.length} postulaciones, ` +
        `${portfolio.length} trabajos de portafolio y ${deals.length} acuerdos calificados.` +
        (removed > 0 ? ` (reemplazó ${removed} perfiles anteriores)` : ""),
    );
  }
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
