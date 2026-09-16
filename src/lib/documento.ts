/**
 * CubeUp³ — Generador Unificado de Documentos (src/lib/documento.ts)
 * 
 * ÚNICA FUENTE DE VERDAD para la emisión de cotizaciones y órdenes de taller.
 * Genera salidas idénticas y coherentes en tres formatos:
 * 1. 'pdf': Documento imprimible con jsPDF (fuentes estándar sin espacios, colores de marca).
 * 2. 'html': Plantilla imprimible para el navegador (estilos CSS inline y @media print).
 * 3. 'texto': Mensaje compacto y legible optimizado para WhatsApp (sin tablas ASCII rotas).
 * 
 * Modos:
 * - 'cliente': Folio, fecha, vigencia calculada, datos cliente, cantidades, precios unitarios,
 *   subtotales, IVA desglosado, anticipo, saldo y términos. NUNCA costos, márgenes ni utilidad.
 * - 'interno': Todo lo anterior MÁS el desglose de las 7 capas por línea, costo total,
 *   utilidad neta, margen realizado y parámetros operativos del taller (tarifa máquina, material, falla).
 */

import { jsPDF } from 'jspdf';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Quote,
  QuoteItem,
  esImpresion,
  esImpresionFDM,
  esImpresionMSLA
} from '../types/domain';

// =============================================================================
// PALETA DE MARCA Y CONSTANTES GRÁFICAS
// =============================================================================

export const BRAND_COLORS = {
  primary: '#1B4D3E', // Verde Bosque Profundo / Institucional
  secondary: '#2E7D32', // Verde Esmeralda Taller
  accent: '#82C69E', // Verde Menta Suave
  background: '#F7F5F0', // Crema Técnico Neutro
  textDark: '#2B2B2B', // Carbón Texto Principal
  textMuted: '#666666',
  border: '#D1D5DB'
} as const;

export interface ContactoCubeUp {
  nombreEmpresa: string;
  slogan: string;
  telefono: string;
  email: string;
  ubicacion: string;
  sitioWeb: string;
}

export const CONTACTO_DEFAULT: ContactoCubeUp = {
  nombreEmpresa: 'CubeUp³ Manufactura Aditiva',
  slogan: 'Taller Especializado FDM & MSLA de Alta Precisión',
  telefono: '+52 (55) 8432-1980',
  email: 'contacto@cubeup3.mx',
  ubicacion: 'Ciudad de México, CDMX',
  sitioWeb: 'https://cubeup3.mx'
};

export type ModoDocumento = 'cliente' | 'interno';
export type FormatoDocumento = 'pdf' | 'html' | 'texto';

// =============================================================================
// ESTRUCTURA INTERMEDIA UNIFICADA (SINGLE SOURCE OF TRUTH)
// =============================================================================

export interface LineaDocumentoIntermedia {
  numero: number;
  descripcion: string;
  tecnologia?: string;
  materialNombre?: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  // Campos exclusivos para modo 'interno'
  costoUnitario?: number;
  costoTotal?: number;
  utilidad?: number;
  margenRealizado?: number;
  desglose7Capas?: {
    material: number;
    energia: number;
    maquina: number;
    consumibles: number;
    laborSetup: number;
    laborPost: number;
    extras: number;
    reservaFalla: number;
  };
  detallesTecnicos?: string;
}

export interface EstructuraDocumentoIntermedia {
  modo: ModoDocumento;
  folio: string;
  fechaEmisionStr: string;
  fechaVigenciaStr: string;
  diasVigencia: number;
  cliente: {
    nombre: string;
    email: string;
    telefono: string;
  };
  operador: {
    nombre: string;
  };
  contacto: ContactoCubeUp;
  lineas: LineaDocumentoIntermedia[];
  financiero: {
    costoTotalLote?: number;
    utilidadTotal?: number;
    margenGlobal?: number;
    subtotal: number;
    recargoUrgenciaMonto: number;
    recargoUrgenciaPorcentaje: number;
    descuentoMonto: number;
    totalAntesIva: number;
    ivaMonto: number;
    ivaTasa: number;
    totalFinal: number;
    anticipoPorcentaje: number;
    anticipoMonto: number;
    saldoContraEntrega: number;
  };
  condiciones: string[];
}

// =============================================================================
// CONSTRUCTOR DE LA ESTRUCTURA INTERMEDIA
// =============================================================================

