"use client";

import { useEffect, useState } from "react";
import { Role } from "@prisma/client";
import { useTranslations } from "next-intl";
import type { SuperAdminUserDto } from "@/server/super-admin/user-roles-service";

export function SuperAdminUsersView() {
  const t = useTranslations("SuperAdminDashboard");
  const [users, setUsers] = useState<SuperAdminUserDto[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Edit user modal state
  const [editingUser, setEditingUser] = useState<SuperAdminUserDto | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editWa, setEditWa] = useState("");
  const [editRole, setEditRole] = useState<Role>(Role.MEMBER);
  const [isSavingUser, setIsSavingUser] = useState(false);

  async function loadUsers(p = 1, r = roleFilter, q = search) {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(p));
      params.set("limit", "15");
      if (r !== "ALL") params.set("role", r);
      if (q.trim()) params.set("search", q.trim());

      const res = await fetch(`/api/super-admin/users?${params.toString()}`);
      if (!res.ok) throw new Error("Gagal memuat pengguna.");
      const data = (await res.json()) as {
        users: SuperAdminUserDto[];
        total: number;
        page: number;
        totalPages: number;
      };
      setUsers(data.users);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat pengguna.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      try {
        const params = new URLSearchParams();
        params.set("page", "1");
        params.set("limit", "15");
        if (roleFilter !== "ALL") params.set("role", roleFilter);
        if (search.trim()) params.set("search", search.trim());

        const res = await fetch(`/api/super-admin/users?${params.toString()}`);
        if (!res.ok) throw new Error("Gagal memuat pengguna.");
        const data = (await res.json()) as {
          users: SuperAdminUserDto[];
          total: number;
          page: number;
          totalPages: number;
        };
        if (!ignore) {
          setUsers(data.users);
          setPage(data.page);
          setTotalPages(data.totalPages);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Gagal memuat pengguna.");
          setIsLoading(false);
        }
      }
    }
    loadInitial();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);

  async function handleChangeRole(targetUserId: string, newRole: Role) {
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch("/api/super-admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, newRole }),
      });
      if (!res.ok) {
        const errJson = (await res.json()) as { error?: string };
        throw new Error(errJson.error || "Gagal mengubah peran akun.");
      }
      setActionSuccess("Peran pengguna berhasil diperbarui.");
      await loadUsers(page, roleFilter, search);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Gagal mengubah peran akun.");
    }
  }

  async function handleRevokeSessions(targetUserId: string) {
    if (!confirm("Cabut seluruh sesi login aktif milik pengguna ini?")) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch("/api/super-admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      if (!res.ok) {
        const errJson = (await res.json()) as { error?: string };
        throw new Error(errJson.error || "Gagal mencabut sesi login.");
      }
      const data = (await res.json()) as { revokedCount: number };
      setActionSuccess(`Berhasil mencabut ${data.revokedCount} sesi aktif.`);
      await loadUsers(page, roleFilter, search);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Gagal mencabut sesi.");
    }
  }

  async function handleDeleteUser(targetUserId: string, targetName: string, targetEmail: string) {
    const confirmation = prompt(
      `PERINGATAN: Apakah Anda yakin ingin menghapus akun '${targetName}' (${targetEmail})?\nKetik "HAPUS" untuk mengonfirmasi:`
    );
    if (confirmation !== "HAPUS") {
      if (confirmation !== null) {
        alert("Konfirmasi tidak sesuai. Penghapusan akun dibatalkan.");
      }
      return;
    }

    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch("/api/super-admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      if (!res.ok) {
        const errJson = (await res.json()) as { error?: string };
        throw new Error(errJson.error || "Gagal menghapus pengguna.");
      }
      const data = (await res.json()) as { message?: string };
      setActionSuccess(data.message || "Pengguna berhasil dihapus.");
      await loadUsers(page, roleFilter, search);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Gagal menghapus akun pengguna.");
    }
  }

  function handleOpenEditModal(u: SuperAdminUserDto) {
    setEditingUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditWa(u.whatsapp ?? "");
    setEditRole(u.role);
    setActionError(null);
    setActionSuccess(null);
  }

  async function handleSaveEditUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setIsSavingUser(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch("/api/super-admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: editingUser.id,
          name: editName,
          email: editEmail,
          whatsapp: editWa,
          role: editRole,
        }),
      });
      if (!res.ok) {
        const errJson = (await res.json()) as { error?: string };
        throw new Error(errJson.error || "Gagal memperbarui profil pengguna.");
      }
      setEditingUser(null);
      setActionSuccess("Profil pengguna berhasil diperbarui.");
      await loadUsers(page, roleFilter, search);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Gagal memperbarui profil pengguna.");
    } finally {
      setIsSavingUser(false);
    }
  }

  return (
    <div className="surface-solid-dark p-6 rounded-2xl border border-telaga-700/60 space-y-6" data-testid="super-admin-users-view">
      {/* HEADER & FILTER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-bold text-kabut">
            {t("usersManagementTitle")}
          </h2>
          <p className="text-xs text-kabut/70">{t("usersManagementSubtitle")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder={t("usersSearchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") loadUsers(1, roleFilter, search);
            }}
            className="w-full sm:w-56 rounded-xl border border-telaga-700 bg-obsidian px-3.5 py-1.5 text-xs text-kabut"
          />

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-xl border border-telaga-700 bg-obsidian px-3 py-1.5 text-xs text-kabut"
          >
            <option value="ALL">{t("allRoles")}</option>
            <option value="MEMBER">MEMBER</option>
            <option value="STAFF">STAFF</option>
            <option value="ADMIN">ADMIN</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
          </select>
        </div>
      </div>

      {actionSuccess ? (
        <div className="p-3 rounded-xl bg-green-950/60 border border-green-700/60 text-xs text-green-200">
          <i className="bi bi-check-circle mr-1.5" aria-hidden="true" />
          {actionSuccess}
        </div>
      ) : null}

      {actionError ? (
        <div className="p-3 rounded-xl bg-red-950/60 border border-red-700/60 text-xs text-red-200" data-testid="user-action-error">
          <i className="bi bi-shield-slash mr-1.5" aria-hidden="true" />
          {actionError}
        </div>
      ) : null}

      {/* TABEL PENGGUNA */}
      {isLoading ? (
        <div className="p-8 text-center text-kabut/60 flex items-center justify-center gap-3">
          <i className="bi bi-arrow-repeat animate-spin text-xl text-fajar" aria-hidden="true" />
          <span>{t("loadingUsers")}</span>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-300">{error}</div>
      ) : users.length === 0 ? (
        <div className="p-8 text-center text-kabut/60">{t("noUsersFound")}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-telaga-700/60 text-kabut/70 uppercase">
              <tr>
                <th className="pb-3 font-semibold">{t("thUserName")}</th>
                <th className="pb-3 font-semibold">{t("thUserContact")}</th>
                <th className="pb-3 font-semibold">{t("thUserRole")}</th>
                <th className="pb-3 font-semibold">{t("thUser2FA")}</th>
                <th className="pb-3 font-semibold">{t("thUserSessions")}</th>
                <th className="pb-3 text-right font-semibold">{t("thUserAction")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-telaga-700/30 text-kabut">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-obsidian/40 transition">
                  <td className="py-3">
                    <div className="font-semibold">{u.name}</div>
                    <div className="text-[11px] text-kabut/50">{u.createdAt.slice(0, 10)}</div>
                  </td>
                  <td className="py-3">
                    <div>{u.email}</div>
                    <div className="text-[11px] text-kabut/60">{u.whatsapp ?? "-"}</div>
                  </td>
                  <td className="py-3">
                    <select
                      value={u.role}
                      data-user-role={u.role}
                      onChange={(e) => handleChangeRole(u.id, e.target.value as Role)}
                      className={`rounded-lg px-2 py-1 text-xs font-bold border transition ${
                        u.role === "SUPER_ADMIN"
                          ? "bg-purple-950 text-purple-300 border-purple-700"
                          : u.role === "ADMIN"
                          ? "bg-fajar/20 text-fajar border-fajar/50"
                          : u.role === "STAFF"
                          ? "bg-telaga-900 text-telaga-200 border-telaga-700"
                          : "bg-obsidian text-kabut border-telaga-700"
                      }`}
                    >
                      <option value="MEMBER">MEMBER</option>
                      <option value="STAFF">STAFF</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                    </select>
                  </td>
                  <td className="py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.twoFactorEnabled
                          ? "bg-green-950 text-green-300"
                          : "bg-obsidian text-kabut/50"
                      }`}
                    >
                      {u.twoFactorEnabled ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </td>
                  <td className="py-3 font-mono font-bold">{t("sessionsCountUnit", { count: u.activeSessionsCount })}</td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(u)}
                        className="rounded bg-telaga-900/80 border border-telaga-600 px-2 py-1 text-[11px] font-bold text-telaga-200 hover:bg-telaga-700 transition cursor-pointer"
                        title="Edit Profil Pengguna"
                      >
                        <i className="bi bi-pencil-square mr-1" aria-hidden="true" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        disabled={u.activeSessionsCount === 0}
                        onClick={() => handleRevokeSessions(u.id)}
                        className="rounded bg-obsidian border border-telaga-700/60 px-2 py-1 text-[11px] text-amber-300 hover:bg-amber-950/40 hover:border-amber-600 transition disabled:opacity-30"
                        title={t("revokeSessionsBtn")}
                      >
                        <i className="bi bi-box-arrow-left mr-1" aria-hidden="true" />
                        <span>{t("revokeSessionsBtn")}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteUser(u.id, u.name, u.email)}
                        className="rounded bg-red-950/50 border border-red-700/70 px-2 py-1 text-[11px] font-bold text-red-200 hover:bg-red-900/60 hover:border-red-500 transition cursor-pointer"
                        title="Hapus Akun Pengguna"
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

      {/* PAGINASI */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between pt-4 border-t border-telaga-700/40 text-xs">
          <span className="text-kabut/60">
            {t("userPageCounter", { page, totalPages })}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => loadUsers(page - 1, roleFilter, search)}
              className="rounded-lg bg-obsidian border border-telaga-700 px-3 py-1 text-kabut disabled:opacity-40"
            >
              {t("userPrevBtn")}
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => loadUsers(page + 1, roleFilter, search)}
              className="rounded-lg bg-obsidian border border-telaga-700 px-3 py-1 text-kabut disabled:opacity-40"
            >
              {t("userNextBtn")}
            </button>
          </div>
        </div>
      ) : null}

      {/* MODAL EDIT DATA PENGGUNA */}
      {editingUser ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/80 backdrop-blur-md"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-hutan border border-telaga-700/60 p-6 shadow-2xl text-kabut space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-lg font-bold">Edit Profil Pengguna</h3>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-kabut/60 hover:text-white"
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleSaveEditUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-telaga-700 bg-obsidian px-3.5 py-2 text-kabut"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Alamat Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded-xl border border-telaga-700 bg-obsidian px-3.5 py-2 text-kabut"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Nomor WhatsApp</label>
                <input
                  type="tel"
                  value={editWa}
                  onChange={(e) => setEditWa(e.target.value)}
                  placeholder="08123456789 atau +628123456789"
                  className="w-full rounded-xl border border-telaga-700 bg-obsidian px-3.5 py-2 text-kabut"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Peran Akun (Role)</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as Role)}
                  className="w-full rounded-xl border border-telaga-700 bg-obsidian px-3 py-2 text-kabut text-xs"
                >
                  <option value="MEMBER">MEMBER (Pengunjung)</option>
                  <option value="STAFF">STAFF (Petugas Lapangan)</option>
                  <option value="ADMIN">ADMIN (Pengelola Wisata)</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN (Pengelola Utama)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-telaga-700/60">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="btn-ui rounded-xl bg-obsidian border border-telaga-700 px-4 py-2 text-xs font-semibold text-kabut"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingUser}
                  className="btn-ui btn-fajar rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50"
                >
                  {isSavingUser ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
