import type { Article } from "../types";

/** Mejora y gestión: acciones (CAPA), indicadores, auditoría interna, revisión por la dirección y documentos. */
export const IMPROVE: Article[] = [
  {
    slug: "acciones",
    title: "Acciones correctivas, preventivas y de mejora (CAPA)",
    group: "Mejora y gestión",
    icon: "Target",
    summary:
      "El lugar donde terminan todos los hallazgos: se asignan, se cierran con evidencia y se verifica su eficacia.",
    module: "actions",
    route: "/acciones",
    who: "Responsable del SG-SST, jefes de área y responsables de cada acción.",
    keywords: [
      "capa",
      "acción correctiva",
      "preventiva",
      "mejora",
      "eficacia",
      "vencida",
      "escalamiento",
      "hallazgo",
    ],
    related: ["inspecciones", "accidentes", "auditorias", "estandares"],
    blocks: [
      {
        t: "p",
        text: "Las acciones nacen de muchos lugares: **inspecciones**, **accidentes**, **auditorías**, **simulacros**, **reportes de condiciones inseguras**, **vigilancia**, la **autoevaluación**, la **revisión por la dirección**… Aquí las ves todas juntas. También puedes crearlas a mano.",
      },
      {
        t: "steps",
        title: "Crear una acción",
        items: [
          "Ve a **Menú → Acciones (CAPA)** y pulsa **Nueva acción**.",
          "Escribe la **acción**, el **tipo** (correctiva, preventiva o de mejora), el **responsable**, la **fecha límite**, el **análisis de causa** y una **descripción**. Pulsa **Crear acción**.",
        ],
      },
      {
        t: "steps",
        title: "Trabajar una acción",
        items: [
          "Abre la acción (clic en su título). Ves el responsable, la fecha, el análisis de causa, el avance y la evidencia.",
          "Pulsa **Cambiar estado** y elige **Pasar a**: en progreso, ejecutada o cancelada. Para **ejecutada** o **cancelada** debes escribir la **evidencia del cierre** o el **motivo**.",
          "Pulsa **Editar** si cambia el responsable, la fecha o la descripción.",
        ],
      },
      {
        t: "steps",
        title: "Verificar la eficacia",
        items: [
          "Cuando la acción esté ejecutada, pulsa **Verificar eficacia**: indica si **fue eficaz** y **cómo se verificó**.",
          "Si **sí**: la acción queda **verificada** y se cierra. Si **no**: se crea una **nueva acción vinculada** para corregir el problema de fondo.",
        ],
      },
      {
        t: "list",
        title: "Mora y escalamiento",
        items: [
          "Una acción pasada de su fecha límite aparece como **vencida** («N d de mora») y genera una **alerta**.",
          "Si sigue vencida, la plataforma **escala** el aviso por niveles a los roles de mayor responsabilidad, sin repetir el mismo nivel.",
          "La pantalla principal resume: **abiertas, vencidas y por verificar**.",
        ],
      },
    ],
  },
  {
    slug: "indicadores",
    title: "Indicadores del SG-SST",
    group: "Mejora y gestión",
    icon: "BarChart3",
    summary: "Indicadores calculados con tus datos reales, su tendencia, metas y análisis.",
    module: "indicators",
    route: "/indicadores",
    who: "Responsable del SG-SST y alta dirección.",
    keywords: [
      "indicadores",
      "frecuencia",
      "severidad",
      "ausentismo",
      "meta",
      "tendencia",
      "análisis",
    ],
    related: ["accidentes", "medicina", "revision-direccion"],
    blocks: [
      {
        t: "p",
        text: "Cada indicador se calcula **solo**, con la fórmula oficial del catálogo y los datos que ya registraste (accidentes, ausentismo, capacitación…). No tienes que digitar nada para que se actualicen.",
      },
      {
        t: "steps",
        items: [
          "Ve a **Menú → Indicadores**. Cada indicador muestra su **valor del periodo**, su **meta** y una **tendencia** de los últimos periodos.",
          "Pulsa **Ver valores por periodo** para el detalle.",
          "Para fijar tu propia meta, pulsa **Definir meta** y escribe la **meta de la empresa** (vacío = usar la de la plataforma). Pulsa **Guardar meta**.",
          "Para documentar qué pasó, pulsa **Registrar análisis** y escribe el **análisis del periodo**. Pulsa **Guardar análisis**.",
        ],
      },
      {
        t: "tip",
        text: "Los indicadores y sus análisis alimentan automáticamente la **revisión por la dirección**.",
      },
    ],
  },
  {
    slug: "auditorias",
    title: "Auditoría interna",
    group: "Mejora y gestión",
    icon: "FileSearch",
    summary:
      "Programa la auditoría, ejecútala con lista de verificación y convierte las no conformidades en acciones.",
    module: "audits",
    route: "/auditorias",
    who: "Responsable del SG-SST y auditores internos.",
    keywords: [
      "auditoría",
      "no conformidad",
      "conforme",
      "lista de verificación",
      "hallazgo",
      "informe",
    ],
    related: ["acciones", "estandares", "revision-direccion"],
    blocks: [
      {
        t: "steps",
        title: "Programar",
        items: [
          "Ve a **Menú → Auditoría interna** y pulsa **Programar auditoría**.",
          "Escribe el **nombre**, la **fecha prevista**, el **alcance** y la **lista de verificación** (un ítem por línea). Si la dejas vacía, la plataforma usa los **criterios de la última autoevaluación de estándares**.",
          "Pulsa **Programar auditoría**.",
        ],
      },
      {
        t: "steps",
        title: "Ejecutar y cerrar",
        items: [
          "En la auditoría pulsa **Ejecutar la auditoría**: **fecha de realización**, **auditor** y **participante del COPASST / Vigía**.",
          "Para cada ítem elige el resultado (**conforme**, **no conformidad menor** o **mayor**) y escribe la nota. Escribe el **informe de auditoría**.",
          "Pulsa **Guardar avance** las veces que necesites. Cuando termines, **Cerrar auditoría** y confirma.",
          "Las **no conformidades** se convierten en **acciones** («NC mayor de auditoría: …»). Si no se hace la auditoría, puedes **Cancelar**.",
        ],
      },
      {
        t: "note",
        text: "Las auditorías **atrasadas** (con fecha prevista vencida) generan una alerta.",
      },
    ],
  },
  {
    slug: "revision-direccion",
    title: "Revisión por la alta dirección",
    group: "Mejora y gestión",
    icon: "ClipboardCheck",
    summary:
      "La revisión anual: entradas automáticas del sistema, conclusiones, decisiones y firma de la alta dirección.",
    module: "management_review",
    route: "/revision-direccion",
    who: "Alta dirección y responsable del SG-SST.",
    keywords: [
      "revisión por la dirección",
      "alta dirección",
      "conclusiones",
      "decisiones",
      "firma",
      "anual",
    ],
    related: ["indicadores", "auditorias", "firmas", "acciones"],
    blocks: [
      {
        t: "steps",
        items: [
          "Ve a **Menú → Revisión por la dirección** y pulsa **Nueva revisión**: **fecha de la reunión** y **asistentes**. Pulsa **Crear la revisión**.",
          "La plataforma llena sola las **Entradas del sistema**: accidentalidad del año, indicadores y otros resultados del sistema. Si pasó algo después, pulsa **Actualizar entradas del sistema**.",
          "Pulsa **Completar la revisión** y escribe los **cambios en el entorno legal**, las **comunicaciones de las partes interesadas**, el **cumplimiento de objetivos y metas**, las **conclusiones** (conveniencia, adecuación y eficacia del sistema) y las **decisiones**.",
          "Escribe las decisiones **una por línea**: cada una se crea como **acción de mejora**; indica el **responsable** y la **fecha límite**. Pulsa **Guardar revisión**.",
          "Cuando esté lista, la alta dirección pulsa **Firmar (alta dirección)**, firma y pulsa **Firmar revisión**. La revisión queda **Firmada**: **se congela** y se crean las acciones.",
        ],
      },
    ],
  },
  {
    slug: "documentos",
    title: "Documentos controlados y política",
    group: "Mejora y gestión",
    icon: "FileText",
    summary:
      "Lista maestra con versiones, aprobación firmada por otra persona y constancia de lectura de la política.",
    module: "documents",
    route: "/documentos",
    who: "Responsable del SG-SST (crea) y alta dirección (aprueba).",
    keywords: [
      "documento",
      "política",
      "versión",
      "aprobar",
      "borrador",
      "lista maestra",
      "lectura",
      "procedimiento",
    ],
    related: ["firmas", "portal", "informes"],
    blocks: [
      {
        t: "p",
        text: "Cada documento tiene un **código**, un **título**, un **tipo** (política, procedimiento, formato…) y **versiones**. Solo una versión está **vigente**; las anteriores quedan en el historial y **no se pueden modificar**.",
      },
      {
        t: "steps",
        title: "Crear un documento",
        items: [
          "Ve a **Menú → Documentos** y pulsa **Crear documento**.",
          "Escribe el **código** (p. ej., POL-001), el **título**, el **tipo**, el **responsable**, cada cuántos **meses se revisa** y el **contenido**. Pulsa **Crear documento**: queda como **Borrador v1**.",
        ],
      },
      {
        t: "steps",
        title: "Aprobar (otra persona)",
        items: [
          "Quien redactó **no puede aprobar** su propio borrador: el aviso dice «Otra persona con permiso de aprobación debe aprobar tu borrador».",
          "La persona aprobadora abre el documento y pulsa **Aprobar el borrador**: lee el texto, indica **desde cuándo es vigente**, **firma** y pulsa **Aprobar con mi firma**.",
          "El documento queda **vigente** con su huella de evidencia.",
        ],
      },
      {
        t: "steps",
        title: "Actualizar un documento vigente",
        items: [
          "Pulsa **Crear una nueva versión**: edita el **contenido** y escribe **qué cambió**. Pulsa **Crear nueva versión**: queda un **borrador** que debe aprobar otra persona.",
          "Mientras haya un borrador, el botón cambia a **Editar el borrador**.",
          "El **Historial de versiones** muestra todas las versiones, quién las creó y quién las aprobó.",
        ],
      },
      {
        t: "list",
        title: "La política de SST",
        items: [
          "Si no hay una política aprobada y vigente, la plataforma lo avisa en **Alertas**.",
          "Cada persona confirma que la leyó con **Leí y acepto la política** en **Mi portal**. En el documento ves cuántas **constancias de lectura** tiene la versión vigente.",
          "Los documentos con revisión vencida generan una alerta («documento por revisar»).",
        ],
      },
    ],
  },
];
