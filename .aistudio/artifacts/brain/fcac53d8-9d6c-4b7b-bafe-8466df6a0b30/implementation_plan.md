# Prestablecidos de Cotización y Edición en Contexto (CubeUp³)

Flujo de cotización optimizado para el taller CubeUp³ mediante popovers flotantes anclados para edición inmediata de insumos/equipos y un sistema de prestablecidos de 1 clic que precarga 12 parámetros técnicos y sincroniza el margen comercial.

## Decisiones Críticas y Confirmadas de Negocio

> [!IMPORTANT]
> **Decisiones confirmadas por el usuario:**
> 1. **Diseño CAD explícito:** Se agrega un campo numérico visible para minutos de modelado/CAD en `CalculadoraPieza.tsx` junto a los tiempos de alistado y post-procesado.
> 2. **Sincronización de margen:** Al hacer clic en un chip de prestablecido, se actualiza automáticamente el margen general de la cotización al margen sugerido configurado en el preset.
> 3. **Límites de alcance explícitos (Fuera de este bloque):** Se excluyen conscientemente: endurecimiento de reglas Firestore, sincronización centralizada de folio, escalones de volumen (`QuantityTiers.tsx`) y procesador de G-code.

---

## 1. Visión General y Propuesta de Valor

### El Problema Operativo
1. **Fricción por cambio de insumo:** Cambiar el costo por kg de un carrete de filamento o la merma requiere 6 clics saliendo a Ajustes > Materiales > Editar > Guardar > Volver.
2. **Captura redundante de 12 campos:** Cada cotización exige recapturar material, impresora, merma, probabilidad de falla, tiempos de preparación, modelado, post-procesado y margen, cuando el 80% de los pedidos corresponden a 4 o 5 patrones repetitivos. Omitir un campo deriva en una cotización subvaluada.

### La Solución
- **Edición en Contexto:** Popovers flotantes situados directamente junto a los selectores de material e impresora. Permiten ajustar en vivo costos y mermas, descartando con Escape o clic fuera y recalculando la cotización de inmediato al guardar.
- **Prestablecidos de Fábrica y Personalizados:** 5 presets predeterminados de fábrica que congelan la combinación técnica y comercial. Chips de acceso directo en la cabecera del cotizador con detección visual de modificaciones y botón para guardar nuevas variantes.
- **Guardado desde Partida del Ticket:** Capacidad de congelar cualquier partida calculada como un nuevo prestablecido para su posterior reutilización.
- **Gestión Visual con Drag & Drop Nativo:** Pestaña de administración en Ajustes con reordenamiento por arrastre HTML5 (sin librerías externas), duplicación, edición y archivado seguro (sin rotura de historial).

---

## 2. Experiencia de Usuario y Diseño Visual

### Flujo 1: Aplicación y Detección de Modificaciones
```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PRESTABLECIDOS RÁPIDOS                                                                 │
│ [⚡ Prototipo rápido] [🛡️ Pieza funcional (modificado)] [✨ Miniatura] [📚 Serie corta] │
│                                                                                        │
│ ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ ⚠️ Has modificado parámetros de este preset.   [ Guardar como nuevo preset ]      │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```
1. Al pulsar un chip activo, se asignan instantáneamente: material, impresora, merma, tasa de falla, minutos de diseño CAD, minutos de alistado, minutos de post-procesado y margen de cotización.
2. Si el usuario altera cualquiera de estos valores en el formulario, el chip muestra el sufijo `(modificado)` y se despliega la acción "Guardar como nuevo prestablecido".

### Flujo 2: Edición en Contexto mediante Popover Anclado
1. Junto al selector de material/impresora se ubica un botón discreto de lápiz (`Pencil`).
2. Al presionarlo se despliega un popover flotante fijado sobre el control con:
   - Nombre del material/impresora
   - Costo unitario (por kg en FDM o litro en MSLA)
   - Porcentaje de merma estimado
   - Acciones: `[Guardar cambios]` y `[Abrir ajustes completos →]`
3. `Escape` o clic exterior descartan los cambios no guardados.
4. Al guardar, se actualiza `TallerConfig`, se persiste en Firestore/localStorage y el cálculo del ticket se actualiza en tiempo real.

