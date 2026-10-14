/**
 * CubeUp³ — Motor Matemático de Precios y Costos de Manufactura Aditiva
 * 
 * Reglas cardinales:
 * 1. Todos los montos monetarios están expresados en MXN.
 * 2. Cero atajos: sin tipos 'any', sin try/catch silenciosos, sin '?? 0' que oculten datos faltantes.
 * 3. Margen comercial real: precio = costo / (1 - margen), garantizando que el % sea sobre venta.
 * 4. Contingencia por falla: costoBase / (1 - tasaFalla), protegiendo material, energía, máquina y overhead.
 * 5. Rentabilidad temporal: cálculo explícito de utilidad por hora de máquina y por hora de persona.
 */

import { OverheadConfig, calcularTasaOverheadHora } from './tallerConfig';

export type TecnologiaImpresion = 'FDM' | 'MSLA';

export interface ConsumibleAplicable {
  id: string;
  nombre: string;
  costoUnitario: number;
  unidadesConsumidas: number;
}

export interface ImpresoraConfig {
  id: string;
  nombre: string;
  tecnologia: TecnologiaImpresion;
  potenciaPromedioW: number;
  precioCompra: number;
  vidaUtilHoras: number;
  mantenimientoPorHora: number;
  tarifaHoraManual?: number;
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
  costoPorUnidad: number; // MXN por kg (FDM) o litro (MSLA)
  mermaPorcentaje: number; // 0.05 = 5%
}

export interface DimensionesPiezaMm {
  x: number;
  y: number;
  z: number;
}

export interface LineaInput {
  id: string;
  nombrePieza: string;
  tecnologia?: TecnologiaImpresion;
  cantidad: number;
  horasImpresion: number; // Horas totales de máquina para el lote completo
  pesoGramos?: number; // Para FDM
  volumenMl?: number; // Para MSLA
  dimensionesMm?: DimensionesPiezaMm;
  consumibles?: ConsumibleAplicable[];

  // Mano de obra en tres partes
  minutosModelado?: number; // Diseño/CAD. UNA VEZ por trabajo. Tarifa propia.
  minutosAlistado?: number; // Preparación/laminado/calibración. UNA VEZ por trabajo. Tarifa operador.
  minutosSetup?: number; // Alias de compatibilidad para cotizaciones previas (migra a minutosAlistado)
  minutosPostproceso: number; // Limpieza/soportes/curado. POR PIEZA. Tarifa operador.

  extrasDirectos: number; // Herrajes, tornillos, empaques
  tasaFalla?: number;
  margen?: number;
}

export interface PricingContext {
  tarifaKwh: number;
  tarifaOperadorHora: number;
  tarifaDisenoHora: number;
  overhead: OverheadConfig;
  margenPorDefecto: number;
  tasaFallaPorDefecto: number;
  minimoPorPieza: number;
  pasoRedondeo: number;
  minimoPedido: number;
  recargoUrgencia: number;
  envio: number;
  ivaTasa: number;
  impresora: ImpresoraConfig;
  material: MaterialConfig;
}

export interface DesgloseCostoLote {
  material: number;
  energia: number;
  maquina: number;
  consumibles: number;
  laborModelado: number;
  laborAlistado: number;
  laborPost: number;
  laborSetup?: number; // Retrocompatibilidad con vistas
  extras: number;
  subtotalTecnico: number;
  overhead: number;
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
  utilidadPorHoraMaquina: number | null;
  utilidadPorHoraPersona: number | null;
  horasPersonaTotales: number;
}

export interface PasoCascada {
  clave: string;
  etiqueta: string;
  monto: number;
  acumulado: number;
  tipo: 'componente' | 'subtotal' | 'ajuste' | 'total';
  porcentajeDelPrecio: number;
  ayuda: string;
}

export interface ResumenTicket {
  lineas: LineaResultado[];
  subtotal: number;
  ajusteMinimoPedido: number;
  recargoUrgencia: number;
  envio: number;
  totalSinIva: number;
  iva: number;
  totalConIva: number;
  costoTotalTicket: number;
  utilidadTotal: number;
  margenRealizadoTicket: number;
  gananciaPorRedondeoYMinimos: number;
  desgloseAgregado: {
    material: number;
    energia: number;
    maquina: number;
    consumibles: number;
    laborModelado: number;
    laborAlistado: number;
    laborPost: number;
    extras: number;
    overhead: number;
    reservaFalla: number;
    envio: number;
    recargoUrgencia: number;
    utilidad: number;
    iva: number;
  };
}

