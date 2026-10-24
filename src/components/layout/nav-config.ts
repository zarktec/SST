/** Menú de la app de empresa: una sola definición para la barra lateral, el menú móvil y el inicio. */
export type IconName =
  | "Home"
  | "ClipboardCheck"
  | "ShieldAlert"
  | "Users"
  | "BarChart3"
  | "Building2"
  | "CreditCard"
  | "Plug"
  | "Receipt"
  | "ScrollText"
  | "Scale"
  | "TriangleAlert"
  | "CalendarCheck"
  | "GraduationCap"
  | "HardHat"
  | "UsersRound"
  | "HeartHandshake"
  | "Stethoscope"
  | "Siren"
  | "Construction"
  | "FlaskConical"
  | "Car"
  | "Activity"
  | "FileSearch"
  | "FileText"
  | "Target"
  | "Megaphone"
  | "Bell"
  | "UserCog"
  | "Globe"
  | "FileBarChart"
  | "UserRound"
  | "ShieldCheck"
  | "ListChecks"
  | "FolderOpen"
  | "Lock"
  | "CalendarDays";

export type NavItem = { href: string; label: string; icon: IconName };
export type NavGroup = { label: string; items: NavItem[] };
/** `module`: permiso de ver que exige el ítem (clave del módulo RBAC); sin él, lo ve cualquier miembro. */
export type ModuleLink = NavItem & { module?: string; hint?: string };

export const MODULE_GROUPS: { label: string; items: ModuleLink[] }[] = [
  {
    label: "Planear",
    items: [
      {
        href: "/estandares",
        label: "Estándares mínimos",
        icon: "ClipboardCheck",
        module: "standards",
        hint: "Autoevaluación Res. 0312",
      },
      {
        href: "/matriz-legal",
        label: "Matriz legal",
        icon: "Scale",
        module: "legal_matrix",
        hint: "Normas y cumplimiento",
      },
      {
        href: "/peligros",
        label: "Matriz de peligros",
        icon: "TriangleAlert",
        module: "hazard_matrix",
        hint: "GTC 45",
      },
      {
        href: "/plan-anual",
        label: "Plan anual",
        icon: "CalendarCheck",
        module: "annual_plan",
        hint: "Cronograma de trabajo",
      },
    ],
  },
  {
    label: "Personas",
    items: [
      {
        href: "/personas",
        label: "Personas",
        icon: "Users",
        module: "workers",
        hint: "Trabajadores y contratistas",
      },
      {
        href: "/capacitacion",
        label: "Capacitación",
        icon: "GraduationCap",
        module: "training",
        hint: "Cursos y asistencia",
      },
      { href: "/epp", label: "EPP", icon: "HardHat", module: "ppe", hint: "Entregas e inventario" },
      {
        href: "/comites",
        label: "Comités",
        icon: "UsersRound",
        module: "committees",
        hint: "COPASST / Vigía",
      },
      {
        href: "/convivencia",
        label: "Convivencia laboral",
        icon: "HeartHandshake",
        module: "ccl",
        hint: "Comité y quejas",
      },
      {
        href: "/acoso-sexual",
        label: "Acoso sexual",
        icon: "ShieldCheck",
        module: "harassment",
        hint: "Canal confidencial",
      },
    ],
  },
  {
    label: "Salud",
    items: [
      {
        href: "/medicina",
        label: "Medicina del trabajo",
        icon: "Stethoscope",
        module: "medical",
        hint: "Exámenes y ausentismo",
      },
      {
        href: "/vigilancia",
        label: "Vigilancia",
        icon: "Activity",
        module: "medical",
        hint: "Epidemiológica y psicosocial",
      },
    ],
  },
  {
    label: "Prevención y respuesta",
    items: [
      {
        href: "/reportes",
        label: "Actos y condiciones",
        icon: "ShieldAlert",
        module: "unsafe_reports",
        hint: "Reportar y revisar",
      },
      {
        href: "/inspecciones",
        label: "Inspecciones",
        icon: "ListChecks",
        module: "inspections",
        hint: "Listas de chequeo",
      },
      {
        href: "/accidentes",
        label: "Accidentes e incidentes",
        icon: "Siren",
        module: "incidents",
        hint: "Reporte e investigación",
      },
      {
        href: "/emergencias",
        label: "Emergencias",
        icon: "Megaphone",
        module: "emergencies",
        hint: "Plan, brigada y simulacros",
      },
      {
        href: "/alto-riesgo",
        label: "Alto riesgo",
        icon: "Construction",
        module: "high_risk",
        hint: "Permisos de trabajo",
      },
      {
        href: "/quimicos",
        label: "Riesgo químico",
        icon: "FlaskConical",
        module: "chemicals",
        hint: "Inventario y FDS",
      },
      { href: "/pesv", label: "Seguridad vial", icon: "Car", module: "pesv", hint: "PESV" },
    ],
  },
  {
    label: "Mejora y gestión",
    items: [
      {
        href: "/acciones",
        label: "Acciones (CAPA)",
        icon: "Target",
        module: "actions",
        hint: "Correctivas y preventivas",
      },
      {
        href: "/indicadores",
        label: "Indicadores",
        icon: "BarChart3",
        module: "indicators",
        hint: "Tablero y metas",
      },
      {
        href: "/auditorias",
        label: "Auditoría interna",
        icon: "FileSearch",
        module: "audits",
        hint: "Programa y hallazgos",
      },
      {
        href: "/revision-direccion",
        label: "Revisión por la dirección",
        icon: "ClipboardCheck",
        module: "management_review",
        hint: "Revisión anual",
      },
      {
        href: "/documentos",
        label: "Documentos",
        icon: "FileText",
        module: "documents",
        hint: "Política y lista maestra",
      },
      {
        href: "/informes",
        label: "Informes",
        icon: "FileBarChart",
        hint: "PDF, Excel y carpeta de inspección",
      },
    ],
  },
  {
    label: "Cuenta",
    items: [
      {
        href: "/usuarios",
        label: "Usuarios y roles",
        icon: "UserCog",
        module: "users",
        hint: "Invitar y permisos",
      },
      {
        href: "/facturacion",
        label: "Facturación",
        icon: "CreditCard",
        module: "billing",
        hint: "Plan, pagos y facturas",
      },
      {
        href: "/dominio",
        label: "Dominio propio",
        icon: "Globe",
        module: "domain",
        hint: "Conecta tu dominio",
      },
      { href: "/portal", label: "Mi portal", icon: "UserRound", hint: "Lo mío como trabajador" },
      { href: "/privacidad", label: "Privacidad", icon: "Lock", hint: "Datos personales" },
      {
        href: "/calendario",
        label: "Calendario",
        icon: "CalendarDays",
        hint: "Obligaciones y fechas",
      },
    ],
  },
];
