"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  ContactMessageDto,
  NotificationDto,
} from "@/server/admin/admin-inbox-service";

export function AdminInboxView() {
  const t = useTranslations("AdminDashboard");
  const [activeSubTab, setActiveSubTab] = useState<"contacts" | "notifications">("contacts");
  const [contacts, setContacts] = useState<ContactMessageDto[]>([]);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Reply modal
  const [activeReplyMsg, setActiveReplyMsg] = useState<ContactMessageDto | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);

  async function loadData() {
    setIsLoading(true);
    try {
      const [cRes, nRes] = await Promise.all([
        fetch("/api/admin/inbox/contacts"),
        fetch("/api/admin/inbox/notifications"),
      ]);
      if (cRes.ok) {
        const cData = (await cRes.json()) as { messages: ContactMessageDto[] };
        setContacts(cData.messages);
      }
      if (nRes.ok) {
        const nData = (await nRes.json()) as { notifications: NotificationDto[] };
        setNotifications(nData.notifications);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      try {
        const [cRes, nRes] = await Promise.all([
          fetch("/api/admin/inbox/contacts"),
          fetch("/api/admin/inbox/notifications"),
        ]);
        if (!ignore && cRes.ok) {
          const cData = (await cRes.json()) as { messages: ContactMessageDto[] };
          setContacts(cData.messages);
        }
        if (!ignore && nRes.ok) {
          const nData = (await nRes.json()) as { notifications: NotificationDto[] };
          setNotifications(nData.notifications);
        }
      } catch {
        // ignore
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }
    loadInitial();
    return () => {
      ignore = true;
    };
  }, []);

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!activeReplyMsg) return;
    setIsSendingReply(true);
    try {
      const res = await fetch("/api/admin/inbox/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: activeReplyMsg.id,
          replyText: replyBody,
        }),
      });
      if (!res.ok) throw new Error("Gagal mengirim balasan.");
      setActiveReplyMsg(null);
      setReplyBody("");
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal membalas pesan.");
    } finally {
      setIsSendingReply(false);
    }
  }

  async function handleMarkNotifRead(notificationId: string) {
    try {
      await fetch("/api/admin/inbox/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });
      await loadData();
    } catch {
      // ignore
    }
  }

  return (
    <div className="surface-solid-dark p-6 rounded-2xl border border-telaga-700/60 space-y-6" data-testid="admin-inbox-view">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-bold text-kabut">
            {t("inboxTitle")}
          </h2>
          <p className="text-xs text-kabut/70">{t("inboxSubtitle")}</p>
        </div>

        <div className="flex items-center gap-2 p-1 rounded-xl bg-obsidian border border-telaga-700 text-xs">
          <button
            type="button"
            onClick={() => setActiveSubTab("contacts")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              activeSubTab === "contacts"
                ? "bg-fajar text-obsidian"
                : "text-kabut hover:text-white"
            }`}
          >
            {t("tabContactMessages", { count: contacts.filter((c) => !c.isRead).length })}
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("notifications")}
            className={`px-3 py-1.5 rounded-lg font-semibold transition ${
              activeSubTab === "notifications"
                ? "bg-fajar text-obsidian"
                : "text-kabut hover:text-white"
            }`}
          >
            {t("tabSystemNotifications", { count: notifications.filter((n) => !n.isRead).length })}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-kabut/60 flex items-center justify-center gap-3">
          <i className="bi bi-arrow-repeat animate-spin text-xl text-fajar" aria-hidden="true" />
          <span>{t("loadingInbox")}</span>
        </div>
      ) : activeSubTab === "contacts" ? (
        /* TAB PESAN KONTAK */
        contacts.length === 0 ? (
          <div className="p-8 text-center text-kabut/60">{t("noContactMessages")}</div>
        ) : (
          <div className="space-y-3">
            {contacts.map((msg) => (
              <div
                key={msg.id}
                className={`p-4 rounded-xl border transition ${
                  msg.isRead
                    ? "bg-obsidian/40 border-telaga-700/40"
                    : "bg-obsidian/80 border-fajar/60"
                } space-y-2 text-xs`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-telaga-700/30 pb-2">
                  <div>
                    <span className="font-bold text-kabut">{msg.name}</span>{" "}
                    <span className="text-kabut/60">({msg.email})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-kabut/50">{msg.createdAt.slice(0, 16)}</span>
                    {msg.isReplied ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-950 text-green-300">
                        {t("statusReplied")}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveReplyMsg(msg);
                          setReplyBody("");
                        }}
                        className="rounded bg-fajar/20 border border-fajar/40 px-2.5 py-0.5 text-[11px] font-bold text-fajar hover:bg-fajar/30"
                      >
                        {t("replyBtn")}
                      </button>
                    )}
                  </div>
                </div>
                <div className="font-semibold text-fajar">{msg.subject}</div>
                <p className="text-kabut/85 leading-relaxed">{msg.message}</p>
              </div>
            ))}
          </div>
        )
      ) : (
        /* TAB NOTIFIKASI */
        notifications.length === 0 ? (
          <div className="p-8 text-center text-kabut/60">{t("noNotifications")}</div>
        ) : (
          <div className="space-y-2.5">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
                  notif.isRead
                    ? "bg-obsidian/40 border-telaga-700/30 text-kabut/70"
                    : "bg-obsidian/80 border-telaga-600 text-kabut font-semibold"
                }`}
              >
                <div className="space-y-0.5">
                  <div className="text-sm font-bold text-kabut">{notif.title}</div>
                  <div className="text-xs text-kabut/80">{notif.message}</div>
                  <div className="text-[10px] text-kabut/50">{notif.createdAt.slice(0, 16)}</div>
                </div>
                {!notif.isRead ? (
                  <button
                    type="button"
                    onClick={() => handleMarkNotifRead(notif.id)}
                    className="rounded bg-obsidian border border-telaga-700 px-2.5 py-1 text-[11px] text-kabut/80 hover:text-white"
                  >
                    {t("markReadBtn")}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )
      )}

      {/* MODAL BALAS PESAN KONTAK */}
      {activeReplyMsg ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian/80 backdrop-blur-md"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-hutan border border-telaga-700/60 p-6 shadow-2xl text-kabut space-y-4">
            <h3 className="font-heading text-lg font-bold">{t("replyContactModalTitle")}</h3>
            <p className="text-xs text-kabut/70">
              {t("recipientLabel")} <strong>{activeReplyMsg.email}</strong> ({activeReplyMsg.name})
            </p>
            <form onSubmit={handleSendReply} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold mb-1">{t("replyBodyLabel")}</label>
                <textarea
                  rows={4}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder={t("replyBodyPlaceholder")}
                  className="w-full rounded-xl border border-telaga-700 bg-obsidian px-3.5 py-2 text-kabut"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-telaga-700/60">
                <button
                  type="button"
                  onClick={() => setActiveReplyMsg(null)}
                  className="btn-ui rounded-xl bg-obsidian border border-telaga-700 px-4 py-2 text-xs font-semibold text-kabut"
                >
                  {t("cancelModalBtn")}
                </button>
                <button
                  type="submit"
                  disabled={isSendingReply || replyBody.trim().length < 5}
                  className="btn-ui btn-fajar rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50"
                >
                  {isSendingReply ? t("sendingReplyBtn") : t("sendReplyBtn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
