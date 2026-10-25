import { expect } from "@playwright/test";
import type { Scenario } from "../types";
import { TENANT } from "../types";

export const START: Scenario[] = [
  {
    slug: "primeros-pasos",
    title: "Primeros pasos: ingresar y recorrer la plataforma",
    as: "anon",
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/login`);
      await r.say("1. Abre la dirección de tu empresa e ingresa con tu correo y contraseña");
      await r.type(page.getByLabel("Correo electrónico"), "demo@demo.test");
      await r.type(page.getByLabel("Contraseña"), "DemoClave-2026!", 30);
      await r.say("También puedes pedir un enlace de acceso por correo, sin contraseña", 1800);
      await r.hover(
        page
          .getByRole("tab", { name: /Enlace/ })
          .or(page.getByText("Enlace por correo"))
          .first(),
      );
      await r.click(page.getByRole("button", { name: "Ingresar" }), 1500);
      await page.waitForURL(TENANT);
      await r.say(
        "2. Esta es tu página de Inicio: accesos rápidos y una tarjeta por cada módulo",
        2400,
      );
      await r.say("3. El menú lateral agrupa los módulos por tema. Solo ves los de tu rol", 1200);
      await r.hover(page.getByRole("link", { name: "Personas", exact: true }).first());
      const nav = page.getByRole("navigation", { name: "Principal" });
      await nav.evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }));
      await r.pause(1800);
      await nav.evaluate((el) => el.scrollTo({ top: 0, behavior: "smooth" }));
      await r.pause(900);
      await r.say("4. El buscador encuentra personas, documentos y acciones", 1000);
      await r.type(page.getByRole("searchbox", { name: "Buscar" }).first(), "capacitación", 60);
      await r.say(
        "5. La campana muestra tus alertas y el botón ? abre la guía de la pantalla donde estás",
        1000,
      );
      await r.hover(page.getByRole("link", { name: /Alertas/ }).first());
      await r.pause(700);
      await r.click(
        page.getByRole("link", { name: /Centro de ayuda|Ayuda sobre esta pantalla/ }).first(),
        1600,
      );
      await r.say("6. Y el botón de la luna cambia entre modo claro y oscuro", 1000);
      await r.click(page.getByRole("button", { name: /modo claro y oscuro/ }).first(), 2600);
      await r.click(page.getByRole("button", { name: /modo claro y oscuro/ }).first(), 1200);
      await r.say("¡Listo! Sigue con «Configurar tu SG-SST» para dejar la empresa lista", 2200);
    },
  },
  {
    slug: "usuarios",
    title: "Invitar personas y asignar roles",
    as: "tenant",
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/usuarios`);
      await r.say("Aquí invitas a las personas de tu empresa y les asignas un rol", 2000);
      await r.say("1. Pulsa «Invitar persona»", 700);
      await r.click(page.getByRole("button", { name: "Invitar persona", exact: true }), 900);
      const dlg = page.getByRole("dialog");
      await r.say("2. Escribe su correo y elige el rol", 700);
      await r.type(dlg.getByLabel("Correo", { exact: true }), "maria.lopez@miempresa.com");
      await r.select(dlg.getByLabel("Rol"), { label: "Responsable del SG-SST" });
      await r.say("3. Envía la invitación: recibirá un correo y vence en 14 días", 900);
      await r.click(dlg.getByRole("button", { name: "Enviar invitación" }), 1500);
      await expect(page.getByText("Invitación enviada.")).toBeVisible();
      await r.say("La invitación queda pendiente. Puedes revocarla mientras no se acepte", 2600);
      await r.hover(page.getByText("maria.lopez@miempresa.com"));
      await r.say(
        "Cuando acepten, aparecerán en «Miembros»: desde ahí cambias su rol o desactivas su acceso",
        3200,
      );
      await r.hover(page.getByRole("heading", { name: /Miembros/ }));
      await r.pause(1200);
    },
  },
  {
    slug: "personas",
    title: "Registrar personas y cargar muchas con un archivo",
    as: "tenant",
    async run(r) {
      const { page } = r;
      await r.goto(`${TENANT}/personas`);
      await r.say("En Personas registras a trabajadores, aprendices y contratistas", 2000);
      await r.say("1. Pulsa «Registrar» y completa la ficha", 800);
      await r.click(page.getByRole("button", { name: "Registrar", exact: true }), 900);
      const dlg = page.getByRole("dialog");
      await r.type(dlg.getByLabel("Número de documento"), "1032456789");
      await r.type(dlg.getByLabel("Nombre completo"), "Ana Pérez");
      await r.type(dlg.getByLabel("Cargo"), "Operaria de bodega");
      await r.fill(dlg.getByLabel("Fecha de ingreso"), "2024-03-01");
      await r.say("2. Guarda: el documento queda cifrado y solo verás los últimos 4 dígitos", 1000);
      await r.click(dlg.getByRole("button", { name: "Registrar", exact: true }), 1500);
      await expect(page.getByText("Persona registrada.")).toBeVisible();
      await r.say("3. Para registrar muchas personas, usa «Carga masiva» con un archivo CSV", 1200);
      await r.click(page.getByRole("button", { name: "Carga masiva" }), 1000);
      const imp = page.getByRole("dialog");
      await r.say("Descarga la plantilla, llénala en Excel, guárdala como CSV y súbela", 2400);
      const csv = [
        "vinculacion,tipo_documento,documento,nombre,fecha_ingreso",
        "Trabajador,CC,1020304050,Luis Gómez,2024-02-01",
        "Contratista,CC,1098765432,Marta Díaz,2024-05-10",
        "Trabajador,CC,abc,Fila con error,2024-02-01",
      ].join("\n");
      await imp
        .getByLabel(/Archivo CSV/)
        .setInputFiles({ name: "personas.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
      await r.pause(900);
      await r.click(imp.getByRole("button", { name: "Importar" }), 1200);
      await r.say(
        "El reporte indica cuántas filas se importaron y cuáles tienen error, con su número de fila",
        3200,
      );
      await r.click(imp.getByRole("button", { name: "Cerrar" }), 900);
      await r.say(
        "Abre una persona para editarla, registrar su retiro o verificar su seguridad social",
        1200,
      );
      await r.click(page.getByRole("link", { name: /Marta Díaz/ }).last(), 1500);
      await r.hover(page.getByRole("button", { name: "Verificar seguridad social" }));
      await r.pause(1500);
    },
  },
];
