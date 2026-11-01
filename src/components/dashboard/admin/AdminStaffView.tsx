"use client";

import { useEffect, useState } from "react";
import { GateType } from "@prisma/client";
import { useTranslations } from "next-intl";
import type {
  LeaveRequestDto,
  StaffListItemDto,
} from "@/server/admin/admin-staff-service";

export function AdminStaffView() {
  const t = useTranslations("AdminDashboard");
  const [staffList, setStaffList] = useState<StaffListItemDto[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal tambah petugas
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newWa, setNewWa] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newGates, setNewGates] = useState<GateType[]>([GateType.GERBANG_BATU_LAWANG]);
  const [newIsMinor, setNewIsMinor] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Modal edit petugas
  const [editingStaff, setEditingStaff] = useState<StaffListItemDto | null>(null);
  const [editName, setEditName] = useState("");
  const [editWa, setEditWa] = useState("");
  const [editGates, setEditGates] = useState<GateType[]>([]);
  const [editIsMinor, setEditIsMinor] = useState(false);
  const [editIsActive, setEditIsActive] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  async function loadData() {
    setIsLoading(true);
    setError(null);
    try {
      const [staffRes, leaveRes] = await Promise.all([
        fetch("/api/admin/staff"),
        fetch("/api/admin/staff/leave"),
      ]);
      if (!staffRes.ok || !leaveRes.ok) throw new Error("Gagal memuat data staf.");
      const sData = (await staffRes.json()) as { staff: StaffListItemDto[] };
      const lData = (await leaveRes.json()) as { requests: LeaveRequestDto[] };
      setStaffList(sData.staff);
      setLeaveRequests(lData.requests);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat staf.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      try {
        const [staffRes, leaveRes] = await Promise.all([
          fetch("/api/admin/staff"),
          fetch("/api/admin/staff/leave"),
        ]);
        if (!staffRes.ok || !leaveRes.ok) throw new Error("Gagal memuat data staf.");
        const sData = (await staffRes.json()) as { staff: StaffListItemDto[] };
        const lData = (await leaveRes.json()) as { requests: LeaveRequestDto[] };
        if (!ignore) {
          setStaffList(sData.staff);
          setLeaveRequests(lData.requests);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Gagal memuat staf.");
          setIsLoading(false);
        }
      }
    }
    loadInitial();
    return () => {
      ignore = true;
    };
  }, []);

  async function handleCreateStaff(e: React.FormEvent) {
    e.preventDefault();
    setIsCreating(true);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          whatsapp: newWa,
          password: newPassword,
          assignedGates: newGates,
          isMinor: newIsMinor,
        }),
      });
      if (!res.ok) {
        const errJson = (await res.json()) as { error?: string };
        throw new Error(errJson.error || "Gagal membuat akun staf.");
      }
      setShowAddModal(false);
      setNewName("");
      setNewEmail("");
      setNewWa("");
      setNewPassword("");
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal membuat akun staf.");
    } finally {
      setIsCreating(false);
    }
  }

  function handleOpenEditModal(staff: StaffListItemDto) {
    setEditingStaff(staff);
    setEditName(staff.name);
    setEditWa(staff.whatsapp ?? "");
    setEditGates([...staff.assignedGates]);
    setEditIsMinor(staff.isMinor);
    setEditIsActive(staff.isActive);
  }

  async function handleSaveEditStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!editingStaff) return;
    setIsUpdating(true);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffProfileId: editingStaff.id,
          name: editName,
          whatsapp: editWa,
          assignedGates: editGates,
          isMinor: editIsMinor,
          isActive: editIsActive,
        }),
      });
      if (!res.ok) {
        const errJson = (await res.json()) as { error?: string };
        throw new Error(errJson.error || "Gagal memperbarui profil staf.");
      }
      setEditingStaff(null);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal memperbarui staf.");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDeleteStaff(staff: StaffListItemDto) {
    if (
      !confirm(
        `Apakah Anda yakin ingin menghapus petugas '${staff.name}'?\nPeran akun akan dikembalikan ke MEMBER dan penugasan gerbang dicabut.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch("/api/admin/staff", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffProfileId: staff.id }),
      });
      if (!res.ok) {
        const errJson = (await res.json()) as { error?: string };
        throw new Error(errJson.error || "Gagal menghapus staf.");
      }
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menghapus staf.");
    }
  }

  async function handleDecideLeave(leaveRequestId: string, status: "APPROVED" | "REJECTED") {
    try {
      const res = await fetch("/api/admin/staff/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaveRequestId, status }),
      });
      if (!res.ok) throw new Error("Gagal memproses pengajuan libur.");
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal memproses libur.");
    }
  }

  return (
    <div className="space-y-8" data-testid="admin-staff-view">
      {/* DAFTAR PETUGAS LAPANGAN */}
      <div className="surface-solid-dark p-6 rounded-2xl border border-telaga-700/60 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-heading text-lg font-bold text-kabut">
              {t("staffManagementTitle")}
            </h2>
            <p className="text-xs text-kabut/70">{t("staffManagementSubtitle")}</p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="btn-ui btn-fajar rounded-xl px-4 py-2 text-xs font-bold"
          >
            <i className="bi bi-person-plus-fill mr-1.5" aria-hidden="true" />
            <span>{t("addStaffBtn")}</span>
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-kabut/60 flex items-center justify-center gap-3">
            <i className="bi bi-arrow-repeat animate-spin text-xl text-fajar" aria-hidden="true" />
            <span>{t("loadingStaff")}</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-300">{error}</div>
        ) : staffList.length === 0 ? (
          <div className="p-8 text-center text-kabut/60">{t("noStaffFound")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-telaga-700/60 text-kabut/70 uppercase">
                <tr>
                  <th className="pb-3 font-semibold">{t("thStaffName")}</th>
                  <th className="pb-3 font-semibold">{t("thStaffContact")}</th>
                  <th className="pb-3 font-semibold">{t("thStaffGates")}</th>
                  <th className="pb-3 font-semibold">{t("thStaffMinor")}</th>
                  <th className="pb-3 font-semibold">{t("metricScansToday")}</th>
                  <th className="pb-3 font-semibold">{t("thStatus")}</th>
                  <th className="pb-3 text-right font-semibold">{t("thAction")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-telaga-700/30 text-kabut">
                {staffList.map((s) => (
                  <tr key={s.id} className="hover:bg-obsidian/40 transition">
                    <td className="py-3 font-semibold">{s.name}</td>
                    <td className="py-3">
                      <div>{s.email}</div>
                      <div className="text-[11px] text-kabut/60">{s.whatsapp}</div>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {s.assignedGates.map((g) => (
                          <span
                            key={g}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-telaga-900 text-telaga-200 border border-telaga-700"
                          >
                            {g === "GERBANG_BATU_LAWANG" ? t("gateBatuLawang") : t("gateGunungBendera")}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3">
                      {s.isMinor ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700">
                          {t("minorBadgeYes")}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-obsidian text-kabut/70">
                          {t("minorBadgeNo")}
                        </span>
                      )}
                    </td>
                    <td className="py-3 font-mono font-bold text-fajar">{s.scansTodayCount} {t("scanUnit")}</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.isActive
                            ? "bg-green-950 text-green-300 border border-green-700/60"
                            : "bg-red-950 text-red-300 border border-red-700/60"
                        }`}
                      >
                        {s.isActive ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(s)}
                          className="rounded bg-telaga-900/80 border border-telaga-600 px-2.5 py-1 text-[11px] font-bold text-telaga-200 hover:bg-telaga-700 transition cursor-pointer"
                          title="Edit Profil Petugas"
                        >
                          <i className="bi bi-pencil-square mr-1" aria-hidden="true" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStaff(s)}
                          className="rounded bg-red-950/60 border border-red-700/70 px-2.5 py-1 text-[11px] font-bold text-red-200 hover:bg-red-900/80 transition cursor-pointer"
                          title="Hapus / Nonaktifkan Petugas"
                        >
                          <i className="bi bi-trash3-fill mr-1 text-red-400" aria-hidden="true" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ANTREAN PENGAJUAN LIBUR MENDADAK (LEAVE REQUEST) */}
      <div className="surface-solid-dark p-6 rounded-2xl border border-telaga-700/60 space-y-4">
        <h3 className="font-heading text-base font-bold text-kabut">
          {t("leaveRequestsTitle")}
        </h3>
        {leaveRequests.length === 0 ? (
          <div className="p-6 text-center text-xs text-kabut/60">{t("noLeaveRequests")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-telaga-700/40 text-kabut/60">
                <tr>
                  <th className="pb-2">{t("thStaffName")}</th>
                  <th className="pb-2">{t("thVisitDate")}</th>
                  <th className="pb-2">{t("thLeaveReason")}</th>
                  <th className="pb-2">{t("thStatus")}</th>
                  <th className="pb-2 text-right">{t("thAction")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-telaga-700/20 text-kabut">
                {leaveRequests.map((lr) => (
                  <tr key={lr.id}>
                    <td className="py-2.5 font-semibold">{lr.staffName}</td>
                    <td className="py-2.5">{lr.date}</td>
                    <td className="py-2.5 text-kabut/80">{lr.reason}</td>
                    <td className="py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          lr.status === "APPROVED"
                            ? "bg-green-950 text-green-300"
                            : lr.status === "PENDING"
                            ? "bg-amber-950 text-amber-300"
                            : "bg-red-950 text-red-300"
                        }`}
                      >
                        {lr.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      {lr.status === "PENDING" ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDecideLeave(lr.id, "APPROVED")}
                            className="rounded bg-green-900 px-2 py-0.5 text-[10px] font-bold text-green-200"
                          >
                            {t("approveLeaveBtn")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDecideLeave(lr.id, "REJECTED")}
                            className="rounded bg-red-900 px-2 py-0.5 text-[10px] font-bold text-red-200"
                          >
                            {t("rejectLeaveBtn")}
                          </button>
                        </div>
                      ) : (
                        <span className="text-kabut/40 text-[10px]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL TAMBAH PETUGAS */}
      {showAddModal ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/80 backdrop-blur-md"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-hutan border border-telaga-700/60 p-6 shadow-2xl text-kabut space-y-4">
            <h3 className="font-heading text-lg font-bold">{t("addStaffModalTitle")}</h3>
            <form onSubmit={handleCreateStaff} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold mb-1">{t("fullNameInputLabel")}</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-xl border border-telaga-700 bg-obsidian px-3.5 py-2 text-kabut"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{t("emailInputLabel")}</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-xl border border-telaga-700 bg-obsidian px-3.5 py-2 text-kabut"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{t("whatsappInputLabel")}</label>
                <input
                  type="tel"
                  value={newWa}
                  onChange={(e) => setNewWa(e.target.value)}
                  className="w-full rounded-xl border border-telaga-700 bg-obsidian px-3.5 py-2 text-kabut"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">{t("passwordInputLabel")}</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-telaga-700 bg-obsidian px-3.5 py-2 text-kabut"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1.5">{t("gateAssignmentLabel")}</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newGates.includes(GateType.GERBANG_BATU_LAWANG)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewGates([...newGates, GateType.GERBANG_BATU_LAWANG]);
                        } else {
                          setNewGates(newGates.filter((g) => g !== GateType.GERBANG_BATU_LAWANG));
                        }
                      }}
                      className="accent-fajar"
                    />
                    <span>{t("gateBatuLawang")}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newGates.includes(GateType.PINTU_GUNUNG_BENDERA)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewGates([...newGates, GateType.PINTU_GUNUNG_BENDERA]);
                        } else {
                          setNewGates(newGates.filter((g) => g !== GateType.PINTU_GUNUNG_BENDERA));
                        }
                      }}
                      className="accent-fajar"
                    />
                    <span>{t("gateGunungBendera")}</span>
                  </label>
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsMinor}
                    onChange={(e) => setNewIsMinor(e.target.checked)}
                    className="accent-fajar"
                  />
                  <span>{t("minorCheckboxLabel")}</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-telaga-700/60">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-ui rounded-xl bg-obsidian border border-telaga-700 px-4 py-2 text-xs font-semibold text-kabut"
                >
                  {t("cancelModalBtn")}
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="btn-ui btn-fajar rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50"
                >
                  {isCreating ? t("submittingAddStaffBtn") : t("submitAddStaffBtn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* MODAL EDIT PETUGAS */}
      {editingStaff ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/80 backdrop-blur-md"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-hutan border border-telaga-700/60 p-6 shadow-2xl text-kabut space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-lg font-bold">Edit Profil Petugas</h3>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="text-kabut/60 hover:text-white"
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleSaveEditStaff} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold mb-1">Nama Petugas</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-telaga-700 bg-obsidian px-3.5 py-2 text-kabut"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Email (Akun)</label>
                <input
                  type="email"
                  value={editingStaff.email}
                  disabled
                  className="w-full rounded-xl border border-telaga-700/40 bg-obsidian/50 px-3.5 py-2 text-kabut/50 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Nomor WhatsApp</label>
                <input
                  type="tel"
                  value={editWa}
                  onChange={(e) => setEditWa(e.target.value)}
                  className="w-full rounded-xl border border-telaga-700 bg-obsidian px-3.5 py-2 text-kabut"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1.5">Penugasan Gerbang</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editGates.includes(GateType.GERBANG_BATU_LAWANG)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEditGates([...editGates, GateType.GERBANG_BATU_LAWANG]);
                        } else {
                          setEditGates(editGates.filter((g) => g !== GateType.GERBANG_BATU_LAWANG));
                        }
                      }}
                      className="accent-fajar"
                    />
                    <span>{t("gateBatuLawang")}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editGates.includes(GateType.PINTU_GUNUNG_BENDERA)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEditGates([...editGates, GateType.PINTU_GUNUNG_BENDERA]);
                        } else {
                          setEditGates(editGates.filter((g) => g !== GateType.PINTU_GUNUNG_BENDERA));
                        }
                      }}
                      className="accent-fajar"
                    />
                    <span>{t("gateGunungBendera")}</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block font-semibold mb-1">Status Keaktifan</label>
                  <select
                    value={editIsActive ? "ACTIVE" : "INACTIVE"}
                    onChange={(e) => setEditIsActive(e.target.value === "ACTIVE")}
                    className="w-full rounded-xl border border-telaga-700 bg-obsidian px-3 py-2 text-kabut text-xs"
                  >
                    <option value="ACTIVE">Aktif (Bertugas)</option>
                    <option value="INACTIVE">Nonaktif (Cuti/Libur)</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editIsMinor}
                      onChange={(e) => setEditIsMinor(e.target.checked)}
                      className="accent-fajar"
                    />
                    <span className="font-semibold text-amber-300">Petugas Minor</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-telaga-700/60">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="btn-ui rounded-xl bg-obsidian border border-telaga-700 px-4 py-2 text-xs font-semibold text-kabut"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="btn-ui btn-fajar rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50"
                >
                  {isUpdating ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
