import { 
  ImpresoraConfig, 
  MaterialConfig, 
  PricingContext, 
  TecnologiaImpresion 
} from './pricing';
import { DEFAULT_TALLER_SETTINGS } from '../types/domain';

export interface OverheadConfig {
  modo: 'porHora' | 'porcentaje';   // default 'porHora'
  costosFijosMensuales: number;      // suma de renta + internet + software + contador, etc. Default 4000
  horasProductivasMes: number;       // horas de máquina reales al mes. Default 160
  tasaManualPorHora?: number;        // escape hatch si ya se tiene calculada
  porcentajeFallback: number;        // solo si modo === 'porcentaje'. Default 0.10
}

export interface Preset {
  id: string;
  nombre: string;
  icono: string;               // Nombre de icono lucide (p. ej. 'Zap', 'Shield', 'Sparkles', 'Layers', 'Crown')
  descripcion?: string;        // Resumen breve de la combinación
  materialId: string;
  impresoraId: string;
  mermaPorcentaje: number;     // Fracción 0–0.50
  tasaFalla: number;           // Fracción 0–0.40
  minutosModelado: number;     // Minutos de diseño CAD
  minutosAlistado: number;     // Minutos de preparación
  minutosPostproceso: number;  // Minutos de acabado / curado / lijado
  margenSugerido: number;      // Fracción 0–0.90
  archivado: boolean;
  orden: number;
}

export interface TallerConfig {
  version: 1;
  tarifaKwh: number;            // MXN/kWh
  tarifaOperadorHora: number;   // MXN/h
  tarifaDisenoHora: number;     // MXN/h de modelado/CAD
  overhead: OverheadConfig;     // Gastos fijos del taller prorrateados
  margenPorDefecto: number;     // fracción 0–0.90, margen real sobre precio
  tasaFallaPorDefecto: number;  // fracción 0–0.40
  minimoPorPieza: number;
  minimoPedido: number;
  pasoRedondeo: number;         // 0.5, 1, 5 o 10
  recargoUrgencia: number;      // fracción; solo aplica si la cotización se marca urgente
  ivaTasa: number;              // fracción
  cobrarIvaPorDefecto: boolean;
  impresoras: ImpresoraConfig[];  // tipo de pricing.ts
  materiales: MaterialConfig[];   // tipo de pricing.ts
  presets: Preset[];              // Prestablecidos de cotización
  updatedAt: string;            // ISO
  updatedBy: string;
}

export const DEFAULT_OVERHEAD_CONFIG: OverheadConfig = {
  modo: 'porHora',
  costosFijosMensuales: 4000,
  horasProductivasMes: 160,
  porcentajeFallback: 0.10
};

export const DEFAULT_MATERIALES: MaterialConfig[] = [
  {
    id: 'mat-pla-std',
    nombre: 'PLA Estándar (CubeUp)',
    tecnologia: 'FDM',
    costoPorUnidad: 450,
    mermaPorcentaje: 0.05
  },
  {
    id: 'mat-petg-res',
    nombre: 'PETG Resistencia',
    tecnologia: 'FDM',
    costoPorUnidad: 550,
    mermaPorcentaje: 0.05
  },
  {
    id: 'mat-abs-tec',
    nombre: 'ABS / ASA Técnico',
    tecnologia: 'FDM',
    costoPorUnidad: 650,
    mermaPorcentaje: 0.05
  },
  {
    id: 'mat-tpu-flex',
    nombre: 'TPU Flexible',
    tecnologia: 'FDM',
    costoPorUnidad: 750,
    mermaPorcentaje: 0.05
  },
  {
    id: 'mat-res-std-4k',
    nombre: 'Resina Estándar 4K',
    tecnologia: 'MSLA',
    costoPorUnidad: 800,
    mermaPorcentaje: 0.10
  }
];

export const DEFAULT_IMPRESORAS: ImpresoraConfig[] = [
  {
    id: 'imp-fdm-default',
    nombre: 'Impresora FDM (editar)',
    tecnologia: 'FDM',
    potenciaPromedioW: 120,
    precioCompra: 15000,
    vidaUtilHoras: 4000,
    mantenimientoPorHora: 2.00,
    volumenMaxMm: {
      x: 256,
      y: 256,
      z: 256
    }
  },
  {
    id: 'imp-msla-default',
    nombre: 'Impresora resina (editar)',
    tecnologia: 'MSLA',
    potenciaPromedioW: 60,
    precioCompra: 8000,
    vidaUtilHoras: 2500,
    mantenimientoPorHora: 1.50,
    volumenMaxMm: {
      x: 218,
      y: 123,
      z: 250
    }
  }
];