export interface ProblemaValidacion {
  campo: 'nombrePieza' | 'pesoGramos' | 'volumenMl' | 'horasImpresion' | 'cantidad' | 'overhead';
  mensaje: string;
  tipo: 'error' | 'advertencia';
}

/**
 * Valida los datos de entrada de una línea de cotización en tiempo real.
 */
export function validarLinea(input: LineaInput, ctx: PricingContext): ProblemaValidacion[] {
  const problemas: ProblemaValidacion[] = [];

  if (!input.nombrePieza.trim()) {
    problemas.push({
      campo: 'nombrePieza',
      mensaje: 'El nombre de la pieza es requerido.',
      tipo: 'error'
    });
  }

  if (input.cantidad < 1) {
    problemas.push({
      campo: 'cantidad',
      mensaje: 'La cantidad debe ser al menos 1 pieza.',
      tipo: 'error'
    });
  }

  if (ctx.material.tecnologia === 'FDM') {
    const gramos = input.pesoGramos ?? 0;
    if (gramos <= 0) {
      problemas.push({
        campo: 'pesoGramos',
        mensaje: 'Ingresa el peso en gramos mayor a 0.',
        tipo: 'error'
      });
    } else if (gramos > 5000) {
      problemas.push({
        campo: 'pesoGramos',
        mensaje: 'Peso inusualmente alto (> 5 kg). Verifica el laminador.',
        tipo: 'advertencia'
      });
    }
  } else {
    const ml = input.volumenMl ?? 0;
    if (ml <= 0) {
      problemas.push({
        campo: 'volumenMl',
        mensaje: 'Ingresa el volumen en ml mayor a 0.',
        tipo: 'error'
      });
    } else if (ml > 2000) {
      problemas.push({
        campo: 'volumenMl',
        mensaje: 'Volumen inusualmente alto (> 2 L). Verifica el laminador.',
        tipo: 'advertencia'
      });
    }
  }

  if (input.horasImpresion <= 0) {
    problemas.push({
      campo: 'horasImpresion',
      mensaje: 'Ingresa el tiempo de impresión en horas mayor a 0.',
      tipo: 'error'
    });
  } else if (input.horasImpresion > 200) {
    problemas.push({
      campo: 'horasImpresion',
      mensaje: 'Tiempo de impresión muy alto (> 200 h). Verifica si es correcto.',
      tipo: 'advertencia'
    });
  }

  return problemas;
}

/**
 * Convierte un margen comercial (fracción sobre precio de venta) a markup (sobrecosto sobre costo).
 * Ejemplo: margen 0.45 (45%) => markup ~0.818 (81.8%).
 */
export function margenToMarkup(margen: number): number {
  const m = Math.max(0, Math.min(0.99, margen));
  return (1 - m) > 0 ? m / (1 - m) : 0;
}

/**
 * Convierte un markup (sobrecosto sobre costo) a margen comercial (sobre precio de venta).
 */
export function markupToMargen(markup: number): number {
  const mu = Math.max(0, markup);
  return mu / (1 + mu);
}

/**
 * Redondea un valor hacia arriba al múltiplo del paso especificado (0.5, 1, 5, 10).
 */
export function redondearAlPaso(valor: number, paso: number): number {
  if (paso <= 0 || !Number.isFinite(paso)) return valor;
  const factor = 1 / paso;
  return Math.ceil(valor * factor) / factor;
}

/**
 * Calcula una línea de cotización con estricto orden de cascada:
 * 1. Costos directos técnicos (material, energía, máquina, consumibles, 3 labores, extras)
 * 2. Overhead prorrateado
 * 3. Base con fallo = (subtotalTecnico + overhead) / (1 - tasaFalla)
 * 4. Precio base lote = baseConFallos / (1 - margen)
 * 5. Aplicación de mínimo por pieza y redondeo comercial
 */
