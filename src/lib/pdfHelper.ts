import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PDFQuoteData {
  folio: string;
  clientName: string;
  operatorName: string;
  createdAt: string | Date;
  items: any[];
  total: number;
}

const formatMXN = (value: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(value);
};

export const exportQuoteToPDF = (quote: PDFQuoteData) => {
  const doc = new jsPDF('p', 'mm', 'letter');
  
  const dateStr = format(new Date(quote.createdAt), "dd 'de' MMMM, yyyy", { locale: es });
  const opName = quote.operatorName || 'Asesor Técnico CubeUp³';
  const grandTotal = quote.total;

  // Header Logo Box (Geometric Design)
  doc.setFillColor(5, 150, 105); // Emerald Theme
  doc.rect(20, 15, 45, 10, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("CUBEUP³", 25, 22);

  // Secondary text logo
  doc.setTextColor(5, 150, 105);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("MANUFACTURA ADITIVA", 20, 29);

  // Title Box
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("PRESUPUESTO DE IMPRESIÓN 3D", 20, 38);

  // Metadata block (Right side)
  doc.setTextColor(17, 24, 39);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("FOLIO:", 140, 20);
  doc.setFont("helvetica", "normal");
  doc.text(quote.folio, 160, 20);

  doc.setFont("helvetica", "bold");
  doc.text("FECHA:", 140, 25);
  doc.setFont("helvetica", "normal");
  doc.text(dateStr, 160, 25);

  doc.setFont("helvetica", "bold");
  doc.text("CLIENTE:", 140, 30);
  doc.setFont("helvetica", "normal");
  const splitClient = doc.splitTextToSize(quote.clientName || 'Sin Nombre', 35);
  doc.text(splitClient, 160, 30);

  doc.setFont("helvetica", "bold");
  doc.text("ASESOR:", 140, 35);
  doc.setFont("helvetica", "normal");
  const splitOp = doc.splitTextToSize(opName, 35);
  doc.text(splitOp, 160, 35);

  // Thin dividing line
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.4);
  doc.line(20, 42, 195, 42);

  // Table header
  let yPos = 52;
  doc.setFillColor(243, 244, 246);
  doc.rect(20, yPos - 5, 175, 7, "F");
  
  doc.setTextColor(75, 85, 99);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("CANT", 22, yPos);
  doc.text("DESCRIPCIÓN DE PIEZA / CONCEPTO", 35, yPos);
  doc.text("PERFIL TÉCNICO", 100, yPos);
  doc.text("UNITARIO", 152, yPos);
  doc.text("TOTAL", 175, yPos);
  
  doc.line(20, yPos + 2, 195, yPos + 2);
  yPos += 10;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(17, 24, 39);
  
  quote.items.forEach((item, index) => {
    // Alternating background for legibility
    if (index % 2 === 1) {
      doc.setFillColor(249, 250, 251);
      doc.rect(20, yPos - 4, 175, 8, "F");
    }

    doc.setFont("helvetica", "bold");
    doc.text(`${item.quantity}x`, 22, yPos);
    doc.setFont("helvetica", "normal");
    
    // Split text for long values
    const splitName = doc.splitTextToSize(item.itemName.toUpperCase(), 60);
    doc.text(splitName, 35, yPos);
    
    const specInfo = item.itemType === 'hardware' ? 'Herraje Adicional' : `${item.weightInfo}g / ${item.timeInfo}h`;
    const splitProfile = doc.splitTextToSize(`${item.profileName}\n(${specInfo})`, 48);
    doc.text(splitProfile, 100, yPos);

    doc.text(formatMXN(item.unitPrice), 152, yPos);
    doc.setFont("helvetica", "bold");
    doc.text(formatMXN(item.totalPrice), 175, yPos);
    doc.setFont("helvetica", "normal");

    const maxLines = Math.max(splitName.length, splitProfile.length);
    yPos += (maxLines * 5) + 3;

    if (yPos > 240) {
      doc.addPage();
      yPos = 25;
      
      // Reprint header on next page
      doc.setFillColor(243, 244, 246);
      doc.rect(20, yPos - 5, 175, 7, "F");
      doc.setTextColor(75, 85, 99);
      doc.setFont("helvetica", "bold");
      doc.text("CANT", 22, yPos);
      doc.text("DESCRIPCIÓN DE PIEZA / CONCEPTO", 35, yPos);
      doc.text("PERFIL TÉCNICO", 100, yPos);
      doc.text("UNITARIO", 152, yPos);
      doc.text("TOTAL", 175, yPos);
      doc.line(20, yPos + 2, 195, yPos + 2);
      yPos += 10;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(17, 24, 39);
    }
  });

  // Table footer line
  doc.line(20, yPos, 195, yPos);
  yPos += 12;

  // Notes box if exists
  const notesExist = false; // We can add notes to the PDF if wanted

  // Total block on right
  doc.setFontSize(13);
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.text("IMPORTE TOTAL:", 115, yPos);
  doc.setTextColor(5, 150, 105);
  doc.setFontSize(14);
  doc.text(formatMXN(grandTotal), 160, yPos);

  // Add signature section at bottom
  const pageHeight = doc.internal.pageSize.getHeight();
  const signatureY = pageHeight - 35;

  doc.setDrawColor(209, 213, 219);
  doc.line(25, signatureY, 85, signatureY);
  doc.line(125, signatureY, 185, signatureY);

  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.setFont("helvetica", "bold");
  doc.text("FIRMA DE AUTORIZACIÓN", 40, signatureY + 4);
  doc.text("FIRMA DEL CLIENTE", 145, signatureY + 4);

  // Footer text
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.text("Este presupuesto digital se rige por términos de uso de CubeUp³. Validez: 15 días tras su emisión.", 20, pageHeight - 12);
  doc.text("Desarrollado para Impresión 3D Profesional", 145, pageHeight - 12);

  // Save PDF
  doc.save(`cubeup3_cotizacion_${quote.folio}.pdf`);
};
