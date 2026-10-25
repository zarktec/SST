/** Logotipo de ZarK. `white` para fondos oscuros (barra lateral), `navy` para fondos claros (acceso, sitio público). */
export function BrandLogo({
  variant = "navy",
  height = 36,
  className,
}: {
  variant?: "white" | "navy" | "auto";
  height?: number;
  className?: string;
}) {
  const img = (v: "white" | "navy", extra = "") => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/brand/zark-logo-${v}.png`}
      alt={extra ? "" : "ZarK"}
      aria-hidden={extra ? true : undefined}
      width={Math.round(height * 2.7)}
      height={height}
      className={[className, extra].filter(Boolean).join(" ")}
      style={{ height, width: "auto" }}
    />
  );
  // `auto`: azul en tema claro, blanco en tema oscuro.
  if (variant === "auto")
    return (
      <>
        {img("navy", "dark:hidden")}
        {img("white", "hidden dark:block")}
      </>
    );
  return img(variant);
}
