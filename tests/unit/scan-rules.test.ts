import { GateType, OrderStatus, TicketStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { evaluateScanRules } from "@/server/scan/scan-service";

describe("Gate Scan Rules Pure Evaluation Engine (§5.4)", () => {
  // Waktu uji: 2026-11-15 pukul 09:30 WIB (UTC 02:30)
  const testNow = new Date("2026-11-15T02:30:00.000Z");
  const todayYmd = "2026-11-15";

  const defaultParams = {
    gate: GateType.GERBANG_BATU_LAWANG,
    ticketStatus: TicketStatus.ACTIVE,
    orderStatus: OrderStatus.PAID,
    visitDateYmd: todayYmd,
    allowedGates: [GateType.GERBANG_BATU_LAWANG, GateType.PINTU_GUNUNG_BENDERA],
    acceptedGates: [] as GateType[],
    destinationOpenTime: "06:00",
    destinationCloseTime: "17:00",
    now: testNow,
  };

  it("menerima tiket ACTIVE yang lunas pada tanggal dan jam operasional yang tepat", () => {
    const res = evaluateScanRules(defaultParams);
    expect(res.reason).toBe("OK");
  });

  it("menolak jika status tiket bukan ACTIVE (mis. REFUNDED / CANCELLED / EXPIRED) atau order bukan PAID", () => {
    expect(
      evaluateScanRules({
        ...defaultParams,
        ticketStatus: TicketStatus.REFUNDED,
      }).reason
    ).toBe("TICKET_INACTIVE");

    expect(
      evaluateScanRules({
        ...defaultParams,
        ticketStatus: TicketStatus.CANCELLED,
      }).reason
    ).toBe("TICKET_INACTIVE");

    expect(
      evaluateScanRules({
        ...defaultParams,
        orderStatus: OrderStatus.PENDING,
      }).reason
    ).toBe("TICKET_INACTIVE");
  });

  it("menolak jika tanggal kunjungan bukan hari ini dalam zona waktu WIB", () => {
    const res = evaluateScanRules({
      ...defaultParams,
      visitDateYmd: "2026-11-16",
    });
    expect(res.reason).toBe("WRONG_DATE");
    expect(res.detail?.visitDate).toBe("2026-11-16");
    expect(res.detail?.today).toBe(todayYmd);
  });

  it("menolak jika dipindai di luar jam operasional destinasi (WIB)", () => {
    // 04:30 WIB (terlalu pagi)
    const tooEarly = new Date("2026-11-14T21:30:00.000Z");
    const resEarly = evaluateScanRules({
      ...defaultParams,
      now: tooEarly,
    });
    expect(resEarly.reason).toBe("OUTSIDE_HOURS");

    // 18:30 WIB (sudah tutup)
    const tooLate = new Date("2026-11-15T11:30:00.000Z");
    const resLate = evaluateScanRules({
      ...defaultParams,
      now: tooLate,
    });
    expect(resLate.reason).toBe("OUTSIDE_HOURS");
  });

  it("menolak Tiket Reguler di Pintu Gunung Bendera dengan alasan NOT_WHITE_TICKET (§5.4)", () => {
    const res = evaluateScanRules({
      ...defaultParams,
      gate: GateType.PINTU_GUNUNG_BENDERA,
      allowedGates: [GateType.GERBANG_BATU_LAWANG], // Tiket Reguler
    });
    expect(res.reason).toBe("NOT_WHITE_TICKET");
  });

  it("menolak tiket yang sudah pernah dipindai dan diterima di gerbang yang sama", () => {
    const res = evaluateScanRules({
      ...defaultParams,
      gate: GateType.GERBANG_BATU_LAWANG,
      acceptedGates: [GateType.GERBANG_BATU_LAWANG],
    });
    expect(res.reason).toBe("ALREADY_SCANNED_AT_GATE");
  });

  it("mengizinkan Tiket Putih dipindai satu kali di Gerbang Batu Lawang lalu satu kali di Pintu Gunung Bendera", () => {
    // Pindaian ke-1 di Gerbang Batu Lawang -> OK
    const scan1 = evaluateScanRules({
      ...defaultParams,
      gate: GateType.GERBANG_BATU_LAWANG,
      acceptedGates: [],
    });
    expect(scan1.reason).toBe("OK");

    // Pindaian ke-2 di Pintu Gunung Bendera -> OK (karena Tiket Putih mengizinkan 2 gerbang berbeda)
    const scan2 = evaluateScanRules({
      ...defaultParams,
      gate: GateType.PINTU_GUNUNG_BENDERA,
      acceptedGates: [GateType.GERBANG_BATU_LAWANG],
    });
    expect(scan2.reason).toBe("OK");

    // Pindaian ke-3 di Pintu Gunung Bendera lagi -> Ditolak (sudah pernah diterima di Gunung Bendera)
    const scan3 = evaluateScanRules({
      ...defaultParams,
      gate: GateType.PINTU_GUNUNG_BENDERA,
      acceptedGates: [GateType.GERBANG_BATU_LAWANG, GateType.PINTU_GUNUNG_BENDERA],
    });
    expect(scan3.reason).toBe("ALREADY_SCANNED_AT_GATE");
  });
});
