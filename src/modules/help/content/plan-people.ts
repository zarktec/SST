import type { Article } from "../types";

/** Planear (estándares, matriz legal, peligros, plan anual) y Personas (personas, capacitación, EPP, comités, convivencia, acoso). */
export const PLAN_PEOPLE: Article[] = [
  {
    slug: "estandares",
    title: "Autoevaluación de estándares mínimos",
    group: "Planear",
    icon: "ClipboardCheck",
    summary:
      "Califica cada año los estándares mínimos (Res. 0312) y obtén el puntaje, el rango y el plan de mejoramiento.",
    module: "standards",
    route: "/estandares",
    who: "Responsable del SG-SST (la alta dirección consulta).",
    keywords: [
      "0312",
      "estándares",
      "autoevaluación",
      "puntaje",
      "ministerio",
      "plan de mejoramiento",
      "cumple",
    ],
    related: ["onboarding", "acciones", "plan-anual"],
    blocks: [
      {
        t: "p",
        text: "Los ítems que se califican dependen del grupo de **7, 21 o 60 estándares** que le corresponde a tu empresa (se define en el onboarding). Cada autoevaluación guarda una **copia** de los criterios vigentes en ese momento.",
      },
      {
        t: "steps",
        title: "Hacer la autoevaluación",
        items: [
          "Ve a **Menú → Estándares mínimos**. En **Nueva autoevaluación** pulsa **Iniciar autoevaluación** (una por año).",
          "Se abre la autoevaluación con los ítems agrupados por ciclo PHVA y estándar. En cada ítem elige el **estado**: cumple, no cumple o no aplica.",
          "Agrega la **evidencia** (una descripción o un enlace), el **responsable** y la **fecha límite**. Si marcas *no aplica*, la **justificación** es obligatoria. Pulsa **Guardar ítem** (verás «Guardado.»).",
          "Cuando todos los ítems estén calificados, pulsa **Cerrar autoevaluación** y confirma. Si falta alguno, el sistema te dice cuántos («Faltan N ítems por calificar»).",
        ],
      },
      {
        t: "list",
        title: "Qué pasa al cerrar",
        items: [
          "Se calcula el **puntaje** y el **rango** (crítico, moderadamente aceptable o aceptable) y se guarda en el **historial** con su tendencia año a año.",
          "La autoevaluación queda **inmutable**: no se puede cambiar. Para el próximo año se crea una nueva.",
          "Cada ítem que **no cumple** crea automáticamente una acción en el **Plan de mejoramiento** (y en *Acciones*).",
        ],
      },
      {
        t: "steps",
        title: "Plan de mejoramiento y registro ante el Ministerio",
        items: [
          "En **Plan de mejoramiento** (enlace dentro de Estándares) verás cada acción con su responsable y fecha. Pulsa **Editar** para actualizar el responsable, la fecha, el estado y **cómo se cerró** (obligatorio al cerrar).",
          "Con la autoevaluación cerrada, pulsa **Registrar ante el Ministerio** y anota la fecha en que la registraste en la plataforma del Ministerio del Trabajo.",
        ],
      },
      {
        t: "warn",
        text: "Si la pantalla dice que no hay un catálogo de estándares, el administrador de la plataforma debe **cargar y publicar el catálogo oficial** (módulo Catálogos del panel de administración). Mientras tanto no se puede iniciar la autoevaluación.",
      },
      {
        t: "tip",
        text: "La plataforma te recuerda cuándo aplicar la autoevaluación y cuándo registrarla. Esos avisos aparecen en **Inicio** y en **Alertas**.",
      },
    ],
  },
  {
    slug: "matriz-legal",
    title: "Matriz legal",
    group: "Planear",
    icon: "Scale",
    summary: "Normas y requisitos aplicables a tu empresa y su estado de cumplimiento.",
    module: "legal_matrix",
    route: "/matriz-legal",
    who: "Responsable del SG-SST.",
    keywords: ["normas", "decreto", "resolución", "cumplimiento", "aplica", "legal"],
    related: ["estandares", "informes"],
    blocks: [
      {
        t: "p",
        text: "La plataforma incluye la base de normas de SST que mantiene el administrador de la plataforma. Tu trabajo es **evaluar** cada norma y requisito: ¿aplica a tu empresa? y, si aplica, ¿se cumple?",
      },
      {
        t: "steps",
        title: "Evaluar una norma",
        items: [
          "Ve a **Menú → Matriz legal**. Cada norma o requisito muestra una etiqueta: **Sin evaluar**, **No aplica** o su estado de cumplimiento.",
          "Pulsa **Evaluar** (o **Editar** si ya la evaluaste).",
          "Responde **¿Aplica a la empresa?** Si no aplica, escribe la **justificación** (obligatoria).",
          "Si aplica, indica el **cumplimiento**, la **evidencia**, el **responsable**, la **próxima revisión** y las **notas**. Pulsa **Guardar**.",
          "Usa **Ver norma** para abrir el texto de la norma.",
        ],
      },
      {
        t: "tip",
        text: "En **Inicio** aparece un aviso cuando hay normas sin evaluar o cuando se agregan normas nuevas a la base. Evalúalas para mantener la matriz al día.",
      },
    ],
  },
  {
    slug: "peligros",
    title: "Matriz de peligros y valoración de riesgos (GTC 45)",
    group: "Planear",
    icon: "TriangleAlert",
    summary: "Identifica peligros por proceso, valóralos automáticamente y define controles.",
    module: "hazard_matrix",
    route: "/peligros",
    who: "Responsable del SG-SST, con participación de los trabajadores.",
    keywords: [
      "peligros",
      "riesgo",
      "gtc 45",
      "nivel de riesgo",
      "deficiencia",
      "exposición",
      "consecuencia",
      "controles",
    ],
    related: ["plan-anual", "acciones", "inspecciones"],
    blocks: [
      {
        t: "steps",
        title: "Crear la matriz y agregar peligros",
        items: [
          "Ve a **Menú → Matriz de peligros**. Si es la primera vez, pulsa **Crear matriz**. Más adelante, para una versión nueva elige el motivo: **Revisión anual**, **Por accidente grave** o **Por cambio en el proceso**.",
          "Pulsa **Agregar peligro** y completa: **Proceso, Actividad, Tarea**, si es rutinaria, **Familia del peligro**, **Peligro**, **Posibles efectos** y **Trabajadores expuestos** (puedes indicar la **Sede**).",
          "Elige los niveles de **deficiencia**, **exposición** y **consecuencia**. La plataforma **calcula el nivel de riesgo** y su clase (I a IV) automáticamente, y te dice qué tan urgente es intervenir.",
          "Agrega los **controles** existentes y propuestos, ordenados por la jerarquía: eliminar, sustituir, controles de ingeniería, administrativos y EPP.",
        ],
      },
      {
        t: "steps",
        title: "Aprobar la matriz",
        items: [
          "Pulsa **Registrar participación** y describe **quiénes y cómo** participaron los trabajadores en la identificación de peligros.",
          "Pulsa **Aprobar matriz** y confirma. Sin el registro de participación, la plataforma no deja aprobar.",
          "La matriz aprobada queda **inmutable**. Para cambiarla crea una **nueva versión**; el **historial de versiones** conserva todas.",
        ],
      },
      {
        t: "tip",
        text: "Los peligros de riesgo alto pueden sugerir actividades para el **Plan anual**. También verás un aviso cuando toque la **revisión anual**.",
      },
    ],
  },
  {
    slug: "plan-anual",
    title: "Plan anual de trabajo",
    group: "Planear",
    icon: "CalendarCheck",
    summary:
      "El cronograma de actividades del año, su avance y las firmas del empleador y del responsable.",
    module: "annual_plan",
    route: "/plan-anual",
    who: "Responsable del SG-SST y alta dirección.",
    keywords: ["cronograma", "actividades", "avance", "firma", "evidencia", "phva"],
    related: ["estandares", "peligros", "firmas"],
    blocks: [
      {
        t: "steps",
        items: [
          "Ve a **Menú → Plan anual** y pulsa **Crear plan {año}** (el botón muestra el año).",
          "Pulsa **Agregar actividad**: nombre de la **actividad**, **ciclo PHVA**, **responsable**, **inicio** y **fin**. Verás sugerencias de actividades a partir de tu plan de mejoramiento y de la matriz de peligros.",
          "Para avanzar una actividad pulsa **Gestionar**, cambia el **estado** y pulsa **Guardar estado**. Para marcarla como realizada debes escribir la **evidencia** (por ejemplo, «Acta 3 de la alta dirección»).",
          "El **% de cumplimiento** del plan se calcula solo con las actividades realizadas.",
          "Cuando esté listo, firma con **Firmar como empleador** y **Firmar como responsable del SG-SST**. La pantalla muestra «Firmas: empleador ✓ · responsable pendiente».",
        ],
      },
      {
        t: "note",
        text: "Las actividades vencidas aparecen en **Alertas** y en el **Calendario**.",
      },
    ],
  },
  {
    slug: "personas",
    title: "Personas (trabajadores y contratistas)",
    group: "Personas",
    icon: "Users",
    summary:
      "El registro de todas las personas vinculadas: ficha, carga masiva, retiros y seguridad social de contratistas.",
    module: "workers",
    route: "/personas",
    who: "Responsable del SG-SST y apoyo.",
    keywords: [
      "trabajadores",
      "contratistas",
      "carga masiva",
      "csv",
      "retiro",
      "seguridad social",
      "documento",
      "aprendiz",
    ],
    related: ["capacitacion", "epp", "medicina", "usuarios"],
    blocks: [
      {
        t: "steps",
        title: "Registrar una persona",
        items: [
          "Ve a **Menú → Personas** y pulsa **Registrar**.",
          "Completa la **vinculación** (trabajador, aprendiz o contratista), **tipo y número de documento**, **nombre completo**, cargo, área, **sede**, **tipo de contrato**, **fecha de ingreso** y, si la persona va a ingresar a la plataforma, su **correo** (el mismo con el que ingresará).",
          "Pulsa **Registrar**. Verás «Persona registrada». Si el documento ya existe, el sistema avisa y no duplica.",
        ],
      },
      {
        t: "steps",
        title: "Carga masiva con un archivo CSV",
        items: [
          "Pulsa **Carga masiva** y descarga la **plantilla** (`plantilla-personas.csv`).",
          "Llénala en Excel (una persona por fila) y guárdala como **CSV**. Obligatorias: vinculación, tipo de documento, documento, nombre y fecha de ingreso (AAAA-MM-DD o DD/MM/AAAA). La sede se escribe igual que está registrada.",
          "Sube el archivo y pulsa **Importar**. El resultado indica cuántas filas se importaron, cuáles se omitieron (ya existían) y cuáles tienen error, con el **número de fila** y el motivo.",
        ],
      },
      {
        t: "list",
        title: "La ficha de cada persona",
        items: [
          "Pulsa el nombre en la lista para abrir la ficha. **Editar datos** cambia la información.",
          "El documento se guarda **cifrado**; en las listas solo ves los últimos 4 dígitos.",
          "**Registrar retiro**: indica la fecha de retiro. La persona deja de contar como activa pero **su registro se conserva** (mínimo 20 años).",
          "Los filtros de la lista (buscar, vinculación, sede, estado) te ayudan a encontrar personas; por defecto ves los activos.",
        ],
      },
      {
        t: "steps",
        title: "Seguridad social de contratistas",
        items: [
          "Cada mes se debe verificar el pago de la seguridad social de los contratistas. Los pendientes aparecen en una tarjeta arriba de la lista.",
          "Abre la ficha del contratista, pulsa **Verificar seguridad social**, elige el **periodo**, marca si está pagado, agrega una observación (planilla, soporte) y pulsa **Registrar verificación**.",
        ],
      },
      {
        t: "warn",
        text: "Tu plan limita cuántas personas puedes registrar. Al llegar al límite, el sistema no deja agregar más hasta cambiar de plan.",
      },
    ],
  },
  {
    slug: "capacitacion",
    title: "Capacitación",
    group: "Personas",
    icon: "GraduationCap",
    summary:
      "Cursos con evaluación, sesiones con asistencia por QR y firma, certificados y matriz de competencias.",
    module: "training",
    route: "/capacitacion",
    who: "Responsable del SG-SST, capacitadores y jefes de área.",
    keywords: [
      "curso",
      "sesión",
      "qr",
      "asistencia",
      "certificado",
      "evaluación",
      "inducción",
      "competencias",
    ],
    related: ["personas", "firmas", "portal"],
    blocks: [
      {
        t: "steps",
        title: "1. Crear un curso",
        items: [
          "En **Capacitación** abre **Cursos y evaluaciones** y pulsa **Nuevo curso**.",
          "Escribe el **nombre**, el **tipo**, la **descripción**, la **intensidad (horas)** y la **vigencia (meses)** si el curso vence (vacío = no vence). Si tendrá evaluación, define el **puntaje mínimo** (1-100). Pulsa **Crear curso**.",
          "Para agregar la evaluación pulsa **Editar** en el curso y escribe las preguntas en el campo de **Evaluación**: una pregunta por bloque, con las opciones debajo; **la opción correcta empieza con \\***. Ejemplo:\n¿Qué es un EPP?\n* Elemento de protección personal\nUn juego\nPulsa **Guardar evaluación**.",
        ],
      },
      {
        t: "steps",
        title: "2. Programar una sesión y tomar asistencia",
        items: [
          "En **Capacitación** pulsa **Programar sesión**: elige el **curso**, la **fecha**, el **lugar** y el **capacitador**.",
          "Abre la sesión y pulsa **Abrir sesión**: se muestra un **código QR** y un enlace.",
          "Cada asistente escanea el QR con su celular (**sin iniciar sesión**), escribe su **número de documento**, responde la evaluación si la hay, **firma** y pulsa **Registrar mi asistencia**. Ve el resultado al instante.",
          "Si alguien no puede usar el celular, pulsa **Registrar asistencia manual** y regístralo tú.",
        ],
      },
      {
        t: "list",
        title: "Después de la sesión",
        items: [
          "En la sesión ves la lista de **asistentes**, quién aprobó y su puntaje. Cada asistente tiene su **certificado en PDF**.",
          "Las capacitaciones con vigencia se muestran con su vencimiento en la **matriz de competencias**.",
          "En **Matriz de competencias** defines **qué cursos exige cada cargo** (con **Agregar**) y ves quién los tiene vigentes y quién no.",
        ],
      },
      {
        t: "tip",
        text: "El enlace del QR registra los intentos para evitar que alguien adivine documentos: después de varios intentos fallidos tendrás que esperar unos minutos.",
      },
    ],
  },
  {
    slug: "epp",
    title: "Elementos de protección personal (EPP)",
    group: "Personas",
    icon: "HardHat",
    summary: "Catálogo, inventario, matriz por cargo y entregas con firma del trabajador.",
    module: "ppe",
    route: "/epp",
    who: "Responsable del SG-SST y apoyo.",
    keywords: ["epp", "casco", "inventario", "entrega", "reposición", "talla", "vida útil"],
    related: ["personas", "firmas"],
    blocks: [
      {
        t: "steps",
        title: "Preparar el catálogo",
        items: [
          "En **EPP**, abre **Catálogo, inventario y matriz**.",
          "Pulsa **Agregar elemento**: **nombre del EPP**, categoría, proveedor, **vida útil (meses)**, **inventario mínimo** y si exige talla. Pulsa **Crear EPP**.",
          "Para registrar compras o ajustes pulsa **Registrar movimiento de inventario**: elige el EPP, la **cantidad** y la fecha, y pulsa **Registrar ingreso**.",
          "En **Matriz por cargo** define **qué EPP exige cada cargo** (el cargo se escribe igual que en la ficha de la persona).",
        ],
      },
      {
        t: "steps",
        title: "Entregar un EPP",
        items: [
          "En **EPP** pulsa **Registrar entrega**.",
          "Elige la **persona**, el **EPP**, la **cantidad**, la **talla** (si aplica), el **motivo** (primera entrega o reposición) y la **fecha**.",
          "El trabajador **firma** («recibe conforme») en el recuadro. Pulsa **Registrar entrega**.",
          "La entrega descuenta el inventario y aparece en **Últimas entregas** y en el portal del trabajador.",
        ],
      },
      {
        t: "note",
        text: "La plataforma calcula cuándo se vence cada EPP según su **vida útil** para que programes la **reposición**, y el catálogo muestra el inventario frente al **mínimo** que definiste.",
      },
    ],
  },
  {
    slug: "comites",
    title: "Comités: COPASST y Vigía SST",
    group: "Personas",
    icon: "UsersRound",
    summary:
      "Elecciones electrónicas con voto secreto, conformación del comité, actas y compromisos.",
    module: "committees",
    route: "/comites",
    who: "Responsable del SG-SST; miembros del comité.",
    keywords: [
      "copasst",
      "vigía",
      "elecciones",
      "votación",
      "candidatos",
      "acta",
      "compromisos",
      "escrutinio",
    ],
    related: ["convivencia", "personas"],
    blocks: [
      {
        t: "p",
        text: "Según el tamaño de tu empresa, el comité es un **COPASST** o un **Vigía SST**. Puedes conformarlo **directamente** (enlace **Registrar conformación existente**, si ya tienes el acta de elección) o por **elección electrónica**.",
      },
      {
        t: "steps",
        title: "Elección electrónica",
        items: [
          "En **Comités** pulsa **Convocar elección**: define cuántos **principales** y **suplentes** de los trabajadores se elegirán, el **inicio del periodo** y las fechas de **apertura** y **cierre de la votación**.",
          "En la elección, pulsa **Inscribir candidato** y elige a cada persona (puedes inscribir varias).",
          "Pulsa **Cerrar inscripción y abrir votación**. Pulsa **Descargar enlaces (CSV)**: cada trabajador activo tiene un **enlace personal de un solo uso**. Envíaselo por el medio que uses (correo, mensajería).",
          "Cada persona abre su enlace (**sin iniciar sesión**), marca a su candidato y pulsa **Votar**. El voto es **secreto**: la plataforma sabe que votó, no por quién. El mismo enlace no vota dos veces.",
          "Cuando termine el plazo, pulsa **Cerrar votación y escrutar**: verás los votos por candidato. Si hay un **empate**, usa **Resolver empate** y explica **cómo se resolvió** (obligatorio).",
          "Con el resultado, pulsa **Conformar el comité con el resultado**: indica el **inicio del periodo** y marca los **representantes del empleador** (principales y suplentes). El comité queda conformado.",
        ],
      },
      {
        t: "steps",
        title: "Reuniones, actas y compromisos",
        items: [
          "Abre el comité y pulsa **Registrar acta**: **fecha**, **orden del día**, **desarrollo y decisiones** y los **compromisos** (uno por línea: *descripción | responsable | AAAA-MM-DD*).",
          "Cada compromiso aparece en **Compromisos**. Cuando se cumpla, pulsa **Cerrar compromiso** y escribe **cómo se cumplió**.",
          "Cuando el periodo del comité termina, convoca una nueva elección para renovarlo.",
        ],
      },
    ],
  },
  {
    slug: "convivencia",
    title: "Convivencia laboral (Comité de Convivencia)",
    group: "Personas",
    icon: "HeartHandshake",
    summary:
      "Quejas confidenciales de acoso laboral, trámite con plazos y acuerdo de confidencialidad del comité.",
    module: "ccl",
    route: "/convivencia",
    who: "Miembros del Comité de Convivencia; cualquier trabajador puede radicar una queja.",
    keywords: ["acoso laboral", "queja", "ccl", "confidencial", "conciliación", "trámite"],
    related: ["acoso-sexual", "comites"],
    blocks: [
      {
        t: "steps",
        title: "Radicar una queja (cualquier trabajador)",
        items: [
          "Desde **Inicio**, abajo, pulsa **Radicar una queja de convivencia** (o entra a **Convivencia laboral → radicar**).",
          "Describe los hechos (**qué, cuándo, dónde, quién**), indica la sede y, si quieres, la persona a la que se refiere. Pulsa para enviar.",
          "La queja se guarda **cifrada** y solo la ven los miembros del comité que firmaron el acuerdo de confidencialidad.",
        ],
      },
      {
        t: "steps",
        title: "Para el comité",
        items: [
          "Antes de ver quejas, cada miembro debe **Firmar acuerdo de confidencialidad**.",
          "En **Convivencia laboral** ves el comité, el acuerdo y la lista de **Quejas**. Abre una queja para leer el **relato** y el **historial (trazabilidad)**.",
          "Para avanzar, pulsa **Avanzar trámite**, elige el **siguiente paso** y escribe una **nota** (queda cifrada). La plataforma controla los **plazos** de cada etapa y avisa si se vencen.",
          "Cada vez que alguien abre una queja queda un **registro de acceso**.",
          "Si el comité aún no está conformado, regístralo desde la misma pantalla; la plataforma valida las reglas de elegibilidad de los integrantes.",
        ],
      },
      {
        t: "warn",
        text: "Las quejas de convivencia y los reportes de acoso sexual son **canales separados**: lo que llega al uno nunca lo ve el otro.",
      },
    ],
  },
  {
    slug: "acoso-sexual",
    title: "Acoso sexual y violencia de género",
    group: "Personas",
    icon: "ShieldCheck",
    summary: "Canal confidencial separado del Comité de Convivencia para reportar y dar trámite.",
    module: "harassment",
    route: "/acoso-sexual",
    who: "Cualquier persona puede reportar; solo roles autorizados dan trámite.",
    keywords: ["acoso sexual", "violencia de género", "reporte", "confidencial", "ley 2365"],
    related: ["convivencia"],
    blocks: [
      {
        t: "steps",
        title: "Reportar",
        items: [
          "Desde **Inicio**, abajo, pulsa **Reportar acoso sexual o violencia de género**.",
          "Escribe **lo ocurrido** con el detalle que quieras compartir y envía. El relato se guarda **cifrado**.",
        ],
      },
      {
        t: "steps",
        title: "Dar trámite (roles autorizados)",
        items: [
          "Ve a **Menú → Acoso sexual**: verás la lista de **Reportes**.",
          "Abre uno para leer el **relato** y su historial. Pulsa **Actualizar trámite**, elige el **estado** y escribe una **nota** (queda cifrada).",
        ],
      },
      {
        t: "warn",
        text: "Este canal **nunca** se comparte con el Comité de Convivencia. Cada lectura queda registrada.",
      },
    ],
  },
];
