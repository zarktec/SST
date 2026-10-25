import { expect } from "@playwright/test";
import { createWorker, importPeople } from "../setup";
import type { Scenario } from "../types";
import { TENANT } from "../types";

export const PLAN_PEOPLE: Scenario[] = [
  {
    slug: "estandares",
    title: "Autoevaluación de estándares mínimos",
    as: "tenant",
    catalog: true,
    onboarded: true,
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/estandares`);
      await r.say(
        "Cada año calificas los estándares mínimos que le corresponden a tu empresa",
        2800,
      );
      await r.say("1. Pulsa «Iniciar autoevaluación»", 700);
      await r.click(page.getByRole("button", { name: /Iniciar autoevaluación/ }), 1500);
      await expect(page.getByRole("heading", { name: /^Autoevaluación \d{4}$/ })).toBeVisible();
      await r.say("2. Para cada ítem elige si cumple, no cumple o no aplica", 1800);
      const f1 = page.locator("form").filter({ hasText: "Criterio 1.1.1" });
      await r.select(f1.locator('select[name="status"]'), "cumple");
      await r.say("Agrega la evidencia y el responsable. Luego guarda el ítem", 1200);
      await r.click(f1.getByRole("button", { name: "Guardar ítem" }), 1400);
      const f2 = page.locator("form").filter({ hasText: "Criterio 1.1.2" });
      await r.select(f2.locator('select[name="status"]'), "no_cumple");
      await r.click(f2.getByRole("button", { name: "Guardar ítem" }), 1400);
      await r.say("3. Cuando todos estén calificados, cierra la autoevaluación", 1200);
      await r.click(page.getByRole("button", { name: "Cerrar autoevaluación" }), 1800);
      await expect(page.getByText(/2 de 2 ítems calificados.*cerrada/)).toBeVisible();
      await r.say(
        "Obtienes el puntaje y el rango. La autoevaluación queda cerrada y no se puede cambiar",
        3400,
      );
      await r.say("Cada ítem que no cumple crea una acción en el plan de mejoramiento", 1200);
      await r.goto(`${TENANT}/estandares/plan`);
      await r.say("Ahí le asignas responsable y fecha a cada acción", 3000);
    },
  },
  {
    slug: "matriz-legal",
    title: "Matriz legal: evaluar el cumplimiento de las normas",
    as: "tenant",
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/matriz-legal`);
      await r.say(
        "La matriz legal lista las normas de SST y su estado de cumplimiento en tu empresa",
        3000,
      );
      await r.say("Las que aún no has revisado aparecen como «Sin evaluar»", 2200);
      await r.say("Pulsa «Evaluar» en una norma", 900);
      await r.click(page.getByRole("button", { name: "Evaluar" }).first(), 1000);
      const dlg = page.getByRole("dialog");
      await r.say("Indica si aplica a tu empresa. Si no aplica, explica por qué", 1600);
      await r.select(dlg.locator('select[name="applies"]'), "no");
      await r.click(dlg.getByRole("button", { name: "Guardar" }), 1400);
      await r.fill(
        dlg.getByLabel("Justificación (si no aplica)"),
        "No aplica a nuestra actividad económica",
      );
      await r.click(dlg.getByRole("button", { name: "Guardar" }), 1600);
      await r.say(
        "Si aplica, registras el cumplimiento, la evidencia, el responsable y la próxima revisión",
        3600,
      );
    },
  },
  {
    slug: "peligros",
    title: "Matriz de peligros y valoración de riesgos (GTC 45)",
    as: "tenant",
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/peligros`);
      await r.say(
        "La matriz de peligros identifica los peligros de cada proceso y valora el riesgo",
        2800,
      );
      await r.say("1. Crea la matriz", 700);
      await r.click(page.getByRole("button", { name: "Crear matriz" }), 1500);
      await r.say("2. Agrega un peligro", 700);
      await r.click(page.getByRole("button", { name: "Agregar peligro" }), 1000);
      const dlg = page.getByRole("dialog");
      await r.type(dlg.getByLabel("Proceso", { exact: true }), "Mantenimiento", 35);
      await r.type(dlg.getByLabel("Actividad", { exact: true }), "Trabajo en alturas", 35);
      await r.type(dlg.getByLabel("Tarea", { exact: true }), "Cambio de luminarias", 35);
      await r.type(dlg.getByLabel("Familia del peligro"), "Seguridad", 35);
      await r.type(dlg.getByLabel("Peligro", { exact: true }), "Caída de altura", 35);
      await r.say("Elige los niveles de deficiencia, exposición y consecuencia", 1200);
      await r.select(dlg.getByLabel("Nivel de deficiencia"), "Muy alto");
      await r.select(dlg.getByLabel("Nivel de exposición"), "Continua");
      await r.select(dlg.getByLabel("Nivel de consecuencia"), "Mortal o catastrófico");
      await r.click(dlg.getByRole("button", { name: "Agregar peligro" }), 1500);
      await r.say(
        "La plataforma calcula sola el nivel de riesgo y qué tan urgente es intervenir",
        3400,
      );
      await r.say("3. Registra cómo participaron los trabajadores", 1000);
      await r.click(page.getByRole("button", { name: "Registrar participación" }), 900);
      const part = page.getByRole("dialog");
      await r.fill(
        part.getByLabel(/Participación de los trabajadores/),
        "Taller con el COPASST y los jefes de área",
      );
      await r.click(part.getByRole("button", { name: "Guardar", exact: true }), 1500);
      await r.say(
        "4. Aprueba la matriz. Queda inmutable: los cambios se hacen en una nueva versión",
        1200,
      );
      await r.click(page.getByRole("button", { name: "Aprobar matriz" }), 1800);
      await expect(page.getByText(/^Aprobada /)).toBeVisible();
      await r.pause(2200);
    },
  },
  {
    slug: "plan-anual",
    title: "Plan anual de trabajo",
    as: "tenant",
    async run(r) {
      const { page } = r;
      const year = new Date().getUTCFullYear();
      await r.goto(`${TENANT}/plan-anual`);
      await r.say("El plan anual es el cronograma de actividades del SG-SST del año", 2600);
      await r.click(page.getByRole("button", { name: `Crear plan ${year}` }), 1500);
      await r.say("Agrega cada actividad con su ciclo PHVA, responsable y fechas", 1200);
      await r.click(page.getByRole("button", { name: "Agregar actividad" }).first(), 1000);
      const dlg = page.getByRole("dialog");
      await r.type(dlg.getByLabel("Actividad", { exact: true }), "Revisar la política de SST", 35);
      await r.type(dlg.getByLabel("Responsable"), "Ana Pérez", 35);
      await r.fill(dlg.getByLabel("Inicio"), `${year}-02-01`);
      await r.fill(dlg.getByLabel("Fin"), `${year}-03-15`);
      await r.click(dlg.getByRole("button", { name: "Agregar actividad" }), 1500);
      await r.say("Para avanzar una actividad pulsa «Gestionar» y cambia su estado", 1400);
      await r.click(page.getByRole("button", { name: "Gestionar" }).first(), 1000);
      const g = page.getByRole("dialog");
      await r.select(g.getByLabel("Estado"), "done");
      await r.click(g.getByRole("button", { name: "Guardar estado" }), 1400);
      await r.say("Para marcarla como realizada debes escribir la evidencia", 1400);
      await r.fill(g.getByLabel(/Evidencia/), "Acta 3 de la alta dirección");
      await r.click(g.getByRole("button", { name: "Guardar estado" }), 1600);
      await r.say("El porcentaje de cumplimiento se calcula solo", 2600);
      await r.say("Al final, el empleador y el responsable firman el plan", 2600);
    },
  },
  {
    slug: "capacitacion",
    title: "Capacitación: cursos, sesiones con QR y certificados",
    as: "tenant",
    async setup(page) {
      await createWorker(page, { doc: "1032456789", name: "Ana Pérez" });
    },
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/capacitacion/cursos`);
      await r.say("1. Crea un curso con su evaluación", 1600);
      await r.click(page.getByRole("button", { name: "Nuevo curso" }), 900);
      const dlg = page.getByRole("dialog");
      await r.type(dlg.getByLabel("Nombre del curso"), "Inducción SST", 40);
      await r.fill(dlg.getByLabel(/Puntaje mínimo/), "70");
      await r.click(dlg.getByRole("button", { name: "Crear curso" }), 1500);
      await r.say("Con «Editar» agregas las preguntas: la opción correcta empieza con *", 1400);
      await r.click(page.getByRole("button", { name: "Editar" }).first(), 900);
      const ev = page.getByRole("dialog");
      await r.fill(
        ev.getByLabel(/Evaluación \(una pregunta/),
        "¿Qué es un EPP?\n* Elemento de protección personal\nUn juego",
      );
      await r.click(ev.getByRole("button", { name: "Guardar evaluación" }), 1500);
      await r.goto(`${TENANT}/capacitacion`);
      await r.say("2. Programa una sesión", 1200);
      await r.click(page.getByRole("button", { name: "Programar sesión" }), 900);
      const s = page.getByRole("dialog");
      await r.fill(s.getByLabel("Fecha"), new Date().toISOString().slice(0, 10));
      await r.click(s.getByRole("button", { name: "Programar sesión" }), 1500);
      await r.click(page.getByRole("link", { name: /Inducción SST/ }).first(), 1500);
      await r.say(
        "3. Abre la sesión: aparece un código QR para que cada asistente registre su asistencia",
        1400,
      );
      await r.click(page.getByRole("button", { name: /Abrir sesión/ }), 1500);
      await expect(page.getByAltText("Código QR de asistencia")).toBeVisible();
      await r.say(
        "Cada persona escanea el QR con su celular, responde la evaluación y firma",
        3600,
      );
      await r.say("La sesión muestra los asistentes y cada uno tiene su certificado en PDF", 3000);
    },
  },
  {
    slug: "epp",
    title: "EPP: catálogo, inventario y entregas con firma",
    as: "tenant",
    async setup(page) {
      await createWorker(page, { doc: "1032456789", name: "Ana Pérez" });
    },
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/epp/catalogo`);
      await r.say("1. Agrega los elementos de protección personal al catálogo", 1600);
      await r.click(page.getByRole("button", { name: "Agregar elemento" }), 900);
      const dlg = page.getByRole("dialog");
      await r.type(dlg.getByLabel("Nombre del EPP"), "Casco de seguridad", 35);
      await r.fill(dlg.getByLabel(/Vida útil/), "24");
      await r.click(dlg.getByRole("button", { name: "Crear EPP" }), 1500);
      await r.say("2. Registra el ingreso al inventario", 1200);
      await r.click(page.getByRole("button", { name: "Registrar movimiento de inventario" }), 900);
      const inv = page.getByRole("dialog");
      await r.fill(inv.getByLabel("Cantidad"), "10");
      await r.click(inv.getByRole("button", { name: "Registrar ingreso" }), 1500);
      await r.goto(`${TENANT}/epp`);
      await r.say("3. Registra la entrega: el trabajador firma que recibió conforme", 1600);
      await r.click(page.getByRole("button", { name: "Registrar entrega" }), 1100);
      const e = page.getByRole("dialog");
      await r.fill(e.getByLabel("Cantidad"), "2");
      await r.say("El trabajador firma con el dedo o el mouse", 900);
      await r.sign(e.getByLabel("Área para firmar"));
      await r.click(e.getByRole("button", { name: "Registrar entrega" }), 1600);
      await r.say("La entrega descuenta el inventario y queda en el historial", 2800);
    },
  },
  {
    slug: "comites",
    title: "Comités: elección electrónica del COPASST",
    as: "tenant",
    onboarded: true,
    async setup(page) {
      await importPeople(page, [
        "Ana Prueba",
        "Beto Prueba",
        "Carla Prueba",
        "Diego Prueba",
        "Elena Prueba",
        "Fabio Prueba",
      ]);
    },
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/comites`);
      await r.say(
        "Los representantes de los trabajadores se eligen con votación electrónica y voto secreto",
        3000,
      );
      await r.say("1. Convoca la elección", 900);
      await r.click(page.getByRole("button", { name: "Convocar elección" }), 900);
      const dlg = page.getByRole("dialog");
      await r.fill(dlg.getByLabel("Cierre de la votación"), "2099-12-31");
      await r.click(dlg.getByRole("button", { name: "Convocar elección" }), 1800);
      await page.waitForURL(/\/comites\/elecciones\//);
      await r.say("2. Inscribe a los candidatos", 1200);
      await r.click(page.getByRole("button", { name: "Inscribir candidato" }), 900);
      const c = page.getByRole("dialog");
      await r.click(c.getByRole("button", { name: "Inscribir a Ana Prueba" }), 1300);
      await r.click(c.getByRole("button", { name: "Inscribir a Beto Prueba" }), 1300);
      await r.click(c.getByRole("button", { name: "Cerrar" }), 900);
      await r.say("3. Cierra la inscripción y abre la votación", 1200);
      await r.click(
        page.getByRole("button", { name: "Cerrar inscripción y abrir votación" }),
        1800,
      );
      await r.say(
        "Descarga los enlaces: cada trabajador recibe un enlace personal de un solo uso",
        1400,
      );
      await r.hover(page.getByRole("button", { name: "Descargar enlaces (CSV)" }));
      await r.pause(2600);
      await r.say(
        "Al terminar el plazo, cierras la votación y la plataforma hace el escrutinio",
        3600,
      );
      await r.say("Con el resultado conformas el comité", 2600);
    },
  },
  {
    slug: "convivencia",
    title: "Convivencia laboral: radicar una queja confidencial",
    as: "tenant",
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/convivencia/radicar`);
      await r.say(
        "Cualquier trabajador puede radicar una queja ante el Comité de Convivencia",
        2800,
      );
      await r.fill(
        page.getByLabel(/Describe los hechos/),
        "El lunes en la bodega me gritaron delante de mis compañeros.",
      );
      await r.say(
        "Describe qué pasó, cuándo, dónde y quién. Puedes hacerlo de forma anónima",
        2600,
      );
      await r.check(page.getByLabel(/anónima/));
      await r.click(page.getByRole("button", { name: "Radicar queja" }), 1600);
      await expect(page.getByText(/recibida de forma confidencial/)).toBeVisible();
      await r.say(
        "La queja se guarda cifrada. Solo la ven los miembros del comité que firmaron la confidencialidad",
        4000,
      );
    },
  },
  {
    slug: "acoso-sexual",
    title: "Reportar acoso sexual o violencia de género",
    as: "tenant",
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/acoso-sexual/radicar`);
      await r.say("Este canal es confidencial y está separado del Comité de Convivencia", 3000);
      await r.fill(
        page.getByLabel("Describe lo ocurrido"),
        "Un superior me hizo comentarios inapropiados de forma repetida en la oficina.",
      );
      await r.say("Cuenta lo que quieras compartir. El relato se guarda cifrado", 2600);
      await r.click(page.getByRole("button", { name: "Enviar reporte" }), 1600);
      await expect(page.getByText(/No lo recibe el Comité de Convivencia/)).toBeVisible();
      await r.say(
        "Solo los roles autorizados lo reciben y dan trámite. Cada lectura queda registrada",
        3800,
      );
    },
  },
];