export const DEFAULT_PRESETS: Preset[] = [
  {
    id: 'preset-prototipo-rapido',
    nombre: 'Prototipo rápido',
    icono: 'Zap',
    descripcion: 'PLA 0.28mm · sin post-procesado · modelado 0',
    materialId: 'mat-pla-std',
    impresoraId: 'imp-fdm-default',
    mermaPorcentaje: 0.05,
    tasaFalla: 0.05,
    minutosModelado: 0,
    minutosAlistado: 5,
    minutosPostproceso: 0,
    margenSugerido: 0.40,
    archivado: false,
    orden: 0
  },
  {
    id: 'preset-pieza-funcional',
    nombre: 'Pieza funcional',
    icono: 'Shield',
    descripcion: 'PETG · insertos térmicos · post 15 min',
    materialId: 'mat-petg-res',
    impresoraId: 'imp-fdm-default',
    mermaPorcentaje: 0.05,
    tasaFalla: 0.05,
    minutosModelado: 0,
    minutosAlistado: 10,
    minutosPostproceso: 15,
    margenSugerido: 0.45,
    archivado: false,
    orden: 1
  },
  {
    id: 'preset-miniatura-resina',
    nombre: 'Miniatura resina',
    icono: 'Sparkles',
    descripcion: 'Resina · lavado+curado · post 25 min',
    materialId: 'mat-res-std-4k',
    impresoraId: 'imp-msla-default',
    mermaPorcentaje: 0.10,
    tasaFalla: 0.10,
    minutosModelado: 0,
    minutosAlistado: 10,
    minutosPostproceso: 25,
    margenSugerido: 0.50,
    archivado: false,
    orden: 2
  },
  {
    id: 'preset-serie-corta',
    nombre: 'Serie corta',
    icono: 'Layers',
    descripcion: 'PLA · alistado único · margen más bajo',
    materialId: 'mat-pla-std',
    impresoraId: 'imp-fdm-default',
    mermaPorcentaje: 0.03,
    tasaFalla: 0.02,
    minutosModelado: 0,
    minutosAlistado: 5,
    minutosPostproceso: 5,
    margenSugerido: 0.35,
    archivado: false,
    orden: 3
  },
  {
    id: 'preset-pieza-exhibicion',
    nombre: 'Pieza de exhibición',
    icono: 'Crown',
    descripcion: 'Resina · lijado+primer+pintura · post 90 min',
    materialId: 'mat-res-std-4k',
    impresoraId: 'imp-msla-default',
    mermaPorcentaje: 0.10,
    tasaFalla: 0.08,
    minutosModelado: 0,
    minutosAlistado: 15,
    minutosPostproceso: 90,
    margenSugerido: 0.55,
    archivado: false,
    orden: 4
  }
];

export const DEFAULT_TALLER_CONFIG: TallerConfig = {
  version: 1,
  tarifaKwh: DEFAULT_TALLER_SETTINGS.tarifaKwh,
  tarifaOperadorHora: DEFAULT_TALLER_SETTINGS.tarifaOperadorHora,
  tarifaDisenoHora: 250,
  overhead: DEFAULT_OVERHEAD_CONFIG,
  margenPorDefecto: DEFAULT_TALLER_SETTINGS.margenPorDefecto,
  tasaFallaPorDefecto: DEFAULT_TALLER_SETTINGS.tasaFallaPorDefecto,
  minimoPorPieza: DEFAULT_TALLER_SETTINGS.minimoPorPieza,
  minimoPedido: DEFAULT_TALLER_SETTINGS.minimoPedido,
  pasoRedondeo: DEFAULT_TALLER_SETTINGS.pasoRedondeo,
  recargoUrgencia: DEFAULT_TALLER_SETTINGS.recargoUrgenciaPorDefecto,
  ivaTasa: DEFAULT_TALLER_SETTINGS.ivaTasa,
  cobrarIvaPorDefecto: true,
  impresoras: DEFAULT_IMPRESORAS,
  materiales: DEFAULT_MATERIALES,
  presets: DEFAULT_PRESETS,
  updatedAt: new Date().toISOString(),
  updatedBy: 'Sistema'
};

/**
 * Calcula la tasa de overhead por hora de máquina y advierte si las horas productivas son inválidas.
 * Nunca divide entre cero en silencio.
 */
