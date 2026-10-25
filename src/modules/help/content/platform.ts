import type { Article } from "../types";

/** Guía del panel de administración de la plataforma (SUPER ADMIN). */
export const PLATFORM: Article[] = [
  {
    slug: "acceso-admin",
    title: "Ingresar al panel y activar la verificación en dos pasos",
    group: "Empezar",
    icon: "Lock",
    summary:
      "El panel de administración vive en su propia dirección y exige verificación en dos pasos.",
    who: "Personal de la plataforma (SUPER ADMIN y soporte).",
    keywords: ["admin", "2fa", "dos pasos", "autenticador", "login", "seguridad"],
    blocks: [
      {
        t: "steps",
        items: [
          "Entra a **admin.sst.zark.pro** e ingresa con tu correo y contraseña.",
          "La **primera vez** te lleva a **Seguridad** para activar la **verificación en dos pasos**: escanea el código QR con una app autenticadora (Google Authenticator, Microsoft Authenticator, Authy…) y escribe el código de 6 dígitos.",
          "Guarda los **códigos de respaldo** que te muestra en un lugar seguro.",
          "En los siguientes ingresos, además de la contraseña, escribes el código de la app.",
        ],
      },
      {
        t: "warn",
        text: "Sin la verificación en dos pasos activa no se puede usar el panel. Un usuario de una empresa **no puede** entrar al panel de plataforma.",
      },
      {
        t: "note",
        text: "Cada acción que haces por encima del aislamiento de una empresa queda en el **registro de auditoría** (quién, cuándo, qué). Los datos sensibles de una empresa (salud, convivencia) solo se consultan con autorización de esa empresa.",
      },
    ],
  },
  {
    slug: "panel",
    title: "Panel de plataforma",
    group: "Empezar",
    icon: "Home",
    summary: "El resumen inicial y el aviso cuando alguna integración está en pruebas (sandbox).",
    route: "/",
    blocks: [
      {
        t: "list",
        items: [
          "El **Resumen** muestra el estado de las integraciones (Wompi, Siigo, AUCO, Google y Microsoft) y los avisos que requieren acción.",
          "Si una integración activa está en **sandbox**, ves una franja amarilla en todo el panel: «La plataforma opera en SANDBOX…». Significa que **los cobros y las facturas no son reales**. Cámbiala a producción cuando termines de probar.",
          "El menú lateral da acceso a **Empresas, Planes, Pagos y facturas, Integraciones y Catálogos**; **Cupones** se abre desde Planes.",
        ],
      },
    ],
  },
  {
    slug: "empresas",
    title: "Empresas y suscripciones",
    group: "Administración",
    icon: "Building2",
    summary:
      "Crear empresas, buscarlas y operar su suscripción: suspender, reactivar, extender prueba, regalar meses o cancelar.",
    route: "/empresas",
    who: "SUPER ADMIN y soporte.",
    keywords: [
      "empresa",
      "tenant",
      "suscripción",
      "suspender",
      "reactivar",
      "prueba",
      "cancelar",
      "meses gratis",
    ],
    related: ["planes", "pagos"],
    blocks: [
      {
        t: "steps",
        title: "Crear una empresa",
        items: [
          "Ve a **Empresas** y pulsa **Nueva empresa**.",
          "Escribe el **nombre comercial**, la **razón social**, el **NIT**, el **identificador en la dirección** (será `sst.zark.pro/identificador`; único), el **correo del administrador** y el **plan** (normalmente *Free Trial*). Pulsa **Crear empresa**.",
          "La empresa queda creada con su prueba gratuita y el administrador recibe la invitación para entrar.",
        ],
      },
      {
        t: "list",
        title: "Buscar y revisar",
        items: [
          "El listado se filtra por **texto** (nombre, NIT o identificador), **estado** y **plan**, y se pagina.",
          "Al abrir una empresa ves su **Suscripción**, sus **Dominios** y el **Historial de la suscripción** (cada cambio con fecha y motivo).",
        ],
      },
      {
        t: "defs",
        items: [
          {
            term: "Suspender (solo lectura)",
            def: "Pide un **motivo** obligatorio. La empresa puede consultar pero no editar.",
          },
          { term: "Reactivar", def: "Devuelve la empresa a su estado activo." },
          {
            term: "Extender prueba",
            def: "Escribe los **días a extender** de la prueba gratuita.",
          },
          { term: "Conceder meses gratis", def: "Regala **meses** de servicio sin cobro." },
          {
            term: "Cancelar al final del periodo",
            def: "La empresa sigue hasta que termina el periodo pagado.",
          },
          {
            term: "Cancelar ahora",
            def: "Cancela de inmediato. Los registros obligatorios quedan en un archivo cifrado de solo conservación.",
          },
        ],
      },
    ],
  },
  {
    slug: "planes",
    title: "Planes, precios e IVA",
    group: "Administración",
    icon: "CreditCard",
    summary:
      "Define qué se vende: precios mensual y anual, IVA configurable, límites y módulos incluidos.",
    route: "/planes",
    who: "SUPER ADMIN.",
    keywords: [
      "plan",
      "precio",
      "iva",
      "prueba gratuita",
      "límites",
      "módulos",
      "siigo",
      "archivar",
    ],
    related: ["cupones", "empresas"],
    blocks: [
      {
        t: "steps",
        title: "Crear un plan",
        items: [
          "Ve a **Planes** y pulsa **Nuevo plan**.",
          "**General**: **clave** única (no se puede cambiar después), **nombre**, **descripción**, si es **visible en la página de precios**, si está **activo** (se puede contratar) y el **orden** en la página.",
          "**Prueba gratuita**: marca si el plan es la prueba y define los **días**.",
          "**Precio e IVA**: **precio mensual** y **anual** (COP). Indica si el IVA está habilitado, su **porcentaje** y si **el precio ya lo incluye**. La **vista previa en vivo** muestra neto, IVA y total. También puedes poner el **código de producto en Siigo** de cada precio.",
          "**Límites**: máximo de **trabajadores**, **usuarios**, **sedes** y **almacenamiento** (vacío = ilimitado).",
          "**Módulos incluidos**: marca los módulos del plan (por ejemplo, PESV es opcional).",
          "Pulsa **Crear plan**. Verás un error claro si falta algo (por ejemplo, «Define al menos un precio»).",
        ],
      },
      {
        t: "list",
        title: "Editar y archivar",
        items: [
          "Abre un plan y pulsa **Editar plan** para cambiar precios, IVA, límites o módulos.",
          "**Archivar plan** lo retira de la venta sin afectar a las empresas que ya lo tienen.",
          "La duración de la prueba gratuita y el IVA se configuran aquí, no en el código.",
        ],
      },
    ],
  },
  {
    slug: "cupones",
    title: "Cupones de descuento",
    group: "Administración",
    icon: "Receipt",
    summary: "Crea códigos de descuento por porcentaje o por valor fijo.",
    route: "/cupones",
    who: "SUPER ADMIN.",
    keywords: ["cupón", "descuento", "código"],
    related: ["planes"],
    blocks: [
      {
        t: "steps",
        items: [
          "Ve a **Planes → Cupones** y pulsa **Nuevo cupón**.",
          "Escribe el **código** (se guarda en mayúsculas), una descripción, el **tipo** (porcentaje o valor), el **valor** y, si quieres, los límites de uso, la vigencia y los planes a los que aplica. Pulsa **Crear cupón**.",
          "Si el código ya existe, la plataforma lo avisa («Ya existe un cupón…»).",
          "En **Cupones creados** ves los usos de cada uno y puedes **Activar** o **Desactivar** cada cupón.",
        ],
      },
    ],
  },
  {
    slug: "pagos",
    title: "Pagos y facturas",
    group: "Administración",
    icon: "Receipt",
    summary:
      "Los últimos pagos de todas las empresas, con su factura electrónica, reintentos y notas crédito.",
    route: "/pagos",
    who: "SUPER ADMIN y finanzas.",
    keywords: [
      "pago",
      "factura electrónica",
      "wompi",
      "siigo",
      "reintentar",
      "nota crédito",
      "conciliación",
    ],
    related: ["integraciones", "empresas"],
    blocks: [
      {
        t: "list",
        items: [
          "**Últimos pagos**: empresa, valor, estado del pago y el estado de la factura electrónica.",
          "**Descargar PDF**: descarga la factura generada en Siigo.",
          "**Reintentar**: vuelve a cobrar o a emitir la factura cuando el intento falló.",
          "**Nota crédito**: anula o corrige una factura. Pide el motivo; los motivos y códigos fiscales son provisionales hasta validarlos con el contador.",
          "La plataforma **concilia** los pagos de Wompi con las facturas de Siigo y te avisa de diferencias.",
        ],
      },
    ],
  },
  {
    slug: "integraciones",
    title: "Integraciones (Wompi, Siigo, AUCO, Google, Microsoft)",
    group: "Administración",
    icon: "Plug",
    summary: "Credenciales de cada servicio, cifradas, con ambiente de pruebas y de producción.",
    route: "/integrations",
    who: "SUPER ADMIN.",
    keywords: [
      "wompi",
      "siigo",
      "auco",
      "google",
      "microsoft",
      "credenciales",
      "sandbox",
      "producción",
      "secretos",
    ],
    related: ["pagos"],
    blocks: [
      {
        t: "steps",
        items: [
          "Ve a **Integraciones** y abre el servicio (Wompi cobra, Siigo factura, AUCO verifica identidad, Google y Microsoft permiten el ingreso con cuenta).",
          "En **Estado** activa o desactiva el servicio y elige el **ambiente activo**: **sandbox** (pruebas) o **producción**.",
          "En **Configuración · sandbox** o **producción** completa cada campo. Los **secretos** (llaves, contraseñas) se guardan **cifrados**, **nunca se muestran** completos ni se envían al navegador: solo ves una máscara. Para cambiar uno pulsa **Reemplazar** y luego **Guardar secreto**.",
          "Pulsa **Guardar configuración**. El **Historial de cambios** registra quién cambió qué y cuándo.",
        ],
      },
      {
        t: "warn",
        text: "Mientras algún servicio esté en **sandbox**, los cobros y las facturas **no son reales**. Haz las pruebas con tarjetas de prueba y pasa a producción solo al final.",
      },
    ],
  },
  {
    slug: "catalogos",
    title: "Catálogos normativos",
    group: "Administración",
    icon: "ScrollText",
    summary:
      "Los textos y parámetros de las normas (estándares 0312, matriz legal, peligros, indicadores…) con versiones.",
    route: "/catalogos",
    who: "SUPER ADMIN (idealmente con apoyo de un experto SST).",
    keywords: [
      "catálogo",
      "norma",
      "0312",
      "versión",
      "borrador",
      "publicar",
      "importar",
      "csv",
      "json",
      "parámetros",
    ],
    blocks: [
      {
        t: "p",
        text: "Las reglas normativas **no están en el código**: viven en catálogos con versiones. Hay catálogos de **parámetros normativos**, **rangos de calificación**, **grupos de estándares**, **estándares mínimos (Res. 0312)**, **actividades económicas y clase de riesgo**, **peligros**, **escalas GTC 45**, **matriz legal** (normas y requisitos), **indicadores**, **tipos de evaluación médica**, **plantillas** (documentos, inspecciones, exportaciones) y **calendario de obligaciones**.",
      },
      {
        t: "steps",
        title: "Actualizar un catálogo",
        items: [
          "Abre el catálogo. Ves sus **versiones**: la **vigente** y las de borrador.",
          "Pulsa **Crear borrador (copia la versión vigente)**.",
          "En el borrador, **Agregar o editar un elemento** (y **Guardar elemento**) o **Importar CSV o JSON** (y **Importar**) para cargar muchos de una vez. La plataforma **valida** cada fila e indica los errores.",
          "Cuando esté correcto, **Publicar versión**. Desde ese momento es la vigente y la versión publicada queda **inmutable**.",
        ],
      },
      {
        t: "warn",
        text: "El catálogo de **estándares mínimos (Res. 0312)** debe cargarse con el texto oficial antes de que las empresas puedan iniciar su autoevaluación. Toda cifra normativa incierta está marcada `TODO-NORMA` hasta que un experto la valide.",
      },
    ],
  },
];