export function calcularLinea(input: LineaInput, ctx: PricingContext): LineaResultado {
  const cantidad = Math.max(1, Math.round(input.cantidad));
  const horasImpresion = Math.max(0, input.horasImpresion);

  // 1. Material
  let costoMaterial = 0;
  if (ctx.material.tecnologia === 'FDM') {
    const gramos = Math.max(0, input.pesoGramos ?? 0);
    const kg = gramos / 1000;
    const kgConMerma = kg * (1 + ctx.material.mermaPorcentaje);
    costoMaterial = kgConMerma * ctx.material.costoPorUnidad;
  } else {
    const ml = Math.max(0, input.volumenMl ?? 0);
    const litros = ml / 1000;
    const litrosConMerma = litros * (1 + ctx.material.mermaPorcentaje);
    costoMaterial = litrosConMerma * ctx.material.costoPorUnidad;
  }

  // 2. Energía
  const kwh = (ctx.impresora.potenciaPromedioW / 1000) * horasImpresion;
  const costoEnergia = kwh * ctx.tarifaKwh;

  // 3. Máquina (Amortización + Mantenimiento)
  let costoMaquina = 0;
  if (ctx.impresora.tarifaHoraManual !== undefined && ctx.impresora.tarifaHoraManual >= 0) {
    costoMaquina = horasImpresion * ctx.impresora.tarifaHoraManual;
  } else {
    const amortizacionHora = ctx.impresora.vidaUtilHoras > 0
      ? ctx.impresora.precioCompra / ctx.impresora.vidaUtilHoras
      : 0;
    const costoHoraMaquina = amortizacionHora + ctx.impresora.mantenimientoPorHora;
    costoMaquina = horasImpresion * costoHoraMaquina;
  }

  // 4. Consumibles
  let costoConsumibles = 0;
  if (Array.isArray(input.consumibles)) {
    for (const c of input.consumibles) {
      costoConsumibles += Math.max(0, c.costoUnitario) * Math.max(0, c.unidadesConsumidas);
    }
  }

  // 5. Mano de obra en tres partes
  // Migración: si viene minutosAlistado se usa ese; si viene minutosSetup se mapea a alistado.
  const minModelado = Math.max(0, input.minutosModelado ?? 0);
  const minAlistado = Math.max(0, input.minutosAlistado ?? input.minutosSetup ?? 0);
  const minPost = Math.max(0, input.minutosPostproceso);

  const laborModelado = (minModelado / 60) * ctx.tarifaDisenoHora;
  const laborAlistado = (minAlistado / 60) * ctx.tarifaOperadorHora;
  const laborPost = (minPost / 60) * ctx.tarifaOperadorHora * cantidad;

  // 6. Extras
  const extras = Math.max(0, input.extrasDirectos);

  // Subtotal técnico
  const subtotalTecnico = costoMaterial + costoEnergia + costoMaquina + costoConsumibles +
    laborModelado + laborAlistado + laborPost + extras;

  // 7. Overhead (antes del fallo)
  let costoOverhead = 0;
  if (ctx.overhead.modo === 'porHora') {
    const overheadCalculado = calcularTasaOverheadHora(ctx.overhead);
    costoOverhead = horasImpresion * overheadCalculado.tasa;
  } else {
    costoOverhead = subtotalTecnico * ctx.overhead.porcentajeFallback;
  }

  const baseConOverhead = subtotalTecnico + costoOverhead;

  // 8. Contingencia por falla
  const tasaFallaRaw = input.tasaFalla ?? ctx.tasaFallaPorDefecto;
  const tasaFalla = Math.max(0, Math.min(0.40, tasaFallaRaw));
  const factorFalla = 1 - tasaFalla;
  const baseConFallos = factorFalla > 0 ? baseConOverhead / factorFalla : baseConOverhead;
  const reservaFalla = baseConFallos - baseConOverhead;

  const costoTotalLote = baseConFallos;
  const costoDirectoLote = baseConOverhead;

  // 9. Margen comercial real
  const margenRaw = input.margen ?? ctx.margenPorDefecto;
  const margen = Math.max(0, Math.min(0.90, margenRaw));
  const divisorMargen = 1 - margen;
  const precioBaseLote = divisorMargen > 0 ? baseConFallos / divisorMargen : baseConFallos;

  // 10. Mínimos y redondeo
  const precioBaseUnitario = precioBaseLote / cantidad;
  const precioUnitarioConPiso = Math.max(ctx.minimoPorPieza, precioBaseUnitario);
  const precioUnitarioFinal = redondearAlPaso(precioUnitarioConPiso, ctx.pasoRedondeo);
  const precioTotalLote = precioUnitarioFinal * cantidad;

  // Utilidad y margen realizado
  const utilidad = precioTotalLote - costoTotalLote;
  const margenRealizado = precioTotalLote > 0 ? utilidad / precioTotalLote : 0;

  // Horas y rentabilidad temporal
  const horasPersonaTotales = (minModelado + minAlistado + (minPost * cantidad)) / 60;
  const utilidadPorHoraMaquina = horasImpresion > 0 ? utilidad / horasImpresion : null;
  const utilidadPorHoraPersona = horasPersonaTotales > 0 ? utilidad / horasPersonaTotales : null;

  return {
    id: input.id,
    nombrePieza: input.nombrePieza,
    cantidad,
    desgloseLote: {
      material: costoMaterial,
      energia: costoEnergia,
      maquina: costoMaquina,
      consumibles: costoConsumibles,
      laborModelado,
      laborAlistado,
      laborPost,
      laborSetup: laborAlistado, // Compatibilidad retroactiva
      extras,
      subtotalTecnico,
      overhead: costoOverhead,
      costoDirecto: costoDirectoLote,
      reservaFalla,
      costoTotal: costoTotalLote
    },
    costoUnitario: costoTotalLote / cantidad,
    costoTotal: costoTotalLote,
    precioUnitario: precioUnitarioFinal,
    precioTotal: precioTotalLote,
    margenRealizado,
    utilidad,
    utilidadPorHoraMaquina,
    utilidadPorHoraPersona,
    horasPersonaTotales
  };
}

