# Guía de usuario

La guía de usuario **está dentro de la aplicación**: **Menú → Ayuda** (`/ayuda` en la dirección de tu empresa, y `/ayuda` en el panel de administración).

- Guías paso a paso de cada módulo, agrupadas por tema, con buscador (sin importar tildes ni mayúsculas).
- Botón **?** en la barra superior: abre la guía del módulo donde estás.
- Primeros pasos, roles y permisos, glosario, preguntas frecuentes, cómo firmar y cómo trabajar sin conexión.
- Guía del panel de administración (empresas, planes, cupones, pagos, integraciones y catálogos).

## Para quien mantiene el código

- El contenido vive en `src/modules/help/content/*.ts` como datos tipados (`Article` y bloques: párrafo, pasos, lista, definiciones, consejo/importante/nota; el texto admite `**negrita**`).
- Al **agregar un módulo o una pantalla en el menú** (`src/components/layout/nav-config.ts`), agrega su guía: la prueba `src/modules/help/help.test.ts` falla si un ítem del menú no tiene artículo, si una ruta no existe o si un enlace «relacionado» apunta a una guía inexistente.
- La ayuda contextual (botón **?**) usa la primera ruta de cada artículo (`route`); por eso el `slug` y la ruta deben corresponder al módulo.
- Escribe los nombres de botones y campos **tal como aparecen en pantalla**; cada cifra normativa provisional se describe como tal.
