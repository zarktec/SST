import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  render,
} from "@react-email/components";

export type Brand = { name: string; primary: string; logoUrl?: string | null };
export const DEFAULT_BRAND: Brand = { name: "SST", primary: "#0f766e" };

function Shell({
  brand,
  preview,
  title,
  children,
}: {
  brand: Brand;
  preview: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Html lang="es-CO">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: "#f4f4f5",
          fontFamily: "system-ui, sans-serif",
          margin: 0,
          padding: "24px 0",
        }}
      >
        <Container
          style={{ backgroundColor: "#ffffff", borderRadius: 12, maxWidth: 480, padding: 32 }}
        >
          <Section>
            <Text style={{ color: brand.primary, fontSize: 18, fontWeight: 700, margin: 0 }}>
              {brand.name}
            </Text>
          </Section>
          <Heading as="h2" style={{ fontSize: 20, margin: "24px 0 12px" }}>
            {title}
          </Heading>
          {children}
        </Container>
      </Body>
    </Html>
  );
}

function Cta({ brand, href, children }: { brand: Brand; href: string; children: React.ReactNode }) {
  return (
    <Button
      href={href}
      style={{
        backgroundColor: brand.primary,
        borderRadius: 8,
        color: "#ffffff",
        fontWeight: 600,
        padding: "12px 20px",
        textDecoration: "none",
      }}
    >
      {children}
    </Button>
  );
}

export function renderMagicLink(brand: Brand, url: string) {
  return render(
    <Shell brand={brand} preview="Tu enlace de acceso" title="Ingresa a tu cuenta">
      <Text>
        Haz clic en el botón para ingresar. El enlace es de un solo uso y vence en 10 minutos.
      </Text>
      <Cta brand={brand} href={url}>
        Ingresar
      </Cta>
      <Text style={{ color: "#71717a", fontSize: 12 }}>
        Si no solicitaste este correo, puedes ignorarlo.
      </Text>
    </Shell>,
  );
}

export function renderVerifyEmail(brand: Brand, url: string) {
  return render(
    <Shell brand={brand} preview="Confirma tu correo" title="Confirma tu correo electrónico">
      <Text>Confirma tu correo para activar tu cuenta.</Text>
      <Cta brand={brand} href={url}>
        Confirmar correo
      </Cta>
    </Shell>,
  );
}

export function renderResetPassword(brand: Brand, url: string) {
  return render(
    <Shell brand={brand} preview="Restablece tu contraseña" title="Restablece tu contraseña">
      <Text>Usa este enlace para elegir una nueva contraseña. Vence en 1 hora.</Text>
      <Cta brand={brand} href={url}>
        Cambiar contraseña
      </Cta>
    </Shell>,
  );
}
