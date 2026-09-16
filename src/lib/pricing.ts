/**
 * CubeUp³ — Motor de Cálculo y Fijación de Precios (Pricing Engine)
 * 
 * Módulo puramente funcional (funciones puras sin efectos secundarios, sin React, sin Firebase).
 * Único punto canónico en el sistema donde se calcula dinero y costos de manufactura aditiva.
 * 
 * Todas las operaciones monetarias internas intermedias operan en precisión de punto flotante
 * y se convierten/redondean estrictamente al final en centavos enteros para evitar errores
 * de acumulación por punto flotante binario (IEEE 754).
 */

// =============================================================================
// TIPOS E INTERFACES DEL MODELO DE COSTOS
// =============================================================================

export type TecnologiaImpresion = 'FDM' | 'MSLA';

export type UnidadVidaConsumible = 'impresiones' | 'horas' | 'litros_procesados';

export interface ConsumibleAplicable {
  id: string;
  nombre: string;
  costo: number; // MXN
  vidaUtil: number; // En la unidad especificada
  unidadVida: UnidadVidaConsumible;
}

export interface ImpresoraConfig {
  id: string;
  nombre: string;
  tecnologia: TecnologiaImpresion;
  /**
   * NOTA CRÍTICA DE ENERGÍA:
   * Debe ser la potencia PROMEDIO MEDIDA durante operación real (por ejemplo con kill-a-watt o smart plug),
   * NO la potencia nominal de la placa o fuente de poder.
   * Ejemplo: Una Bambu Lab X1-Carbon cuenta con fuente nominal de 1000 W (para calentamiento rápido de cama),
   * pero promedia ~105 W imprimiendo PLA. Utilizar la nominal de 1000 W provocaría una sobreestimación
   * de casi 10x arrastrada a cada cotización comercial del taller.
   */
  potenciaPromedioW: number;
  precioCompra: number; // Costo de adquisición de la máquina en MXN
  vidaUtilHoras: number; // Horas totales estimadas de vida operativa antes de reposición
  mantenimientoPorHora: number; // MXN por hora en refacciones, lubricación y desgastes menores
  tarifaHoraManual?: number; // Si se define, anula la amortización + mantenimiento estándar
  volumenMaxMm: {
    x: number;
    y: number;
    z: number;
  };
}

export interface MaterialConfig {
  id: string;
  nombre: string;
  tecnologia: TecnologiaImpresion;
  costoPorUnidad: number; // MXN por Kg (FDM) o MXN por Litro (MSLA)
  mermaPorcentaje: number; // Ratio 0.05 = 5% por purgas, soportes, brim, torres de purga
}

export interface DimensionesPiezaMm {
  x: number;
  y: number;
  z: number;
}

export interface LineaInput {
  id: string;
  nombrePieza: string;
  tecnologia: TecnologiaImpresion;
  cantidad: number; // Unidades del trabajo/lote
  horasImpresion: number; // Horas de máquina dedicadas a fabricar la cantidad total o batch
  dimensionesMm?: DimensionesPiezaMm;
  
  // Parámetros FDM
  pesoGramos?: number; // Total de gramos de filamento consumidos (incluye soportes)

  // Parámetros MSLA
  volumenMl?: number; // Total de mililitros de resina consumidos

  // Consumibles asociados directamente
  consumibles?: ConsumibleAplicable[];

  // Mano de obra (Labor)
  minutosSetup: number; // Tiempo de preparación (laminado, calibración, envío). Se incurre UNA VEZ por lote.
  minutosPostproceso: number; // Tiempo de remoción de soportes, curado, lavado, pulido. Se incurre POR PIEZA.

  // Insumos extras o herrajes directos
  extrasDirectos: number; // MXN totales en tornillería, insertos roscados térmicos, empaque individual, pintura, etc.

  // Factores específicos de la pieza (sobrescriben contexto si existen)
  tasaFalla?: number; // 0.0 a 0.5
  margen?: number; // 0.0 a 0.95
}

