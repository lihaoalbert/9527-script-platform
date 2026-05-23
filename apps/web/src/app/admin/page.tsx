"use client";

import { authFetch, useAuth } from "../auth-context";
import { useEffect, useState } from "react";
import { Users, BookOpen, Bot } from "lucide-react";

type Script = {
  id: string; title: string; status: string; authorId: string; wordCount: number;
};

type UserRow = {
  id: string; email: string; name: string; role: string; createdAt: string;
};

type PromptRow = {
  key: string; title: string; template: string; enabled: boolean; isCustomized: boolean;
};

const ROLES = ["USER", "CREATOR", "BUYER", "REVIEWER", "OPERATOR", "ADMIN", "SUPER_ADMIN"];

type TabKey = "users" | "scripts" | "ai";

export default function AdminPage() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("users");
  const [scripts, setScripts] = useState<Script[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [editPrompt, setEditPrompt] = useState<string | null>(null);
  const [editTemplate, setEditTemplate] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

  const tabs: Array<{ key: TabKey; label: string; icon: typeof Users }> = [
    { key: "users", label: "用户管理", icon: Users },
    { key: "scripts", label: "剧本管理", icon: BookOpen },
    { key: "ai", label: "AI 配置", icon: Bot },
  ];

  useEffect(() => {
    if (activeTab === "scripts") {
      authFetch("/api/scripts").then((r) => r.ok && r.json()).then((d) => d && setScripts(d)).catch(() => {});
    }
    if (activeTab === "users") {
      authFetch("/api/admin/users").then((r) => r.ok && r.json()).then((d) => d && setUsers(d)).catch(() => {});
    }
    if (activeTab === "ai") {
      authFetch("/api/studio/prompts").then((r) => r.ok && r.json()).then((d) => d && setPrompts(d)).catch(() => {});
    }
  }, [activeTab]);

  async function updateRole(userId: string, role: string) {
    setLoading(true);
    try {
      const res = await authFetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
        setMessage("角色已更新");
      }
    } catch { setMessage("更新失败"); }
    setLoading(false);
  }

  async function savePrompt(key: string) {
    try {
      await authFetch(`/api/studio/prompts/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: editTemplate, enabled: true }),
      });
      setEditPrompt(null);
      setMessage("提示词已保存");
      // Refresh
      const res = await authFetch("/api/studio/prompts");
      if (res.ok) setPrompts(await res.json());
    } catch { setMessage("保存失败"); }
  }

  const statusLabels: Record<string, string> = {
    DRAFT: "草稿", PENDING_REVIEW: "待审核", PUBLISHED: "已发布",
    LOCKED: "已锁定", IN_USE: "使用中", SOLD: "已售出",
  };

  const roleLabels: Record<string, string> = {
    USER: "普通用户", CREATOR: "创作者", BUYER: "买方",
    REVIEWER: "审核员", OPERATOR: "运营", ADMIN: "管理员", SUPER_ADMIN: "超级管理员",
  };

  return (
    <div>
      <header className="topbar">
        <div>
          <h1>系统管理</h1>
          <p>用户、剧本、AI 配置管理</p>
        </div>
      </header>

      {message && (
        <div className="notice success" style={{ marginBottom: 12 }} onClick={() => setMessage("")}>
          {message}
        </div>
      )}

      <div className="adminTabs">
        {tabs.map((t) => (
          <button key={t.key} className={`adminTab ${activeTab === t.key ? "active" : ""}`} onClick={() => setActiveTab(t.key)}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      <div className="adminContent">
        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="adminSection">
            <div className="dataTable">
              <div className="tableHeader" style={{ gridTemplateColumns: "2fr 2fr 1fr 1fr" }}>
                <span>邮箱</span><span>昵称</span><span>角色</span><span>操作</span>
              </div>
              {users.map((u) => (
                <div key={u.id} className="tableRow" style={{ gridTemplateColumns: "2fr 2fr 1fr 1fr" }}>
                  <span>{u.email}</span>
                  <span>{u.name}</span>
                  <span className="tag" style={{ fontSize: 11 }}>{roleLabels[u.role] ?? u.role}</span>
                  <span>
                    {isSuperAdmin && u.id !== currentUser?.id ? (
                      <select
                        value={u.role}
                        onChange={(e) => { void updateRole(u.id, e.target.value); }}
                        disabled={loading}
                        style={{ fontSize: 11, padding: "2px 4px", minHeight: "auto", width: "auto" }}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{roleLabels[r]}</option>
                        ))}
                      </select>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>—</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scripts Tab */}
        {activeTab === "scripts" && (
          <div className="adminSection">
            <div className="dataTable">
              <div className="tableHeader" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
                <span>剧本</span><span>状态</span><span>字数</span><span>作者</span>
              </div>
              {scripts.map((s) => (
                <div key={s.id} className="tableRow" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
                  <span className="scriptTitle">{s.title}</span>
                  <span className="statusBadge">{statusLabels[s.status] ?? s.status}</span>
                  <span>{Math.round(s.wordCount / 1000)}k字</span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{s.authorId.slice(0, 8)}...</span>
                </div>
              ))}
              {scripts.length === 0 && (
                <div className="tableRow" style={{ justifyContent: "center", padding: 24 }}>
                  <span style={{ color: "var(--muted)" }}>暂无剧本</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Config Tab */}
        {activeTab === "ai" && (
          <div className="adminSection">
            <div className="promptList" style={{ maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}>
              {prompts.map((p) => (
                <div key={p.key} className={`promptItem ${editPrompt === p.key ? "editing" : ""}`}>
                  <div className="promptItemHeader" onClick={() => {
                    setEditPrompt(editPrompt === p.key ? null : p.key);
                    setEditTemplate(p.template);
                  }}>
                    <div className="promptItemTitle">
                      <span className="promptKey">{p.key}</span>
                      <span className="promptTitle">{p.title}</span>
                    </div>
                    <div className="promptItemMeta">
                      {p.isCustomized && <span className="customBadge">已自定义</span>}
                    </div>
                  </div>
                  {editPrompt === p.key && (
                    <div className="promptItemBody" style={{ maxHeight: 400, overflowY: "auto" }}>
                      <textarea
                        value={editTemplate}
                        onChange={(e) => setEditTemplate(e.target.value)}
                        rows={10}
                        className="promptEditor"
                      />
                      <div className="promptActions">
                        <button onClick={() => { void savePrompt(p.key); }}>
                          保存
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
