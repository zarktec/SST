import type { Article } from "../types";

/** Salud (medicina del trabajo, vigilancia) y Prevención y respuesta (reportes, inspecciones, accidentes, emergencias, alto riesgo, químicos, PESV). */
export const HEALTH_PREVENTION: Article[] = [
  {
    slug: "medicina",
    title: "Medicina del trabajo",
    group: "Salud",
    icon: "Stethoscope",
    summary:
      "Evaluaciones médicas ocupacionales, concepto de aptitud, adaptaciones del puesto y ausentismo.",
    module: "medical",
    route: "/medicina",
    who: "Responsable del SG-SST y quien gestione la salud ocupacional.",
    keywords: [
      "examen médico",
      "ingreso",
      "periódico",
      "egreso",
      "aptitud",
      "restricciones",
      "ips",
      "ausentismo",
      "incapacidad",
      "retorno",
    ],
    related: ["vigilancia", "personas", "privacidad"],
    blocks: [
      {
        t: "warn",
        text: "Aquí no se guarda la historia clínica. El **concepto de aptitud** y las **restricciones** se guardan **cifrados**, solo los ve el rol autorizado y cada lectura queda registrada.",
      },
      {
        t: "steps",
        title: "Programar y registrar una evaluación",
        items: [
          "Ve a **Menú → Medicina del trabajo** y pulsa **Programar evaluación**: elige la **persona**, el **tipo de evaluación** (ingreso, periódica, egreso, retorno…), la **fecha programada**, la **IPS** y el **costo estimado**. Puedes escribir **observaciones de la solicitud** (los exámenes que pides).",
          "La plataforma **bloquea pruebas discriminatorias**: si pides prueba de embarazo, VIH o serología, no deja guardar y te explica por qué (no son exigibles).",
          "Cuando la persona se hace el examen, pulsa **Registrar resultado** en esa evaluación: **fecha de realización**, **concepto de aptitud** (apto, apto con restricciones, etc.), **recomendaciones**, **restricciones** y el **costo asumido por el empleador**.",
        ],
      },
      {
        t: "steps",
        title: "Adaptar el puesto cuando hay restricciones",
        items: [
          "Si el concepto es **apto con restricciones**, aparece **Adaptación del puesto pendiente** (hay un plazo de unos 20 días).",
          "Cuando hagas la adaptación, pulsa **Registrar adaptación** y describe la **adaptación realizada**.",
          "Para enviar las recomendaciones a la IPS usa **Enviar a la IPS** dentro de la evaluación (escribe el **correo de la IPS**).",
        ],
      },
      {
        t: "list",
        title: "Alertas de esta pantalla",
        items: [
          "**Evaluación periódica vencida**, según la periodicidad de cada tipo.",
          "**Evaluación de retorno laboral pendiente** cuando alguien estuvo ausente más de 90 días.",
        ],
      },
      {
        t: "steps",
        title: "Ausentismo e incapacidades",
        items: [
          "Dentro de Medicina del trabajo abre **Ausentismo e incapacidades**.",
          "Pulsa **Registrar ausencia**: **persona**, **causa** (enfermedad común, accidente de trabajo, etc.), **inicio** y **fin** (déjalo vacío si sigue en curso) y una observación.",
          "Cuando la persona regrese, pulsa **Cerrar ausencia** y pon la **fecha de regreso**.",
          "Arriba verás el **% de ausentismo**, que alimenta los indicadores.",
        ],
      },
    ],
  },
  {
    slug: "vigilancia",
    title: "Vigilancia epidemiológica y riesgo psicosocial",
    group: "Salud",
    icon: "Activity",
    summary:
      "Programas de vigilancia, casos con seguimiento cifrado y batería de riesgo psicosocial.",
    module: "medical",
    route: "/vigilancia",
    who: "Responsable del SG-SST y profesionales de salud ocupacional.",
    keywords: ["pve", "osteomuscular", "psicosocial", "batería", "caso", "seguimiento", "programa"],
    related: ["medicina", "acciones"],
    blocks: [
      {
        t: "steps",
        title: "Programas de vigilancia (PVE)",
        items: [
          "Ve a **Menú → Vigilancia** y pulsa **Crear programa**: **nombre** (p. ej., «PVE osteomuscular»), **tipo**, **objetivo**, **población objetivo** y **fecha de inicio**.",
          "Dentro del programa, **Programar actividad** (actividad y fecha prevista) y, cuando se haga, **Registrar realización** (fecha y participantes).",
          "Cuando el programa termine, pulsa **Cerrar programa**.",
        ],
      },
      {
        t: "steps",
        title: "Casos y seguimientos",
        items: [
          "Pulsa **Abrir un caso**: elige el **programa**, la **persona**, la **fecha de apertura**, el **nivel de riesgo**, el **resumen del caso** y el **próximo seguimiento**.",
          "Abre el caso (clic en el nombre) y pulsa **Registrar seguimiento** cada vez que haya uno: **fecha**, **seguimiento** y **próximo seguimiento**. Cuando termine, **Cerrar caso**.",
        ],
      },
      {
        t: "warn",
        text: "El resumen y los seguimientos se guardan **cifrados** y **sin historia clínica**. No escribas diagnósticos detallados. Cada lectura queda registrada.",
      },
      {
        t: "steps",
        title: "Batería de riesgo psicosocial",
        items: [
          "En **Vigilancia → Riesgo psicosocial** pulsa **Registrar aplicación**.",
          "Indica la **fecha de aplicación**, el **psicólogo(a)** y su **licencia en seguridad y salud en el trabajo**, la **población evaluada** y el **nivel de riesgo resultante**.",
          "En **Plan de intervención** escribe **una acción por línea**: cada una se convierte en una **acción** (CAPA) con el responsable que indiques.",
          "La plataforma avisa cuando la batería está **vencida** según la periodicidad que corresponde al nivel de riesgo.",
        ],
      },
    ],
  },
  {
    slug: "reportes",
    title: "Reportar actos y condiciones inseguras",
    group: "Prevención y respuesta",
    icon: "ShieldAlert",
    summary: "Cualquier persona puede reportar lo que ve; quien revisa lo convierte en una acción.",
    module: "unsafe_reports",
    route: "/reportes",
    who: "Todas las personas reportan; el responsable y los revisores gestionan.",
    keywords: [
      "reporte",
      "condición insegura",
      "acto inseguro",
      "anónimo",
      "peligro",
      "casi accidente",
    ],
    related: ["acciones", "inspecciones"],
    blocks: [
      {
        t: "steps",
        title: "Reportar (cualquier persona)",
        items: [
          "Ve a **Menú → Actos y condiciones** (o al acceso rápido **Reportar una condición insegura** de Inicio) y pulsa **Reportar acto o condición insegura**.",
          "Cuenta **qué viste**, el **lugar** (opcional) y la **sede**. Indica **qué tan grave parece**.",
          "Si prefieres no identificarte, marca **Enviar de forma anónima**: tu nombre no se guarda en el reporte.",
          "Pulsa **Enviar reporte**. Lo ves en la lista **Mis reportes** con su estado.",
        ],
      },
      {
        t: "steps",
        title: "Revisar (responsable o revisor)",
        items: [
          "La lista muestra **Reportes de la empresa**. En cada uno pulsa **Revisar**.",
          "Elige la **decisión**: **Crear una acción** (indica la acción, el responsable y la fecha límite; el reporte queda **Con acción** y verás el enlace **Ver la acción**) o **Descartar** (escribe el **motivo del descarte**).",
          "Pulsa **Registrar revisión**.",
        ],
      },
      {
        t: "tip",
        text: "Reportar es rápido y se puede hacer desde el celular. Un buen reporte tiene **qué, dónde y qué tan grave**: con eso el responsable decide.",
      },
    ],
  },
  {
    slug: "inspecciones",
    title: "Inspecciones",
    group: "Prevención y respuesta",
    icon: "ListChecks",
    summary:
      "Listas de chequeo propias o de la plataforma; los hallazgos se vuelven acciones. Funciona sin conexión.",
    module: "inspections",
    route: "/inspecciones",
    who: "Responsable del SG-SST, COPASST, jefes de área e inspectores.",
    keywords: [
      "inspección",
      "lista de chequeo",
      "plantilla",
      "hallazgo",
      "locativa",
      "sin conexión",
      "checklist",
    ],
    related: ["acciones", "sin-conexion"],
    blocks: [
      {
        t: "steps",
        title: "Crear tu propia plantilla",
        items: [
          "Ve a **Menú → Inspecciones** y pulsa **Nueva plantilla**.",
          "Escribe el **nombre** (p. ej., «Inspección locativa»), la **categoría** y los **ítems, uno por línea**. Empieza la línea con **\\*** si el ítem es **obligatorio**.",
          "Pulsa **Guardar plantilla**. Aparece en **Plantillas de la empresa**. También hay **Plantillas de la plataforma** que puedes usar tal cual; con **Editar** ajustas las de tu empresa.",
        ],
      },
      {
        t: "steps",
        title: "Hacer una inspección",
        items: [
          "En **Iniciar una inspección** elige la plantilla.",
          "Escribe el **lugar** (y la sede). Para cada ítem pulsa **Cumple**, **No cumple** o **No aplica**.",
          "Si marcas **No cumple**, **describe el hallazgo** (es obligatorio). Puedes agregar **observaciones generales**.",
          "Pulsa **Enviar inspección**. Verás el resultado en **Inspecciones realizadas**.",
        ],
      },
      {
        t: "list",
        title: "Resultados",
        items: [
          "Abre una inspección realizada para ver los **resultados** ítem por ítem.",
          "Cada hallazgo crea automáticamente una **acción** («Corregir hallazgo: …») que aparece en **Acciones generadas** y en el módulo **Acciones**.",
        ],
      },
      {
        t: "tip",
        text: "Si estás en un lugar sin señal, haz la inspección igual: queda guardada y **se envía sola** cuando vuelve la conexión. Mira *Trabajar sin conexión*.",
      },
    ],
  },
  {
    slug: "accidentes",
    title: "Accidentes e incidentes de trabajo",
    group: "Prevención y respuesta",
    icon: "Siren",
    summary:
      "Reporte del evento, plazos ante la ARL y la EPS, investigación, plan de acción y enfermedad laboral.",
    module: "incidents",
    route: "/accidentes",
    who: "Cualquier persona reporta; el responsable del SG-SST investiga y cierra.",
    keywords: [
      "accidente",
      "incidente",
      "arl",
      "eps",
      "furat",
      "investigación",
      "causas",
      "enfermedad laboral",
      "lesión",
    ],
    related: ["acciones", "informes", "emergencias"],
    blocks: [
      {
        t: "steps",
        title: "1. Reportar el evento",
        items: [
          "Ve a **Menú → Accidentes e incidentes** (o al acceso rápido de Inicio) y pulsa **Reportar evento**.",
          "Elige el **tipo** (accidente con lesión o incidente sin lesión) y la **gravedad** (sin lesión, leve, grave, mortal). Indica la **persona afectada** (de la lista o escribe su nombre), la **fecha**, la **hora**, el **lugar**, la **actividad**, la **parte del cuerpo**, el **tipo de lesión**, los **testigos** y **qué pasó**.",
          "Pulsa **Reportar evento**. La plataforma te dice el **plazo para informar a la ARL y a la EPS**, calculado en días hábiles.",
        ],
      },
      {
        t: "steps",
        title: "2. Informar a la ARL y a la EPS",
        items: [
          "Abre el evento. Arriba ves si el reporte está **en plazo**, **vence hoy** o está **vencido**. Los pendientes también salen en una tarjeta de la pantalla principal y en **Alertas**.",
          "Cuando lo informes, pulsa **Registrar reporte**: **fecha de reporte a la ARL**, **número de reporte** y **fecha a la EPS** (vacío = la misma).",
          "El enlace **Ver datos precargados del FURAT** muestra toda la información lista para diligenciar el formato de la ARL.",
        ],
      },
      {
        t: "steps",
        title: "3. Investigar",
        items: [
          "Pulsa **Abrir investigación** y luego **Registrar investigación**: **jefe inmediato o supervisor**, **representante del COPASST / Vigía**, **responsable del SG-SST** y, en accidentes graves o mortales, el **profesional con licencia en SST**. Elige la **metodología**.",
          "En **Análisis** escribe **una causa por línea**, de la más cercana al evento a la raíz (mínimo 3: es la técnica de los 5 porqués). Completa las **causas inmediatas** (actos y condiciones) y las **causas básicas** (factores personales y del trabajo). Pulsa **Guardar investigación**.",
          "Para cada medida, pulsa **Agregar acción**: **acción**, **responsable** y **fecha límite**. Se agrega al **plan de acción** y se crea en el módulo **Acciones**.",
          "Si aplica, pulsa **Remitir a la ARL** con la fecha en que enviaste la investigación y **Registrar lecciones aprendidas** para divulgarlas.",
          "Cuando esté completa, pulsa **Cerrar investigación**. Si falta algo (por ejemplo, el representante del COPASST), el sistema te lo indica.",
        ],
      },
      {
        t: "steps",
        title: "Enfermedad laboral",
        items: [
          "Dentro de **Accidentes e incidentes** abre **Enfermedad laboral** y pulsa **Registrar caso**: **persona afectada**, **diagnóstico** y **fecha de detección**.",
          "Cuando la EPS, la ARL o la junta la califique, pulsa **Calificar**: **calificación**, **quién calificó** y **fecha**.",
        ],
      },
      {
        t: "note",
        text: "Los plazos (reporte a la ARL/EPS e investigación) se calculan según la norma y los **días hábiles y festivos de Colombia**. Son valores **provisionales** hasta que un experto SST los valide.",
      },
    ],
  },
  {
    slug: "emergencias",
    title: "Emergencias",
    group: "Prevención y respuesta",
    icon: "Megaphone",
    summary: "Plan de emergencias por sede, brigada, equipos con vencimiento y simulacros.",
    module: "emergencies",
    route: "/emergencias",
    who: "Responsable del SG-SST y coordinador de la brigada.",
    keywords: [
      "plan de emergencias",
      "brigada",
      "extintor",
      "simulacro",
      "evacuación",
      "botiquín",
      "vulnerabilidad",
    ],
    related: ["acciones", "notificaciones"],
    blocks: [
      {
        t: "steps",
        title: "Plan de prevención, preparación y respuesta",
        items: [
          "Ve a **Menú → Emergencias** y pulsa **Crear o actualizar un plan**.",
          "Elige la **sede** (vacío = plan general), el **nivel de vulnerabilidad**, la **fecha de revisión**, el **análisis de vulnerabilidad**, las **rutas de evacuación y puntos de encuentro** y los **procedimientos operativos normalizados (PON)**. Pulsa **Guardar plan**.",
        ],
      },
      {
        t: "steps",
        title: "Equipos de emergencia",
        items: [
          "Pulsa **Agregar equipo**: **tipo** (extintor, botiquín…), **código o rótulo**, **ubicación**, **sede**, **vence** (recarga o contenido) y **detalle**.",
          "Cuando lo inspecciones o recargues, pulsa **Inspeccionar o renovar**: **fecha**, si está en **buen estado**, **observación** y la **nueva fecha de vencimiento**.",
          "Los equipos vencidos, por vencer o sin inspección al día generan **alertas**. Para sacar uno de servicio usa **Retirar equipo**.",
        ],
      },
      {
        t: "steps",
        title: "Brigada de emergencias",
        items: [
          "Pulsa **Agregar integrante**: **persona**, **rol**, **ingreso a la brigada** y **última capacitación**.",
          "Con **Capacitación o retiro** registras una nueva capacitación o **Retirar de la brigada**.",
        ],
      },
      {
        t: "steps",
        title: "Simulacros",
        items: [
          "Pulsa **Programar simulacro**: **escenario** (p. ej., «evacuación por incendio»), **fecha prevista** y **sede**. Si no se hace, puedes **Cancelar simulacro**.",
          "Cuando lo hagas, pulsa **Registrar resultado**: **fecha de realización**, **participantes**, **minutos de evacuación**, **evaluación** y las **mejoras (una por línea)**. Cada mejora se crea como **acción** con el responsable que indiques.",
          "Si no hay simulacro del año o no hay plan de emergencias, la plataforma lo avisa en **Alertas**.",
        ],
      },
    ],
  },
  {
    slug: "alto-riesgo",
    title: "Tareas de alto riesgo y permisos de trabajo",
    group: "Prevención y respuesta",
    icon: "Construction",
    summary:
      "Permisos firmados (alturas y otros), certificados de las personas y equipos de protección contra caídas.",
    module: "high_risk",
    route: "/alto-riesgo",
    who: "Responsable del SG-SST, coordinadores de trabajo y jefes de área.",
    keywords: [
      "alturas",
      "permiso de trabajo",
      "certificado",
      "arnés",
      "coordinador",
      "rescate",
      "espacios confinados",
      "caliente",
    ],
    related: ["firmas", "emergencias"],
    blocks: [
      {
        t: "steps",
        title: "Preparar",
        items: [
          "La primera vez, en **Tipos de permiso** pulsa **Crear los tipos predeterminados** (trabajo en alturas y otros). Puedes **Editar** su nombre, clase y **duración máxima (horas)**.",
          "En **Certificados de trabajo en alturas**, pulsa **Registrar certificado**: **persona**, **nivel** (trabajador autorizado o coordinador), **entidad que certificó**, **fecha de expedición** y **vence**.",
          "En **Equipos certificados**, pulsa **Agregar equipo**: **código**, **descripción** (arnés, línea de vida…), **última inspección** y **certificación vigente hasta**. Con **Actualizar o retirar** los mantienes.",
        ],
      },
      {
        t: "steps",
        title: "Solicitar un permiso",
        items: [
          "Pulsa el tipo de permiso (p. ej., **Trabajo en alturas**) y luego **Solicitar permiso**.",
          "Completa **lugar**, **sede**, **fecha del trabajo**, **desde y hasta**, **trabajo a realizar**, la **lista de verificación** (cumple, no cumple, no aplica), el **coordinador de trabajo en alturas**, el **plan de rescate** y marca las **personas autorizadas** que trabajarán.",
          "Firma como **solicitante** y pulsa **Solicitar permiso**.",
          "La plataforma **bloquea** el permiso si alguna persona o el coordinador **no tienen certificado vigente**, y te dice quién.",
        ],
      },
      {
        t: "steps",
        title: "Autorizar y cerrar",
        items: [
          "**Otra persona** con permiso de aprobación abre el permiso y pulsa **Autorizar con mi firma**. Quien solicitó **no puede autorizar** su propio permiso.",
          "Al terminar el trabajo, pulsa **Cerrar el permiso** y escribe las **novedades al cierre**. Si no se hace, puedes **Cancelar** con un **motivo**.",
          "Los permisos vencidos sin cerrar, y los certificados y equipos vencidos o por vencer, generan **alertas**.",
        ],
      },
    ],
  },
  {
    slug: "quimicos",
    title: "Riesgo químico (SGA)",
    group: "Prevención y respuesta",
    icon: "FlaskConical",
    summary:
      "Inventario de sustancias con pictogramas, fichas de seguridad y alerta de almacenamiento incompatible.",
    module: "chemicals",
    route: "/quimicos",
    who: "Responsable del SG-SST y encargados de bodega.",
    keywords: [
      "químicos",
      "sustancias",
      "fds",
      "ficha de seguridad",
      "pictograma",
      "incompatible",
      "sga",
      "etiquetado",
    ],
    related: ["emergencias", "acciones"],
    blocks: [
      {
        t: "steps",
        items: [
          "Ve a **Menú → Riesgo químico** y pulsa **Agregar sustancia**.",
          "Escribe el **nombre del producto**, **número CAS**, **proveedor**, **lugar de almacenamiento**, **cantidad**, **sede**, la **palabra de advertencia** y las **indicaciones de peligro (frases H)**. Marca los **pictogramas** SGA que trae la etiqueta (p. ej., inflamable, comburente). Anota la **fecha de la FDS** si la tienes. Pulsa **Agregar sustancia**.",
          "La plataforma revisa la **compatibilidad**: si dos sustancias que no deben almacenarse juntas están en el mismo lugar, muestra una alerta (por ejemplo, «Inflamable con Comburente»). Esta matriz es **provisional**.",
          "Las sustancias **sin FDS** se marcan en rojo. Cuando consigas la ficha, abre **Editar o retirar** y pulsa **Registrar revisión** (**FDS revisada el** y **etiquetado verificado el**).",
          "Para sacar una sustancia del inventario usa **Retirar del inventario**.",
        ],
      },
      {
        t: "note",
        text: "Las sustancias sin FDS, con FDS por revisar o con almacenamiento incompatible generan **alertas**.",
      },
    ],
  },
  {
    slug: "pesv",
    title: "Seguridad vial (PESV)",
    group: "Prevención y respuesta",
    icon: "Car",
    summary:
      "Vehículos, conductores, inspección preoperacional, siniestros y datos del reporte anual.",
    module: "pesv",
    route: "/pesv",
    who: "Responsable del PESV y conductores. Módulo opcional según tu plan.",
    keywords: [
      "pesv",
      "vehículos",
      "conductores",
      "soat",
      "tecnomecánica",
      "licencia",
      "preoperacional",
      "siniestro",
    ],
    related: ["acciones"],
    blocks: [
      {
        t: "note",
        text: "El módulo PESV puede no estar incluido en tu plan. Si no lo ves en el menú, revisa **Facturación** o pide a tu administrador que cambie de plan.",
      },
      {
        t: "steps",
        title: "Vehículos y conductores",
        items: [
          "En **Vehículos** pulsa **Agregar vehículo**: **placa**, **tipo**, **propiedad**, **descripción** (marca, línea, modelo), **SOAT vence** y **revisión técnico-mecánica vence**. Se muestra si el SOAT y la RTM están vigentes, por vencer o vencidos.",
          "Con **Editar o retirar** actualizas los datos o pulsas **Retirar vehículo**.",
          "En **Conductores** pulsa **Agregar o actualizar licencia**: **persona**, **categoría de la licencia** y **vence**. Las licencias por vencer generan alertas.",
        ],
      },
      {
        t: "steps",
        title: "Inspección preoperacional",
        items: [
          "Pulsa **Registrar preoperacional**: elige el **vehículo**, el **conductor**, la **fecha** y el **kilometraje**.",
          "Recorre la lista: deja marcado lo que está bien y **desmarca** lo que falla, con una **nota**. Una **falla crítica** (por ejemplo, frenos) crea automáticamente una **acción** («Vehículo ABC123: corregir Frenos»).",
        ],
      },
      {
        t: "steps",
        title: "Siniestros y reporte anual",
        items: [
          "Pulsa **Registrar siniestro**: **vehículo**, **conductor**, **fecha**, **hora**, **lugar**, **lesionados**, **muertos**, **responsabilidad del conductor** y **qué pasó**.",
          "La tarjeta **Datos {año} para el reporte anual de autogestión** resume los números que necesitas para reportar.",
        ],
      },
    ],
  },
];