export function construirEstructuraIntermedia(
  quote: Quote,
  modo: ModoDocumento,
  contacto: ContactoCubeUp = CONTACTO_DEFAULT,
  anticipoPorcentaje: number = 0.50
): EstructuraDocumentoIntermedia {
  const fechaCreacion = new Date(quote.createdAt);
  const diasVigencia = quote.vigenciaDias || 15;
  const fechaVigencia = addDays(fechaCreacion, diasVigencia);

  const fechaEmisionStr = format(fechaCreacion, "dd 'de' MMMM, yyyy", { locale: es });
  const fechaVigenciaStr = format(fechaVigencia, "dd 'de' MMMM, yyyy", { locale: es });

  const lineas: LineaDocumentoIntermedia[] = (quote.items || []).map((item, idx) => {
    let materialNombre = 'Estándar';
    let detallesTecnicos = '';

    if (esImpresion(item)) {
      if (esImpresionFDM(item)) {
        materialNombre = quote.pricingSnapshot?.materiales?.[item.materialId]?.nombre || 'Filamento FDM';
        detallesTecnicos = `${item.pesoGramos}g · ${item.horasImpresion}h máquina`;
      } else if (esImpresionMSLA(item)) {
        materialNombre = quote.pricingSnapshot?.materiales?.[item.materialId]?.nombre || 'Resina MSLA';
        detallesTecnicos = `${item.volumenMl}ml · ${item.horasImpresion}h curado/máquina`;
      }
    }

    const baseLinea: LineaDocumentoIntermedia = {
      numero: idx + 1,
      descripcion: item.descripcion,
      tecnologia: esImpresion(item) ? item.tecnologia : undefined,
      materialNombre: esImpresion(item) ? materialNombre : undefined,
      cantidad: item.cantidad,
      precioUnitario: item.unitPrice,
      subtotal: item.totalPrice
    };

    // Si el modo es interno, anexamos las 7 capas y auditoría
    if (modo === 'interno') {
      baseLinea.costoUnitario = item.unitCost;
      baseLinea.costoTotal = item.totalCost;
      baseLinea.utilidad = item.totalPrice - item.totalCost;
      baseLinea.margenRealizado = item.totalPrice > 0 ? (item.totalPrice - item.totalCost) / item.totalPrice : 0;
      baseLinea.detallesTecnicos = detallesTecnicos;

      if (esImpresion(item) && item.breakdown) {
        baseLinea.desglose7Capas = {
          material: item.breakdown.material,
          energia: item.breakdown.energia,
          maquina: item.breakdown.maquina,
          consumibles: item.breakdown.consumibles,
          laborSetup: item.breakdown.laborSetup,
          laborPost: item.breakdown.laborPost,
          extras: item.breakdown.extras,
          reservaFalla: item.breakdown.reservaFalla
        };
      }
    }

    return baseLinea;
  });

  const subtotal = quote.subtotal || 0;
  const recargoUrgenciaMonto = quote.recargoUrgenciaMonto || 0;
  const recargoUrgenciaPorcentaje = quote.recargoUrgenciaPorcentaje || 0;
  const descuentoMonto = quote.descuentoGlobalMonto || 0;
  const totalAntesIva = quote.total || 0;
  const ivaMonto = quote.ivaMonto || 0;
  const totalFinal = quote.totalConIva || totalAntesIva;

  const anticipoMonto = Math.round(totalFinal * anticipoPorcentaje * 100) / 100;
  const saldoContraEntrega = Math.round((totalFinal - anticipoMonto) * 100) / 100;

  const condiciones = [
    `Presupuesto formal válido hasta el ${fechaVigenciaStr} (${diasVigencia} días naturales a partir de su emisión).`,
    `Se requiere un anticipo del ${(anticipoPorcentaje * 100).toFixed(0)}% para ingresar piezas a cola de fabricación e iniciar preparación de camas.`,
    'El saldo restante se liquida al término del control dimensional previo a la entrega o recolección.',
    'Tiempos de entrega estimados sujetos a disponibilidad de máquina y recepción formal de aprobación de archivos CAD/STL.',
    'Garantía técnica de taller: Se repondrán sin costo piezas con defectos de delaminación o desviaciones atribuibles al proceso.'
  ];

  const utilidadTotal = totalAntesIva - (quote.costoTotal || 0);
  const margenGlobal = totalAntesIva > 0 ? utilidadTotal / totalAntesIva : 0;

  return {
    modo,
    folio: quote.folio || 'CUB-TEMP',
    fechaEmisionStr,
    fechaVigenciaStr,
    diasVigencia,
    cliente: {
      nombre: quote.clientName || 'Cliente General',
      email: quote.clientEmail || 'No registrado',
      telefono: quote.clientPhone || 'No registrado'
    },
    operador: {
      nombre: quote.operatorName || 'Asesor Técnico CubeUp³'
    },
    contacto,
    lineas,
    financiero: {
      costoTotalLote: quote.costoTotal,
      utilidadTotal,
      margenGlobal,
      subtotal,
      recargoUrgenciaMonto,
      recargoUrgenciaPorcentaje,
      descuentoMonto,
      totalAntesIva,
      ivaMonto,
      ivaTasa: 0.16,
      totalFinal,
      anticipoPorcentaje,
      anticipoMonto,
      saldoContraEntrega
    },
    condiciones
  };
}

