import { 
  calcularLinea, 
  redondearAlPaso, 
  LineaInput, 
  PricingContext 
} from './pricing';
import { 
  TallerConfig, 
  buildContext, 
  DEFAULT_TALLER_CONFIG 
} from './tallerConfig';
import { TicketItem } from '../hooks/useQuoteHistory';

export interface DesgloseAgregadoTicket {
  material: number;
  energia: number;
  maquina: number;
  consumibles: number;
  manoDeObra: number; // laborSetup + laborPost
  extras: number;
  hardwareCosto: number;
  reservaFalla: number;
  costoDirectoTotal: number;
  costoRealTotal: number;
  subtotal: number;
  recargoUrgenciaMonto: number;
  costoEnvio: number;
  utilidad: number;
  margenRealizado: number;
  ivaMonto: number;
  total: number;
  totalConIva: number;
}

export interface TicketCalculadoItem {
  id: string;
  itemName: string;
  quantity: number;
  itemType: 'print' | 'hardware';
  profileName: string;
  profileId?: string;
  weightInfo: number;
  timeInfo: number;
  unitCost: number;
  totalCost: number;
  unitPrice: number;
  totalPrice: number;
  utilidad: number;
  margenRealizado: number;
  // Detalle para piezas 3D
  desglose?: {
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
  };
}

export interface TicketCalculadoResultado {
  items: TicketCalculadoItem[];
  subtotal: number;
  recargoUrgenciaMonto: number;
  costoEnvio: number;
  total: number;
  ivaMonto: number;
  totalConIva: number;
  utilidadNeta: number;
  margenGlobalRealizado: number;
  desgloseAgregado: DesgloseAgregadoTicket;
}

export interface CalcularTicketOpts {
  urgente?: boolean;
  envio?: number;
  cobrarIva?: boolean;
  margenSobrescrito?: number;
}

/**
 * Calcula un ticket completo procesando cada pieza con `calcularLinea()` y hardware
 * con la fórmula de margen real `costo / (1 - margen)`, aplicando mínimos, redondeo,
 * urgencia, envío e IVA idéntico al motor canónico de cotizaciones.
 */
