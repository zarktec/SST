import { expect } from "@playwright/test";
import { createAction, createWorker } from "../setup";
import type { Scenario } from "../types";
import { TENANT } from "../types";

export const ACCOUNT: Scenario[] = [
  {
    slug: "onboarding",
    title: "Configurar tu SG-SST: empresa, sedes, responsable y marca",
    as: "tenant",
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/onboarding?paso=1`);
      await r.say("El onboarding tiene 5 pasos. Paso 1: los datos de la empresa", 2200);
      await r.type(page.getByLabel("NIT (sin DV ni puntos)"), "900123456");
      await r.type(page.getByLabel("Dígito de verificación"), "8");
      await r.type(page.getByLabel("Razón social"), "Empresa Demo S.A.S.", 35);
      await r.type(page.getByLabel("Nombre comercial"), "Empresa Demo", 35);
      await r.type(page.getByLabel(/Actividad económica/), "4711");
      await r.say("Indica la clase de riesgo, la ARL y cuántas personas trabajan", 1400);
      await r.type(page.getByLabel("Clase de riesgo (1 a 5)"), "1");
      await r.type(page.getByLabel("ARL", { exact: true }), "Sura");
      await r.type(page.getByLabel("Representante legal"), "Ana Pérez", 35);
      await r.type(page.getByLabel("Número de trabajadores"), "8");
      await r.say("Al guardar, la plataforma te clasifica en 7, 21 o 60 estándares mínimos", 1000);
      await r.click(page.getByRole("button", { name: "Guardar y clasificar" }), 1500);
      await expect(page.getByText("Te aplican 7 estándares mínimos")).toBeVisible();
      await r.pause(2200);

      await r.goto(`${TENANT}/onboarding?paso=2`);
      await r.say("Paso 2: agrega cada sede o centro de trabajo", 1800);
      await r.type(page.getByLabel("Nombre de la sede").last(), "Sede principal", 35);
      await r.click(page.getByRole("button", { name: "Agregar sede" }), 1500);

      await r.goto(`${TENANT}/onboarding?paso=3`);
      await r.say("Paso 3: la persona responsable del SG-SST y su licencia", 2000);
      await r.type(page.getByLabel("Nombre completo"), "Luis Gómez", 35);
      await r.type(page.getByLabel("Número de documento"), "1032456789");
      await r.type(page.getByLabel("Correo"), "luis@demo.test", 35);
      await r.type(page.getByLabel("Licencia en SST (número)"), "L-123");
      await r.fill(page.getByLabel("Vigencia de la licencia"), "2032-01-01");
      await r.fill(page.getByLabel(/Curso de 50 horas: fecha/), "2025-06-01");
      await r.click(page.getByRole("button", { name: "Guardar responsable" }), 1500);

      await r.goto(`${TENANT}/onboarding?paso=4`);
      await r.say("Paso 4: los colores de tu marca. La plataforma verifica que se lean bien", 3000);
      await r.goto(`${TENANT}/onboarding?paso=5`);
      await r.say("Paso 5: revisa el resumen y finaliza", 1800);
      await r.click(page.getByRole("button", { name: "Finalizar onboarding" }), 1500);
      await page.waitForURL(TENANT);
      await r.say("¡Listo! Tu empresa quedó configurada", 2200);
    },
  },
  {
    slug: "facturacion",
    title: "Facturación: plan, datos fiscales y pagos",
    as: "tenant",
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/facturacion`);
      await r.say(
        "Aquí ves tu plan, tus métodos de pago, tus datos de facturación y tu historial",
        2800,
      );
      await r.hover(page.getByRole("heading", { name: "Mi plan" }));
      await r.pause(900);
      await r.say("Para recibir factura electrónica, completa tus datos de facturación", 1600);
      await r.click(page.getByRole("button", { name: "Editar datos de facturación" }), 1000);
      const dlg = page.getByRole("dialog");
      await r.type(dlg.getByLabel("Número de documento (sin puntos ni DV)"), "900123456");
      await r.type(dlg.getByLabel("Dígito de verificación (NIT)"), "1");
      await r.type(dlg.getByLabel("Razón social o nombre completo"), "Empresa Demo SAS", 35);
      await r.type(dlg.getByLabel("Dirección", { exact: true }), "Calle 1 # 2-3", 35);
      await r.type(dlg.getByLabel("Municipio (código DANE de 5 dígitos)"), "11001");
      await r.type(dlg.getByLabel("Teléfono"), "3001234567");
      await r.type(
        dlg.getByLabel("Correo para recibir la factura electrónica"),
        "facturas@demo.test",
        30,
      );
      await r.check(dlg.getByLabel(/O-13/));
      await r.say(
        "El dígito de verificación del NIT se valida: si está mal, te dice cuál es",
        1000,
      );
      await r.click(dlg.getByRole("button", { name: "Guardar datos de facturación" }), 1800);
      await r.type(dlg.getByLabel("Dígito de verificación (NIT)"), "8");
      await r.click(dlg.getByRole("button", { name: "Guardar datos de facturación" }), 1600);
      await r.say("Los cambios de plan aplican en la próxima renovación", 2600);
    },
  },
  {
    slug: "dominio",
    title: "Conectar tu dominio propio",
    as: "tenant",
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/dominio`);
      await r.say("Tu empresa tiene una dirección en la plataforma", 2200);
      await r.say("Si prefieres usar tu propio dominio, pulsa «Conectar dominio propio»", 1000);
      await r.click(page.getByRole("button", { name: "Conectar dominio propio" }), 900);
      const dlg = page.getByRole("dialog");
      await r.type(dlg.getByLabel("Tu dominio"), "sst.miempresa.com", 40);
      await r.click(dlg.getByRole("button", { name: "Conectar dominio" }), 1800);
      await expect(page.getByText("sst.miempresa.com").first()).toBeVisible();
      await r.say(
        "La plataforma te da las instrucciones DNS que debes configurar donde administras tu dominio",
        3600,
      );
    },
  },
  {
    slug: "privacidad",
    title: "Autorizar el tratamiento de datos y ejercer tus derechos",
    as: "tenant",
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/privacidad`);
      await r.say("Aquí lees el aviso de privacidad y autorizas el tratamiento de tus datos", 2800);
      await r.click(page.getByRole("button", { name: "Mi autorización de datos" }), 900);
      const dlg = page.getByRole("dialog");
      await r.say("La autorización general es obligatoria; la de datos de salud es opcional", 2400);
      await r.check(dlg.locator("#co-general"));
      await r.click(dlg.getByRole("button", { name: "Guardar mi autorización" }), 1500);
      await r.say("Para consultar, corregir o suprimir tus datos, radica una solicitud", 1400);
      await r.click(page.getByRole("button", { name: "Radicar solicitud" }), 900);
      const req = page.getByRole("dialog");
      await r.fill(req.locator("#rq-detail"), "Quiero conocer qué datos míos tienen registrados");
      await r.click(req.getByRole("button", { name: "Radicar solicitud" }), 1500);
      await r.say("La solicitud queda «En trámite» hasta que el responsable la responda", 2800);
    },
  },
  {
    slug: "portal",
    title: "Mi portal: lo que te corresponde como trabajador",
    as: "tenant",
    async setup(page) {
      await createWorker(page, {
        doc: "1032456789",
        name: "Ana Pérez",
        position: "Operaria",
        email: "demo@demo.test",
      });
    },
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/portal`);
      await r.say(
        "Mi portal reúne lo tuyo: pendientes, capacitaciones, EPP, evaluaciones y reportes",
        3000,
      );
      await r.hover(page.getByRole("heading", { name: "Mis capacitaciones" }));
      await r.say(
        "Aquí ves las capacitaciones a las que asististe y descargas tu certificado",
        2600,
      );
      await r.hover(page.getByRole("heading", { name: "Mis elementos de protección personal" }));
      await r.say("Y los elementos de protección que te entregaron", 2200);
      await r.hover(page.getByRole("heading", { name: "Mis reportes" }));
      await r.say("También ves el estado de lo que has reportado", 2200);
    },
  },
  {
    slug: "notificaciones",
    title: "Alertas y calendario de obligaciones",
    as: "tenant",
    async setup(page) {
      await createAction(page, "Reparar la baranda de la escalera", "2020-01-01");
      await page.evaluate(
        async ([url, secret]) =>
          (await fetch(`${url}/api/cron/daily`, { headers: { authorization: `Bearer ${secret}` } }))
            .status,
        [TENANT, "e2e-cron-secret"] as const,
      );
    },
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/notificaciones`);
      await r.say("Cada día la plataforma revisa tu empresa y crea alertas de lo que vence", 2800);
      await r.hover(page.getByText(/1 acción vencida/));
      await r.say("Cada alerta lleva a la pantalla donde se resuelve", 2200);
      await r.say("Marca las alertas como leídas cuando las atiendas", 1000);
      await r.click(page.getByRole("button", { name: "Marcar todas como leídas" }), 1500);
      await r.say("Activa los avisos en este dispositivo para recibirlas en tu celular", 2600);
      await r.hover(page.getByRole("heading", { name: /Notificaciones en este dispositivo/ }));
      await r.goto(`${TENANT}/calendario`);
      await r.say("El calendario reúne todas las fechas importantes del SG-SST", 2800);
      await r.say("Y puedes descargarlo para tu agenda de Google o Outlook", 2400);
    },
  },
  {
    slug: "informes",
    title: "Informes y exportaciones",
    as: "tenant",
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/informes`);
      await r.say("Aquí descargas informes del SG-SST en PDF, Excel o CSV", 2800);
      await r.hover(page.getByRole("heading", { name: "Carpeta de inspección" }));
      await r.say(
        "La carpeta de inspección reúne todos los soportes en un ZIP con un índice de huellas",
        3400,
      );
      await r.hover(page.getByRole("heading", { name: "Exportación total de los datos" }));
      await r.say(
        "Y la exportación total te entrega toda tu información cuando la necesites",
        3000,
      );
    },
  },
];