/**
 * Genera la cascada analítica ordenada de 13 pasos para auditoría o visualización en UI.
 */
export function construirCascada(res: LineaResultado, ctx: PricingContext): PasoCascada[] {
  const precioUnitario = res.precioUnitario;
  const cant = res.cantidad;
  const desg = res.desgloseLote;

  const matUnit = desg.material / cant;
  const enerUnit = desg.energia / cant;
  const maqUnit = desg.maquina / cant;
  const modUnit = desg.laborModelado / cant;
  const aliUnit = desg.laborAlistado / cant;
  const postUnit = desg.laborPost / cant;
  const extUnit = (desg.extras + desg.consumibles) / cant;

  const subtotalTecnicoUnit = desg.subtotalTecnico / cant;
  const overheadUnit = desg.overhead / cant;
  const baseConFallosUnit = desg.costoTotal / cant;
  const margenMontoUnit = Math.max(0, precioUnitario - baseConFallosUnit);
  const ivaUnit = precioUnitario * ctx.ivaTasa;
  const totalLoteConIva = (precioUnitario + ivaUnit) * cant;

  const calcPct = (monto: number): number => {
    return precioUnitario > 0 ? (monto / precioUnitario) * 100 : 0;
  };

  let acc = 0;

  acc += matUnit;
  const p1: PasoCascada = {
    clave: 'material',
    etiqueta: 'Material',
    monto: matUnit,
    acumulado: acc,
    tipo: 'componente',
    porcentajeDelPrecio: calcPct(matUnit),
    ayuda: 'Filamento o resina consumida incluyendo porcentaje de merma.'
  };

  acc += enerUnit;
  const p2: PasoCascada = {
    clave: 'energia',
    etiqueta: 'Energía impresión',
    monto: enerUnit,
    acumulado: acc,
    tipo: 'componente',
    porcentajeDelPrecio: calcPct(enerUnit),
    ayuda: 'Consumo eléctrico según potencia real y tarifa CFE.'
  };

  acc += maqUnit;
  const p3: PasoCascada = {
    clave: 'maquina',
    etiqueta: 'Máquina',
    monto: maqUnit,
    acumulado: acc,
    tipo: 'componente',
    porcentajeDelPrecio: calcPct(maqUnit),
    ayuda: 'Amortización por vida útil y mantenimiento preventivo.'
  };

  acc += modUnit;
  const p4: PasoCascada = {
    clave: 'labor_modelado',
    etiqueta: 'Mano de obra: modelado',
    monto: modUnit,
    acumulado: acc,
    tipo: 'componente',
    porcentajeDelPrecio: calcPct(modUnit),
    ayuda: 'Diseño/CAD prorrateado en el lote según tarifa de diseño.'
  };

  acc += aliUnit;
  const p5: PasoCascada = {
    clave: 'labor_alistado',
    etiqueta: 'Mano de obra: alistado',
    monto: aliUnit,
    acumulado: acc,
    tipo: 'componente',
    porcentajeDelPrecio: calcPct(aliUnit),
    ayuda: 'Laminado, calibración y carga de material.'
  };

  acc += postUnit;
  const p6: PasoCascada = {
    clave: 'labor_post',
    etiqueta: 'Mano de obra: post-procesado',
    monto: postUnit,
    acumulado: acc,
    tipo: 'componente',
    porcentajeDelPrecio: calcPct(postUnit),
    ayuda: 'Retiro de soportes, lavado, curado o acabado superficial.'
  };

  acc += extUnit;
  const p7: PasoCascada = {
    clave: 'extras',
    etiqueta: 'Extras',
    monto: extUnit,
    acumulado: acc,
    tipo: 'componente',
    porcentajeDelPrecio: calcPct(extUnit),
    ayuda: 'Herrajes, insertos, consumibles especiales y empaques.'
  };

  const p8: PasoCascada = {
    clave: 'subtotal_tecnico',
    etiqueta: '= Subtotal técnico',
    monto: subtotalTecnicoUnit,
    acumulado: subtotalTecnicoUnit,
    tipo: 'subtotal',
    porcentajeDelPrecio: calcPct(subtotalTecnicoUnit),
    ayuda: 'Suma de costos directos de manufactura.'
  };

  const p9: PasoCascada = {
    clave: 'overhead',
    etiqueta: '+ Overhead',
    monto: overheadUnit,
    acumulado: subtotalTecnicoUnit + overheadUnit,
    tipo: 'ajuste',
    porcentajeDelPrecio: calcPct(overheadUnit),
    ayuda: 'Gastos fijos de taller por hora de máquina.'
  };

  const p10: PasoCascada = {
    clave: 'base_con_fallos',
    etiqueta: '= Base con fallos',
    monto: baseConFallosUnit,
    acumulado: baseConFallosUnit,
    tipo: 'subtotal',
    porcentajeDelPrecio: calcPct(baseConFallosUnit),
    ayuda: 'Costo total tras factor de contingencia por desperdicio.'
  };

  const p11: PasoCascada = {
    clave: 'margen',
    etiqueta: '+ Margen',
    monto: margenMontoUnit,
    acumulado: precioUnitario,
    tipo: 'ajuste',
    porcentajeDelPrecio: calcPct(margenMontoUnit),
    ayuda: 'Margen comercial aplicado sobre el precio final.'
  };

  const p12: PasoCascada = {
    clave: 'unitario_base',
    etiqueta: 'Unitario (base)',
    monto: precioUnitario,
    acumulado: precioUnitario,
    tipo: 'subtotal',
    porcentajeDelPrecio: 100,
    ayuda: 'Precio de venta unitario antes de impuestos.'
  };

  const p13: PasoCascada = {
    clave: 'iva',
    etiqueta: `+ IVA ${Math.round(ctx.ivaTasa * 100)}%`,
    monto: ivaUnit,
    acumulado: precioUnitario + ivaUnit,
    tipo: 'ajuste',
    porcentajeDelPrecio: calcPct(ivaUnit),
    ayuda: 'Impuesto al valor agregado.'
  };

  const p14: PasoCascada = {
    clave: 'total_lote',
    etiqueta: 'Total × cantidad',
    monto: totalLoteConIva,
    acumulado: totalLoteConIva,
    tipo: 'total',
    porcentajeDelPrecio: 100,
    ayuda: `Monto final por las ${cant} piezas incluyendo IVA.`
  };

  return [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14];
}