export interface PricingContext {
  // Parámetros globales de taller
  tarifaKwh: number; // Tarifa eléctrica en MXN por kWh (ej. 3.20 en tarifa comercial CFE)
  tarifaOperadorHora: number; // Costo por hora del técnico u operador en MXN
  margenPorDefecto: number; // Margen comercial (ej. 0.30 = 30%)
  tasaFallaPorDefecto: number; // Tasa de contingencia/falla promedio (ej. 0.08 = 8%)
  
  // Políticas de cobro y redondeo
  minimoPorPieza: number; // Precio mínimo de venta por pieza en MXN (ej. 50.00)
  pasoRedondeo: number; // Múltiplo para Math.ceil (ej. 1 = al peso, 5 = múltiplos de $5, 0.5 = múltiplos de 50 centavos)
  minimoPedido: number; // Cobro mínimo de orden en taller (ej. 150.00)
  recargoUrgencia: number; // Porcentaje de sobrecargo por orden express (ej. 0.20 = 20%)
  envio: number; // Flete o entrega local en MXN
  ivaTasa: number; // Tasa impositiva (ej. 0.16 para 16% de IVA en México)

  // Catálogos vinculados a la línea
  impresora: ImpresoraConfig;
  material: MaterialConfig;
}

export interface DesgloseCostoLote {
  material: number;
  energia: number;
  maquina: number;
  consumibles: number;
  laborSetup: number;
  laborPost: number;
  extras: number;
  costoDirecto: number;
  reservaFalla: number;
  costoTotal: number;
}

export interface LineaResultado {
  id: string;
  nombrePieza: string;
  cantidad: number;
  desgloseLote: DesgloseCostoLote;
  costoUnitario: number;
  costoTotal: number;
  precioUnitario: number;
  precioTotal: number;
  margenRealizado: number;
  utilidad: number;
}

export interface CotizacionResultado {
  lineas: LineaResultado[];
  costoTotalLote: number;
  subtotal: number;
  recargoUrgenciaMonto: number;
  costoEnvio: number;
  total: number;
  ivaMonto: number;
  totalConIva: number;
  utilidadNeta: number;
  margenGlobalRealizado: number;
}

export interface EscalonResultado {
  cantidad: number;
  costoUnitario: number;
  precioUnitario: number;
  precioTotal: number;
  ahorroPorcentualRespectoAUnitaria: number;
}

export type TipoProblema = 'error' | 'advertencia';

export interface ProblemaValidacion {
  campo: string;
  tipo: TipoProblema;
  mensaje: string;
}

// =============================================================================
// FUNCIONES DE EQUIVALENCIA: MARGEN VS MARKUP
// =============================================================================

/**
 * Convierte un factor de Markup (sobrecosto porcentual sobre el costo) a Margen Real sobre precio.
 * 
 * NOTA COMERCIAL CRÍTICA:
 * Un "markup" del 30% (`costo * 1.30`) NO equivale a un margen del 30%.
 * Representa un margen real de solo 23.07%:
 *   margen = markup / (1 + markup) = 0.30 / 1.30 = 0.23076...
 * Vender calculando `costo * (1 + margenDeseado)` resulta en un déficit sistemático de ganancias.
 */
export function markupToMargen(markup: number): number {
  if (markup < 0) return 0;
  return markup / (1 + markup);
}

/**
 * Convierte un Margen Real deseado a su multiplicador equivalente de Markup.
 *   markup = margen / (1 - margen)
 * Ejemplo: Para obtener 50% de margen real, se requiere un markup del 100% (vender al doble del costo).
 */
export function margenToMarkup(margen: number): number {
  if (margen <= 0) return 0;
  if (margen >= 0.9999) return 9999;
  return margen / (1 - margen);
}

/**
 * Redondea un valor en pesos hacia el múltiplo superior definido por `paso`.
 * Trabaja en centavos enteros para evitar imprecisiones de coma flotante.
 */
