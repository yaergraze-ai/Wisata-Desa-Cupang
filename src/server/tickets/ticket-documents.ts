import "server-only";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { GateType, TicketStatus } from "@prisma/client";
import { formatRupiah, type SupportedLocale } from "@/lib/currency";
import { formatTimestampWib, formatVisitDateDisplay } from "@/lib/datetime-wib";

export interface TicketDocumentInput {
  publicCode: string;
  orderNumber: string;
  productCode: string;
  productName: string;
  visitorName: string;
  visitorWhatsapp: string;
  visitDateYmd: string;
  admitCount: number;
  unitBase: number;
  unitParking: number;
  unitTotal: number;
  subtotal: number;
  allowedGates: GateType[];
  qrPayload: string;
  status: TicketStatus;
  issuedAt: Date;
}

/**
 * Menormalkan teks ke himpunan karakter WinAnsi (Latin-1) agar pdf-lib StandardFonts
 * tidak pernah gagal mengenkode tanda baca Unicode non-WinAnsi.
 */
function toPdfSafeText(text: string): string {
  return text
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2022/g, "*")
    .replace(/\u2192/g, "->")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

export function formatGateName(gate: GateType, locale: SupportedLocale): string {
  if (gate === GateType.GERBANG_BATU_LAWANG) {
    return locale === "en" ? "Batu Lawang Gate" : "Gerbang Batu Lawang";
  }
  return locale === "en" ? "Gunung Bendera Gate" : "Pintu Gunung Bendera";
}

export async function generateTicketQrPngBuffer(
  qrPayload: string
): Promise<Buffer> {
  return QRCode.toBuffer(qrPayload, {
    type: "png",
    width: 520,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: "#08110E",
      light: "#FFFFFF",
    },
  });
}

export async function generateTicketQrDataUrl(
  qrPayload: string
): Promise<string> {
  return QRCode.toDataURL(qrPayload, {
    width: 520,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: "#08110E",
      light: "#FFFFFF",
    },
  });
}

/**
 * Menghasilkan dokumen PDF E-Ticket dwibahasa dengan desain kartu berbeda untuk
 * Tiket Putih (kertas kabut terang, 2 gerbang) vs Tiket Reguler (hutan gelap, 1 gerbang) (§7.3).
 */
