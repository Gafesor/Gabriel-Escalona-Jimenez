import { 
  ImpresoraConfig, 
  MaterialConfig, 
  PricingContext, 
  TecnologiaImpresion 
} from './pricing';
import { DEFAULT_TALLER_SETTINGS } from '../types/domain';

export interface TallerConfig {
  version: 1;
  tarifaKwh: number;            // MXN/kWh
  tarifaOperadorHora: number;   // MXN/h
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
  updatedAt: string;            // ISO
  updatedBy: string;
}

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

export const DEFAULT_TALLER_CONFIG: TallerConfig = {
  version: 1,
  tarifaKwh: DEFAULT_TALLER_SETTINGS.tarifaKwh,
  tarifaOperadorHora: DEFAULT_TALLER_SETTINGS.tarifaOperadorHora,
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
  updatedAt: new Date().toISOString(),
  updatedBy: 'Sistema'
};

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
      // Buscar por nombre aproximado o coincidencia
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

  return {
    version: 1,
    tarifaKwh: num(r.tarifaKwh, DEFAULT_TALLER_CONFIG.tarifaKwh, 0),
    tarifaOperadorHora: num(r.tarifaOperadorHora, DEFAULT_TALLER_CONFIG.tarifaOperadorHora, 0),
    margenPorDefecto: num(r.margenPorDefecto, DEFAULT_TALLER_CONFIG.margenPorDefecto, 0, 0.90),
    tasaFallaPorDefecto: num(r.tasaFallaPorDefecto, DEFAULT_TALLER_CONFIG.tasaFallaPorDefecto, 0, 0.40),
    minimoPorPieza: num(r.minimoPorPieza, DEFAULT_TALLER_CONFIG.minimoPorPieza, 0),
    minimoPedido: num(r.minimoPedido, DEFAULT_TALLER_CONFIG.minimoPedido, 0),
    pasoRedondeo: sanitizePasoRedondeo(r.pasoRedondeo),
    recargoUrgencia: num(r.recargoUrgencia, DEFAULT_TALLER_CONFIG.recargoUrgencia, 0, 2.0),
    ivaTasa: num(r.ivaTasa, DEFAULT_TALLER_CONFIG.ivaTasa, 0, 0.50),
    cobrarIvaPorDefecto: typeof r.cobrarIvaPorDefecto === 'boolean' ? r.cobrarIvaPorDefecto : true,
    impresoras: sanitizeImpresoras(r.impresoras),
    materiales: sanitizeMateriales(r.materiales),
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
