---
target: prototype/index.html
total_score: 18
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-07-26T01-29-32Z
slug: prototype-index-html
---
Method: dual-agent (A: b2d688b7-c6c7-44a6-849b-27b68db4c8eb · B: 88013d14-77b6-440b-988b-9c17042ccdcd)

# Reporte de Crítica de Diseño — Cassandra HQ (Prototipo)

**Objetivo:** `prototype/index.html`  
**Referencia:** `PRODUCT.md`  

---

### Design Health Score (Nielsen Usability Heuristics)

| # | Heurística | Puntuación | Problema Clave |
|---|-----------|:---:|---|
| 1 | Visibilidad del estado del sistema | 3 | Progreso dinámico en "Mi Día", pero `alert()` bloqueante al crear tareas. |
| 2 | Coincidencia entre el sistema y el mundo real | 3 | Vocabulario natural en español; los módulos "Próximamente" necesitan contexto. |
| 3 | Control y libertad del usuario | 2 | Borrar subtareas no ofrece función "Deshacer" (Undo). |
| 4 | Consistencia y estándares | 3 | Representación inconsistente de prioridades (badges, puntos, emojis). |
| 5 | Prevención de errores | 1 | Permite guardar tareas sin título; el drawer se cierra sin avisar cambios no guardados. |
| 6 | Reconocimiento antes que recuerdo | 2 | Tareas duplicadas en "Mi Día" y lista inferior cargan la memoria. |
| 7 | Flexibilidad y eficiencia de uso | 1 | Sin atajos de teclado (`Cmd+K`, `Esc`); uso de ratón obligatorio. |
| 8 | Diseño estético y minimalista | 2 | Ruido visual por tarjetas duplicadas y múltiples badges compitiendo. |
| 9 | Reconocer y recuperarse de errores | 1 | Sin mensajes de validación inline ni pantallas de estado vacío. |
| 10 | Ayuda y documentación | 0 | Ausencia de tooltips o guías de enfoque TDAH. |
| **Total** | | **18/40** | **Poor (Requiere mejoras clave de UX y accesibilidad)** |

---

### Veredicto de Especificidad de Diseño

* **Evaluación LLM (Assessment A):** El prototipo tiene una base visual oscura atractiva, pero su estructura es la de un dashboard estándar. Requiere affordances genuinas para TDAH como un modo "Hyperfocus" de una sola tarea, paleta `Cmd+K`, clasificación por nivel de energía cognitiva y feedback de logro al completar tareas.
* **Escaneo Determinista (Assessment B):** 1 advertencia encontrada (`overused-font`) por el uso de `Plus Jakarta Sans` en el `<head>`.

---

### Impresión General
Diseño estético y limpio, pero con alta sobrecarga por duplicidad de elementos en pantalla, falta de accesibilidad por teclado y ausencia de atajos rápidos.

---

### Lo que Funciona Bien
1. Paleta de colores oscuros bien estructurada (`#0B0F17` / `#0F1623`) que reduce la fatiga visual.
2. Indicador de progreso dinámico en tiempo real (*"3 de 5 completadas (60%)"*).
3. Animación fluida del panel lateral deslizante (Drawer).

---

### Problemas Prioritarios (P0 - P3)

* **[P0] Accesibilidad y Navegación por Teclado Inexistente**
  * *Por qué importa:* Los checkboxes ocultan el outline nativo, las filas `onclick` en `<div>` no aceptan foco Tab ni `Enter`/`Space`, y el Drawer no atrapa el foco.
  * *Solución:* Añadir outline de foco visible, roles ARIA, gestores de eventos de teclado y trampa de foco.
  * *Comando sugerido:* `/impeccable harden prototype/index.html`

* **[P1] Carga Cognitiva por Duplicidad de Tareas**
  * *Por qué importa:* Mostrar las mismas tareas arriba en "Mi Día" y abajo en los proyectos genera parálisis visual en usuarios con TDAH.
  * *Solución:* Reorganizar el layout para aislar "Mi Día" de la lista de proyectos o permitir colapsar secciones.
  * *Comando sugerido:* `/impeccable layout prototype/index.html`

* **[P1] Falta de Captura Rápida y Atajos de Teclado**
  * *Por qué importa:* Obliga a múltiples clics con el ratón para cualquier acción.
  * *Solución:* Añadir paleta de comandos `Cmd+K` y atajo `Esc`.
  * *Comando sugerido:* `/impeccable delight prototype/index.html`

* **[P2] Tipografía Repetitiva (`Plus Jakarta Sans`)**
  * *Por qué importa:* Detectada como fuente genérica de plantillas AI por el detector.
  * *Solución:* Reemplazar por una tipografía secundaria con más personalidad o unificar en `Outfit`.
  * *Comando sugerido:* `/impeccable typeset prototype/index.html`

* **[P2] Inconsistencia Visual en Prioridades**
  * *Por qué importa:* Badges de texto, puntos de colores y emojis compiten entre sí.
  * *Solución:* Unificar el sistema de diseño de prioridades.
  * *Comando sugerido:* `/impeccable polish prototype/index.html`

---

### Red Flags por Persona

* **Alex (Power User):** No puede usar teclado ni `Cmd+K`; obligado a 6 clics para crear una tarea.
* **Jordan (First-Timer TDAH):** Sobrecarga visual al ver 6 tareas en tarjetas y acordeones a la vez; falta un modo "Enfoque Unico / Hyperfocus".
* **Sam (Accesibilidad/Teclado):** Las filas `onclick` en `<div>` son inalcanzables por Tab; los checkboxes nativos están ocultos sin outline; el texto secundario (`#64748B`) no cumple contraste WCAG AA (3.6:1).
* **Riley (Edge Cases):** Títulos largos distorsionan filas; borrar subtareas no se puede deshacer (sin Undo); buscar no muestra estados vacíos limpios.
* **Casey (Mobile):** Puntos de prioridad (8px) son demasiado pequeños para tocar en pantallas táctiles (mínimo WCAG 44px).

---

### Preguntas Provocativas
* ¿Qué tal si añadimos un botón "Modo Hiperenfoque" que oculte toda la interfaz y deje solo la tarea activa actual?
* ¿Podríamos reemplazar el formulario modal por una entrada de lenguaje natural (`Cmd+K`)?