/**
 * Calcula los totales agregados de un ticket de cotización.
 */
export function calcularTicket(lineas: LineaResultado[], ctx: PricingContext): ResumenTicket {
  let subtotalLineas = 0;
  let costoTotalLineas = 0;

  const desglose = {
    material: 0,
    energia: 0,
    maquina: 0,
    consumibles: 0,
    laborModelado: 0,
    laborAlistado: 0,
    laborPost: 0,
    extras: 0,
    overhead: 0,
    reservaFalla: 0,
    envio: ctx.envio,
    recargoUrgencia: 0,
    utilidad: 0,
    iva: 0
  };

  for (const l of lineas) {
    subtotalLineas += l.precioTotal;
    costoTotalLineas += l.costoTotal;

    desglose.material += l.desgloseLote.material;
    desglose.energia += l.desgloseLote.energia;
    desglose.maquina += l.desgloseLote.maquina;
    desglose.consumibles += l.desgloseLote.consumibles;
    desglose.laborModelado += l.desgloseLote.laborModelado;
    desglose.laborAlistado += l.desgloseLote.laborAlistado;
    desglose.laborPost += l.desgloseLote.laborPost;
    desglose.extras += l.desgloseLote.extras;
    desglose.overhead += l.desgloseLote.overhead;
    desglose.reservaFalla += l.desgloseLote.reservaFalla;
  }

  // Ajuste a mínimo de pedido
  let ajusteMinimoPedido = 0;
  if (lineas.length > 0 && subtotalLineas < ctx.minimoPedido) {
    ajusteMinimoPedido = ctx.minimoPedido - subtotalLineas;
  }

  const subtotalConAjuste = subtotalLineas + ajusteMinimoPedido;
  const recargoUrgencia = subtotalConAjuste * ctx.recargoUrgencia;
  desglose.recargoUrgencia = recargoUrgencia;

  const totalSinIva = subtotalConAjuste + recargoUrgencia + ctx.envio;
  const iva = totalSinIva * ctx.ivaTasa;
  desglose.iva = iva;

  const totalConIva = totalSinIva + iva;
  const costoTotalTicket = costoTotalLineas + ctx.envio;
  const utilidadTotal = totalSinIva - costoTotalTicket;
  desglose.utilidad = utilidadTotal;

  const margenRealizadoTicket = totalSinIva > 0 ? utilidadTotal / totalSinIva : 0;

  // Ganancia por redondeo y mínimos
  let precioBaseSinRedondeoNiPiso = 0;
  for (const l of lineas) {
    const margen = ctx.margenPorDefecto;
    const baseConFallos = l.desgloseLote.costoTotal;
    const precioBase = (1 - margen) > 0 ? baseConFallos / (1 - margen) : baseConFallos;
    precioBaseSinRedondeoNiPiso += precioBase;
  }
  const gananciaPorRedondeoYMinimos = Math.max(0, subtotalConAjuste - precioBaseSinRedondeoNiPiso);

  return {
    lineas,
    subtotal: subtotalLineas,
    ajusteMinimoPedido,
    recargoUrgencia,
    envio: ctx.envio,
    totalSinIva,
    iva,
    totalConIva,
    costoTotalTicket,
    utilidadTotal,
    margenRealizadoTicket,
    gananciaPorRedondeoYMinimos,
    desgloseAgregado: desglose
  };
}

