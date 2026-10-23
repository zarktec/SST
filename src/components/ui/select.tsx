import * as React from "react";

/**
 * <select> nativo que se vuelve a montar cuando cambia su `defaultValue`: React no actualiza la opción seleccionada de un
 * select no controlado, y al reiniciar el formulario (React 19) quedaría el valor original en vez del enviado.
 */
export function Select({ defaultValue, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select key={String(defaultValue ?? "")} defaultValue={defaultValue} {...props} />;
}