export function redondearAlPaso(monto: number, paso: number): number {
  if (paso <= 0) return Math.round(monto * 100) / 100;
  
  const montoCentavos = Math.round(monto * 100);
  const pasoCentavos = Math.round(paso * 100);
  
  const unidades = Math.ceil(montoCentavos / pasoCentavos);
  return (unidades * pasoCentavos) / 100;
}

// =============================================================================
// MOTOR PURAMENTE MATEMÁTICO: CÁLCULO DE LÍNEA
// =============================================================================

export function calcularLinea(input: LineaInput, ctx: PricingContext): LineaResultado {
  const cantidad = Math.max(1, Math.floor(input.cantidad));
  const horas = Math.max(0, input.horasImpresion);
  const merma = Math.max(0, ctx.material.mermaPorcentaje);

  // 1. MATERIAL
  let costoMaterial = 0;
  if (input.tecnologia === 'FDM') {
    const pesoG = Math.max(0, input.pesoGramos || 0);
    // Formula: (pesoG / 1000) * precioPorKg * (1 + merma)
    costoMaterial = (pesoG / 1000) * ctx.material.costoPorUnidad * (1 + merma);
  } else {
    const volMl = Math.max(0, input.volumenMl || 0);
    // Formula: (volumenMl / 1000) * precioPorLitro * (1 + merma)
    costoMaterial = (volMl / 1000) * ctx.material.costoPorUnidad * (1 + merma);
  }

  // 2. ENERGÍA
  // Formula: (potenciaPromedioW / 1000) * horas * tarifaKwh
  const costoEnergia = (ctx.impresora.potenciaPromedioW / 1000) * horas * ctx.tarifaKwh;

  // 3. MÁQUINA (AMORTIZACIÓN Y MANTENIMIENTO)
  let costoMaquina = 0;
  if (ctx.impresora.tarifaHoraManual !== undefined && ctx.impresora.tarifaHoraManual >= 0) {
    costoMaquina = horas * ctx.impresora.tarifaHoraManual;
  } else {
    const amortizacionHora = ctx.impresora.vidaUtilHoras > 0
      ? ctx.impresora.precioCompra / ctx.impresora.vidaUtilHoras
      : 0;
    costoMaquina = horas * (amortizacionHora + ctx.impresora.mantenimientoPorHora);
  }

  // 4. CONSUMIBLES
  // Suma de consumibles aplicables prorrateados según su unidadVida
  let costoConsumibles = 0;
  if (input.consumibles && input.consumibles.length > 0) {
    for (const c of input.consumibles) {
      if (c.vidaUtil <= 0) continue;
      if (c.unidadVida === 'impresiones') {
        // Desgaste por corrida/plataforma realizada (1 corrida para el lote completo)
        costoConsumibles += c.costo / c.vidaUtil;
      } else if (c.unidadVida === 'horas') {
        costoConsumibles += (horas * c.costo) / c.vidaUtil;
      } else if (c.unidadVida === 'litros_procesados') {
        const litrosUsados = (input.volumenMl || 0) / 1000;
        costoConsumibles += (litrosUsados * c.costo) / c.vidaUtil;
      }
    }
  }

  // 5. LABOR (MANO DE OBRA)
  // Setup: UNA VEZ POR TRABAJO/LOTE (20 piezas no requieren 20 setups de rebanador/calibración)
  const costoLaborSetup = (Math.max(0, input.minutosSetup) / 60) * ctx.tarifaOperadorHora;
  // Postproceso: POR PIEZA (lavar, curar, desbastar o pulir escala con cada unidad producida)
  const costoLaborPost = (Math.max(0, input.minutosPostproceso) / 60) * ctx.tarifaOperadorHora * cantidad;

  // 6. EXTRAS DIRECTOS
  const costoExtras = Math.max(0, input.extrasDirectos);

  // COSTO DIRECTO DEL LOTE (Suma de las primeras 6 capas)
  const costoDirecto = costoMaterial + costoEnergia + costoMaquina + costoConsumibles + costoLaborSetup + costoLaborPost + costoExtras;

  // 7. RESERVA DE FALLA
  // OJO CRÍTICO: Se DIVIDE entre (1 - tasaFalla), no se multiplica.
  // Demostración: Si la tasa de falla es 10% (0.10), por cada 10 piezas lanzadas fallará 1 y saldrán 9 buenas.
  // La pieza buena debe absorber el costo completo de las fallidas: costoDirecto / 0.90 = costoDirecto * 1.111...
  // Si se usara `* (1 + 0.10)`, el taller recuperaría solo el 10% adicional, quedando en pérdida ante reimpresiones completas.
  const tasaFalla = Math.min(0.499, Math.max(0, input.tasaFalla !== undefined ? input.tasaFalla : ctx.tasaFallaPorDefecto));
  const costoRealTotal = costoDirecto / (1 - tasaFalla);
  const reservaFalla = costoRealTotal - costoDirecto;

  const desgloseLote: DesgloseCostoLote = {
    material: costoMaterial,
    energia: costoEnergia,
    maquina: costoMaquina,
    consumibles: costoConsumibles,
    laborSetup: costoLaborSetup,
    laborPost: costoLaborPost,
    extras: costoExtras,
    costoDirecto,
    reservaFalla,
    costoTotal: costoRealTotal
  };

  const costoUnitario = costoRealTotal / cantidad;

  // CÁLCULO DE PRECIO
  // Formula: precioBase = costoReal / (1 - margen)  [Margen real sobre venta]
  const margen = Math.min(0.949, Math.max(0, input.margen !== undefined ? input.margen : ctx.margenPorDefecto));
  const precioBaseLote = costoRealTotal / (1 - margen);
  const precioBaseUnitario = precioBaseLote / cantidad;

  // Aplicar precio mínimo por pieza configurado
  const precioConMinimo = Math.max(precioBaseUnitario, ctx.minimoPorPieza);

  // Redondear al paso configurado
  const precioUnitario = redondearAlPaso(precioConMinimo, ctx.pasoRedondeo);
  const precioTotal = Math.round(precioUnitario * cantidad * 100) / 100;

  // Métricas financieras reales resultantes
  const utilidad = precioTotal - costoRealTotal;
  const margenRealizado = precioTotal > 0 ? utilidad / precioTotal : 0;

  return {
    id: input.id,
    nombrePieza: input.nombrePieza,
    cantidad,
    desgloseLote,
    costoUnitario,
    costoTotal: costoRealTotal,
    precioUnitario,
    precioTotal,
    margenRealizado,
    utilidad
  };
}