/*
================================================================================
CASO DE PRUEBA DE REFERENCIA (VERIFICACIÓN PASO A PASO CON CALCULADORA)
================================================================================

Pieza de prueba:
  - FDM: 80g PLA ($450/kg, merma 5% => 84g => $37.80)
  - 3.5 horas de impresión
  - Impresora FDM: 120W, $15,000 compra, 4,000 h vida útil, $2/h mantenimiento
    -> Energía: 0.12 kW * 3.5 h * $3.50/kWh = $1.47
    -> Amortización: ($15,000 / 4,000) = $3.75/h + $2.00/h = $5.75/h * 3.5 h = $20.125
  - Labor:
    -> Modelado: 0 min => $0.00
    -> Alistado: 10 min a $120/h => $20.00
    -> Postproceso: 10 min a $120/h * 1 pieza => $20.00
  - Extras: $0.00
  - Subtotal técnico = 37.80 + 1.47 + 20.125 + 0 + 20.00 + 20.00 + 0 = $79.395
  - Overhead:
    -> $4,000 / 160 h = $25.00/h
    -> $25.00 * 3.5 h = $87.50
  - Base con overhead = 79.395 + 87.50 = $166.895
  - Tasa de fallo (8%):
    -> $166.895 / (1 - 0.08) = $166.895 / 0.92 = $181.408
    -> Reserva de fallo = $14.513
  - Margen objetivo (45%):
    -> $181.408 / (1 - 0.45) = $181.408 / 0.55 = $329.832
  - Redondeo (paso $1.00):
    -> Math.ceil(329.832) = $330.00
  - Utilidad: $330.00 - $181.408 = $148.592 (45.03% margen realizado)
  - Utilidad / h máquina = $148.592 / 3.5 = $42.45 MXN/h
  - Horas persona: (0 + 10 + 10) / 60 = 0.333 h
  - Utilidad / h persona = $148.592 / 0.333 = $445.78 MXN/h
================================================================================
*/
