/**
 * CubeUp³ — Modelo de Dominio y Contrato Tipado Central
 * 
 * Contrato de tipos estricto para el cotizador y gestor de manufactura aditiva FDM + MSLA.
 * No contiene lógica de presentación (React), dependencias de Firestore ni efectos secundarios.
 * 
 * Principios de diseño:
 * 1. Uniones discriminadas estrictas para items de cotización y materiales (evita estados inválidos).
 * 2. Inmutabilidad histórica mediante `PricingSnapshot` (auditoría fidedigna en el tiempo).
 * 3. Trazabilidad con borrado lógico (`archivedAt: string | null`) en todas las entidades de catálogo.
 * 4. Serialización confiable: Fechas almacenadas como cadenas ISO 8601 en UTC.
 */

// =============================================================================
// VALORES POR DEFECTO DEL TALLER (MÉXICO - MXN)
// =============================================================================

export const DEFAULT_TALLER_SETTINGS = {
  tarifaKwh: 2.80, // Tarifa comercial PDBT / CFE en MXN
  tarifaOperadorHora: 120.00, // Costo por hora técnica/operador en MXN
  ivaTasa: 0.16, // IVA vigente en México (16%)
  vigenciaDias: 15, // Validez comercial estándar de cotización
  margenPorDefecto: 0.45, // Margen comercial objetivo del 45% (equivalente a ~81.8% de markup)
  minimoPedido: 250.00, // Cargo mínimo por orden de producción en taller en MXN
  minimoPorPieza: 40.00, // Precio de venta piso por pieza individual
  pasoRedondeo: 1.00, // Redondeo al peso superior (Math.ceil a múltiplos de $1.00)
  tasaFallaPorDefecto: 0.08, // 8% de margen de contingencia/falla
  recargoUrgenciaPorDefecto: 0.25, // 25% por trabajo express/prioritario en cola
} as const;

// =============================================================================
// IDENTIFICADORES Y BASE DE AUDITORÍA
// =============================================================================

export type UUID = string;

export interface BaseCatalogEntity {
  id: UUID;
  orgId: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  /**
   * Borrado lógico: si es null, la entidad está activa.
   * Si contiene timestamp ISO, está archivada pero preserva la integridad
   * referencial de cotizaciones pasadas.
   */
  archivedAt: string | null;
}

// =============================================================================
// 1. CONFIGURACIÓN DEL TALLER (SETTINGS)
// =============================================================================

export interface Settings extends BaseCatalogEntity {
  nombreTaller: string;
  telefono: string;
  email: string;
  direccion: string;
  rfc?: string;
  tarifaKwh: number;
  tarifaOperadorHora: number;
  ivaTasa: number;
  vigenciaDias: number;
  margenPorDefecto: number;
  minimoPedido: number;
  minimoPorPieza: number;
  pasoRedondeo: number;
  tasaFallaPorDefecto: number;
  recargoUrgenciaPorDefecto: number;
}

// =============================================================================
// 2. MATERIALES (DISCRIMINATED UNION: FDM vs MSLA)
// =============================================================================

export type TecnologiaImpresion = 'FDM' | 'MSLA';

export interface BaseMaterial extends BaseCatalogEntity {
  nombre: string;
  marca: string;
  color: string;
  tecnologia: TecnologiaImpresion;
  /**
   * Ratio de merma/pérdida esperada (ej. 0.05 = 5% por purgas, brim, soportes).
   */
  merma: number;
  densidadGcm3?: number; // Opcional, útil para conversiones volumétricas
  activo: boolean;
}

export interface MaterialFDM extends BaseMaterial {
  tecnologia: 'FDM';
  precioPorKg: number; // MXN por kilogramo de filamento
  diametroMm: 1.75 | 2.85;
}

export interface MaterialMSLA extends BaseMaterial {
  tecnologia: 'MSLA';
  precioPorLitro: number; // MXN por litro (1000 ml) de resina líquida
  longitudOndaNm?: 405 | 385;
}

export type Material = MaterialFDM | MaterialMSLA;

// =============================================================================
// 3. IMPRESORAS (PRINTER)
// =============================================================================

export interface DimensionesMm {
  x: number;
  y: number;
  z: number;
}

export interface Printer extends BaseCatalogEntity {
  nombre: string;
  marca: string;
  modelo: string;
  tecnologia: TecnologiaImpresion;
  /**
   * Potencia PROMEDIO MEDIDA en Watts durante impresión continua.
   * NOTA: Nunca usar la potencia nominal de la fuente (ej. 1000 W en X1C) porque
   * infla el costo de energía hasta 10 veces.
   */
  potenciaPromedioW: number;
  precioCompra: number; // Costo de adquisición de la máquina en MXN
  vidaUtilHoras: number; // Horas estimadas antes de depreciación total
  mantenimientoPorHora: number; // MXN por hora operativa en lubricantes, correas, rodamientos, etc.
  tarifaHoraManual?: number; // Si existe y es > 0, anula la amortización y mantenimiento estándar
  volumenMaxMm: DimensionesMm;
  activo: boolean;
}