// =============================================================================
// FORMATEADORES AUXILIARES
// =============================================================================

function formatearMXN(val: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  }).format(val);
}

// =============================================================================
// 1. GENERADOR DE SALIDA PDF (jsPDF CON FUENTES ESTÁNDAR SIN ESPACIOS)
// =============================================================================

export function generarPDF(docData: EstructuraDocumentoIntermedia): jsPDF {
  // Inicializar documento en orientación vertical, mm, formato carta
  const doc = new jsPDF('p', 'mm', 'letter');
  const totalPaginas = Math.ceil(docData.lineas.length / 12) || 1;

  let paginaActual = 1;
  const margenIzq = 18;
  const margenDer = 198;
  const anchoContenido = margenDer - margenIzq;

  const dibujarEncabezadoYPie = (pNum: number) => {
    // Franja decorativa superior en color primario
    doc.setFillColor(27, 77, 62); // #1B4D3E
    doc.rect(0, 0, 216, 6, 'F');

    // Cuadro de Marca
    doc.setFillColor(27, 77, 62);
    doc.roundedRect(margenIzq, 14, 46, 11, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    // NOTA DE FUENTE: Registrar 'helvetica' (sin espacios) para evitar fallas en Adobe Acrobat
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('CUBEUP³', margenIzq + 5, 22);

    doc.setTextColor(46, 125, 50); // #2E7D32
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('MANUFACTURA ADITIVA', margenIzq, 30);

    // Título del documento
    doc.setTextColor(43, 43, 43);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    const tituloDoc = docData.modo === 'cliente'
      ? 'COTIZACIÓN DE MANUFACTURA 3D'
      : 'ORDEN TÉCNICA DE TALLER (AUDITORÍA INTERNA)';
    doc.text(tituloDoc, margenIzq, 38);

    // Bloque de metadatos (Derecha)
    doc.setFontSize(8);
    const xMeta = 135;
    let yMeta = 16;

    const filaMeta = (etiqueta: string, valor: string) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 100);
      doc.text(etiqueta, xMeta, yMeta);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(27, 77, 62);
      doc.text(valor, xMeta + 22, yMeta);
      yMeta += 4.5;
    };

    filaMeta('FOLIO:', docData.folio);
    filaMeta('FECHA:', docData.fechaEmisionStr);
    filaMeta('VENCE:', docData.fechaVigenciaStr);
    filaMeta('ASESOR:', docData.operador.nombre);

    // Datos del Cliente (Recuadro sutil)
    doc.setFillColor(247, 245, 240); // #F7F5F0
    doc.setDrawColor(209, 213, 219);
    doc.roundedRect(margenIzq, 42, anchoContenido, 13, 1, 1, 'FD');

    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'bold');
    doc.text('CLIENTE / EMPRESA:', margenIzq + 3, 47);
    doc.setTextColor(43, 43, 43);
    doc.text(docData.cliente.nombre, margenIzq + 35, 47);

    doc.setTextColor(100, 100, 100);
    doc.text('CONTACTO:', margenIzq + 3, 51.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${docData.cliente.email} · Tel: ${docData.cliente.telefono}`, margenIzq + 35, 51.5);

    // Pie de página con numeración
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(130, 130, 130);
    doc.text(
      `${docData.contacto.nombreEmpresa} · ${docData.contacto.telefono} · ${docData.contacto.email}`,
      margenIzq,
      270
    );
    doc.text(`Página ${pNum} de ${totalPaginas}`, margenDer - 20, 270);
  };

  const dibujarEncabezadoTabla = (y: number) => {
    doc.setFillColor(27, 77, 62);
    doc.rect(margenIzq, y, anchoContenido, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);

    doc.text('#', margenIzq + 3, y + 4.5);
    doc.text('DESCRIPCIÓN / ESPECIFICACIÓN', margenIzq + 10, y + 4.5);
    doc.text('CANT', margenIzq + 115, y + 4.5);

    if (docData.modo === 'cliente') {
      doc.text('P. UNITARIO', margenIzq + 135, y + 4.5);
      doc.text('IMPORTE', margenIzq + 162, y + 4.5);
    } else {
      doc.text('COSTO U.', margenIzq + 130, y + 4.5);
      doc.text('VENTA U.', margenIzq + 150, y + 4.5);
      doc.text('UTILIDAD', margenIzq + 167, y + 4.5);
    }
  };

  dibujarEncabezadoYPie(paginaActual);

  let yCursor = 60;
  dibujarEncabezadoTabla(yCursor);
  yCursor += 9;

  let lineasEnPagina = 0;

  docData.lineas.forEach((lin) => {
    // Si superamos 12 líneas en una página, generar salto y repetir encabezado
    if (lineasEnPagina >= 12) {
      doc.addPage();
      paginaActual++;
      dibujarEncabezadoYPie(paginaActual);
      yCursor = 60;
      dibujarEncabezadoTabla(yCursor);
      yCursor += 9;
      lineasEnPagina = 0;
    }

    // Fondo zebra alternado
    if (lin.numero % 2 === 0) {
      doc.setFillColor(250, 249, 246);
      doc.rect(margenIzq, yCursor - 3.5, anchoContenido, 7, 'F');
    }

    doc.setTextColor(43, 43, 43);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);

    doc.text(lin.numero.toString(), margenIzq + 3, yCursor + 1);

    const descTexto = lin.materialNombre
      ? `${lin.descripcion} (${lin.materialNombre})`
      : lin.descripcion;
    const descRecortada = doc.splitTextToSize(descTexto, 98);
    doc.text(descRecortada[0], margenIzq + 10, yCursor + 1);

    doc.text(lin.cantidad.toString(), margenIzq + 118, yCursor + 1);

    if (docData.modo === 'cliente') {
      doc.text(formatearMXN(lin.precioUnitario), margenIzq + 135, yCursor + 1);
      doc.setFont('helvetica', 'bold');
      doc.text(formatearMXN(lin.subtotal), margenIzq + 162, yCursor + 1);
    } else {
      doc.text(formatearMXN(lin.costoUnitario || 0), margenIzq + 130, yCursor + 1);
      doc.text(formatearMXN(lin.precioUnitario), margenIzq + 150, yCursor + 1);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(46, 125, 50);
      doc.text(formatearMXN(lin.utilidad || 0), margenIzq + 167, yCursor + 1);
    }

    yCursor += 7;
    lineasEnPagina++;
  });

  // Línea divisoria
  doc.setDrawColor(209, 213, 219);
  doc.line(margenIzq, yCursor, margenDer, yCursor);
  yCursor += 5;

  // Bloque inferior: Totales y Condiciones
  const yTotales = yCursor;
  const xTotales = 125;

  const filaTotal = (etiqueta: string, valor: string, destacar: boolean = false) => {
    doc.setFontSize(destacar ? 9 : 8);
    doc.setFont('helvetica', destacar ? 'bold' : 'normal');
    doc.setTextColor(destacar ? 27 : 100, destacar ? 77 : 100, destacar ? 62 : 100);
    doc.text(etiqueta, xTotales, yCursor);
    doc.text(valor, margenDer - 2, yCursor, { align: 'right' });
    yCursor += 5;
  };

  filaTotal('Subtotal:', formatearMXN(docData.financiero.subtotal));

  if (docData.financiero.recargoUrgenciaMonto > 0) {
    filaTotal(
      `Urgencia (+${(docData.financiero.recargoUrgenciaPorcentaje * 100).toFixed(0)}%):`,
      formatearMXN(docData.financiero.recargoUrgenciaMonto)
    );
  }

  if (docData.financiero.ivaMonto > 0) {
    filaTotal('IVA (16%):', formatearMXN(docData.financiero.ivaMonto));
  }

  filaTotal('TOTAL NETO (MXN):', formatearMXN(docData.financiero.totalFinal), true);

  // Recuadro de Anticipo Comercial
  doc.setFillColor(240, 253, 244); // #F0FDF4
  doc.setDrawColor(130, 198, 158); // #82C69E
  doc.roundedRect(xTotales - 5, yCursor + 1, anchoContenido - (xTotales - margenIzq) + 5, 14, 1, 1, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(27, 77, 62);
  doc.text(
    `Anticipo ${(docData.financiero.anticipoPorcentaje * 100).toFixed(0)}% para iniciar:`,
    xTotales,
    yCursor + 6
  );
  doc.text(formatearMXN(docData.financiero.anticipoMonto), margenDer - 2, yCursor + 6, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Saldo contra entrega:', xTotales, yCursor + 11);
  doc.text(formatearMXN(docData.financiero.saldoContraEntrega), margenDer - 2, yCursor + 11, { align: 'right' });

  // Condiciones comerciales a la izquierda
  let yCond = yTotales;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(27, 77, 62);
  doc.text(docData.modo === 'cliente' ? 'TÉRMINOS Y CONDICIONES:' : 'AUDITORÍA Y COSTOS DEL TALLER:', margenIzq, yCond);
  yCond += 4.5;

  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);

  if (docData.modo === 'cliente') {
    docData.condiciones.forEach((cond) => {
      const lineasCond = doc.splitTextToSize(`• ${cond}`, 95);
      doc.text(lineasCond, margenIzq, yCond);
      yCond += lineasCond.length * 3.6;
    });
  } else {
    // Resumen de costos internos de taller
    const linCosto = (t: string, v: string) => {
      doc.text(t, margenIzq, yCond);
      doc.setFont('helvetica', 'bold');
      doc.text(v, margenIzq + 50, yCond);
      doc.setFont('helvetica', 'normal');
      yCond += 4;
    };

    linCosto('Inversión Directa Taller:', formatearMXN(docData.financiero.costoTotalLote || 0));
    linCosto('Utilidad Bruta Proyectada:', formatearMXN(docData.financiero.utilidadTotal || 0));
    linCosto(
      'Margen Realizado s/Venta:',
      `${((docData.financiero.margenGlobal || 0) * 100).toFixed(2)}%`
    );
    yCond += 2;
    doc.text(
      '* Parámetros congelados en pricingSnapshot. No alterables retrospectivamente.',
      margenIzq,
      yCond
    );
  }

  return doc;
}

// =============================================================================
// 2. GENERADOR DE SALIDA HTML (PLANTILLA WEB Y @MEDIA PRINT)
// =============================================================================

export function generarHTML(docData: EstructuraDocumentoIntermedia): string {
  const lineasHTML = docData.lineas
    .map(
      (lin) => `
      <tr style="border-bottom: 1px solid #E5E7EB; ${lin.numero % 2 === 0 ? 'background-color: #FAFAF9;' : ''}">
        <td style="padding: 8px 10px; font-size: 11px; text-align: center;">${lin.numero}</td>
        <td style="padding: 8px 10px; font-size: 11px;">
          <strong>${lin.descripcion}</strong>
          ${lin.materialNombre ? `<br><span style="color: #6B7280; font-size: 10px;">Material: ${lin.materialNombre}</span>` : ''}
          ${lin.detallesTecnicos && docData.modo === 'interno' ? `<br><span style="color: #059669; font-size: 9px;">${lin.detallesTecnicos}</span>` : ''}
        </td>
        <td style="padding: 8px 10px; font-size: 11px; text-align: center; font-weight: bold;">${lin.cantidad}</td>
        ${
          docData.modo === 'cliente'
            ? `
          <td style="padding: 8px 10px; font-size: 11px; text-align: right;">${formatearMXN(lin.precioUnitario)}</td>
          <td style="padding: 8px 10px; font-size: 11px; text-align: right; font-weight: bold; color: #1B4D3E;">${formatearMXN(lin.subtotal)}</td>
        `
            : `
          <td style="padding: 8px 10px; font-size: 11px; text-align: right; color: #6B7280;">${formatearMXN(lin.costoUnitario || 0)}</td>
          <td style="padding: 8px 10px; font-size: 11px; text-align: right;">${formatearMXN(lin.precioUnitario)}</td>
          <td style="padding: 8px 10px; font-size: 11px; text-align: right; font-weight: bold; color: #2E7D32;">${formatearMXN(lin.utilidad || 0)}</td>
        `
        }
      </tr>
    `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="es-MX">
    <head>
      <meta charset="UTF-8" />
      <title>${docData.folio} - ${docData.cliente.nombre}</title>
      <style>
        @page { size: letter portrait; margin: 12mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #2B2B2B; margin: 0; padding: 20px; background: #FFF; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #1B4D3E; padding-bottom: 12px; margin-bottom: 16px; }
        .brand-box { background: #1B4D3E; color: #FFF; padding: 6px 12px; border-radius: 4px; font-weight: bold; display: inline-block; font-size: 16px; letter-spacing: 1px; }
        .doc-title { font-size: 16px; font-weight: bold; color: #1B4D3E; margin-top: 8px; }
        .meta-table td { padding: 2px 6px; font-size: 11px; }
        .client-box { background: #F7F5F0; border: 1px solid #E5E7EB; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; font-size: 11px; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .items-table th { background: #1B4D3E; color: #FFF; padding: 8px 10px; font-size: 10px; text-align: left; text-transform: uppercase; }
        .footer-grid { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 20px; margin-top: 10px; }
        .terms-box { font-size: 10px; color: #4B5563; line-height: 1.5; }
        .totals-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .totals-table td { padding: 4px 6px; }
        .anticipo-card { background: #F0FDF4; border: 1px solid #82C69E; border-radius: 6px; padding: 10px; margin-top: 8px; font-size: 11px; }
        @media print {
          body { padding: 0; }
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand-box">CUBEUP³</div>
          <div style="color: #2E7D32; font-size: 9px; font-weight: bold; margin-top: 4px;">MANUFACTURA ADITIVA</div>
          <div class="doc-title">${docData.modo === 'cliente' ? 'PRESUPUESTO DE MANUFACTURA 3D' : 'ORDEN INTERNA DE TALLER'}</div>
        </div>
        <div>
          <table class="meta-table">
            <tr><td><strong>FOLIO:</strong></td><td style="color: #1B4D3E; font-weight: bold;">${docData.folio}</td></tr>
            <tr><td><strong>FECHA:</strong></td><td>${docData.fechaEmisionStr}</td></tr>
            <tr><td><strong>VENCE:</strong></td><td>${docData.fechaVigenciaStr}</td></tr>
            <tr><td><strong>ASESOR:</strong></td><td>${docData.operador.nombre}</td></tr>
          </table>
        </div>
      </div>

      <div class="client-box">
        <strong>CLIENTE:</strong> ${docData.cliente.nombre} &nbsp;|&nbsp; 
        <strong>CONTACTO:</strong> ${docData.cliente.email} · Tel: ${docData.cliente.telefono}
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">#</th>
            <th>Descripción / Especificación</th>
            <th style="width: 50px; text-align: center;">Cant</th>
            ${
              docData.modo === 'cliente'
                ? `
              <th style="width: 90px; text-align: right;">P. Unitario</th>
              <th style="width: 90px; text-align: right;">Importe</th>
            `
                : `
              <th style="width: 80px; text-align: right;">Costo U.</th>
              <th style="width: 80px; text-align: right;">Venta U.</th>
              <th style="width: 80px; text-align: right;">Utilidad</th>
            `
            }
          </tr>
        </thead>
        <tbody>
          ${lineasHTML}
        </tbody>
      </table>

      <div class="footer-grid">
        <div class="terms-box">
          <strong style="color: #1B4D3E;">${docData.modo === 'cliente' ? 'CONDICIONES COMERCIALES:' : 'MÉTRICAS DEL TALLER:'}</strong>
          ${
            docData.modo === 'cliente'
              ? `<ul style="padding-left: 16px; margin-top: 6px;">
                  ${docData.condiciones.map((c) => `<li>${c}</li>`).join('')}
                 </ul>`
              : `
                <div style="margin-top: 8px; font-size: 11px;">
                  <p>Inversión Taller: <strong>${formatearMXN(docData.financiero.costoTotalLote || 0)}</strong></p>
                  <p>Utilidad Neta: <strong>${formatearMXN(docData.financiero.utilidadTotal || 0)}</strong></p>
                  <p>Margen Realizado: <strong>${((docData.financiero.margenGlobal || 0) * 100).toFixed(2)}%</strong></p>
                </div>
              `
          }
        </div>

        <div>
          <table class="totals-table">
            <tr>
              <td>Subtotal:</td>
              <td style="text-align: right; font-weight: bold;">${formatearMXN(docData.financiero.subtotal)}</td>
            </tr>
            ${
              docData.financiero.recargoUrgenciaMonto > 0
                ? `<tr>
                    <td>Urgencia (+${(docData.financiero.recargoUrgenciaPorcentaje * 100).toFixed(0)}%):</td>
                    <td style="text-align: right;">${formatearMXN(docData.financiero.recargoUrgenciaMonto)}</td>
                   </tr>`
                : ''
            }
            ${
              docData.financiero.ivaMonto > 0
                ? `<tr>
                    <td>IVA (16%):</td>
                    <td style="text-align: right;">${formatearMXN(docData.financiero.ivaMonto)}</td>
                   </tr>`
                : ''
            }
            <tr style="border-top: 2px solid #1B4D3E; font-size: 14px;">
              <td style="color: #1B4D3E; font-weight: bold; padding-top: 6px;">TOTAL NETO:</td>
              <td style="color: #1B4D3E; font-weight: bold; text-align: right; padding-top: 6px;">${formatearMXN(docData.financiero.totalFinal)}</td>
            </tr>
          </table>

          <div class="anticipo-card">
            <div style="display: flex; justify-content: space-between; font-weight: bold; color: #1B4D3E;">
              <span>Anticipo ${(docData.financiero.anticipoPorcentaje * 100).toFixed(0)}%:</span>
              <span>${formatearMXN(docData.financiero.anticipoMonto)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: #4B5563; margin-top: 4px;">
              <span>Saldo contra entrega:</span>
              <span>${formatearMXN(docData.financiero.saldoContraEntrega)}</span>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// =============================================================================
// 3. GENERADOR DE MENSAJE WHATSAPP (COMPACTO, CABE EN 1 MENSAJE, SIN TABLAS ASCII)
// =============================================================================

export function generarTextoWhatsApp(docData: EstructuraDocumentoIntermedia): string {
  const resumenPiezas = docData.lineas
    .map((l) => `• ${l.cantidad}x ${l.descripcion} (${formatearMXN(l.subtotal)})`)
    .join('\n');

  return `Hola ${docData.cliente.nombre}, te compartimos tu cotización de *CubeUp³ Manufactura Aditiva*:

📋 *Folio:* ${docData.folio}
📅 *Vigencia:* ${docData.fechaVigenciaStr}

*Partidas:*
${resumenPiezas}

💰 *Inversión Total:* ${formatearMXN(docData.financiero.totalFinal)}
🔹 *Anticipo ${(docData.financiero.anticipoPorcentaje * 100).toFixed(0)}% para iniciar:* ${formatearMXN(docData.financiero.anticipoMonto)}
🔹 *Saldo contra entrega:* ${formatearMXN(docData.financiero.saldoContraEntrega)}

¿Deseas que ingresemos tus piezas a cola de fabricación? Quedamos a tus órdenes.`;
}

// =============================================================================
// FUNCIÓN PRINCIPAL POLIMÓRFICA CANÓNICA
// =============================================================================

export function generarDocumento(
  quote: Quote,
  modo: ModoDocumento = 'cliente',
  formato: FormatoDocumento = 'pdf',
  contacto: ContactoCubeUp = CONTACTO_DEFAULT,
  anticipoPorcentaje: number = 0.50
): jsPDF | string {
  // 1. Crear el objeto intermedio común (única fuente de verdad)
  const docData = construirEstructuraIntermedia(quote, modo, contacto, anticipoPorcentaje);

  // 2. Renderizar según el formato solicitado
  switch (formato) {
    case 'pdf':
      return generarPDF(docData);
    case 'html':
      return generarHTML(docData);
    case 'texto':
      return generarTextoWhatsApp(docData);
    default: {
      const _exhaustivo: never = formato;
      throw new Error(`Formato no soportado: ${_exhaustivo}`);
    }
  }
}