export function calcularTasaOverheadHora(overhead: OverheadConfig): { tasa: number; advertencia?: string } {
  if (overhead.tasaManualPorHora !== undefined && Number.isFinite(overhead.tasaManualPorHora) && overhead.tasaManualPorHora >= 0) {
    return { tasa: overhead.tasaManualPorHora };
  }
  if (overhead.horasProductivasMes <= 0) {
    return {
      tasa: 0,
      advertencia: 'Las horas productivas al mes deben ser mayores a 0 para calcular la tasa de overhead por hora. Se aplicó tasa 0.00 MXN/h.'
    };
  }
  return {
    tasa: overhead.costosFijosMensuales / overhead.horasProductivasMes
  };
}

/**
 * Migra una sola vez perfiles personalizados previos desde localStorage ('cubeup3-custom-profiles')
 * hacia los materiales del taller si el usuario tenía precios de bobina personalizados.
 */
export function migrateCustomProfilesOnce(baseMateriales: MaterialConfig[]): MaterialConfig[] {
  if (typeof window === 'undefined') return baseMateriales;
  const MIGRATION_FLAG = 'cubeup3-profiles-migrated-to-taller';
  if (localStorage.getItem(MIGRATION_FLAG)) {
    return baseMateriales;
  }

  const legacyRaw = localStorage.getItem('cubeup3-custom-profiles');
  if (!legacyRaw) {
    localStorage.setItem(MIGRATION_FLAG, 'true');
    return baseMateriales;
  }

  try {
    const legacyList = JSON.parse(legacyRaw);
    if (!Array.isArray(legacyList)) {
      localStorage.setItem(MIGRATION_FLAG, 'true');
      return baseMateriales;
    }

    const updated = baseMateriales.map(mat => {
      const found = legacyList.find(
        (legacy: { id?: string; name?: string; spoolCost?: number }) => 
          legacy && (
            legacy.name?.toLowerCase().includes(mat.nombre.toLowerCase().slice(0, 5)) ||
            (legacy.id && legacy.id === mat.id)
          )
      );
      if (found && typeof found.spoolCost === 'number' && found.spoolCost > 0) {
        return {
          ...mat,
          costoPorUnidad: found.spoolCost
        };
      }
      return mat;
    });

    localStorage.setItem(MIGRATION_FLAG, 'true');
    return updated;
  } catch (err) {
    console.warn('[tallerConfig] Error leyendo cubeup3-custom-profiles para migración:', err);
    localStorage.setItem(MIGRATION_FLAG, 'true');
    return baseMateriales;
  }
}

/**
 * Sanea y valida cualquier estructura de configuración externa o incompleta,
 * asegurando tipos numéricos finitos y restringiendo a los rangos permitidos.
 */