// =============================================================================
// 4. CONSUMIBLES (CONSUMABLE)
// =============================================================================

export type UnidadVidaConsumible = 'impresiones' | 'horas' | 'litros_procesados';

export interface Consumible extends BaseCatalogEntity {
  nombre: string;
  descripcion?: string;
  costo: number; // MXN
  vidaUtil: number; // Duración en la unidad especificada
  unidadVida: UnidadVidaConsumible;
  tecnologiaAplicable?: TecnologiaImpresion | 'ambas';
  activo: boolean;
}

// =============================================================================
// 5. PRESETS DE REBANADO (PRESET)
// =============================================================================

export interface Preset extends BaseCatalogEntity {
  nombre: string;
  tecnologia: TecnologiaImpresion;
  alturaCapaMm: number;
  rellenoPorcentaje: number;
  patronRelleno?: string;
  temperaturaExtrusorC?: number;
  temperaturaCamaC?: number;
  velocidadImpresionMms?: number;
  tiempoExposicionSeg?: number; // Para MSLA
  tiempoExposicionBaseSeg?: number; // Para MSLA
  notasLaminado?: string;
}

// =============================================================================
// 6. POSTPROCESOS (POSTPROCESS)
// =============================================================================

export interface Postprocess extends BaseCatalogEntity {
  nombre: string;
  descripcion: string;
  costoFijoExtra: number; // MXN directo por insumos químicos/lijas/pintura
  minutosManoDeObra: number; // Minutos de labor del técnico por pieza
  tecnologiaAplicable?: TecnologiaImpresion | 'ambas';
  activo: boolean;
}

// =============================================================================
// 7. CLIENTES (CLIENT)
// =============================================================================

export interface Client extends BaseCatalogEntity {
  nombreRazonSocial: string;
  contactoNombre?: string;
  email: string;
  telefono: string;
  rfc?: string;
  direccionEntrega?: string;
  notas?: string;
  descuentoAcordadoPorcentaje?: number; // Ej. 0.10 = 10%
}

// =============================================================================
// 8. DESGLOSE DE COSTOS Y AUDITORÍA (COST BREAKDOWN)
// =============================================================================

export interface CostBreakdown {
  material: number; // MXN
  energia: number; // MXN
  maquina: number; // MXN (amortización + mantenimiento)
  consumibles: number; // MXN (prorrateo de boquillas, FEP, filtros, etc.)
  laborSetup: number; // MXN (preparación y laminado, 1 sola vez por corrida)
  laborPost: number; // MXN (acabado, curado o limpieza por pieza)
  extras: number; // MXN (insertos, tornillos, empaques directos)
  costoDirecto: number; // Suma de las 6 capas anteriores
  reservaFalla: number; // Monto absorbido por contingencia: costoDirecto / (1 - tasaFalla) - costoDirecto
  costoTotal: number; // Costo real total absorbido
  costoUnitario: number; // costoTotal / cantidad
}

// =============================================================================
// 9. ITEMS DE COTIZACIÓN (DISCRIMINATED UNION: QUOTE ITEM)
// =============================================================================

export type TipoQuoteItem = 'impresion' | 'hardware' | 'servicio' | 'envio' | 'descuento';

export interface BaseQuoteItem {
  id: UUID;
  tipo: TipoQuoteItem;
  order: number; // Índice entero para ordenamiento drag & drop
  descripcion: string;
  cantidad: number; // Entero >= 1
  unitCost: number; // Costo unitario base en MXN
  totalCost: number; // unitCost * cantidad
  unitPrice: number; // Precio de venta unitario en MXN
  totalPrice: number; // unitPrice * cantidad (con margen y descuentos)
  notas?: string;
}

export interface QuoteItemImpresionFDM extends BaseQuoteItem {
  tipo: 'impresion';
  tecnologia: 'FDM';
  materialId: UUID;
  printerId: UUID;
  presetId?: UUID;
  pesoGramos: number; // Consumo total del lote de piezas
  horasImpresion: number; // Horas máquina del lote
  minutosSetup: number; // Preparación única por lote
  minutosPostproceso: number; // Minutos por pieza
  dimensionesMm?: DimensionesMm;
  breakdown: CostBreakdown;
  margenAplicado: number;
}

export interface QuoteItemImpresionMSLA extends BaseQuoteItem {
  tipo: 'impresion';
  tecnologia: 'MSLA';
  materialId: UUID;
  printerId: UUID;
  presetId?: UUID;
  volumenMl: number; // Consumo total de resina en ml
  horasImpresion: number; // Horas máquina del lote
  minutosSetup: number; // Preparación única por lote
  minutosPostproceso: number; // Minutos por pieza
  dimensionesMm?: DimensionesMm;
  breakdown: CostBreakdown;
  margenAplicado: number;
}