// =============================================================================
// CÁLCULO GENERAL DE COTIZACIÓN
// =============================================================================

export function calcularCotizacion(lineas: LineaInput[], ctx: PricingContext): CotizacionResultado {
  const lineasResultados = lineas.map(linea => calcularLinea(linea, ctx));

  const costoTotalLote = lineasResultados.reduce((acc, l) => acc + l.costoTotal, 0);
  const sumaSubtotales = lineasResultados.reduce((acc, l) => acc + l.precioTotal, 0);

  // Aplicar mínimo de pedido del taller
  const baseSubtotal = Math.max(sumaSubtotales, ctx.minimoPedido);

  // Recargo de urgencia sobre el subtotal de trabajo
  const factorUrgencia = Math.max(0, ctx.recargoUrgencia);
  const recargoUrgenciaMonto = Math.round(baseSubtotal * factorUrgencia * 100) / 100;

  const costoEnvio = Math.max(0, ctx.envio);

  // Total antes de impuestos
  const total = baseSubtotal + recargoUrgenciaMonto + costoEnvio;

  // Impuestos (IVA)
  const ivaTasa = Math.max(0, ctx.ivaTasa);
  const ivaMonto = Math.round(total * ivaTasa * 100) / 100;
  const totalConIva = Math.round((total + ivaMonto) * 100) / 100;

  // Utilidad neta global del taller
  const utilidadNeta = total - (costoTotalLote + costoEnvio);
  const margenGlobalRealizado = total > 0 ? utilidadNeta / total : 0;

  return {
    lineas: lineasResultados,
    costoTotalLote,
    subtotal: baseSubtotal,
    recargoUrgenciaMonto,
    costoEnvio,
    total,
    ivaMonto,
    totalConIva,
    utilidadNeta,
    margenGlobalRealizado
  };
}