export function sanitizeConfig(raw: unknown): TallerConfig {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;

  // Número seguro con fallback y límites
  const num = (val: unknown, fallback: number, min?: number, max?: number): number => {
    if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
    let res = val;
    if (min !== undefined) res = Math.max(min, res);
    if (max !== undefined) res = Math.min(max, res);
    return res;
  };

  const sanitizePasoRedondeo = (val: unknown): number => {
    const allowed = [0.5, 1, 5, 10];
    if (typeof val === 'number' && allowed.includes(val)) return val;
    return DEFAULT_TALLER_CONFIG.pasoRedondeo;
  };

  const sanitizeOverhead = (ovRaw: unknown): OverheadConfig => {
    const o = (typeof ovRaw === 'object' && ovRaw !== null ? ovRaw : {}) as Record<string, unknown>;
    const modo: 'porHora' | 'porcentaje' = o.modo === 'porcentaje' ? 'porcentaje' : 'porHora';
    const tasaManual = typeof o.tasaManualPorHora === 'number' && Number.isFinite(o.tasaManualPorHora) && o.tasaManualPorHora >= 0
      ? o.tasaManualPorHora
      : undefined;

    return {
      modo,
      costosFijosMensuales: num(o.costosFijosMensuales, 4000, 0),
      horasProductivasMes: num(o.horasProductivasMes, 160, 0),
      tasaManualPorHora: tasaManual,
      porcentajeFallback: num(o.porcentajeFallback, 0.10, 0, 1.0)
    };
  };

  const sanitizeImpresoras = (impsRaw: unknown): ImpresoraConfig[] => {
    if (!Array.isArray(impsRaw) || impsRaw.length === 0) {
      return DEFAULT_IMPRESORAS;
    }
    return impsRaw.map((imp, idx) => {
      const i = (typeof imp === 'object' && imp !== null ? imp : {}) as Record<string, unknown>;
      const tec: TecnologiaImpresion = i.tecnologia === 'MSLA' ? 'MSLA' : 'FDM';
      const volRaw = (typeof i.volumenMaxMm === 'object' && i.volumenMaxMm !== null ? i.volumenMaxMm : {}) as Record<string, unknown>;
      
      return {
        id: typeof i.id === 'string' && i.id ? i.id : `imp-${idx + 1}`,
        nombre: typeof i.nombre === 'string' && i.nombre ? i.nombre : `Impresora ${tec} #${idx + 1}`,
        tecnologia: tec,
        potenciaPromedioW: num(i.potenciaPromedioW, tec === 'FDM' ? 120 : 60, 1, 2000),
        precioCompra: num(i.precioCompra, tec === 'FDM' ? 15000 : 8000, 0),
        vidaUtilHoras: num(i.vidaUtilHoras, tec === 'FDM' ? 4000 : 2500, 1),
        mantenimientoPorHora: num(i.mantenimientoPorHora, tec === 'FDM' ? 2.0 : 1.5, 0),
        tarifaHoraManual: typeof i.tarifaHoraManual === 'number' && i.tarifaHoraManual >= 0 ? i.tarifaHoraManual : undefined,
        volumenMaxMm: {
          x: num(volRaw.x, 220, 10),
          y: num(volRaw.y, 220, 10),
          z: num(volRaw.z, 250, 10)
        }
      };
    });
  };

  const sanitizeMateriales = (matsRaw: unknown): MaterialConfig[] => {
    if (!Array.isArray(matsRaw) || matsRaw.length === 0) {
      return migrateCustomProfilesOnce(DEFAULT_MATERIALES);
    }
    return matsRaw.map((mat, idx) => {
      const m = (typeof mat === 'object' && mat !== null ? mat : {}) as Record<string, unknown>;
      const tec: TecnologiaImpresion = m.tecnologia === 'MSLA' ? 'MSLA' : 'FDM';
      return {
        id: typeof m.id === 'string' && m.id ? m.id : `mat-${idx + 1}`,
        nombre: typeof m.nombre === 'string' && m.nombre ? m.nombre : `Material ${idx + 1}`,
        tecnologia: tec,
        costoPorUnidad: num(m.costoPorUnidad, 500, 0),
        mermaPorcentaje: num(m.mermaPorcentaje, tec === 'FDM' ? 0.05 : 0.10, 0, 0.50)
      };
    });
  };

  const sanitizePresets = (
    presetsRaw: unknown,
    impresorasDisponibles: ImpresoraConfig[],
    materialesDisponibles: MaterialConfig[]
  ): Preset[] => {
    if (!Array.isArray(presetsRaw) || presetsRaw.length === 0) {
      return DEFAULT_PRESETS;
    }
    const defaultImpId = impresorasDisponibles[0]?.id || DEFAULT_IMPRESORAS[0].id;
    const defaultMatId = materialesDisponibles[0]?.id || DEFAULT_MATERIALES[0].id;

    return presetsRaw.map((pRaw, idx) => {
      const p = (typeof pRaw === 'object' && pRaw !== null ? pRaw : {}) as Record<string, unknown>;
      
      const matId = typeof p.materialId === 'string' && materialesDisponibles.some(m => m.id === p.materialId)
        ? p.materialId
        : defaultMatId;

      const impId = typeof p.impresoraId === 'string' && impresorasDisponibles.some(i => i.id === p.impresoraId)
        ? p.impresoraId
        : defaultImpId;

      return {
        id: typeof p.id === 'string' && p.id ? p.id : `preset-${idx + 1}`,
        nombre: typeof p.nombre === 'string' && p.nombre ? p.nombre : `Prestablecido ${idx + 1}`,
        icono: typeof p.icono === 'string' && p.icono ? p.icono : 'Box',
        descripcion: typeof p.descripcion === 'string' ? p.descripcion : undefined,
        materialId: matId,
        impresoraId: impId,
        mermaPorcentaje: num(p.mermaPorcentaje, 0.05, 0, 0.50),
        tasaFalla: num(p.tasaFalla, 0.05, 0, 0.40),
        minutosModelado: num(p.minutosModelado, 0, 0, 1440),
        minutosAlistado: num(p.minutosAlistado, 5, 0, 720),
        minutosPostproceso: num(p.minutosPostproceso, 0, 0, 1440),
        margenSugerido: num(p.margenSugerido, 0.45, 0, 0.90),
        archivado: typeof p.archivado === 'boolean' ? p.archivado : false,
        orden: num(p.orden, idx, 0)
      };
    }).sort((a, b) => a.orden - b.orden);
  };

  const impresorasSanitizadas = sanitizeImpresoras(r.impresoras);
  const materialesSanitizados = sanitizeMateriales(r.materiales);

  return {
    version: 1,
    tarifaKwh: num(r.tarifaKwh, DEFAULT_TALLER_CONFIG.tarifaKwh, 0),
    tarifaOperadorHora: num(r.tarifaOperadorHora, DEFAULT_TALLER_CONFIG.tarifaOperadorHora, 0),
    tarifaDisenoHora: num(r.tarifaDisenoHora, DEFAULT_TALLER_CONFIG.tarifaDisenoHora, 0),
    overhead: sanitizeOverhead(r.overhead),
    margenPorDefecto: num(r.margenPorDefecto, DEFAULT_TALLER_CONFIG.margenPorDefecto, 0, 0.90),
    tasaFallaPorDefecto: num(r.tasaFallaPorDefecto, DEFAULT_TALLER_CONFIG.tasaFallaPorDefecto, 0, 0.40),
    minimoPorPieza: num(r.minimoPorPieza, DEFAULT_TALLER_CONFIG.minimoPorPieza, 0),
    minimoPedido: num(r.minimoPedido, DEFAULT_TALLER_CONFIG.minimoPedido, 0),
    pasoRedondeo: sanitizePasoRedondeo(r.pasoRedondeo),
    recargoUrgencia: num(r.recargoUrgencia, DEFAULT_TALLER_CONFIG.recargoUrgencia, 0, 2.0),
    ivaTasa: num(r.ivaTasa, DEFAULT_TALLER_CONFIG.ivaTasa, 0, 0.50),
    cobrarIvaPorDefecto: typeof r.cobrarIvaPorDefecto === 'boolean' ? r.cobrarIvaPorDefecto : true,
    impresoras: impresorasSanitizadas,
    materiales: materialesSanitizados,
    presets: sanitizePresets(r.presets, impresorasSanitizadas, materialesSanitizados),
    updatedAt: typeof r.updatedAt === 'string' && r.updatedAt ? r.updatedAt : new Date().toISOString(),
    updatedBy: typeof r.updatedBy === 'string' && r.updatedBy ? r.updatedBy : 'Sistema'
  };
}

