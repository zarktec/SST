import { expect } from "@playwright/test";
import { Pool } from "pg";
import { createWorker } from "../setup";
import type { Scenario } from "../types";
import { TENANT } from "../types";

export const RISK_SYSTEMS: Scenario[] = [
  {
    slug: "alto-riesgo",
    title: "Permisos de trabajo de alto riesgo",
    as: "tenant",
    async setup(page) {
      await createWorker(page, { doc: "1032456789", name: "Ana Pérez" });
    },
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/alto-riesgo`);
      await r.say("1. Crea los tipos de trabajo de alto riesgo de tu empresa", 1800);
      await r.click(page.getByRole("button", { name: "Crear los tipos predeterminados" }), 1500);
      await r.click(page.getByRole("link", { name: "Trabajo en alturas" }), 1500);
      await r.say("2. Solicita el permiso: lugar, descripción y lista de verificación", 1600);
      await r.click(page.getByRole("button", { name: "Solicitar permiso" }), 1100);
      const dlg = page.getByRole("dialog");
      await r.fill(
        dlg.locator("#rq-date"),
        new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
      );
      await r.type(dlg.locator("#rq-place"), "Fachada norte", 35);
      await r.fill(dlg.locator("#rq-description"), "Pintura de la fachada con andamio");
      for (const sel of await dlg.locator('select[id^="rq-c_"]').all())
        await sel.selectOption("ok");
      await r.select(dlg.locator("#rq-coordinatorWorkerId"), { label: "Ana Pérez" });
      await r.fill(dlg.locator("#rq-rescuePlan"), "Rescate con la brigada y camilla");
      await r.check(dlg.getByLabel("Trabaja: Ana Pérez"));
      await r.say("Quien solicita firma el permiso", 900);
      await r.sign(dlg.getByLabel("Área para firmar"));
      await r.click(dlg.getByRole("button", { name: "Solicitar permiso" }), 1800);
      await expect(page.getByText("Pendiente de autorizar").first()).toBeVisible();
      await r.say("El sistema avisa si falta algún certificado vigente", 2600);
      await r.click(page.getByRole("button", { name: "Registrar certificado" }), 900);
      const ce = page.getByRole("dialog");
      await r.type(ce.locator("#ce-issuer"), "SENA", 40);
      await r.fill(ce.locator("#ce-expiresOn"), "2999-01-01");
      await r.click(ce.getByRole("button", { name: "Registrar certificado" }), 1800);
      await r.say("Otra persona distinta a quien solicita debe autorizar con su firma", 3000);
    },
  },
  {
    slug: "quimicos",
    title: "Inventario de sustancias químicas",
    as: "tenant",
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/quimicos`);
      await r.say("Registra cada sustancia química con sus pictogramas de peligro", 2200);
      const add = async (name: string, picto: string) => {
        await r.click(page.getByRole("button", { name: "Agregar sustancia" }), 900);
        const dlg = page.getByRole("dialog");
        await r.type(dlg.locator("#ns-name"), name, 35);
        await r.type(dlg.locator("#ns-location"), "Bodega A", 35);
        await r.check(dlg.locator(`#ns-p_${picto}`));
        await r.click(dlg.getByRole("button", { name: "Agregar sustancia" }), 1500);
      };
      await add("Acetona", "GHS02");
      await r.say("Agrega otra sustancia guardada en el mismo lugar", 1400);
      await add("Peróxido de hidrógeno", "GHS03");
      await expect(page.getByText(/Inflamable con Comburente/)).toBeVisible();
      await r.say(
        "El sistema alerta si dos sustancias incompatibles comparten almacenamiento",
        3200,
      );
      await r.say("También avisa cuando falta la ficha de datos de seguridad (FDS)", 2800);
    },
  },
  {
    slug: "pesv",
    title: "PESV: vehículos, preoperacional y siniestros",
    as: "tenant",
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/pesv`);
      await r.say("1. Registra los vehículos con las fechas de sus documentos", 1800);
      await r.click(page.getByRole("button", { name: "Agregar vehículo" }), 900);
      const dlg = page.getByRole("dialog");
      await r.type(dlg.locator("#nv-plate"), "abc123", 50);
      await r.fill(dlg.locator("#nv-soatExpiresOn"), "2020-01-01");
      await r.click(dlg.getByRole("button", { name: "Agregar vehículo" }), 1500);
      await r.say("Los documentos vencidos se marcan en rojo", 2000);
      await r.say("2. El conductor llena la inspección preoperacional antes de salir", 1800);
      await r.click(page.getByRole("button", { name: "Registrar preoperacional" }), 900);
      const po = page.getByRole("dialog");
      await r.check(po.locator("#po-ok_0"));
      await po.locator("#po-ok_0").uncheck();
      await r.type(po.locator("#po-note_0"), "Pedal de freno blando", 35);
      await r.click(po.getByRole("button", { name: "Registrar preoperacional" }), 1600);
      await r.say("Una falla crítica crea una acción correctiva automáticamente", 2600);
      await r.say("3. Si hay un siniestro vial, regístralo aquí", 1400);
      await r.click(page.getByRole("button", { name: "Registrar siniestro" }), 900);
      const sn = page.getByRole("dialog");
      await r.type(sn.locator("#cr-driverName"), "Luis Gómez", 35);
      await r.type(sn.locator("#cr-place"), "Autopista Norte km 5", 35);
      await r.fill(sn.locator("#cr-description"), "Colisión por alcance sin lesionados");
      await r.click(sn.getByRole("button", { name: "Registrar siniestro" }), 1600);
      await r.say("Los datos alimentan el reporte anual del PESV", 2800);
    },
  },
  {
    slug: "auditorias",
    title: "Auditoría interna del SG-SST",
    as: "tenant",
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/auditorias`);
      await r.say("1. Programa la auditoría con los puntos que se van a revisar", 1800);
      await r.click(page.getByRole("button", { name: "Programar auditoría" }), 900);
      const dlg = page.getByRole("dialog");
      await r.type(dlg.locator("#na-title"), "Auditoría anual del SG-SST", 35);
      await r.fill(dlg.locator("#na-itemsText"), "Política divulgada\nActas del COPASST al día");
      await r.click(dlg.getByRole("button", { name: "Programar auditoría" }), 1600);
      await r.say("2. Ejecútala: califica cada punto y anota las observaciones", 1800);
      await r.click(page.getByRole("button", { name: "Ejecutar la auditoría" }), 900);
      const ex = page.getByRole("dialog");
      await r.type(ex.locator('[id^="ex-"][id$="-auditorName"]'), "Marta Díaz", 35);
      await r.type(ex.locator('[id^="ex-"][id$="-committeeParticipant"]'), "Luis Gómez", 35);
      await r.select(ex.locator('[id^="ex-"][id$="-r_a1"]'), "conforms");
      await r.select(ex.locator('[id^="ex-"][id$="-r_a2"]'), "major_nc");
      await r.type(ex.locator('[id^="ex-"][id$="-n_a2"]'), "Faltan tres actas", 35);
      await r.fill(
        ex.locator('[id^="ex-"][id$="-report"]'),
        "El sistema cumple parcialmente los requisitos evaluados",
      );
      await r.click(ex.getByRole("button", { name: "Guardar avance" }), 1500);
      await r.say("3. Al cerrar la auditoría, las no conformidades pasan a ser acciones", 1800);
      await r.click(page.getByRole("button", { name: "Cerrar auditoría" }), 1800);
      await r.say("El informe y los hallazgos quedan guardados para consulta", 2600);
    },
  },
  {
    slug: "revision-direccion",
    title: "Revisión por la alta dirección",
    as: "tenant",
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/revision-direccion`);
      await r.say("Una vez al año la alta dirección revisa el desempeño del sistema", 2400);
      await r.click(page.getByRole("button", { name: "Nueva revisión" }), 900);
      const dlg = page.getByRole("dialog");
      await r.fill(dlg.locator("#nr-attendees"), "Gerente general y responsable del SG-SST");
      await r.click(dlg.getByRole("button", { name: /Crear la revisión/ }), 1600);
      await r.say("El sistema reúne las entradas: accidentalidad, indicadores, auditorías…", 3000);
      await r.click(page.getByRole("button", { name: "Completar la revisión" }), 900);
      const rv = page.getByRole("dialog");
      await r.fill(
        rv.locator('[id^="rv-"][id$="-conclusions"]'),
        "El sistema es conveniente y adecuado pero requiere más recursos",
      );
      await r.fill(
        rv.locator('[id^="rv-"][id$="-decisions"]'),
        "Asignar presupuesto para capacitación",
      );
      await r.click(rv.getByRole("button", { name: "Guardar revisión" }), 1600);
      await r.say("La alta dirección firma: la revisión queda congelada", 1600);
      await r.click(page.getByRole("button", { name: "Firmar (alta dirección)" }), 1100);
      const f = page.getByRole("dialog");
      await r.sign(f.getByLabel("Área para firmar"));
      await r.click(f.getByRole("button", { name: "Firmar revisión" }), 1800);
      await r.say("Las decisiones se convierten en acciones de seguimiento", 2800);
    },
  },
  {
    slug: "documentos",
    title: "Documentos: versiones y aprobación con firma",
    as: "tenant",
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/documentos`);
      await r.say("La lista maestra reúne los documentos del SG-SST con sus versiones", 2400);
      await r.click(page.getByRole("button", { name: "Crear documento" }), 900);
      const dlg = page.getByRole("dialog");
      await r.type(dlg.locator("#nd-code"), "POL-001");
      await r.type(dlg.locator("#nd-title"), "Política de seguridad y salud en el trabajo", 30);
      await r.select(dlg.locator("#nd-kind"), "policy");
      await r.fill(
        dlg.locator("#nd-body"),
        "La empresa se compromete a proteger la seguridad y la salud de todos sus trabajadores.",
      );
      await r.click(dlg.getByRole("button", { name: "Crear documento" }), 1600);
      await r.say("Quien redacta no puede aprobar: otra persona debe hacerlo con su firma", 3200);
      // Simula que lo redactó otra persona para mostrar la aprobación.
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      await pool.query(
        "UPDATE document_version SET created_by = 'otro-usuario', created_by_name = 'Otra Persona'",
      );
      await pool.end();
      await page.reload();
      await page.waitForLoadState("load");
      await r.click(page.getByRole("button", { name: "Aprobar el borrador" }), 1100);
      const ap = page.getByRole("dialog");
      await r.sign(ap.getByLabel("Área para firmar"));
      await r.click(ap.getByRole("button", { name: "Aprobar con mi firma" }), 1800);
      await r.say("El documento queda vigente. Para cambiarlo se crea una nueva versión", 2800);
    },
  },
];
