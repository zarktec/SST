import { expect } from "@playwright/test";
import { createWorker } from "../setup";
import type { Scenario } from "../types";
import { TENANT } from "../types";

export const HEALTH_IMPROVE: Scenario[] = [
  {
    slug: "acciones",
    title: "Acciones correctivas, preventivas y de mejora",
    as: "tenant",
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/acciones`);
      await r.say("Aquí le haces seguimiento a todo lo que hay que corregir o mejorar", 2400);
      await r.say("1. Crea la acción con responsable y fecha límite", 1200);
      await r.click(page.getByRole("button", { name: "Nueva acción" }), 900);
      const dlg = page.getByRole("dialog");
      await r.type(dlg.getByLabel("Acción", { exact: true }), "Reparar la baranda de la escalera");
      await r.type(dlg.getByLabel("Responsable"), "Luis Gómez");
      await r.fill(dlg.getByLabel("Fecha límite"), "2020-01-01");
      await r.click(dlg.getByRole("button", { name: "Crear acción" }), 1500);
      await r.say("Si la fecha pasa sin cerrarse, aparece la mora y se escala", 2400);
      await r.click(page.getByRole("link", { name: /Reparar la baranda/ }), 1500);
      await r.say("2. Cuando se ejecute, cambia el estado y deja la evidencia del cierre", 1400);
      await r.click(page.getByRole("button", { name: "Cambiar estado" }), 900);
      const st = page.getByRole("dialog");
      await r.select(st.getByLabel("Pasar a"), "done");
      await r.click(st.getByRole("button", { name: "Actualizar estado" }), 1200);
      await r.fill(st.getByLabel(/Evidencia del cierre/), "Baranda reparada, acta 5");
      await r.click(st.getByRole("button", { name: "Actualizar estado" }), 1500);
      await expect(page.getByRole("heading", { name: "Verificación de eficacia" })).toBeVisible();
      await r.say("3. Pasado un tiempo, verifica que la acción sí resolvió el problema", 1400);
      await r.click(page.getByRole("button", { name: "Verificar eficacia" }), 900);
      const ve = page.getByRole("dialog");
      await r.fill(ve.getByLabel("Cómo se verificó"), "Sin nuevos eventos en 30 días");
      await r.click(ve.getByRole("button", { name: "Registrar verificación" }), 1600);
      await r.say("La acción queda cerrada como eficaz, con todo el historial", 2800);
    },
  },
  {
    slug: "reportes",
    title: "Reportar actos y condiciones inseguras",
    as: "tenant",
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/reportes`);
      await r.say("Cualquier persona puede reportar un peligro desde el celular", 2400);
      await r.click(page.getByRole("button", { name: "Reportar acto o condición insegura" }), 900);
      const dlg = page.getByRole("dialog");
      await r.type(dlg.getByLabel("Descripción"), "Extintor sin carga en el pasillo", 35);
      await r.type(dlg.getByLabel("Lugar (opcional)"), "Pasillo 3", 40);
      await r.say("Si prefieres, envíalo de forma anónima", 1400);
      await r.check(dlg.getByLabel(/Enviar de forma anónima/));
      await r.click(dlg.getByRole("button", { name: "Enviar reporte" }), 1600);
      await r.say("El responsable revisa el reporte y lo convierte en una acción", 1800);
      await r.click(page.getByRole("button", { name: "Revisar" }), 900);
      const rv = page.getByRole("dialog");
      await r.type(rv.getByLabel("Acción", { exact: true }), "Recargar el extintor del pasillo 3");
      await r.type(rv.getByLabel("Responsable"), "Luis Gómez");
      await r.fill(rv.getByLabel("Fecha límite"), "2030-01-01");
      await r.click(rv.getByRole("button", { name: "Registrar revisión" }), 1600);
      await expect(page.getByRole("link", { name: "Ver la acción" })).toBeVisible();
      await r.say("El reporte queda enlazado a su acción de seguimiento", 2800);
    },
  },
  {
    slug: "accidentes",
    title: "Accidentes e incidentes: reporte e investigación",
    as: "tenant",
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/accidentes`);
      await r.say("Registra cada accidente o incidente apenas ocurra", 2200);
      await r.click(page.getByRole("button", { name: "Reportar evento" }), 900);
      const dlg = page.getByRole("dialog");
      await r.select(dlg.getByLabel("Gravedad"), "serious");
      await r.type(dlg.getByLabel(/Nombre de la persona afectada/), "Pedro Pérez");
      await r.type(dlg.getByLabel("Lugar"), "Bodega 2");
      await r.fill(dlg.getByLabel("¿Qué pasó?"), "Caída desde una escalera al alcanzar una caja");
      await r.click(dlg.getByRole("button", { name: "Reportar evento" }), 1600);
      await r.click(page.getByRole("link", { name: /Accidente · Pedro Pérez/ }), 1500);
      await r.say(
        "El sistema calcula el plazo para reportar a la ARL y a la EPS en días hábiles",
        2800,
      );
      await r.click(page.getByRole("button", { name: "Registrar reporte" }), 900);
      await r.click(
        page.getByRole("dialog").getByRole("button", { name: "Registrar reporte" }),
        1500,
      );
      await r.say("Los eventos graves requieren investigación con el equipo", 1600);
      await r.click(page.getByRole("button", { name: "Abrir investigación" }), 1400);
      await r.click(page.getByRole("button", { name: "Registrar investigación" }), 900);
      const inv = page.getByRole("dialog");
      await r.type(inv.getByLabel("Jefe inmediato o supervisor"), "Ana Ruiz", 35);
      await r.type(inv.getByLabel(/Representante del COPASST/), "Luis Gómez", 35);
      await r.type(inv.getByLabel("Responsable del SG-SST"), "Marta Díaz", 35);
      await r.type(inv.getByLabel(/Profesional con licencia/), "Carlos Soto", 35);
      await r.say("Describe los porqués y las causas", 1200);
      await r.fill(inv.getByLabel(/^Análisis/), "Cayó\nEscalera inestable\nSin mantenimiento");
      await r.fill(inv.getByLabel(/Causas inmediatas/), "Escalera sin apoyo");
      await r.fill(inv.getByLabel(/Causas básicas/), "Sin inspección periódica");
      await r.click(inv.getByRole("button", { name: "Guardar investigación" }), 1500);
      await r.say("Las acciones del plan se crean directamente en el módulo de acciones", 2600);
    },
  },
  {
    slug: "indicadores",
    title: "Indicadores del SG-SST",
    as: "tenant",
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/indicadores`);
      await r.say("El tablero calcula los indicadores con los datos reales del sistema", 2800);
      await r.click(page.getByRole("button", { name: "Definir meta" }).first(), 900);
      const dlg = page.getByRole("dialog");
      await r.say("Define la meta de tu empresa para el indicador", 1400);
      await r.type(dlg.locator("#frecuencia_accidentalidad-target"), "2");
      await r.click(dlg.getByRole("button", { name: "Guardar meta" }), 1500);
      await r.say("Cada periodo registra el análisis de resultados", 1400);
      await r.click(page.getByRole("button", { name: "Registrar análisis" }).first(), 900);
      const an = page.getByRole("dialog");
      await r.fill(an.locator("#a-frecuencia_accidentalidad"), "Sin accidentes en el periodo");
      await r.click(an.getByRole("button", { name: "Guardar análisis" }), 1500);
      await r.say(
        "La tendencia y el análisis quedan listos para la revisión por la dirección",
        3000,
      );
    },
  },
  {
    slug: "inspecciones",
    title: "Inspecciones con checklist",
    as: "tenant",
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/inspecciones`);
      await r.say("1. Crea una plantilla con los ítems que vas a revisar", 1800);
      await r.click(page.getByRole("button", { name: "Nueva plantilla" }), 900);
      const dlg = page.getByRole("dialog");
      await r.type(dlg.getByLabel("Nombre", { exact: true }), "Inspección locativa");
      await r.type(dlg.getByLabel("Categoría"), "Locativa");
      await r.say("Un ítem por línea; el * marca los críticos", 1400);
      await r.fill(
        dlg.getByLabel(/Ítems \(uno por línea/),
        "* Pisos secos y sin obstáculos\nSalidas de emergencia libres",
      );
      await r.click(dlg.getByRole("button", { name: "Guardar plantilla" }), 1500);
      await r.say("2. Abre la plantilla para hacer la inspección, también desde el celular", 1600);
      await r.click(page.getByRole("link", { name: /Inspección locativa/ }), 1500);
      await r.type(page.getByLabel("Lugar"), "Bodega 1");
      await r.click(
        page
          .getByRole("group", { name: "Pisos secos y sin obstáculos" })
          .getByRole("button", { name: "No cumple" }),
        900,
      );
      await r.say("Cada ítem que no cumple pide la descripción del hallazgo", 1600);
      await r.click(page.getByRole("button", { name: "Enviar inspección" }), 1200);
      await r.type(page.getByLabel(/Hallazgo: Pisos secos/), "Charco de agua en el pasillo", 35);
      await r.click(page.getByRole("button", { name: "Enviar inspección" }), 1800);
      await r.say("El hallazgo genera una acción correctiva con su seguimiento", 2800);
    },
  },
  {
    slug: "medicina",
    title: "Medicina del trabajo",
    as: "tenant",
    async setup(page) {
      await createWorker(page, { doc: "1032456789", name: "Ana Pérez" });
    },
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/medicina`);
      await r.say("Programa los exámenes médicos de ingreso, periódicos y de retiro", 2200);
      await r.click(page.getByRole("button", { name: "Programar evaluación" }), 900);
      const dlg = page.getByRole("dialog");
      await r.say("El sistema bloquea pruebas discriminatorias como embarazo o VIH", 1400);
      await r.fill(dlg.getByLabel("Observaciones de la solicitud"), "Incluir prueba de embarazo");
      await r.click(dlg.getByRole("button", { name: "Programar evaluación" }), 2400);
      await r.fill(dlg.getByLabel("Observaciones de la solicitud"), "Audiometría y optometría");
      await r.click(dlg.getByRole("button", { name: "Programar evaluación" }), 1600);
      await r.say("Cuando llegue el concepto, regístralo con sus restricciones", 1600);
      await r.click(page.getByRole("button", { name: "Registrar resultado" }), 900);
      const res = page.getByRole("dialog");
      await r.select(res.getByLabel("Concepto de aptitud"), "apto_restricciones");
      await r.fill(res.getByLabel("Recomendaciones"), "Pausas activas cada dos horas");
      await r.click(res.getByRole("button", { name: "Registrar resultado" }), 1600);
      await r.say("Queda una tarea para adaptar el puesto de trabajo en 20 días", 2800);
      await r.goto(`${TENANT}/medicina/ausentismo`);
      await r.say("El ausentismo se registra aquí y se calcula el porcentaje", 2800);
    },
  },
  {
    slug: "vigilancia",
    title: "Vigilancia epidemiológica y riesgo psicosocial",
    as: "tenant",
    async setup(page) {
      await createWorker(page, { doc: "1032456789", name: "Ana Pérez" });
    },
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/vigilancia`);
      await r.say("1. Crea un programa de vigilancia epidemiológica", 1600);
      await r.click(page.getByRole("button", { name: "Crear programa" }), 900);
      const dlg = page.getByRole("dialog");
      await r.type(dlg.locator("#np-name"), "PVE osteomuscular");
      await r.click(dlg.getByRole("button", { name: "Crear programa" }), 1500);
      await r.say("2. Abre un caso para la persona: la información clínica va cifrada", 1800);
      await r.click(page.getByRole("button", { name: "Abrir un caso" }), 900);
      const c = page.getByRole("dialog");
      await r.fill(c.locator("#nc-notes"), "Dolor lumbar recurrente por cargas");
      await r.click(c.getByRole("button", { name: "Abrir caso" }), 1500);
      await r.click(page.getByRole("link", { name: /Ana Pérez/ }), 1500);
      await r.say("Cada lectura del caso queda registrada y puedes agregar seguimientos", 2000);
      await r.click(page.getByRole("button", { name: "Registrar seguimiento" }), 900);
      const f = page.getByRole("dialog");
      await r.fill(f.locator("#fu-note"), "Control con fisioterapia, mejora parcial");
      await r.click(f.getByRole("button", { name: "Registrar seguimiento" }), 1500);
      await r.goto(`${TENANT}/vigilancia/psicosocial`);
      await r.say("3. Registra la aplicación de la batería de riesgo psicosocial", 1800);
      await r.click(page.getByRole("button", { name: "Registrar aplicación" }), 900);
      const ps = page.getByRole("dialog");
      await r.type(ps.locator("#ps-psychologistName"), "Dra. Ana Ruiz", 35);
      await r.type(ps.locator("#ps-licenseNumber"), "SST-12345", 35);
      await r.select(ps.locator("#ps-riskLevel"), "high");
      await r.fill(ps.locator("#ps-interventions"), "Capacitar en manejo del estrés");
      await r.click(ps.getByRole("button", { name: "Registrar aplicación" }), 1600);
      await r.say("Las intervenciones se convierten en acciones de seguimiento", 2800);
    },
  },
  {
    slug: "emergencias",
    title: "Emergencias: equipos, plan y simulacros",
    as: "tenant",
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/emergencias`);
      await r.say("1. Registra los equipos de emergencia con su fecha de vencimiento", 1800);
      await r.click(page.getByRole("button", { name: "Agregar equipo" }), 900);
      const dlg = page.getByRole("dialog");
      await r.type(dlg.locator("#na-code"), "EXT-01");
      await r.type(dlg.locator("#na-location"), "Pasillo principal", 35);
      await r.fill(dlg.locator("#na-expiresOn"), "2020-01-01");
      await r.click(dlg.getByRole("button", { name: "Agregar equipo" }), 1500);
      await r.say("Los equipos vencidos se marcan y generan alertas", 2000);
      await r.say("2. Documenta el plan de emergencias de la sede", 1400);
      await r.click(page.getByRole("button", { name: "Crear o actualizar un plan" }), 900);
      const pl = page.getByRole("dialog");
      await r.fill(
        pl.locator("#pl-vulnerabilityAnalysis"),
        "Edificio de dos pisos con una sola salida",
      );
      await r.click(pl.getByRole("button", { name: "Guardar plan" }), 1500);
      await r.say("3. Programa el simulacro y registra su resultado", 1400);
      await r.click(page.getByRole("button", { name: "Programar simulacro" }), 900);
      const sm = page.getByRole("dialog");
      await r.type(sm.locator("#nd-scenario"), "Evacuación por incendio", 35);
      await r.click(sm.getByRole("button", { name: "Programar", exact: true }), 1500);
      await r.click(page.getByRole("button", { name: "Registrar resultado" }), 900);
      const rs = page.getByRole("dialog");
      await r.fill(
        rs.locator('[id^="dr-"][id$="-evaluation"]'),
        "Evacuación completa en cinco minutos",
      );
      await r.fill(
        rs.locator('[id^="dr-"][id$="-improvements"]'),
        "Señalizar la ruta de evacuación B",
      );
      await r.click(rs.getByRole("button", { name: "Registrar simulacro" }), 1600);
      await r.say("Las mejoras del simulacro pasan a ser acciones de seguimiento", 2800);
    },
  },
];
