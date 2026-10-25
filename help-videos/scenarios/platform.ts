import { expect } from "@playwright/test";
import type { Scenario } from "../types";
import { ADMIN } from "../types";

export const PLATFORM: Scenario[] = [
  {
    slug: "panel",
    title: "Recorrido por el panel de administración",
    as: "admin",
    async run(r) {
      const { page } = r;
      await r.goto(`${ADMIN}/`);
      await r.say("Este es el panel del SUPER ADMIN de la plataforma", 2400);
      for (const [name, text] of [
        ["Empresas", "Aquí administras las empresas clientes y sus suscripciones"],
        ["Planes", "Define los planes, sus precios y el IVA"],
        ["Pagos", "Consulta los pagos y las facturas electrónicas"],
        ["Integraciones", "Configura Wompi, Siigo, AUCO y los accesos con Google"],
      ] as const) {
        const link = page.getByRole("link", { name, exact: true }).first();
        if (await link.count()) {
          await r.click(link, 1200);
          await r.say(text, 2400);
        }
      }
    },
  },
  {
    slug: "empresas",
    title: "Crear y administrar empresas",
    as: "admin",
    async run(r) {
      const { page } = r;
      await r.goto(`${ADMIN}/empresas`);
      await r.say("1. Pulsa «Nueva empresa» y llena sus datos", 1600);
      await r.click(page.getByRole("button", { name: "Nueva empresa" }), 900);
      const dlg = page.getByRole("dialog");
      await r.type(dlg.getByLabel("Nombre comercial"), "Constructora Andina", 35);
      await r.type(dlg.getByLabel("Razón social"), "Constructora Andina S.A.S.", 30);
      await r.type(dlg.getByLabel(/^NIT/), "900555111", 40);
      await r.type(dlg.getByLabel("Identificador en la dirección"), "demo-constructora", 35);
      await r.type(dlg.getByLabel(/^Correo del administrador/), "gerente@constructora.co", 30);
      await r.click(dlg.getByRole("button", { name: "Crear empresa" }), 1800);
      await expect(page.getByRole("heading", { name: "Constructora Andina" })).toBeVisible();
      await r.say(
        "La empresa empieza con el periodo de prueba y su administrador recibe la invitación",
        3200,
      );
      await r.say(
        "2. Desde aquí suspendes o reactivas la suscripción, siempre con un motivo",
        1800,
      );
      await r.type(page.getByLabel("Motivo"), "Solicitud del cliente", 35);
      await r.click(page.getByRole("button", { name: /Suspender/ }), 1800);
      await r.say("3. También puedes extender los días de prueba", 1400);
      await r.type(page.getByLabel("Días a extender"), "10", 60);
      await r.click(page.getByRole("button", { name: "Extender prueba" }), 1800);
      await r.say("Cada cambio queda en el historial de la suscripción", 2800);
    },
  },
  {
    slug: "planes",
    title: "Planes, precios e IVA",
    as: "admin",
    async run(r) {
      const { page } = r;
      await r.goto(`${ADMIN}/planes`);
      await r.say("1. Crea un plan con su precio mensual y anual", 1600);
      await r.click(page.getByRole("button", { name: "Nuevo plan" }), 900);
      const dlg = page.getByRole("dialog");
      await r.type(dlg.getByLabel(/^Clave/), "demo-profesional", 30);
      await r.type(dlg.getByLabel("Nombre"), "Profesional", 40);
      await r.type(dlg.getByLabel("Precio mensual (COP)"), "200000", 40);
      await r.type(dlg.getByLabel("Precio anual (COP)"), "2000000", 40);
      await r.say("La vista previa calcula el IVA y el total mientras escribes", 2600);
      await r.check(dlg.getByLabel("El precio ya incluye IVA"));
      await r.say("Si el precio ya incluye IVA, el sistema separa el neto del impuesto", 2600);
      await dlg.getByLabel("El precio ya incluye IVA").uncheck();
      await r.click(dlg.getByRole("button", { name: "Crear plan" }), 1800);
      await r.say("2. Para cambiar un precio, usa «Editar plan»", 1400);
      await r.click(page.getByRole("button", { name: "Editar plan" }), 900);
      const ed = page.getByRole("dialog");
      await r.type(ed.getByLabel("Precio mensual (COP)"), "250000", 40);
      await r.click(ed.getByRole("button", { name: "Guardar cambios" }), 1800);
      await r.say("Los cambios aplican a las próximas renovaciones", 2800);
    },
  },
  {
    slug: "cupones",
    title: "Cupones de descuento",
    as: "admin",
    async run(r) {
      const { page } = r;
      await r.goto(`${ADMIN}/cupones`);
      await r.say("Los cupones dan descuentos a las empresas que se registran", 2400);
      await r.click(page.getByRole("button", { name: "Nuevo cupón" }), 900);
      const dlg = page.getByRole("dialog");
      await r.type(dlg.getByLabel("Código"), "demo10", 50);
      await r.type(dlg.getByLabel(/^Valor/), "10", 60);
      await r.click(dlg.getByRole("button", { name: "Crear cupón" }), 1800);
      await r.say("El código no se puede repetir: el sistema avisa si ya existe", 3000);
    },
  },
  {
    slug: "pagos",
    title: "Pagos y facturas",
    as: "admin",
    async run(r) {
      const { page } = r;
      await r.goto(`${ADMIN}/pagos`);
      await r.say("Aquí aparecen los últimos pagos de todas las empresas", 2600);
      await r.hover(page.getByRole("heading", { name: "Últimos pagos" }));
      await r.say("Cada pago muestra el estado de su factura electrónica ante la DIAN", 3000);
      await r.say("Si una factura falla puedes reintentarla o emitir una nota crédito", 3200);
    },
  },
  {
    slug: "integraciones",
    title: "Centro de integraciones",
    as: "admin",
    async run(r) {
      const { page } = r;
      await r.goto(`${ADMIN}/integrations/wompi`);
      await r.say("Cada integración se configura aquí, en ambiente de pruebas o producción", 2600);
      await r.type(page.locator("#sandbox-publicKey"), "pub_test_ABC123", 30);
      await r.click(page.getByRole("button", { name: "Guardar configuración" }), 1500);
      await r.say("Las llaves secretas se guardan cifradas", 1600);
      await r.type(page.locator("#sandbox-privateKey"), "prv_test_SUPERSECRETO987654", 25);
      await r.click(page.getByRole("button", { name: "Guardar secreto" }).first(), 1800);
      await r.say("Después solo verás una versión enmascarada: nunca se vuelve a mostrar", 3200);
      await r.say("«Probar conexión» verifica las credenciales antes de activar", 2800);
    },
  },
  {
    slug: "catalogos",
    title: "Catálogos normativos versionados",
    as: "admin",
    async run(r) {
      const { page } = r;
      await r.goto(`${ADMIN}/catalogos`);
      await r.say("Los catálogos normativos tienen versiones: las publicadas no se editan", 2800);
      await r.goto(`${ADMIN}/catalogos/hazard_catalog`);
      await r.say("1. Crea un borrador de la nueva versión", 1400);
      await r.click(page.getByRole("button", { name: /Crear borrador/ }), 1800);
      await page.waitForLoadState("networkidle");
      await r.say("2. Importa los elementos desde un archivo CSV", 1600);
      const csv =
        "family,hazard,description\nFísico,Ruido,Exposición a ruido continuo\nQuímico,Polvo,\n";
      await page
        .getByLabel("Archivo")
        .setInputFiles({ name: "peligros.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
      await r.click(page.getByRole("button", { name: "Importar" }), 1800);
      await r.say("3. Para publicar, indica desde cuándo vale y su norma fuente", 1600);
      await r.fill(page.getByLabel("Vigente desde"), "2026-01-01");
      await r.type(page.getByLabel("Norma fuente"), "GTC 45", 50);
      await r.click(page.getByRole("button", { name: "Publicar" }), 1800);
      await r.say("La versión publicada queda inmutable y con su historial", 2800);
    },
  },
];