export interface BuildContextOpts {
  urgente: boolean;
  envio: number;
  cobrarIva: boolean;
  margen?: number;
}

/**
 * Ensambla un `PricingContext` completo para `pricing.ts`, seleccionando la impresora y el
 * material apropiados según los IDs solicitados o usando los primeros disponibles compatibles.
 */
export function buildContext(
  config: TallerConfig,
  impresoraId: string | undefined,
  materialId: string | undefined,
  opts: BuildContextOpts
): PricingContext {
  // Buscar material
  let material = config.materiales.find(m => m.id === materialId);
  if (!material) {
    material = config.materiales[0] || DEFAULT_MATERIALES[0];
  }

  // Buscar impresora compatible con la tecnología del material
  let impresora = config.impresoras.find(i => i.id === impresoraId);
  if (!impresora || impresora.tecnologia !== material.tecnologia) {
    const compatible = config.impresoras.find(i => i.tecnologia === material.tecnologia);
    impresora = compatible || config.impresoras[0] || DEFAULT_IMPRESORAS[0];
  }

  const margenFinal = opts.margen !== undefined && Number.isFinite(opts.margen)
    ? Math.max(0, Math.min(0.90, opts.margen))
    : config.margenPorDefecto;

  return {
    tarifaKwh: config.tarifaKwh,
    tarifaOperadorHora: config.tarifaOperadorHora,
    tarifaDisenoHora: config.tarifaDisenoHora,
    overhead: config.overhead,
    margenPorDefecto: margenFinal,
    tasaFallaPorDefecto: config.tasaFallaPorDefecto,
    minimoPorPieza: config.minimoPorPieza,
    pasoRedondeo: config.pasoRedondeo,
    minimoPedido: config.minimoPedido,
    recargoUrgencia: opts.urgente ? config.recargoUrgencia : 0,
    envio: Math.max(0, opts.envio),
    ivaTasa: opts.cobrarIva ? config.ivaTasa : 0,
    impresora,
    material
  };
}
