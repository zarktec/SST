import type { Article } from "../types";

/** Empezar, cuenta y datos, y referencia: lo que necesita toda persona antes de entrar a los módulos. */
export const START: Article[] = [
  {
    slug: "primeros-pasos",
    title: "Primeros pasos",
    group: "Empezar",
    icon: "Home",
    summary:
      "Cómo crear la empresa, ingresar, moverte por la plataforma y dejarla lista para trabajar.",
    who: "Todas las personas, sobre todo quien crea la cuenta de la empresa.",
    keywords: [
      "registro",
      "ingresar",
      "login",
      "contraseña",
      "enlace",
      "menú",
      "instalar",
      "celular",
    ],
    related: ["roles", "onboarding", "usuarios", "sin-conexion"],
    blocks: [
      {
        t: "p",
        text: "La plataforma te ayuda a montar, administrar y **demostrar** el cumplimiento del Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST) de tu empresa. Todo lo que registras queda con fecha, responsable y evidencia, listo para una inspección.",
      },
      {
        t: "steps",
        title: "1. Crear la empresa (solo la primera vez)",
        items: [
          "Entra a **sst.zark.pro** y pulsa **Empieza tu prueba gratuita** (o **Prueba gratis** en la barra superior).",
          "Escribe los datos de la empresa y el **correo de quien será administrador**. Elige el identificador de tu empresa: será la parte final de tu dirección (`sst.zark.pro/tu-empresa`).",
          "Recibirás un correo con la dirección de ingreso. La prueba gratuita no pide tarjeta y no tiene restricciones mientras dure.",
        ],
      },
      {
        t: "steps",
        title: "2. Ingresar",
        items: [
          "Abre la dirección de tu empresa, por ejemplo `sst.zark.pro/tu-empresa/login`. Si no la recuerdas, entra a **sst.zark.pro/login**, escribe el identificador de tu empresa y pulsa **Continuar**.",
          "Elige **Contraseña** (correo y contraseña) o **Enlace por correo** (te enviamos un enlace de un solo uso a tu correo, sin contraseña).",
          "Si tu empresa activó Google, también verás el botón para ingresar con tu cuenta de Google.",
        ],
      },
      {
        t: "note",
        text: "Solo puedes entrar si tu correo fue **invitado** por el administrador de la empresa (o si el dominio de tu correo está autorizado por la empresa). Si el sistema dice que no estás invitado, pide la invitación a quien administra tu empresa.",
      },
      {
        t: "steps",
        title: "3. Conocer la pantalla",
        items: [
          "**Menú lateral** (en el celular, el botón **Menú** de la barra inferior): todos los módulos agrupados por tema. Solo ves los que tu rol permite.",
          "**Barra superior**: buscador global, botón **?** (ayuda de la pantalla donde estás), campana de **alertas** con el número de pendientes y el botón de **modo claro/oscuro**.",
          "**Inicio**: accesos rápidos (reportar una condición insegura, acciones pendientes, hacer una inspección, reportar un accidente) y una tarjeta por cada módulo.",
          "**Agregar o editar**: todos los formularios se abren en una ventana (modal). Al guardar bien, la ventana se cierra y aparece un aviso breve. Si hay un error, la ventana sigue abierta y te dice qué corregir.",
        ],
      },
      {
        t: "steps",
        title: "4. Dejar la empresa lista",
        items: [
          "El administrador completa el **onboarding** (datos de la empresa, sedes, responsable del SG-SST y marca). Mira la guía *Configurar tu SG-SST*.",
          "Invita a las demás personas desde **Usuarios y roles** y asígnales el rol que corresponde.",
          "Registra a los trabajadores y contratistas en **Personas** (uno a uno o con carga masiva).",
          "Empieza por la **Autoevaluación de estándares mínimos** y la **Matriz de peligros**: de ellas salen el plan de mejoramiento y el plan anual.",
        ],
      },
      {
        t: "tip",
        text: "En el celular puedes **instalar la plataforma como una app** (menú del navegador → *Agregar a pantalla de inicio* o *Instalar app*). Las inspecciones funcionan aun sin señal; mira la guía *Trabajar sin conexión*.",
      },
    ],
  },
  {
    slug: "ayuda",
    title: "Cómo usar el centro de ayuda",
    group: "Empezar",
    icon: "BookOpen",
    summary:
      "Encuentra la guía que necesitas: por tema, con el buscador o desde el botón ? de cada pantalla.",
    route: "/ayuda",
    keywords: ["ayuda", "guía", "manual", "buscar", "cómo se usa"],
    related: ["primeros-pasos", "preguntas-frecuentes", "glosario"],
    blocks: [
      {
        t: "list",
        items: [
          "**Por tema**: el índice agrupa las guías (Empezar, Planear, Personas, Salud, Prevención y respuesta, Mejora y gestión, Cuenta y datos, Referencia).",
          "**Buscador**: escribe una palabra («firma», «accidente», «carga masiva») y pulsa **Buscar**. No importan las tildes ni las mayúsculas.",
          "**Desde cualquier pantalla**: el botón **?** de la barra superior abre la guía del módulo donde estás.",
          "Cada guía tiene el botón **Abrir esta pantalla** (si tu rol tiene acceso), los pasos y consejos, y enlaces a guías relacionadas.",
        ],
      },
      {
        t: "tip",
        text: "Si algo no aparece en la guía o no funciona como se describe, avísale al responsable del SG-SST o al administrador de la plataforma.",
      },
    ],
  },
  {
    slug: "roles",
    title: "Roles y permisos",
    group: "Empezar",
    icon: "UserCog",
    summary:
      "Qué puede ver y hacer cada rol. Cada persona tiene un rol; lo asigna el administrador.",
    who: "Administradores y responsables del SG-SST.",
    keywords: [
      "permisos",
      "administrador",
      "trabajador",
      "responsable",
      "copasst",
      "acceso",
      "no veo",
    ],
    related: ["usuarios", "primeros-pasos"],
    blocks: [
      {
        t: "p",
        text: "La plataforma muestra a cada persona solo lo que su rol necesita. Si no ves un módulo del que te hablaron, probablemente tu rol no lo incluye: pídele al administrador que revise tu rol en **Usuarios y roles**.",
      },
      {
        t: "defs",
        items: [
          {
            term: "Administrador de la empresa",
            def: "Gestiona usuarios, facturación, dominio propio, marca y datos de la empresa, y consulta todos los módulos del SG-SST.",
          },
          {
            term: "Alta dirección",
            def: "Consulta y exporta todo, aprueba la política, el plan anual, la revisión por la dirección y los documentos, y firma la revisión.",
          },
          {
            term: "Responsable del SG-SST",
            def: "Opera todos los módulos del sistema (crea, edita, aprueba y exporta) y completa los datos de la empresa. Recibe por correo las alertas.",
          },
          {
            term: "Apoyo SST",
            def: "Ayuda a operar el sistema: consulta, crea y edita en los módulos SST (sin aprobar).",
          },
          {
            term: "Miembro COPASST / Vigía SST",
            def: "Consulta casi todo (excepto medicina del trabajo), reporta e inspecciona y participa en comités.",
          },
          {
            term: "Miembro del Comité de Convivencia",
            def: "Accede únicamente al módulo de Convivencia laboral: quejas, trámite y acuerdo de confidencialidad.",
          },
          {
            term: "Jefe de área",
            def: "Ve y gestiona lo de su equipo: personas, accidentes, acciones y capacitación; aprueba acciones y permisos de alto riesgo de su equipo.",
          },
          {
            term: "Brigadista",
            def: "Consulta Emergencias y puede reportar condiciones inseguras.",
          },
          {
            term: "Trabajador",
            def: "Reporta condiciones inseguras y accidentes, y consulta lo suyo (capacitaciones, EPP, documentos) en **Mi portal**.",
          },
          {
            term: "Contratista",
            def: "Reporta condiciones inseguras y consulta sus propios documentos y capacitaciones.",
          },
          {
            term: "Auditor externo",
            def: "Solo lectura y exportación de los módulos SST, excepto medicina del trabajo.",
          },
        ],
      },
      {
        t: "warn",
        text: "La **medicina del trabajo**, la **vigilancia epidemiológica**, las **quejas de convivencia** y los **reportes de acoso sexual** contienen datos sensibles: están cifrados, solo los ven los roles autorizados y cada lectura queda registrada.",
      },
    ],
  },
  {
    slug: "onboarding",
    title: "Configurar tu SG-SST (onboarding)",
    group: "Empezar",
    icon: "ClipboardCheck",
    summary: "Cinco pasos para dejar lista la empresa: datos, sedes, responsable, marca y resumen.",
    module: "company",
    route: "/onboarding",
    who: "Administrador y responsable del SG-SST.",
    keywords: [
      "empresa",
      "nit",
      "arl",
      "sede",
      "responsable",
      "licencia",
      "logo",
      "colores",
      "clasificación",
      "7 21 60",
    ],
    related: ["estandares", "usuarios"],
    blocks: [
      {
        t: "p",
        text: "Desde **Inicio → Configura tu SG-SST → Continuar con el onboarding**. Un aviso en Inicio te recuerda completarlo hasta que termines. Puedes volver a cualquier paso con **Editar**.",
      },
      {
        t: "steps",
        title: "Paso 1 · Empresa",
        items: [
          "Completa **razón social**, **nombre comercial**, **NIT** (sin dígito de verificación ni puntos) y su **dígito de verificación**, **representante legal**, **dirección**, **municipio** (código DANE de 5 dígitos), **teléfono** y **correo**.",
          "Indica la **actividad económica** (CIIU de 4 dígitos), la **ARL**, la **clase de riesgo** (1 a 5) y el **número de trabajadores**.",
          "Con el número de trabajadores y la clase de riesgo, la plataforma **clasifica** tu empresa en el grupo de **7, 21 o 60 estándares mínimos** que te aplican. Si después cambias esos datos, te avisa que la clasificación cambió.",
        ],
      },
      {
        t: "steps",
        title: "Paso 2 · Sedes",
        items: [
          "Agrega cada sede o centro de trabajo: nombre, dirección, municipio, **trabajadores en la sede** y, si es distinta, la **clase de riesgo de la sede**.",
          "Las sedes se usan después en inspecciones, planes de emergencia, accidentes, etc.",
        ],
      },
      {
        t: "steps",
        title: "Paso 3 · Responsable del SG-SST",
        items: [
          "Registra a la persona responsable: **nombre, documento, licencia en SST** (número, entidad que la expidió y vigencia), **curso de 50 horas** (entidad y fecha del certificado) y su **última actualización de 20 horas**.",
          "La plataforma te alerta cuando la licencia o la actualización de 20 horas estén por vencer.",
        ],
      },
      {
        t: "steps",
        title: "Paso 4 · Marca",
        items: [
          "Elige el **color primario**, **secundario** y de **acento** de tu empresa. La plataforma verifica el contraste de los colores (accesibilidad AA) y te sugiere ajustes si el texto no se leería bien.",
          "Si no eliges colores, se usa la identidad de ZarK.",
        ],
      },
      {
        t: "steps",
        title: "Paso 5 · Resumen",
        items: [
          "Revisa lo que registraste. Si todo está bien, el aviso de Inicio desaparece y puedes empezar con la autoevaluación.",
        ],
      },
    ],
  },
  {
    slug: "usuarios",
    title: "Usuarios y roles",
    group: "Cuenta y datos",
    icon: "UserCog",
    summary: "Invitar personas por correo, cambiar su rol y desactivar accesos.",
    module: "users",
    route: "/usuarios",
    who: "Administrador de la empresa.",
    keywords: [
      "invitar",
      "invitación",
      "rol",
      "desactivar",
      "acceso",
      "correo",
      "límite de usuarios",
    ],
    related: ["roles", "primeros-pasos"],
    blocks: [
      {
        t: "steps",
        title: "Invitar a una persona",
        items: [
          "Ve a **Menú → Usuarios y roles** y pulsa **Invitar persona**.",
          "Escribe su **correo** y elige el **rol** (mira la guía *Roles y permisos*). Pulsa **Enviar invitación**.",
          "La persona recibe un correo con la dirección de ingreso. Debe entrar con **ese mismo correo** (con enlace por correo o con su cuenta de Google). La invitación vence a los **14 días**.",
        ],
      },
      {
        t: "list",
        title: "Gestionar el equipo",
        items: [
          "**Invitaciones pendientes**: aparecen mientras no se acepten. Pulsa **Revocar** para cancelarlas. Si invitas de nuevo al mismo correo, la invitación anterior se reemplaza.",
          "**Miembros**: para cada persona puedes abrir **Cambiar rol** y **Guardar rol**, o **Desactivar** su acceso (y **Activar** de nuevo). Desactivar no borra su historial.",
          "No puedes cambiar tu propio rol ni desactivar tu propia cuenta, y siempre debe quedar **al menos un administrador activo**.",
        ],
      },
      {
        t: "warn",
        text: "Tu plan tiene un **límite de usuarios**. Si lo alcanzas, el sistema no deja invitar más hasta que cambies de plan o desactives a alguien. Invitar y reactivar cuentan para el límite.",
      },
    ],
  },
  {
    slug: "facturacion",
    title: "Facturación, plan y pagos",
    group: "Cuenta y datos",
    icon: "CreditCard",
    summary:
      "Tu plan, el método de pago, los datos para la factura electrónica y el historial de pagos.",
    module: "billing",
    route: "/facturacion",
    who: "Administrador de la empresa.",
    keywords: [
      "plan",
      "pago",
      "tarjeta",
      "factura",
      "nit",
      "cancelar",
      "prueba gratuita",
      "suspendida",
      "mora",
    ],
    related: ["usuarios"],
    blocks: [
      {
        t: "p",
        text: "En **Menú → Facturación** ves seis bloques: **Mi plan**, **Elegir o cambiar de plan**, **Métodos de pago**, **Datos de facturación**, **Historial de pagos** y **Cancelar suscripción**.",
      },
      {
        t: "steps",
        title: "Pasar de la prueba gratuita a un plan",
        items: [
          "En **Elegir o cambiar de plan**, selecciona el plan y el periodo (mensual o anual) con el botón del plan que quieras.",
          "En **Métodos de pago**, registra tu tarjeta (número, nombre, vencimiento y CVC). Los datos de la tarjeta se envían directamente a la pasarela de pagos (Wompi): la plataforma no los guarda. Con varias tarjetas, marca una como **Predeterminado**; con **Pagar ahora** puedes pagar un saldo pendiente.",
          "En **Datos de facturación**, pulsa **Editar datos de facturación**: tipo de persona y de documento, número de documento (con su dígito de verificación si es NIT), razón social o nombre, dirección, municipio (código DANE de 5 dígitos), teléfono y el correo donde quieres recibir la **factura electrónica**.",
        ],
      },
      {
        t: "list",
        title: "Cómo funciona",
        items: [
          "Se cobra automáticamente en cada renovación y se genera la **factura electrónica**; la abres desde **Historial de pagos** (enlace «Factura …»). Si aún dice «Factura en proceso», vuelve en unos minutos.",
          "Un **cambio de plan** aplica en la **próxima renovación** (no hay prorrateo por ahora).",
          "Si un pago falla, se **reintenta** varias veces. Mientras tanto verás avisos; si no se logra cobrar, la cuenta pasa a **solo lectura** (puedes consultar pero no editar) y luego se suspende.",
          "Si cancelas, la suscripción sigue hasta el final del periodo pagado; puedes arrepentirte con **Mantener mi suscripción**. Después, tus registros obligatorios quedan en un archivo cifrado de solo conservación.",
        ],
      },
      {
        t: "note",
        text: "El dígito de verificación del NIT se valida: si no corresponde, el formulario te dice cuál es el correcto. El plan limita cuántas personas, usuarios y sedes puedes tener y qué módulos incluye (por ejemplo, PESV).",
      },
    ],
  },
  {
    slug: "dominio",
    title: "Dominio propio",
    group: "Cuenta y datos",
    icon: "Globe",
    summary:
      "Usa tu propio dominio (por ejemplo, sst.miempresa.com) en lugar de sst.zark.pro/tu-empresa.",
    module: "domain",
    route: "/dominio",
    who: "Administrador de la empresa.",
    keywords: ["dominio", "dns", "cname", "marca blanca", "dirección"],
    blocks: [
      {
        t: "steps",
        items: [
          "Ve a **Menú → Dominio propio**. Arriba verás la **dirección de tu empresa** actual.",
          "En **Conectar un dominio** pulsa **Conectar dominio propio**, escribe tu dominio (por ejemplo `sst.miempresa.com`) y pulsa **Conectar dominio**.",
          "La plataforma te muestra las **instrucciones DNS**: el registro que debes crear en el proveedor donde administras tu dominio.",
          "Cuando el DNS se propaga (puede tardar desde minutos hasta horas), el dominio queda **Verificado** y tu empresa responde en él.",
        ],
      },
      {
        t: "note",
        text: "Con un dominio activo ya no se ofrece conectar otro. Tu dirección original `sst.zark.pro/tu-empresa` sigue funcionando.",
      },
    ],
  },
  {
    slug: "privacidad",
    title: "Privacidad y datos personales",
    group: "Cuenta y datos",
    icon: "Lock",
    summary:
      "Tu autorización de tratamiento de datos (Ley 1581) y cómo ejercer tus derechos como titular.",
    route: "/privacidad",
    who: "Todas las personas. El responsable atiende las solicitudes.",
    keywords: [
      "ley 1581",
      "habeas data",
      "autorización",
      "consulta",
      "corrección",
      "supresión",
      "datos sensibles",
    ],
    related: ["portal"],
    blocks: [
      {
        t: "steps",
        title: "Autorizar el tratamiento de tus datos",
        items: [
          "Ve a **Menú → Privacidad** y lee el **aviso de privacidad** de tu empresa.",
          "Pulsa **Mi autorización de datos**. Marca la autorización **general** (obligatoria para usar la plataforma) y, si quieres, la de **datos sensibles de salud** (opcional).",
          "Pulsa **Guardar mi autorización**. Verás el estado **Autorizado**. Puedes actualizarla cuando quieras.",
        ],
      },
      {
        t: "steps",
        title: "Ejercer tus derechos",
        items: [
          "En **Ejercer mis derechos**, pulsa **Radicar solicitud**, elige el **tipo** (consultar, corregir, suprimir…) y describe lo que necesitas.",
          "Tu solicitud queda **En trámite** hasta que el responsable la responda; verás la respuesta en la misma pantalla.",
        ],
      },
      {
        t: "steps",
        title: "Para el responsable: atender solicitudes",
        items: [
          "Ve a **Privacidad → Solicitudes de los titulares**. Pulsa **Responder** en la solicitud.",
          "Escribe la **respuesta al titular** y elige la **decisión**: *Atendida* o *Rechazada* (con motivo). Pulsa **Registrar respuesta**.",
        ],
      },
      {
        t: "note",
        text: "Los documentos de identidad se guardan cifrados y solo se ven los **últimos cuatro dígitos**. Los datos de salud y de convivencia también están cifrados y sus lecturas quedan registradas.",
      },
    ],
  },
  {
    slug: "portal",
    title: "Mi portal (trabajadores)",
    group: "Cuenta y datos",
    icon: "UserRound",
    summary:
      "Tu espacio personal: pendientes, capacitaciones, EPP, evaluaciones médicas y reportes.",
    route: "/portal",
    who: "Trabajadores y contratistas.",
    keywords: ["trabajador", "mis capacitaciones", "política", "pendientes", "epp", "certificado"],
    related: ["privacidad", "reportes"],
    blocks: [
      {
        t: "p",
        text: "**Menú → Mi portal** reúne lo que te corresponde como persona vinculada a la empresa. Para que aparezca tu información, el administrador debe haberte registrado en **Personas** con **el mismo correo** con el que ingresas.",
      },
      {
        t: "list",
        title: "Qué encuentras",
        items: [
          "**Pendientes**: lo que debes hacer (autorizar el tratamiento de tus datos, leer la política, capacitaciones vencidas…).",
          "**Política de seguridad y salud en el trabajo**: léela y pulsa **Leí y acepto la política** para dejar tu constancia de lectura.",
          "**Mis capacitaciones**: las que asististe, el resultado y el **certificado** en PDF.",
          "**Mis elementos de protección personal**: lo que te entregaron y cuándo debe reponerse.",
          "**Mis evaluaciones médicas ocupacionales**: tipo, fecha y próxima fecha. El concepto y las recomendaciones médicas se consultan directamente con la IPS.",
          "**Mis reportes**: lo que reportaste y en qué estado va.",
        ],
      },
      {
        t: "tip",
        text: "Si el portal dice que tu cuenta «no está vinculada a una persona registrada», avisa al responsable del SG-SST para que revise que tu correo esté en tu ficha de **Personas**.",
      },
    ],
  },
  {
    slug: "notificaciones",
    title: "Alertas y notificaciones",
    group: "Cuenta y datos",
    icon: "Bell",
    summary:
      "Qué te avisa la plataforma, dónde verlo y cómo recibir avisos en el celular y el correo.",
    route: "/notificaciones",
    who: "Todas las personas (cada una ve las alertas de sus módulos).",
    keywords: [
      "alertas",
      "campana",
      "push",
      "correo",
      "resumen semanal",
      "vencidas",
      "recordatorio",
    ],
    related: ["calendario", "acciones"],
    blocks: [
      {
        t: "p",
        text: "Todos los días la plataforma revisa tu empresa y crea **alertas**: acciones vencidas, reportes a la ARL/EPS e investigaciones de accidentes vencidos, simulacros y equipos de emergencia, permisos y certificados de alto riesgo, sustancias sin ficha de seguridad, preoperacionales y licencias de conducción, seguimientos de vigilancia, auditorías atrasadas, política y documentos por revisar, y evaluaciones médicas periódicas o de retorno. Cada persona ve las que corresponden a los módulos de su rol.",
      },
      {
        t: "list",
        title: "Dónde llegan",
        items: [
          "**Campana** de la barra superior: muestra cuántas alertas tienes sin leer. Pulsa para abrir **Alertas**.",
          "**Correo**: el responsable del SG-SST y el administrador reciben un correo con lo **nuevo**, y un **resumen semanal** los lunes.",
          "**Avisos en el celular o el computador**: en **Alertas → Notificaciones en este dispositivo** pulsa para activarlos (el navegador te pedirá permiso).",
        ],
      },
      {
        t: "steps",
        title: "Gestionar las alertas",
        items: [
          "Abre **Alertas**. Cada una tiene un enlace a la pantalla donde se resuelve.",
          "Pulsa **Marcar leída** en una alerta o **Marcar todas como leídas**.",
          "Una alerta **desaparece sola** cuando resuelves el motivo (por ejemplo, al cerrar la acción vencida).",
        ],
      },
    ],
  },
  {
    slug: "calendario",
    title: "Calendario de obligaciones",
    group: "Cuenta y datos",
    icon: "CalendarDays",
    summary:
      "Todas las fechas importantes del SG-SST en un solo lugar, con descarga para tu agenda.",
    route: "/calendario",
    who: "Responsable del SG-SST y quien necesite planificar.",
    keywords: ["calendario", "fechas", "vencimientos", "ics", "google calendar", "outlook"],
    related: ["notificaciones"],
    blocks: [
      {
        t: "p",
        text: "**Menú → Calendario** lista, por mes, lo que vence o está programado: acciones, simulacros, vencimientos de equipos y certificados, evaluaciones, revisiones de documentos, etc. Arriba aparecen las **Vencidas**.",
      },
      {
        t: "steps",
        title: "Llevarlo a tu agenda",
        items: [
          "Pulsa el enlace de descarga del calendario (archivo **.ics**).",
          "Impórtalo en Google Calendar, Outlook o el calendario de tu celular.",
        ],
      },
    ],
  },
  {
    slug: "buscar",
    title: "Buscar en la plataforma",
    group: "Cuenta y datos",
    icon: "Home",
    summary: "El buscador de la barra superior encuentra personas, documentos, acciones y más.",
    route: "/buscar",
    keywords: ["buscar", "búsqueda", "encontrar"],
    blocks: [
      {
        t: "steps",
        items: [
          "Escribe en el buscador de la barra superior (o en el menú, en el celular) y pulsa Enter.",
          "Los resultados se agrupan por tipo. Pulsa uno para abrirlo.",
          "Solo ves resultados de los módulos a los que tu rol tiene acceso. Si no aparece nada, prueba con otra palabra (nombre, cargo, parte del título).",
        ],
      },
    ],
  },
  {
    slug: "informes",
    title: "Informes y exportaciones",
    group: "Cuenta y datos",
    icon: "FileBarChart",
    summary:
      "Descarga informes en PDF, Excel o CSV, la carpeta de inspección y la exportación total.",
    route: "/informes",
    who: "Responsable del SG-SST, alta dirección, auditores.",
    keywords: [
      "pdf",
      "excel",
      "csv",
      "exportar",
      "descargar",
      "inspección",
      "ministerio",
      "carpeta",
      "zip",
    ],
    related: ["indicadores", "documentos"],
    blocks: [
      {
        t: "p",
        text: "En **Menú → Informes** hay informes agrupados por el ciclo PHVA (planear, hacer, verificar, actuar). Cada uno se descarga en **PDF**, **Excel** o **CSV**.",
      },
      {
        t: "steps",
        title: "Descargar un informe",
        items: [
          "Ubica el informe (por ejemplo, acciones correctivas, accidentalidad, capacitación…).",
          "Pulsa el formato que necesitas. El archivo lleva la fecha, el nombre de la empresa y tu marca.",
        ],
      },
      {
        t: "steps",
        title: "Carpeta de inspección",
        items: [
          "Cuando llegue una visita de inspección, pulsa **Carpeta de inspección**: descarga un **ZIP** con todos los soportes y un **índice** con la huella (SHA-256) de cada archivo, que demuestra que no fueron alterados.",
        ],
      },
      {
        t: "steps",
        title: "Exportación total",
        items: [
          "En **Exportación total de los datos** descargas todo lo que tu empresa tiene en la plataforma. Es tu copia de seguridad y tu derecho a llevarte la información.",
        ],
      },
      {
        t: "tip",
        text: "El informe de **investigación de un accidente** se descarga desde el propio accidente (en **Accidentes e incidentes**).",
      },
    ],
  },
  {
    slug: "firmas",
    title: "Cómo firmar en la plataforma",
    group: "Referencia",
    icon: "FileText",
    summary:
      "Las firmas se hacen con el dedo o el mouse; quedan con fecha y una huella que prueba que el contenido no cambió.",
    keywords: ["firma", "firmar", "huella", "evidencia", "aprobar"],
    related: ["documentos", "alto-riesgo", "epp"],
    blocks: [
      {
        t: "steps",
        items: [
          "Cuando una pantalla pide **firma**, verás un recuadro («Área para firmar»). Dibuja tu firma con el dedo (celular) o el mouse.",
          "Pulsa **Borrar firma** si quieres repetirla. El botón de guardar se activa cuando hay una firma válida (no vale un punto o un rayón).",
          "Al guardar, el sistema registra **quién firmó, cuándo, desde qué dispositivo** y una **huella digital** del contenido firmado.",
        ],
      },
      {
        t: "list",
        title: "Dónde se firma",
        items: [
          "Aprobación de **documentos** y de la **política**.",
          "**Plan anual** (firma del empleador y del responsable).",
          "**Entrega de EPP** (recibe conforme el trabajador).",
          "**Permisos de trabajo de alto riesgo** (quien solicita y quien autoriza).",
          "**Asistencia a capacitaciones** (con el QR).",
          "**Revisión por la dirección** (alta dirección).",
        ],
      },
      {
        t: "warn",
        text: "**Separación de funciones**: quien redacta un documento o solicita un permiso **no puede aprobarlo** él mismo. La plataforma lo impide.",
      },
    ],
  },
  {
    slug: "sin-conexion",
    title: "Trabajar sin conexión e instalar la app",
    group: "Referencia",
    icon: "ListChecks",
    summary: "Las inspecciones se pueden hacer sin señal y se envían solas al volver la conexión.",
    keywords: ["offline", "sin internet", "sin señal", "instalar", "pwa", "celular", "sincronizar"],
    related: ["inspecciones"],
    blocks: [
      {
        t: "steps",
        title: "Instalar la plataforma en el celular",
        items: [
          "Abre la dirección de tu empresa en el navegador del celular.",
          "En el menú del navegador elige **Agregar a pantalla de inicio** (o **Instalar app**).",
          "Se instala con el nombre y los colores de tu empresa y abre a pantalla completa.",
        ],
      },
      {
        t: "steps",
        title: "Hacer una inspección sin señal",
        items: [
          "Abre **Inspecciones** estando con conexión al menos una vez (la pantalla de ejecución se guarda en el dispositivo).",
          "Sin señal, abre la inspección, califica los ítems y pulsa **Enviar inspección**.",
          "Verás «Sin conexión: la inspección quedó guardada». Al volver la señal, **se envía sola** y aparece el aviso de que se sincronizó.",
        ],
      },
      {
        t: "note",
        text: "Solo las **inspecciones** funcionan sin conexión. El resto de módulos necesita internet. El envío es seguro: si se reintenta, la inspección **no se duplica**.",
      },
    ],
  },
  {
    slug: "glosario",
    title: "Glosario",
    group: "Referencia",
    icon: "FileSearch",
    summary: "Siglas y términos del SG-SST que aparecen en la plataforma.",
    keywords: [
      "significa",
      "sigla",
      "capa",
      "phva",
      "copasst",
      "ccl",
      "furat",
      "arl",
      "eps",
      "gtc 45",
      "pesv",
      "sga",
      "fds",
    ],
    blocks: [
      {
        t: "defs",
        items: [
          { term: "SG-SST", def: "Sistema de Gestión de Seguridad y Salud en el Trabajo." },
          {
            term: "PHVA",
            def: "Planear, Hacer, Verificar, Actuar: el ciclo de mejora en que se organizan los estándares y los informes.",
          },
          {
            term: "Estándares mínimos (Res. 0312)",
            def: "Los 7, 21 o 60 criterios que debe cumplir tu empresa según su tamaño y su riesgo; se califican en la **autoevaluación** anual.",
          },
          {
            term: "COPASST",
            def: "Comité Paritario de Seguridad y Salud en el Trabajo. En empresas pequeñas se reemplaza por un **Vigía SST**.",
          },
          {
            term: "CCL",
            def: "Comité de Convivencia Laboral: atiende las quejas de acoso laboral.",
          },
          {
            term: "CAPA / Acción",
            def: "Acción correctiva, preventiva o de mejora. Es el lugar donde terminan los hallazgos de inspecciones, accidentes, auditorías, simulacros, etc.",
          },
          {
            term: "ARL / EPS / IPS",
            def: "Administradora de Riesgos Laborales / Entidad Promotora de Salud / Institución Prestadora de Servicios de salud (donde se hacen los exámenes médicos).",
          },
          {
            term: "FURAT",
            def: "Formato del reporte de un accidente de trabajo a la ARL. La plataforma prepara los datos para diligenciarlo.",
          },
          {
            term: "GTC 45",
            def: "Guía técnica para identificar peligros y valorar riesgos; es la base de la **matriz de peligros**.",
          },
          {
            term: "NR (nivel de riesgo)",
            def: "Resultado de multiplicar deficiencia, exposición y consecuencia. Define la clase de riesgo (I a IV) y qué tan urgente es intervenir.",
          },
          { term: "PESV", def: "Plan Estratégico de Seguridad Vial." },
          {
            term: "SGA / FDS",
            def: "Sistema Globalmente Armonizado de clasificación de químicos / Ficha de Datos de Seguridad de un producto.",
          },
          { term: "EPP", def: "Elementos de protección personal." },
          { term: "PVE", def: "Programa de vigilancia epidemiológica." },
          {
            term: "Matriz legal",
            def: "Lista de normas y requisitos aplicables y su estado de cumplimiento en tu empresa.",
          },
          {
            term: "Solo lectura",
            def: "Estado de una cuenta suspendida por mora: puedes consultar pero no editar.",
          },
        ],
      },
    ],
  },
  {
    slug: "preguntas-frecuentes",
    title: "Preguntas frecuentes",
    group: "Referencia",
    icon: "CircleHelp",
    summary: "Respuestas rápidas a lo que más se pregunta.",
    keywords: ["no puedo", "no me llega", "error", "olvidé", "problema", "ayuda"],
    related: ["primeros-pasos", "roles", "sin-conexion"],
    blocks: [
      {
        t: "defs",
        items: [
          {
            term: "No me llega el correo del enlace de acceso",
            def: "Revisa spam. Pide el enlace de nuevo (vence en pocos minutos y es de un solo uso). Si sigue sin llegar, avisa al administrador de la plataforma.",
          },
          {
            term: "Dice que no estoy invitado",
            def: "Tu correo debe estar invitado en **Usuarios y roles**. Pídele al administrador que te invite con ese mismo correo.",
          },
          {
            term: "No veo un módulo",
            def: "Tu rol no lo incluye. Mira *Roles y permisos* y pide al administrador que revise tu rol.",
          },
          {
            term: "Mi cuenta está en solo lectura",
            def: "La suscripción está suspendida por un pago pendiente. El administrador debe regularizarlo en **Facturación**.",
          },
          {
            term: "No puedo aprobar mi propio documento o permiso",
            def: "Es por diseño (separación de funciones): lo debe aprobar otra persona con permiso de aprobación.",
          },
          {
            term: "Quiero corregir algo que ya cerré o aprobé",
            def: "Lo cerrado o aprobado es **inmutable** (autoevaluación cerrada, matriz de peligros aprobada, documentos vigentes, revisión firmada). Se corrige creando una **nueva versión**.",
          },
          {
            term: "¿Se puede borrar un registro?",
            def: "Los registros obligatorios (personas retiradas, accidentes, evaluaciones…) **no se borran**: se conservan para cumplir los plazos de ley. Puedes marcarlos como retirados, cerrados o cancelados.",
          },
          {
            term: "¿Quién ve los datos de salud o de convivencia?",
            def: "Solo los roles autorizados. Los datos están cifrados y cada lectura queda registrada.",
          },
          {
            term: "Mis colores o logo no aparecen",
            def: "Configúralos en **Onboarding → Marca**. El tema oscuro usa su propia paleta, salvo que definas colores propios.",
          },
          {
            term: "Mi pantalla se ve rara o cortada en el celular",
            def: "Recarga la página. Si instalaste la app, ciérrala y ábrela de nuevo. Si persiste, cuéntale al administrador qué pantalla es.",
          },
        ],
      },
    ],
  },
];