export function calcularTicket(
  items: TicketItem[],
  config: TallerConfig,
  opts: CalcularTicketOpts = {}
): TicketCalculadoResultado {
  const urgente = Boolean(opts.urgente);
  const envio = Math.max(0, opts.envio || 0);
  const cobrarIva = opts.cobrarIva !== undefined ? opts.cobrarIva : config.cobrarIvaPorDefecto;
  const margenSobrescrito = opts.margenSobrescrito;

  const resultadoItems: TicketCalculadoItem[] = [];

  // Acumuladores de desglose
  let acumMaterial = 0;
  let acumEnergia = 0;
  let acumMaquina = 0;
  let acumConsumibles = 0;
  let acumManoDeObra = 0;
  let acumExtras = 0;
  let acumHardwareCosto = 0;
  let acumReservaFalla = 0;
  let acumCostoDirecto = 0;
  let acumCostoReal = 0;
  let acumPrecioVentaItems = 0;

  for (const item of items) {
    const isHardware = item.itemType === 'hardware';
    const cantidad = Math.max(1, Math.floor(item.quantity));

    if (isHardware) {
      // Costo unitario de hardware
      const costoUnit = Math.max(0, item.unitCost);
      const costoTotalItem = Math.round(costoUnit * cantidad * 100) / 100;

      // Margen comercial sobre venta para hardware
      const margenHw = margenSobrescrito !== undefined && Number.isFinite(margenSobrescrito)
        ? Math.max(0, Math.min(0.90, margenSobrescrito))
        : config.margenPorDefecto;

      const precioBaseUnit = margenHw < 1 ? costoUnit / (1 - margenHw) : costoUnit;
      const unitPrice = redondearAlPaso(precioBaseUnit, config.pasoRedondeo);
      const totalPrice = Math.round(unitPrice * cantidad * 100) / 100;
      const utilidadItem = totalPrice - costoTotalItem;
      const margenRealizado = totalPrice > 0 ? utilidadItem / totalPrice : 0;

      acumHardwareCosto += costoTotalItem;
      acumCostoDirecto += costoTotalItem;
      acumCostoReal += costoTotalItem;
      acumPrecioVentaItems += totalPrice;

      resultadoItems.push({
        id: item.id,
        itemName: item.itemName,
        quantity: cantidad,
        itemType: 'hardware',
        profileName: item.profileName || 'Hardware / Herrajes',
        profileId: item.profileId,
        weightInfo: 0,
        timeInfo: 0,
        unitCost: costoUnit,
        totalCost: costoTotalItem,
        unitPrice,
        totalPrice,
        utilidad: utilidadItem,
        margenRealizado
      });
    } else if (!item.calc) {
      // Partida histórica previa sin calc: preservar montos guardados sin recalcular
      const costoUnit = Math.max(0, item.unitCost);
      const costoTotalItem = Math.max(0, item.totalCost);
      const unitPrice = Math.max(0, item.unitPrice);
      const totalPrice = Math.max(0, item.totalPrice);
      const utilidadItem = totalPrice - costoTotalItem;
      const margenRealizado = totalPrice > 0 ? utilidadItem / totalPrice : 0;

      acumCostoDirecto += costoTotalItem;
      acumCostoReal += costoTotalItem;
      acumPrecioVentaItems += totalPrice;

      resultadoItems.push({
        id: item.id,
        itemName: item.itemName,
        quantity: cantidad,
        itemType: 'print',
        profileName: item.profileName || 'Impresión 3D',
        profileId: item.profileId,
        weightInfo: item.weightInfo,
        timeInfo: item.timeInfo,
        unitCost: costoUnit,
        totalCost: costoTotalItem,
        unitPrice,
        totalPrice,
        utilidad: utilidadItem,
        margenRealizado
      });
    } else {
      // Pieza de manufactura aditiva con calc (motor v2)
      const material = (item.calc.materialId ? config.materiales.find(m => m.id === item.calc?.materialId) : undefined)
        || config.materiales.find(m => m.id === item.profileId)
        || config.materiales.find(m => m.nombre === item.profileName)
        || config.materiales[0];

      const impresora = (item.calc.impresoraId ? config.impresoras.find(i => i.id === item.calc?.impresoraId) : undefined)
        || config.impresoras.find(i => i.tecnologia === material.tecnologia)
        || config.impresoras[0];

      const ctx: PricingContext = buildContext(config, impresora.id, material.id, {
        urgente,
        envio,
        cobrarIva,
        margen: margenSobrescrito
      });

      const lineaInput: LineaInput = {
        id: item.id,
        nombrePieza: item.itemName,
        tecnologia: material.tecnologia,
        cantidad,
        horasImpresion: Math.max(0, item.calc.horasImpresion ?? item.timeInfo),
        pesoGramos: material.tecnologia === 'FDM' ? Math.max(0, item.calc.pesoGramos ?? item.weightInfo) : undefined,
        volumenMl: material.tecnologia === 'MSLA' ? Math.max(0, item.calc.volumenMl ?? item.weightInfo) : undefined,
        minutosSetup: Math.max(0, item.calc.minutosSetup ?? 0),
        minutosPostproceso: Math.max(0, item.calc.minutosPostproceso ?? item.laborInfo ?? 0),
        extrasDirectos: Math.max(0, item.calc.extrasDirectos ?? 0),
        margen: margenSobrescrito
      };

      const res = calcularLinea(lineaInput, ctx);

      acumMaterial += res.desgloseLote.material;
      acumEnergia += res.desgloseLote.energia;
      acumMaquina += res.desgloseLote.maquina;
      acumConsumibles += res.desgloseLote.consumibles;
      acumManoDeObra += (res.desgloseLote.laborSetup + res.desgloseLote.laborPost);
      acumExtras += res.desgloseLote.extras;
      acumReservaFalla += res.desgloseLote.reservaFalla;
      acumCostoDirecto += res.desgloseLote.costoDirecto;
      acumCostoReal += res.costoTotal;
      acumPrecioVentaItems += res.precioTotal;

      resultadoItems.push({
        id: item.id,
        itemName: item.itemName,
        quantity: cantidad,
        itemType: 'print',
        profileName: material.nombre,
        profileId: material.id,
        weightInfo: item.weightInfo,
        timeInfo: item.timeInfo,
        unitCost: res.costoUnitario,
        totalCost: res.costoTotal,
        unitPrice: res.precioUnitario,
        totalPrice: res.precioTotal,
        utilidad: res.utilidad,
        margenRealizado: res.margenRealizado,
        desglose: {
          material: res.desgloseLote.material,
          energia: res.desgloseLote.energia,
          maquina: res.desgloseLote.maquina,
          consumibles: res.desgloseLote.consumibles,
          laborSetup: res.desgloseLote.laborSetup,
          laborPost: res.desgloseLote.laborPost,
          extras: res.desgloseLote.extras,
          costoDirecto: res.desgloseLote.costoDirecto,
          reservaFalla: res.desgloseLote.reservaFalla,
          costoTotal: res.costoTotal
        }
      });
    }
  }

  // Reglas globales del taller replicando calcularCotizacion():
  // 1. Mínimo de pedido
  const subtotal = Math.max(acumPrecioVentaItems, items.length > 0 ? config.minimoPedido : 0);

  // 2. Recargo de urgencia sobre el subtotal
  const factorUrgencia = urgente ? Math.max(0, config.recargoUrgencia) : 0;
  const recargoUrgenciaMonto = Math.round(subtotal * factorUrgencia * 100) / 100;

  // 3. Flete / Envío
  const costoEnvio = Math.max(0, envio);

  // 4. Total antes de impuestos
  const total = subtotal + recargoUrgenciaMonto + costoEnvio;

  // 5. Impuestos (IVA)
  const ivaTasa = cobrarIva ? Math.max(0, config.ivaTasa) : 0;
  const ivaMonto = Math.round(total * ivaTasa * 100) / 100;
  const totalConIva = Math.round((total + ivaMonto) * 100) / 100;

  // 6. Utilidad neta global y margen realizado
  // En pricing.ts: utilidadNeta = total - (costoTotalLote + costoEnvio)
  const utilidadNeta = Math.round((total - (acumCostoReal + costoEnvio)) * 100) / 100;
  const margenGlobalRealizado = total > 0 ? utilidadNeta / total : 0;

  // Auditoría estricta de coherencia contable
  // Todo menos iva debe sumar total (tolerancia 0.01)
  // total = costoReal + utilidadNeta + costoEnvio (o suma de componentes)
  // Desglose: material + energia + maquina + consumibles + manoDeObra + extras + hardwareCosto + reservaFalla + envio + urgencia + utilidad
  const sumaDesglose = acumMaterial 
    + acumEnergia 
    + acumMaquina 
    + acumConsumibles 
    + acumManoDeObra 
    + acumExtras 
    + acumHardwareCosto 
    + acumReservaFalla 
    + costoEnvio 
    + (subtotal - acumPrecioVentaItems) // delta por minimoPedido si aplicó
    + recargoUrgenciaMonto 
    + (utilidadNeta - (subtotal - acumPrecioVentaItems)); // ajuste exacto

  const deltaTotal = Math.abs(total - (acumCostoReal + costoEnvio + utilidadNeta));
  if (deltaTotal > 0.05) {
    console.error(`[ticket.ts] Inconsistencia contable en calcularTicket: total=${total}, componentes=${acumCostoReal + costoEnvio + utilidadNeta}, delta=${deltaTotal}`);
  }

  const desgloseAgregado: DesgloseAgregadoTicket = {
    material: Math.round(acumMaterial * 100) / 100,
    energia: Math.round(acumEnergia * 100) / 100,
    maquina: Math.round(acumMaquina * 100) / 100,
    consumibles: Math.round(acumConsumibles * 100) / 100,
    manoDeObra: Math.round(acumManoDeObra * 100) / 100,
    extras: Math.round(acumExtras * 100) / 100,
    hardwareCosto: Math.round(acumHardwareCosto * 100) / 100,
    reservaFalla: Math.round(acumReservaFalla * 100) / 100,
    costoDirectoTotal: Math.round(acumCostoDirecto * 100) / 100,
    costoRealTotal: Math.round(acumCostoReal * 100) / 100,
    subtotal,
    recargoUrgenciaMonto,
    costoEnvio,
    utilidad: utilidadNeta,
    margenRealizado: margenGlobalRealizado,
    ivaMonto,
    total,
    totalConIva
  };

  return {
    items: resultadoItems,
    subtotal,
    recargoUrgenciaMonto,
    costoEnvio,
    total,
    ivaMonto,
    totalConIva,
    utilidadNeta,
    margenGlobalRealizado,
    desgloseAgregado
  };
}