// =============================================================================
// ESCALONES DE PRECIO POR VOLUMEN (TIERED PRICING)
// =============================================================================

export function calcularEscalones(
  linea: LineaInput,
  ctx: PricingContext,
  cantidades: number[]
): EscalonResultado[] {
  // Obtener primero el precio unitario base de 1 pieza como referencia
  const lineaBaseUnit = calcularLinea({ ...linea, cantidad: 1 }, ctx);
  const precioUnitarioReferencia = lineaBaseUnit.precioUnitario;

  const escalones = cantidades
    .filter(c => c > 0)
    .sort((a, b) => a - b)
    .map(cant => {
      const resultado = calcularLinea({ ...linea, cantidad: cant }, ctx);
      const ahorro = precioUnitarioReferencia > 0
        ? Math.max(0, (precioUnitarioReferencia - resultado.precioUnitario) / precioUnitarioReferencia)
        : 0;

      return {
        cantidad: cant,
        costoUnitario: resultado.costoUnitario,
        precioUnitario: resultado.precioUnitario,
        precioTotal: resultado.precioTotal,
        ahorroPorcentualRespectoAUnitaria: Math.round(ahorro * 1000) / 10 // Ej. 14.5%
      };
    });

  return escalones;
}

// =============================================================================
// VALIDACIONES Y AUDITORÍA DE DATOS
// =============================================================================