export async function generateTicketPdfBuffer(
  ticket: TicketDocumentInput,
  locale: SupportedLocale
): Promise<Buffer> {
  const isEn = locale === "en";
  const isWhiteTicket = ticket.productCode === "TIKET_PUTIH";

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(
    toPdfSafeText(
      isEn
        ? `E-Ticket ${ticket.publicCode} - Wisata Cirebon`
        : `E-Ticket ${ticket.publicCode} - Wisata Cirebon`
    )
  );
  pdfDoc.setAuthor("Wisata Cirebon - Desa Cupang");

  const pageWidth = 540;
  const pageHeight = 680;
  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Latar belakang luar obsidian (#08110E)
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: rgb(0.031, 0.067, 0.055),
  });

  // Kartu tiket utama dengan palet berbeda antara Tiket Putih vs Reguler
  const cardX = 28;
  const cardY = 28;
  const cardW = pageWidth - 56;
  const cardH = pageHeight - 56;

  const cardBg = isWhiteTicket
    ? rgb(0.965, 0.98, 0.973) // #F6FAF8 kertas kabut terang
    : rgb(0.059, 0.165, 0.141); // #0F2A24 hutan gelap
  const cardBorder = isWhiteTicket
    ? rgb(0.098, 0.369, 0.337) // #195E56 telaga-700
    : rgb(0.184, 0.561, 0.514); // #2F8F83 telaga-500
  const primaryText = isWhiteTicket
    ? rgb(0.031, 0.067, 0.055) // #08110E
    : rgb(0.91, 0.945, 0.925); // #E8F1EC
  const mutedText = isWhiteTicket
    ? rgb(0.22, 0.31, 0.28)
    : rgb(0.71, 0.79, 0.75);
  const accentText = isWhiteTicket
    ? rgb(0.098, 0.369, 0.337) // #195E56
    : rgb(0.949, 0.651, 0.353); // #F2A65A fajar

  page.drawRectangle({
    x: cardX,
    y: cardY,
    width: cardW,
    height: cardH,
    color: cardBg,
    borderColor: cardBorder,
    borderWidth: 2,
  });

  // Pita tajuk atas kartu
  const headerBandH = 74;
  page.drawRectangle({
    x: cardX,
    y: cardY + cardH - headerBandH,
    width: cardW,
    height: headerBandH,
    color: isWhiteTicket ? rgb(0.098, 0.369, 0.337) : rgb(0.031, 0.067, 0.055),
  });

  page.drawText("WISATA CIREBON - DESA CUPANG, GEMPOL", {
    x: cardX + 24,
    y: cardY + cardH - 28,
    size: 9.5,
    font: fontBold,
    color: rgb(0.949, 0.651, 0.353),
  });

  const badgeTitle = isWhiteTicket
    ? isEn
      ? "TIKET PUTIH - 2 GATES COMBINED PASS"
      : "TIKET PUTIH - AKSES TERUSAN 2 GERBANG"
    : isEn
      ? "REGULAR PASS - BATU LAWANG (1 GATE)"
      : "TIKET REGULER - BATU LAWANG (1 GERBANG)";

  page.drawText(toPdfSafeText(badgeTitle), {
    x: cardX + 24,
    y: cardY + cardH - 52,
    size: 15,
    font: fontBold,
    color: rgb(0.965, 0.98, 0.973),
  });

  // Detail Pemegang & Kunjungan
  let cursorY = cardY + cardH - headerBandH - 30;
  const leftColX = cardX + 24;
  const rightColX = cardX + 265;

  const drawField = (
    x: number,
    y: number,
    label: string,
    value: string,
    highlight = false
  ) => {
    page.drawText(toPdfSafeText(label.toUpperCase()), {
      x,
      y,
      size: 8.5,
      font: fontBold,
      color: mutedText,
    });
    page.drawText(toPdfSafeText(value), {
      x,
      y: y - 16,
      size: highlight ? 13 : 11,
      font: fontBold,
      color: highlight ? accentText : primaryText,
    });
  };

  drawField(
    leftColX,
    cursorY,
    isEn ? "Ticket Code" : "Kode Tiket",
    ticket.publicCode,
    true
  );
  drawField(
    rightColX,
    cursorY,
    isEn ? "Visit Date (WIB)" : "Tanggal Kunjungan (WIB)",
    formatVisitDateDisplay(ticket.visitDateYmd, locale),
    true
  );

  cursorY -= 46;
  drawField(
    leftColX,
    cursorY,
    isEn ? "Ticket Holder" : "Nama Pemegang Tiket",
    ticket.visitorName.slice(0, 34)
  );
  drawField(
    rightColX,
    cursorY,
    isEn ? "Group Admission" : "Jumlah Pengunjung",
    isEn ? `${ticket.admitCount} Visitor(s)` : `${ticket.admitCount} Orang`
  );

  cursorY -= 46;
  drawField(
    leftColX,
    cursorY,
    isEn ? "Order Number" : "Nomor Pesanan",
    ticket.orderNumber
  );
  drawField(
    rightColX,
    cursorY,
    isEn ? "WhatsApp Contact" : "Kontak WhatsApp",
    ticket.visitorWhatsapp
  );

  // Rincian harga teritemisasi
  cursorY -= 48;
  page.drawRectangle({
    x: leftColX,
    y: cursorY - 46,
    width: cardW - 48,
    height: 58,
    color: isWhiteTicket ? rgb(0.91, 0.949, 0.933) : rgb(0.039, 0.11, 0.094),
    borderColor: cardBorder,
    borderWidth: 1,
  });

  const breakdownLine1 = isEn
    ? `Package: ${ticket.productName} | Ticket: ${formatRupiah(ticket.unitBase, locale)} + Parking: ${formatRupiah(ticket.unitParking, locale)} = ${formatRupiah(ticket.unitTotal, locale)} / person`
    : `Paket: ${ticket.productName} | Tiket: ${formatRupiah(ticket.unitBase, locale)} + Parkir: ${formatRupiah(ticket.unitParking, locale)} = ${formatRupiah(ticket.unitTotal, locale)} / orang`;

  const breakdownLine2 = isEn
    ? `Total Paid (${ticket.admitCount}x): ${formatRupiah(ticket.subtotal, locale)} | Issued: ${formatTimestampWib(ticket.issuedAt, locale)}`
    : `Total Dibayar (${ticket.admitCount}x): ${formatRupiah(ticket.subtotal, locale)} | Terbit: ${formatTimestampWib(ticket.issuedAt, locale)}`;

  page.drawText(toPdfSafeText(breakdownLine1), {
    x: leftColX + 12,
    y: cursorY - 12,
    size: 9,
    font: fontRegular,
    color: primaryText,
  });
  page.drawText(toPdfSafeText(breakdownLine2), {
    x: leftColX + 12,
    y: cursorY - 30,
    size: 9.5,
    font: fontBold,
    color: accentText,
  });

  // Garis perforasi putus-putus + takik setengah lingkaran kiri/kanan
  const perfY = cardY + 236;
  page.drawCircle({
    x: cardX,
    y: perfY,
    size: 11,
    color: rgb(0.031, 0.067, 0.055),
  });
  page.drawCircle({
    x: cardX + cardW,
    y: perfY,
    size: 11,
    color: rgb(0.031, 0.067, 0.055),
  });

  for (let dashX = cardX + 18; dashX < cardX + cardW - 18; dashX += 14) {
    page.drawLine({
      start: { x: dashX, y: perfY },
      end: { x: Math.min(dashX + 7, cardX + cardW - 18), y: perfY },
      thickness: 1.4,
      color: cardBorder,
    });
  }

  // Bagian Bawah: QR Besar & Daftar Gerbang yang Diizinkan
  const qrBuffer = await generateTicketQrPngBuffer(ticket.qrPayload);
  const qrImage = await pdfDoc.embedPng(qrBuffer);
  const qrBoxSize = 172;
  const qrX = leftColX;
  const qrY = cardY + 34;

  page.drawRectangle({
    x: qrX,
    y: qrY,
    width: qrBoxSize,
    height: qrBoxSize,
    color: rgb(1, 1, 1),
    borderColor: cardBorder,
    borderWidth: 1.5,
  });
  page.drawImage(qrImage, {
    x: qrX + 8,
    y: qrY + 8,
    width: qrBoxSize - 16,
    height: qrBoxSize - 16,
  });

  const stubTextX = qrX + qrBoxSize + 22;
  let stubY = qrY + qrBoxSize - 16;

  page.drawText(
    toPdfSafeText(
      isEn ? "AUTHORIZED CHECKPOINT GATES:" : "GERBANG MASUK YANG DIIZINKAN:"
    ),
    {
      x: stubTextX,
      y: stubY,
      size: 9.5,
      font: fontBold,
      color: accentText,
    }
  );

  stubY -= 20;
  for (const gate of ticket.allowedGates) {
    const gateLabel = `* ${formatGateName(gate, locale)} (${isEn ? "1x entry scan" : "1x pindai masuk"})`;
    page.drawText(toPdfSafeText(gateLabel), {
      x: stubTextX,
      y: stubY,
      size: 10,
      font: fontBold,
      color: primaryText,
    });
    stubY -= 18;
  }

  if (!isWhiteTicket) {
    page.drawText(
      toPdfSafeText(
        isEn
          ? "Note: Not valid at Gunung Bendera Gate."
          : "Catatan: Tidak berlaku di Pintu Gunung Bendera."
      ),
      {
        x: stubTextX,
        y: stubY,
        size: 9,
        font: fontRegular,
        color: mutedText,
      }
    );
    stubY -= 20;
  } else {
    stubY -= 6;
  }

  const instructions = isEn
    ? [
        "1. Show this QR code to on-duty gate staff.",
        "2. Valid strictly on the visit date (WIB).",
        "3. One QR admits the entire group listed above.",
        "4. Save offline on your phone before ascending.",
      ]
    : [
        "1. Tunjukkan QR ini kepada petugas jaga gerbang.",
        "2. Hanya berlaku pada tanggal kunjungan (WIB).",
        "3. Satu QR berlaku untuk jumlah rombongan tertera.",
        "4. Simpan PDF/tiket luring sebelum naik ke jalur.",
      ];

  for (const line of instructions) {
    page.drawText(toPdfSafeText(line), {
      x: stubTextX,
      y: stubY,
      size: 8.8,
      font: fontRegular,
      color: mutedText,
    });
    stubY -= 15;
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
