import "server-only";
import { db } from "@/server/db";
import { getEnv } from "@/server/env";
import { formatRupiah, type SupportedLocale } from "@/lib/currency";
import { formatVisitDateDisplay } from "@/lib/datetime-wib";
import { revealServerQrPayload } from "@/server/tickets/qr-crypto";
import {
  formatGateName,
  generateTicketPdfBuffer,
  type TicketDocumentInput,
} from "@/server/tickets/ticket-documents";
import {
  sendTransactionalEmail,
  type EmailAttachment,
} from "@/server/integrations/email/email-service";
import { sendWhatsappMessage } from "@/server/integrations/whatsapp/whatsapp-service";
import { writeAuditLog } from "@/server/audit/audit";

export interface TicketDeliverySummary {
  orderId: string;
  emailConfigured: boolean;
  emailDelivered: boolean;
  whatsappConfigured: boolean;
  whatsappDelivered: boolean;
}

/**
 * Mengirimkan E-Ticket (lampiran PDF + ringkasan HTML dengan desain khas Tiket Putih/Reguler)
 * melalui SMTP Email serta ringkasan kode tiket melalui WhatsApp sesuai bahasa pesanan (§6.J & §7.3).
 */
export async function deliverOrderTicketsNotification(
  orderId: string
): Promise<TicketDeliverySummary> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      user: true,
      items: {
        include: {
          product: true,
          ticket: true,
        },
      },
    },
  });

  if (!order) {
    return {
      orderId,
      emailConfigured: false,
      emailDelivered: false,
      whatsappConfigured: false,
      whatsappDelivered: false,
    };
  }

  const locale: SupportedLocale = order.locale === "en" ? "en" : "id";
  const isEn = locale === "en";
  const visitDateYmd = order.visitDate.toISOString().slice(0, 10);
  const visitDateHuman = formatVisitDateDisplay(visitDateYmd, locale);
  const appUrl = getEnv().APP_URL.replace(/\/$/, "");
  const walletUrl = isEn
    ? `${appUrl}/en/dashboard?tab=wallet`
    : `${appUrl}/dashboard?tab=wallet`;

  const attachments: EmailAttachment[] = [];
  const ticketCardsHtml: string[] = [];
  const waLines: string[] = [];

  for (const item of order.items) {
    if (!item.ticket) continue;

    const qrPayload = revealServerQrPayload(item.ticket.qrTokenCipher);
    const productName = isEn ? item.product.nameEn : item.product.nameId;
    const isWhite = item.product.code === "TIKET_PUTIH";

    const docInput: TicketDocumentInput = {
      publicCode: item.ticket.publicCode,
      orderNumber: order.orderNumber,
      productCode: item.product.code,
      productName,
      visitorName: item.ticket.visitorName,
      visitorWhatsapp: item.ticket.visitorWhatsapp,
      visitDateYmd,
      admitCount: item.ticket.admitCount,
      unitBase: item.unitBase,
      unitParking: item.unitParking,
      unitTotal: item.unitTotal,
      subtotal: item.subtotal,
      allowedGates: item.product.allowedGates,
      qrPayload,
      status: item.ticket.status,
      issuedAt: item.ticket.issuedAt,
    };

    const pdfBuffer = await generateTicketPdfBuffer(docInput, locale);
    attachments.push({
      filename: `e-ticket-${item.ticket.publicCode}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    });

    const gatesText = item.product.allowedGates
      .map((g) => formatGateName(g, locale))
      .join(" + ");

    ticketCardsHtml.push(
      isWhite
        ? `<div style="background:#F6FAF8;color:#08110E;border:2px solid #195E56;border-radius:16px;padding:18px;margin-bottom:14px;">
            <div style="font-size:11px;font-weight:700;color:#195E56;text-transform:uppercase;">${
              isEn ? "TIKET PUTIH — 2 GATES PASS" : "TIKET PUTIH — TERUSAN 2 GERBANG"
            }</div>
            <div style="font-size:20px;font-weight:800;margin:4px 0;">${item.ticket.publicCode}</div>
            <div style="font-size:13px;">${productName} (${item.ticket.admitCount} ${
              isEn ? "visitor(s)" : "orang"
            }) — ${formatRupiah(item.subtotal, locale)}</div>
            <div style="font-size:12px;color:#195E56;margin-top:6px;">${
              isEn ? "Authorized Gates" : "Gerbang Diizinkan"
            }: ${gatesText}</div>
          </div>`
        : `<div style="background:#0F2A24;color:#E8F1EC;border:2px solid #2F8F83;border-radius:16px;padding:18px;margin-bottom:14px;">
            <div style="font-size:11px;font-weight:700;color:#F2A65A;text-transform:uppercase;">${
              isEn ? "REGULAR PASS — 1 GATE" : "TIKET REGULER — 1 GERBANG"
            }</div>
            <div style="font-size:20px;font-weight:800;margin:4px 0;">${item.ticket.publicCode}</div>
            <div style="font-size:13px;">${productName} (${item.ticket.admitCount} ${
              isEn ? "visitor(s)" : "orang"
            }) — ${formatRupiah(item.subtotal, locale)}</div>
            <div style="font-size:12px;color:#A7DDD6;margin-top:6px;">${
              isEn ? "Authorized Gate" : "Gerbang Diizinkan"
            }: ${gatesText}</div>
          </div>`
    );

    waLines.push(
      `- *${item.ticket.publicCode}* (${productName}, ${item.ticket.admitCount} ${
        isEn ? "visitor(s)" : "orang"
      })`
    );
  }

  const emailSubject = isEn
    ? `Your E-Ticket (${order.orderNumber}) — Wisata Cirebon`
    : `E-Ticket Resmi Anda (${order.orderNumber}) — Wisata Cirebon`;

  const emailText = isEn
    ? `Hello ${order.visitorName},\n\nYour payment for order ${order.orderNumber} (${formatRupiah(order.totalAmount, locale)}) has been confirmed.\nVisit Date: ${visitDateHuman} (WIB)\n\nYour PDF e-tickets are attached to this email, and you can open your offline-capable Ticket Wallet anytime at:\n${walletUrl}`
    : `Halo ${order.visitorName},\n\nPembayaran pesanan ${order.orderNumber} (${formatRupiah(order.totalAmount, locale)}) telah terkonfirmasi.\nTanggal Kunjungan: ${visitDateHuman} (WIB)\n\nPDF e-ticket terlampir pada email ini, dan Anda dapat membuka Dompet Tiket (mendukung mode luring) kapan saja di:\n${walletUrl}`;

  const emailHtml = `<div style="font-family:sans-serif;background:#08110E;color:#E8F1EC;padding:28px;border-radius:16px;">
    <h2 style="color:#F2A65A;margin:0 0 8px 0;">Wisata Cirebon — Batu Lawang &amp; Gunung Bendera</h2>
    <p style="margin:0 0 16px 0;font-size:14px;">${
      isEn
        ? `Hello <strong>${order.visitorName}</strong>, your official e-ticket for <strong>${visitDateHuman}</strong> is ready.`
        : `Halo <strong>${order.visitorName}</strong>, e-ticket resmi Anda untuk kunjungan <strong>${visitDateHuman}</strong> telah terbit.`
    }</p>
    ${ticketCardsHtml.join("\n")}
    <p style="font-size:13px;margin:18px 0;">${
      isEn
        ? `Order Total: <strong>${formatRupiah(order.totalAmount, locale)}</strong> (PDF e-tickets attached).`
        : `Total Pesanan: <strong>${formatRupiah(order.totalAmount, locale)}</strong> (PDF e-ticket terlampir).`
    }</p>
    <p style="margin:22px 0;">
      <a href="${walletUrl}" style="background:#F2A65A;color:#08110E;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block;">
        ${isEn ? "Open Ticket Wallet" : "Buka Dompet Tiket"}
      </a>
    </p>
  </div>`;

  const waMessage = isEn
    ? `*Wisata Cirebon — Official E-Ticket*\nOrder: *${order.orderNumber}*\nVisit Date: *${visitDateHuman} (WIB)*\nTotal: *${formatRupiah(order.totalAmount, locale)}*\n\nTickets:\n${waLines.join("\n")}\n\nOpen & cache your QR tickets for offline gate scan:\n${walletUrl}`
    : `*Wisata Cirebon — E-Ticket Resmi*\nPesanan: *${order.orderNumber}*\nTanggal Kunjungan: *${visitDateHuman} (WIB)*\nTotal: *${formatRupiah(order.totalAmount, locale)}*\n\nDaftar Tiket:\n${waLines.join("\n")}\n\nBuka & simpan QR tiket di perangkat sebelum naik ke gerbang:\n${walletUrl}`;

  const [emailRes, waRes] = await Promise.all([
    sendTransactionalEmail({
      to: order.user.email,
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
      attachments,
    }),
    sendWhatsappMessage(order.visitorWhatsapp, waMessage),
  ]);

  await writeAuditLog({
    actorId: order.userId,
    actorRole: order.user.role,
    action: "TICKET_DELIVERY_ATTEMPTED",
    entity: "Order",
    entityId: order.id,
    metadata: {
      orderNumber: order.orderNumber,
      locale,
      emailConfigured: emailRes.configured,
      emailDelivered: emailRes.delivered,
      whatsappConfigured: waRes.configured,
      whatsappDelivered: waRes.delivered,
    },
  }).catch(() => undefined);

  return {
    orderId: order.id,
    emailConfigured: emailRes.configured,
    emailDelivered: emailRes.delivered,
    whatsappConfigured: waRes.configured,
    whatsappDelivered: waRes.delivered,
  };
}