export function validarLinea(input: LineaInput, ctx?: PricingContext): ProblemaValidacion[] {
  const problemas: ProblemaValidacion[] = [];

  // Cantidad
  if (!Number.isFinite(input.cantidad) || input.cantidad <= 0) {
    problemas.push({
      campo: 'cantidad',
      tipo: 'error',
      mensaje: 'La cantidad debe ser un número entero mayor a cero.'
    });
  }

  // Horas de impresión
  if (!Number.isFinite(input.horasImpresion) || input.horasImpresion <= 0) {
    problemas.push({
      campo: 'horasImpresion',
      tipo: 'error',
      mensaje: 'El tiempo de impresión debe ser un número finito mayor a 0.'
    });
  }

  // Consumo según tecnología
  if (input.tecnologia === 'FDM') {
    if (input.pesoGramos === undefined || !Number.isFinite(input.pesoGramos) || input.pesoGramos <= 0) {
      problemas.push({
        campo: 'pesoGramos',
        tipo: 'error',
        mensaje: 'En tecnología FDM el peso en gramos debe ser mayor a 0.'
      });
    } else if (input.horasImpresion > 0) {
      // Regla heurística de taller: Caudal volumétrico normal FDM ronda entre 3 y 30 g/h
      // Si cae fuera, suele ser error humano de captura (ej. poner gramos en kilos o viceversa).
      const gPorHora = input.pesoGramos / input.horasImpresion;
      if (gPorHora < 3 || gPorHora > 30) {
        problemas.push({
          campo: 'pesoGramos',
          tipo: 'advertencia',
          mensaje: `El ratio de flujo calculado (${gPorHora.toFixed(1)} g/h) cae fuera del rango típico de impresión FDM (3–30 g/h). Verifica si el tiempo o peso fueron capturados incorrectamente.`
        });
      }
    }
  } else if (input.tecnologia === 'MSLA') {
    if (input.volumenMl === undefined || !Number.isFinite(input.volumenMl) || input.volumenMl <= 0) {
      problemas.push({
        campo: 'volumenMl',
        tipo: 'error',
        mensaje: 'En tecnología MSLA el volumen en mililitros de resina debe ser mayor a 0.'
      });
    }
  }

  // Márgenes y tasas
  const margenEvaluado = input.margen !== undefined ? input.margen : ctx?.margenPorDefecto;
  if (margenEvaluado !== undefined) {
    if (!Number.isFinite(margenEvaluado) || margenEvaluado < 0 || margenEvaluado >= 0.95) {
      problemas.push({
        campo: 'margen',
        tipo: 'error',
        mensaje: 'El margen debe ser un número entre 0.00 (0%) y menor a 0.95 (95%). Un margen de 1.0 provocaría división entre cero.'
      });
    }
  }

  const tasaFallaEvaluada = input.tasaFalla !== undefined ? input.tasaFalla : ctx?.tasaFallaPorDefecto;
  if (tasaFallaEvaluada !== undefined) {
    if (!Number.isFinite(tasaFallaEvaluada) || tasaFallaEvaluada < 0 || tasaFallaEvaluada >= 0.5) {
      problemas.push({
        campo: 'tasaFalla',
        tipo: 'error',
        mensaje: 'La reserva de falla debe estar entre 0.00 (0%) y menor a 0.50 (50%). Valores superiores indican un proceso inestable no cotizable.'
      });
    }
  }

  // Dimensiones vs Volumen de la Impresora
  if (input.dimensionesMm && ctx?.impresora?.volumenMaxMm) {
    const { x, y, z } = input.dimensionesMm;
    const max = ctx.impresora.volumenMaxMm;

    // Comparar si cabe en alguna orientación elemental
    const dimsPieza = [x, y, z].sort((a, b) => a - b);
    const dimsMax = [max.x, max.y, max.z].sort((a, b) => a - b);

    if (dimsPieza[0] > dimsMax[0] || dimsPieza[1] > dimsMax[1] || dimsPieza[2] > dimsMax[2]) {
      problemas.push({
        campo: 'dimensionesMm',
        tipo: 'error',
        mensaje: `La pieza (${x}x${y}x${z} mm) excede el volumen máximo imprimible de la ${ctx.impresora.nombre} (${max.x}x${max.y}x${max.z} mm). Requiere segmentación o una máquina de mayor volumen.`
      });
    }
  }

  return problemas;
}

// =============================================================================
// CASOS DE PRUEBA RESUELTOS A MANO (VERIFICACIÓN Y AUDITORÍA DEL MOTOR)
// =============================================================================