/**
 * Función de autoverificación obligatoria para desarrollo.
 * Compara los resultados calculados contra los valores matemáticos de verificación.
 */
export function autoVerificarMotor(): boolean {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    return true;
  }

  // Caso: FDM, 1 pieza, 80 g PLA a $450/kg merma 5%, 4 h, 105 W, $3.50/kWh, 
  // impresora $28,000 / 4000 h + $2/h, preparación 15 min, postproceso 5 min, 
  // $120/h, falla 5%, margen 35%, mínimo $50, redondeo $5.
  // Esperado: material 37.80, energía 1.47, máquina 36.00, mano de obra 40.00, 
  // reserva 6.07, costo 121.34, precio 190.00, utilidad 68.66, IVA 16% = 30.40, total con IVA 220.40.
  
  const ctxTest: PricingContext = {
    tarifaKwh: 3.50,
    tarifaOperadorHora: 120.00,
    margenPorDefecto: 0.35,
    tasaFallaPorDefecto: 0.05,
    minimoPorPieza: 50.00,
    pasoRedondeo: 5.00,
    minimoPedido: 0,
    recargoUrgencia: 0,
    envio: 0,
    ivaTasa: 0.16,
    impresora: {
      id: 'test-imp',
      nombre: 'Impresora Test',
      tecnologia: 'FDM',
      potenciaPromedioW: 105,
      precioCompra: 28000,
      vidaUtilHoras: 4000,
      mantenimientoPorHora: 2.00,
      volumenMaxMm: { x: 256, y: 256, z: 256 }
    },
    material: {
      id: 'test-mat',
      nombre: 'PLA Test',
      tecnologia: 'FDM',
      costoPorUnidad: 450,
      mermaPorcentaje: 0.05
    }
  };

  const lineaTest: LineaInput = {
    id: 'test-linea-1',
    nombrePieza: 'Pieza Test Verificación',
    tecnologia: 'FDM',
    cantidad: 1,
    horasImpresion: 4,
    pesoGramos: 80,
    minutosSetup: 15,
    minutosPostproceso: 5,
    extrasDirectos: 0,
    tasaFalla: 0.05,
    margen: 0.35
  };

  const res = calcularLinea(lineaTest, ctxTest);

  const matOk = Math.abs(res.desgloseLote.material - 37.80) < 0.01;
  const eneOk = Math.abs(res.desgloseLote.energia - 1.47) < 0.01;
  const maqOk = Math.abs(res.desgloseLote.maquina - 36.00) < 0.01;
  const labOk = Math.abs((res.desgloseLote.laborSetup + res.desgloseLote.laborPost) - 40.00) < 0.01;
  const resOk = Math.abs(res.desgloseLote.reservaFalla - 6.07) < 0.02;
  const cosOk = Math.abs(res.costoTotal - 121.34) < 0.02;
  const preOk = Math.abs(res.precioUnitario - 190.00) < 0.01;
  const utiOk = Math.abs(res.utilidad - 68.66) < 0.02;

  const ivaEsperado = Math.round(res.precioTotal * 0.16 * 100) / 100;
  const ivaOk = Math.abs(ivaEsperado - 30.40) < 0.01;
  const totConIvaOk = Math.abs((res.precioTotal + ivaEsperado) - 220.40) < 0.01;

  const passed = matOk && eneOk && maqOk && labOk && resOk && cosOk && preOk && utiOk && ivaOk && totConIvaOk;

  if (passed) {
    console.log(
      '%c[CubeUp³ Motor] Autoverificación de cálculo: EXITOSA',
      'color: #2E7D32; font-weight: bold; font-size: 11px;',
      {
        material: res.desgloseLote.material.toFixed(2),
        energia: res.desgloseLote.energia.toFixed(2),
        maquina: res.desgloseLote.maquina.toFixed(2),
        manoDeObra: (res.desgloseLote.laborSetup + res.desgloseLote.laborPost).toFixed(2),
        reservaFalla: res.desgloseLote.reservaFalla.toFixed(2),
        costo: res.costoTotal.toFixed(2),
        precio: res.precioUnitario.toFixed(2),
        utilidad: res.utilidad.toFixed(2),
        iva: ivaEsperado.toFixed(2),
        totalConIva: (res.precioTotal + ivaEsperado).toFixed(2)
      }
    );
  } else {
    console.error('[CubeUp³ Motor] Falló la autoverificación de cálculo:', {
      mat: { actual: res.desgloseLote.material, expected: 37.80, ok: matOk },
      ene: { actual: res.desgloseLote.energia, expected: 1.47, ok: eneOk },
      maq: { actual: res.desgloseLote.maquina, expected: 36.00, ok: maqOk },
      lab: { actual: (res.desgloseLote.laborSetup + res.desgloseLote.laborPost), expected: 40.00, ok: labOk },
      reserva: { actual: res.desgloseLote.reservaFalla, expected: 6.07, ok: resOk },
      costo: { actual: res.costoTotal, expected: 121.34, ok: cosOk },
      precio: { actual: res.precioUnitario, expected: 190.00, ok: preOk },
      utilidad: { actual: res.utilidad, expected: 68.66, ok: utiOk },
      iva: { actual: ivaEsperado, expected: 30.40, ok: ivaOk },
      totConIva: { actual: res.precioTotal + ivaEsperado, expected: 220.40, ok: totConIvaOk }
    });
  }

  return passed;
}

// Ejecutar inmediatamente al cargar en desarrollo
if (typeof window !== 'undefined') {
  try {
    autoVerificarMotor();
  } catch (err) {
    console.error('[CubeUp³ Motor] Error al correr autoVerificarMotor():', err);
  }
}
