# Sistema de Diseño y Tokens UI/UX

La página emplea una estética altamente premium que mezcla el **Industrial Noir** con **Arcane Luxury**. El objetivo de este sistema es evocar tecnología de punta ("high tech"), pero sin que deje de verse empresarial (serio) y futurista / misterioso a la vez.

## Paleta de Colores

- **Colores de Fondo (Dark Theme Nativos):**
  - `Void (#050709)`: El pozo negro base del canvas.
  - `Dark (#0A0D12)`: Fondo principal sobre el cual fluyen los bloques.
  - `Surface (#0F1319)`: Fondo elevado, usado en las tarjetas.
  - `Surface-2 (#151C25)`: Hover states en tarjetas muy pronunciadas.

- **Colores de Acento "Arcano":**
  - `Amber (#F5A623)`: El acento predominante. Genera urgencia, energía y llama a la acción.
  - `Arcane (#8B31FF)`: Morado profundo/místico que representa la Inteligencia Artificial "mágica".
  - `Teal (#00D4AA)`: Representativo de las datas conectadas, el "verde" de éxito de un sistema funcional. Usado primordialmente cuando el usuario interactúa activamente con la tecnología real (como conectarse al AI Bot).

- **Texto:**
  - `Text-1 (#F0F4F8)`: Títulos principales.
  - `Text-2 (#A8B5C4)`: Párrafos descriptivos y legibilidad extendida.
  - `Text-3 (#5A6A7A)`: Etiquetas mutadas, de prioridad menor y códigos.

## Tipografía
1. **Display (Títulos):** `Bebas Neue`. Denota control, robustez empresarial y alto contraste moderno.
2. **Body (Párrafos y UI):** `Outfit`. Muy geométrica, con toque tecnológico sin perder la humanidad y legibilidad de alto estándar.
3. **Mono (Etiquetas y Datos):** `Space Mono`. Añade el componente de "Desarrollo / Código", aportando confianza tecnológica.

## Puntos Técnicos Resolutivos (UX)
Cumple lineamientos de **Accesibilidad y Movimiento** revisados por la IA:
- Cursor inteligente que otorga `pointer` e indica retroalimentación táctil a los elementos dinámicos mediante enrosque lumínico.
- Fuerte consideración por teclado (`:focus-visible` con borde interactivo Ámbar de 2px).
- Interrupción de bloqueos CSS en animaciones para quienes presenten *prefers-reduced-motion* en su hardware. Todo por la salud y paz del usuario.