/*
 ===============================================================================
 CASO 1: FDM SIMPLE (1 sola pieza técnica en Bambu X1-Carbon, PLA Estándar)
 ===============================================================================
 Parámetros de entrada:
   - Tecnología: FDM
   - Cantidad: 1 pieza
   - Peso: 80 g de PLA ($450 MXN / kg, merma 5% = 0.05)
   - Tiempo de impresión: 4.0 horas
   - Potencia promedio medida X1C: 105 W
   - Tarifa eléctrica CFE: $3.50 MXN / kWh
   - Impresora adquisición: $28,000 MXN, vida útil: 4,000 h, mantto: $2.00 MXN/h
     -> Amortización/h = 28000 / 4000 = $7.00/h
     -> Tarifa máquina total/h = $7.00 + $2.00 = $9.00/h
   - Consumibles: Ninguno adicional
   - Labor: Setup 15 min (0.25 h), Postproceso 5 min (0.0833 h)
   - Tarifa técnico: $120.00 MXN / h
   - Extras: $0.00
   - Tasa de falla: 5% (0.05)
   - Margen comercial deseado: 35% (0.35)
   - Mínimo por pieza: $50.00 MXN
   - Paso redondeo: $5.00 MXN

 Cálculos a mano paso a paso:
   1. Material = (80 / 1000) * 450 * (1 + 0.05) = 0.08 * 450 * 1.05 = $37.8000 MXN
   2. Energía  = (105 / 1000) * 4.0 * 3.50 = 0.105 * 4 * 3.50 = $1.4700 MXN
   3. Máquina  = 4.0 * ($7.00 + $2.00) = 4.0 * $9.00 = $36.0000 MXN
   4. Consumibles = $0.00 MXN
   5. Labor:
      - Setup (1 vez): (15 / 60) * 120 = 0.25 * 120 = $30.0000 MXN
      - Postproceso (1 pieza): (5 / 60) * 120 * 1 = $10.0000 MXN
      - Total Labor = $40.0000 MXN
   6. Extras   = $0.00 MXN
   -----------------------------------------------------------------------------
   Costo Directo = 37.80 + 1.47 + 36.00 + 0 + 40.00 + 0 = $115.2700 MXN
   7. Reserva Falla = 115.27 / (1 - 0.05) = 115.27 / 0.95 = $121.3368 MXN
      (Monto de la reserva: $6.0668 MXN)
   -----------------------------------------------------------------------------
   Precio Base = 121.3368 / (1 - 0.35) = 121.3368 / 0.65 = $186.6720 MXN
   Precio Unitario con paso de $5 (Math.ceil a múltiplo de 5):
     186.6720 / 5 = 37.3344 -> ceil = 38 -> 38 * 5 = $190.00 MXN
   Precio Total (1 unidad) = $190.00 MXN
   Utilidad neta: $190.00 - $121.34 = $68.66 MXN (Margen realizado: 36.14%)

 ===============================================================================
 CASO 2: MSLA CON POSTPROCESO EXIGENTE (Figura en Resina Tough + Lavado/Curado)
 ===============================================================================
 Parámetros de entrada:
   - Tecnología: MSLA
   - Cantidad: 1 pieza
   - Resina: 120 ml ($950 MXN / Litro, merma 10% = 0.10 por soportes y película FEP)
   - Tiempo de impresión: 6.0 horas
   - Potencia promedio Elegoo Saturn: 60 W
   - Tarifa eléctrica CFE: $3.50 MXN / kWh
   - Impresora: $15,000 MXN, vida útil: 2,500 h, mantto: $1.50 MXN/h
     -> Amortización/h = 15000 / 2500 = $6.00/h
     -> Tarifa máquina/h = $6.00 + $1.50 = $7.50/h
   - Consumibles específicos MSLA:
     * Película FEP: $400 MXN, vida útil 100 horas -> $4.00/h * 6h = $24.00 MXN
     * Alcohol Isopropílico (IPA): $90 MXN/litro, procesa 5 litros de resina
       -> $90 / 5 = $18.00 por litro procesado -> 0.120 L * $18.00 = $2.16 MXN
     Total Consumibles = 24.00 + 2.16 = $26.1600 MXN
   - Labor:
     * Setup (revisión isla, vaciado, soportes): 20 min = 0.3333 h
     * Postproceso (lavado ultrasonido, retiro soporte bisturí, curado UV): 25 min = 0.4166 h
     * Tarifa operador: $140.00 MXN / h
   - Extras (caja rígida y protección para figura frágil): $35.00 MXN
   - Tasa de falla: 12% (0.12)  [MSLA es más propensa a delaminación]
   - Margen comercial deseado: 40% (0.40)
   - Paso redondeo: $10.00 MXN

 Cálculos a mano paso a paso:
   1. Material = (120 / 1000) * 950 * (1 + 0.10) = 0.12 * 950 * 1.10 = $125.4000 MXN
   2. Energía  = (60 / 1000) * 6.0 * 3.50 = 0.06 * 6 * 3.50 = $1.2600 MXN
   3. Máquina  = 6.0 * $7.50 = $45.0000 MXN
   4. Consumibles = $26.1600 MXN
   5. Labor:
      - Setup: (20 / 60) * 140 = $46.6667 MXN
      - Postproceso: (25 / 60) * 140 = $58.3333 MXN
      - Total Labor = $105.0000 MXN
   6. Extras   = $35.0000 MXN
   -----------------------------------------------------------------------------
   Costo Directo = 125.40 + 1.26 + 45.00 + 26.16 + 105.00 + 35.00 = $337.8200 MXN
   7. Reserva Falla = 337.82 / (1 - 0.12) = 337.82 / 0.88 = $383.8864 MXN
      (Monto de la reserva: $46.0664 MXN)
   -----------------------------------------------------------------------------
   Precio Base = 383.8864 / (1 - 0.40) = 383.8864 / 0.60 = $639.8106 MXN
   Precio Unitario con paso de $10 (Math.ceil a múltiplo de 10):
     639.8106 / 10 = 63.981 -> ceil = 64 -> 64 * 10 = $640.00 MXN
   Precio Total = $640.00 MXN
   Utilidad neta: $640.00 - $383.89 = $256.11 MXN (Margen realizado: 40.02%)

 ===============================================================================
 CASO 3: LOTE DE 25 PIEZAS FDM (Demostración de dilución de Setup)
 ===============================================================================
 Parámetros de entrada:
   - Tecnología: FDM
   - Cantidad: 25 piezas
   - Peso por pieza: 30 g -> Lote total (25 uds) = 750 g de PETG ($550 MXN / kg, merma 4% = 0.04)
   - Horas totales de máquina (impresión serial o por camas): 35.0 horas
   - Potencia promedio: 110 W
   - Tarifa eléctrica CFE: $3.20 MXN / kWh
   - Impresora: Amortización + Mantto = $8.50 MXN / hora
   - Consumibles: Boquilla endurecida prorrateada ($250 / 500 horas) * 35 h = $17.50 MXN
   - Labor:
     * Setup lote: 30 min (0.5 h) a $130 MXN/h = $65.00 MXN (INCURRIDO 1 VEZ)
     * Postproceso por pieza: 3 min c/u -> 25 piezas * 3 min = 75 min = 1.25 h
       -> 1.25 h * $130 MXN/h = $162.50 MXN
   - Extras: 25 insertos roscados M3 ($2.00 c/u) = $50.00 MXN
   - Tasa de falla: 6% (0.06)
   - Margen comercial deseado: 30% (0.30)
   - Paso redondeo: $1.00 MXN

 Cálculos a mano paso a paso:
   1. Material = (750 / 1000) * 550 * (1 + 0.04) = 0.75 * 550 * 1.04 = $429.0000 MXN
   2. Energía  = (110 / 1000) * 35.0 * 3.20 = 0.11 * 35 * 3.20 = $12.3200 MXN
   3. Máquina  = 35.0 * $8.50 = $297.5000 MXN
   4. Consumibles = $17.5000 MXN
   5. Labor:
      - Setup (único): $65.0000 MXN  [Representa solo $2.60 por pieza en lote de 25]
      - Postproceso (25 uds): $162.5000 MXN
      - Total Labor = $227.5000 MXN
   6. Extras   = $50.0000 MXN
   -----------------------------------------------------------------------------
   Costo Directo Lote = 429.00 + 12.32 + 297.50 + 17.50 + 227.50 + 50.00 = $1,033.8200 MXN
   7. Reserva Falla Lote = 1,033.82 / (1 - 0.06) = 1,033.82 / 0.94 = $1,099.8085 MXN
      (Costo unitario real por pieza: $1,099.81 / 25 = $43.9923 MXN/pieza)
   -----------------------------------------------------------------------------
   Precio Base Lote = 1,099.8085 / (1 - 0.30) = 1,099.8085 / 0.70 = $1,571.1550 MXN
   Precio Base Unitario = 1,571.1550 / 25 = $62.8462 MXN
   Precio Unitario con paso de $1 (Math.ceil a múltiplo de 1):
     Math.ceil(62.8462) = $63.00 MXN / pieza
   Precio Total del Lote (25 x $63.00) = $1,575.00 MXN
   Utilidad neta: $1,575.00 - $1,099.81 = $475.19 MXN (Margen realizado: 30.17%)
 ===============================================================================
*/