### Paleta y Reglas de Identidad CubeUp³
- **Colores primarios:** Bosque profundo (`#1B4D3E`), Verde acento (`#2E7D32`), Acento secundario (`#82C69E`).
- **Fondos y superficies:** Arena neutro (`#F7F5F0`), Blanco puro (`#FFFFFF`), Borde tenue (`#E5E7EB`).
- **Tipografía:** Jerarquía tipográfica existente, importes en fuente monoespaciada (`font-mono`).
- **Idioma:** Español de México en todos los textos e indicadores.

---

## 3. Decisiones de Producto y Compensaciones Técnicas

1. **Reordenamiento con Drag & Drop HTML5 Nativo:**
   - *Decisión:* Implementar eventos nativos de navegador (`draggable`, `onDragStart`, `onDragOver`, `onDrop`) en lugar de añadir paquetes como `@dnd-kit` o `react-beautiful-dnd`.
   - *Razón:* Cumple estrictamente la regla de cero dependencias nuevas y garantiza un rendimiento ligero y predecible.
2. **Archivado en lugar de Borrado Físico:**
   - *Decisión:* Los prestablecidos se marcan con `archivado: true` en vez de eliminarse de `TallerConfig.presets`.
   - *Razón:* Evita inconsistencias o fallos si cotizaciones archivadas o históricas hacen referencia al identificador del preset.
3. **Persistencia Unificada en `TallerConfig`:**
   - *Decisión:* Integrar `presets` directamente en el documento global `settings/taller`.
   - *Razón:* Sincronización transparente con Firestore y compatibilidad con el hook `useTallerConfig`.

---

## 4. Arquitectura del Sistema y Flujo de Datos

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                           useTallerConfig (Hook)                               │
│       Firestore (settings/taller) ◄──► LocalStorage ('cubeup3-taller-config')  │
└───────────────────────┬────────────────────────────────┬───────────────────────┘
                        │                                │
                        ▼                                ▼
       ┌────────────────────────────────┐  ┌────────────────────────────────┐
       │     CalculadoraPieza.tsx       │  │       AjustesCostos.tsx        │
       │  • Fila de Chips de Presets    │  │  • Pestaña 'presets'           │
       │  • Detección (modificado)      │  │  • PestanaPresets.tsx          │
       │  • Popovers flotantes en línea │  │    - Drag & Drop nativo HTML5  │
       │  • Campo Diseño CAD            │  │    - Edición, duplicar, archivar│
       └────────────────┬───────────────┘  └────────────────────────────────┘
                        │
                        ▼
       ┌────────────────────────────────┐
       │       TicketEnCurso.tsx        │
       │  • "Guardar como preset" en    │
       │    cada partida de impresión   │
       └────────────────────────────────┘
```

---

## 5. Hoja de Ruta de Entregas (1 Archivo Completo por Respuesta)

1. **Entrega 1/6 (Completada): `src/lib/tallerConfig.ts`**
   - Definición de interfaz `Preset`, 5 prestablecidos predeterminados, tipado en `TallerConfig` y sanitización en `sanitizeConfig`.
2. **Entrega 2/6: `src/components/costos/PestanaPresets.tsx`**
   - Componente de gestión en Ajustes: lista interactiva, Drag & Drop nativo, modal de edición, duplicación y archivado.
3. **Entrega 3/6: `src/components/AjustesCostos.tsx`**
   - Integración de pestaña "Prestablecidos" y soporte para apertura anclada de pestaña vía `initialTab`.
4. **Entrega 4/6: `src/components/CalculadoraPieza.tsx`**
   - Popovers flotantes anclados para material e impresora, barra de chips superior con detección de modificaciones y campo de minutos CAD.
5. **Entrega 5/6: `src/components/TicketEnCurso.tsx`**
   - Botón en cada partida para congelar sus parámetros y registrarla como nuevo prestablecido.
6. **Entrega 6/6: `src/App.tsx`**
   - Cableado de `guardarConfig`, propagación del margen sugerido del preset y navegación contextual a ajustes.
