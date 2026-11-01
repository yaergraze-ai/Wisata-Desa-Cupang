import { test, expect } from "@playwright/test";
import crypto from "node:crypto";

function signMidtransPayload(params: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  serverKey: string;
}): string {
  return crypto
    .createHash("sha512")
    .update(
      `${params.orderId}${params.statusCode}${params.grossAmount}${params.serverKey}`,
      "utf8"
    )
    .digest("hex");
}

test.describe("Alur Penuh Perjalanan Wisatawan E2E (ID & EN) — §10.1, §10.2", () => {
  const timestamp = Date.now();
  const visitorEmail = `wisatawan.e2e.${timestamp}@wisatacirebon.id`;
  const visitorWa = `0857${Math.floor(10000000 + Math.random() * 90000000)}`;
  const password = "Wisatawan#Cirebon2026!";

  test("1. Alur Lengkap Dwibahasa (ID): Registrasi -> Login -> Beli Tiket Putih -> Webhook -> Tiket Aktif -> Pindai Gerbang -> Ulasan Berfoto Tampil di Beranda", async ({
    page,
    browser,
  }) => {
    // A. Registrasi Pengunjung Baru
    await page.goto("/daftar");
    await page.waitForLoadState("networkidle");

    await page.fill("#reg-name", "Hadi Kusuma");
    await page.fill("#reg-email", visitorEmail);
    await page.fill("#reg-whatsapp", visitorWa);
    await page.fill("#reg-password", password);
    await page.fill("#reg-confirm", password);
    await page.check("#reg-consent"); // Persetujuan UU PDP
    await page.click("button[type=submit]");

    // Tunggu pengalihan ke dashboard member
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    expect(page.url()).toContain("dashboard");

    // B. Pesan Tiket Putih untuk 2 Orang (Kunjungan Hari Ini dalam Zona Waktu WIB)
    const todayWib = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
    const scanTimeIso = `${todayWib}T10:00:00.000+07:00`;
    const orderRes = await page.request.post("/api/orders", {
      data: {
        visitDate: todayWib,
        putihQty: 2,
        regulerQty: 0,
        visitorName: "Hadi Kusuma",
        visitorWhatsapp: visitorWa,
        locale: "id",
      },
    });
    expect([200, 201]).toContain(orderRes.status());
    const orderJson = await orderRes.json();
    const orderNumber = orderJson.order?.orderNumber || orderJson.orderNumber;
    const orderId = orderJson.order?.id;
    const orderTotal = orderJson.order?.totalAmount;
    expect(orderNumber).toBeTruthy();
    expect(orderNumber).toMatch(/^WC-/);

    // C. Webhook Midtrans Resmi dengan Tanda Tangan SHA-512 Valid (§5.3)
    const serverKey = process.env.MIDTRANS_SERVER_KEY || "midtrans_test_server_key";
    const grossAmount = `${orderTotal}.00`;

    const signature = signMidtransPayload({
      orderId: orderNumber,
      statusCode: "200",
      grossAmount,
      serverKey,
    });

    const webhookRes = await page.request.post("/api/webhooks/midtrans", {
      data: {
        order_id: orderNumber,
        status_code: "200",
        gross_amount: grossAmount,
        signature_key: signature,
        transaction_status: "settlement",
        transaction_id: `mid-tx-e2e-${timestamp}`,
      },
    });
    expect(webhookRes.status()).toBe(200);

    // D. Buka Tab Dompet Tiket & Verifikasi Tiket Aktif Diterbitkan
    await page.goto("/dashboard?tab=wallet");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);

    // Ambil detail tiket dari API untuk verifikasi token QR dan public code
    const paidOrderDetail = await (await page.request.get(`/api/orders/${orderId}`)).json();
    const paidOrder = paidOrderDetail.order || paidOrderDetail;
    expect(paidOrder.status).toBe("PAID");
    expect(paidOrder.tickets?.length).toBeGreaterThan(0);
    const issuedTicket = paidOrder.tickets[0];
    const publicCode = issuedTicket.publicCode;
    expect(publicCode).toBeTruthy();

    // E. Pemindaian oleh Petugas Lapangan di Gerbang Batu Lawang (ACCEPTED)
    const staffBlContext = await browser.newContext();
    const staffBlPage = await staffBlContext.newPage();
    await staffBlPage.goto("/masuk?next=%2Fdashboard%2Fstaff");
    await staffBlPage.waitForLoadState("networkidle");
    await staffBlPage.fill("#login-email", "staff.batulawang@wisatacirebon.id");
    await staffBlPage.fill("#login-password", "Petugas#Cirebon2026!");
    await staffBlPage.click("button[type=submit]");
    await staffBlPage.waitForURL(/\/dashboard\/staff/, { timeout: 15000 });

    const scanBlRes = await staffBlPage.request.post("/api/staff/scan", {
      data: {
        rawInput: publicCode,
        gate: "GERBANG_BATU_LAWANG",
        locale: "id",
        nowIso: scanTimeIso,
      },
    });
    const scanBlJson = await scanBlRes.json();
    expect(["ACCEPTED", "ALREADY_SCANNED_AT_GATE"]).toContain(scanBlJson.result || scanBlJson.scan?.result);
    await staffBlContext.close();

    // F. Pemindaian oleh Petugas Lapangan di Pintu Gunung Bendera (ACCEPTED untuk Tiket Putih)
    const staffGbContext = await browser.newContext();
    const staffGbPage = await staffGbContext.newPage();
    await staffGbPage.goto("/masuk?next=%2Fdashboard%2Fstaff");
    await staffGbPage.waitForLoadState("networkidle");
    await staffGbPage.fill("#login-email", "staff.bendera@wisatacirebon.id");
    await staffGbPage.fill("#login-password", "Petugas#Cirebon2026!");
    await staffGbPage.click("button[type=submit]");
    await staffGbPage.waitForURL(/\/dashboard\/staff/, { timeout: 15000 });

    const scanGbRes = await staffGbPage.request.post("/api/staff/scan", {
      data: {
        rawInput: publicCode,
        gate: "PINTU_GUNUNG_BENDERA",
        locale: "id",
        nowIso: scanTimeIso,
      },
    });
    const scanGbJson = await scanGbRes.json();
    expect(["ACCEPTED", "ALREADY_SCANNED_AT_GATE"]).toContain(scanGbJson.result || scanGbJson.scan?.result);

    // G. Uji Penolakan Tiket Reguler di Pintu Gunung Bendera (§5.5: Bukan Tiket Putih)
    const orderRegRes = await page.request.post("/api/orders", {
      data: {
        visitDate: todayWib,
        putihQty: 0,
        regulerQty: 1,
        visitorName: "Pengunjung Reguler",
        visitorWhatsapp: visitorWa,
        locale: "id",
      },
    });
    expect([200, 201]).toContain(orderRegRes.status());
    const orderRegJson = await orderRegRes.json();
    const regOrderNumber = orderRegJson.order?.orderNumber || orderRegJson.orderNumber;
    const regOrderId = orderRegJson.order?.id;
    const regTotal = orderRegJson.order?.totalAmount ?? orderRegJson.totalAmount;
    const regGross = `${regTotal}.00`;
    const regSignature = signMidtransPayload({
      orderId: regOrderNumber,
      statusCode: "200",
      grossAmount: regGross,
      serverKey,
    });
    await page.request.post("/api/webhooks/midtrans", {
      data: {
        order_id: regOrderNumber,
        status_code: "200",
        gross_amount: regGross,
        signature_key: regSignature,
        transaction_status: "settlement",
        transaction_id: `mid-reg-${timestamp}`,
      },
    });
    const regDetail = await (await page.request.get(`/api/orders/${regOrderId || regOrderNumber}`)).json();
    const regTicket = regDetail.order?.tickets?.[0] || regDetail.tickets?.[0];
    expect(regTicket).toBeTruthy();

    const scanRegAtGb = await staffGbPage.request.post("/api/staff/scan", {
      data: {
        rawInput: regTicket.publicCode,
        gate: "PINTU_GUNUNG_BENDERA",
        locale: "id",
        nowIso: scanTimeIso,
      },
    });
    const scanRegJson = await scanRegAtGb.json();
    expect(scanRegJson.result || scanRegJson.scan?.result).toBe("REJECTED");
    expect(scanRegJson.reason || scanRegJson.scan?.reason).toMatch(/NOT_WHITE_TICKET|REGULAR_TICKET_AT_BENDERA|Bukan Tiket Putih/);
    await staffGbContext.close();

    // H. Penulisan Ulasan Pengunjung Berfoto (§5.6)
    const reviewRes = await page.request.post("/api/reviews", {
      data: {
        ticketId: issuedTicket.id,
        rating: 5,
        comment: "Pendakian jalur Gunung Bendera via Batu Lawang sangat luar biasa, tebing megah dan udara sejuk!",
        photos: [],
      },
    });
    expect([200, 201]).toContain(reviewRes.status());

    // I. Verifikasi Ulasan Tampil di Beranda Utama
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const reviewElement = page.locator("text=Pendakian jalur Gunung Bendera via Batu Lawang");
    await expect(reviewElement.first()).toBeVisible({ timeout: 15000 });
  });

  test("2. Navigasi Dwibahasa Penuh (EN): Beranda, Syarat Ketentuan, Peta Jalur & Pemilih Bahasa", async ({
    page,
  }) => {
    // A. Buka Beranda Versi Bahasa Inggris
    await page.goto("/en");
    await page.waitForLoadState("networkidle");

    // Verifikasi tag HTML lang="en"
    const langAttr = await page.locator("html").getAttribute("lang");
    expect(langAttr).toBe("en");

    // Verifikasi teks judul dalam bahasa Inggris
    await expect(page.locator("h1").first()).toContainText(/Official|Batu Lawang|Gunung Bendera/);

    // B. Pindah ke Halaman Peta Jalur (/en/jalur)
    await page.goto("/en/jalur");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/en/jalur");

    // C. Buka Syarat Ketentuan Bahasa Inggris (/en/syarat-ketentuan)
    await page.goto("/en/syarat-ketentuan");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("text=/Indonesian.*version/i").first()).toBeVisible();

    // D. Uji Tautan Kembali ke Beranda
    const backBtn = page.locator("a:has-text('Return to Homepage'), a:has-text('Back')").first();
    if (await backBtn.isVisible()) {
      await backBtn.click();
      await page.waitForURL(/\/en/, { timeout: 10000 });
    }
  });
});