export type QuoteItemImpresion = QuoteItemImpresionFDM | QuoteItemImpresionMSLA;

export interface QuoteItemHardware extends BaseQuoteItem {
  tipo: 'hardware';
  sku?: string;
  proveedor?: string;
}

export interface QuoteItemServicio extends BaseQuoteItem {
  tipo: 'servicio';
  horasServicio: number;
  tarifaHora: number;
}

export interface QuoteItemEnvio extends BaseQuoteItem {
  tipo: 'envio';
  transportadora?: string;
  guiaRastreo?: string;
}

export interface QuoteItemDescuento extends BaseQuoteItem {
  tipo: 'descuento';
  porcentajeDescuento?: number; // Si es porcentual
  montoDirecto?: number; // Si es monto fijo
}

export type QuoteItem =
  | QuoteItemImpresionFDM
  | QuoteItemImpresionMSLA
  | QuoteItemHardware
  | QuoteItemServicio
  | QuoteItemEnvio
  | QuoteItemDescuento;

// =============================================================================
// 10. SNAPSHOT DE PRECIOS CONGELADO (PRICING SNAPSHOT)
// =============================================================================

/**
 * Fotografía inmutable de los catálogos y tarifas utilizados al momento de emitir
 * una cotización. Garantiza que fluctuaciones posteriores en el costo del filamento
 * o tarifa eléctrica no alteren el histórico comercial ni rompan auditorías.
 */
export interface PricingSnapshot {
  capturedAt: string; // ISO 8601
  tarifaKwh: number;
  tarifaOperadorHora: number;
  ivaTasa: number;
  materiales: Record<UUID, Material>;
  impresoras: Record<UUID, Printer>;
  consumibles?: Record<UUID, Consumible>;
}

// =============================================================================
// 11. TRAZABILIDAD Y CICLO DE VIDA (STATUS EVENT & QUOTE)
// =============================================================================

export type QuoteStatus =
  | 'borrador'
  | 'enviada'
  | 'revision'
  | 'aprobada'
  | 'produccion'
  | 'entregada'
  | 'cancelada';

export interface StatusEvent {
  from: QuoteStatus | null;
  to: QuoteStatus;
  changedBy: string; // Nombre o email del operador
  changedAt: string; // ISO 8601
  motivo?: string;
}

export interface Quote {
  id: UUID;
  orgId: string;
  folio: string; // Formato CUB-AAAA-NNNN
  clientId?: UUID;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  operatorId?: string;
  operatorName: string;
  status: QuoteStatus;
  statusHistory: StatusEvent[];
  
  // Financiero
  costoTotal: number; // Suma de costos de todos los items
  subtotal: number; // Suma de items antes de recargos e IVA
  recargoUrgenciaPorcentaje: number;
  recargoUrgenciaMonto: number;
  descuentoGlobalMonto: number;
  total: number; // Monto antes de IVA
  ivaMonto: number;
  totalConIva: number;
  moneda: 'MXN';

  // Partidas e instantánea de costos
  items: QuoteItem[];
  pricingSnapshot: PricingSnapshot;

  // Condiciones comerciales
  tiempoEntregaDiasHabiles?: number;
  vigenciaDias: number;
  vigenciaFechaFin: string; // ISO 8601
  condicionesPago?: string;
  notas: string;
  
  // Trazabilidad
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  deletedAt: string | null; // Borrado lógico
  isArchived: boolean;
}

// =============================================================================
// TYPE GUARDS EXPORTADOS (SEGURIDAD Y NARROWING DE TIPOS)
// =============================================================================

export function esImpresion(item: QuoteItem): item is QuoteItemImpresion {
  return item.tipo === 'impresion';
}

export function esImpresionFDM(item: QuoteItem): item is QuoteItemImpresionFDM {
  return item.tipo === 'impresion' && (item as QuoteItemImpresionFDM).tecnologia === 'FDM';
}

export function esImpresionMSLA(item: QuoteItem): item is QuoteItemImpresionMSLA {
  return item.tipo === 'impresion' && (item as QuoteItemImpresionMSLA).tecnologia === 'MSLA';
}

export function esHardware(item: QuoteItem): item is QuoteItemHardware {
  return item.tipo === 'hardware';
}

export function esServicio(item: QuoteItem): item is QuoteItemServicio {
  return item.tipo === 'servicio';
}

export function esEnvio(item: QuoteItem): item is QuoteItemEnvio {
  return item.tipo === 'envio';
}

export function esDescuento(item: QuoteItem): item is QuoteItemDescuento {
  return item.tipo === 'descuento';
}

export function esMaterialFDM(material: Material): material is MaterialFDM {
  return material.tecnologia === 'FDM';
}

export function esMaterialMSLA(material: Material): material is MaterialMSLA {
  return material.tecnologia === 'MSLA';
}
