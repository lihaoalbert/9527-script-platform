"use client";

import { authFetch } from "../auth-context";
import { useEffect, useState } from "react";
import { Users, BookOpen, Bot, Key, Plus, Trash2, Settings } from "lucide-react";

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

type TabKey = "users" | "scripts" | "ai" | "apikeys";

type ApiKeyRow = {
  id: string; name: string; provider: string; apiKey: string; model: string; persona: string; isActive: boolean;
};

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("users");
  const [scripts, setScripts] = useState<Script[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [editPrompt, setEditPrompt] = useState<string | null>(null);
  const [editTemplate, setEditTemplate] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [showNewKey, setShowNewKey] = useState(false);
  const [newKey, setNewKey] = useState({ name: "", provider: "deepseek", apiKey: "", model: "deepseek-v4-pro", persona: "both" });
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editKeyData, setEditKeyData] = useState({ name: "", provider: "deepseek", apiKey: "", model: "", persona: "both" });

  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const u = localStorage.getItem("user");
      if (u) {
        const parsed = JSON.parse(u);
        setIsSuperAdmin(parsed.role === "SUPER_ADMIN");
        setCurrentUserId(parsed.id);
      }
    } catch { /* ignore */ }
  }, []);

  const tabs: Array<{ key: TabKey; label: string; icon: typeof Users }> = [
    { key: "users", label: "用户管理", icon: Users },
    { key: "scripts", label: "剧本管理", icon: BookOpen },
    { key: "ai", label: "AI 配置", icon: Bot },
    { key: "apikeys", label: "API Key", icon: Key },
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
    if (activeTab === "apikeys") {
      authFetch("/api/admin/apikeys").then((r) => r.ok && r.json()).then((d) => d && setApiKeys(d)).catch(() => {});
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

  async function createApiKey() {
    try {
      await authFetch("/api/admin/apikeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newKey),
      });
      setShowNewKey(false);
      setNewKey({ name: "", provider: "deepseek", apiKey: "", model: "deepseek-v4-pro", persona: "both" });
      setMessage("API Key 已添加");
      const res = await authFetch("/api/admin/apikeys");
      if (res.ok) setApiKeys(await res.json());
    } catch { setMessage("添加失败"); }
  }

  async function toggleApiKey(id: string, isActive: boolean) {
    try {
      await authFetch(`/api/admin/apikeys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      const res = await authFetch("/api/admin/apikeys");
      if (res.ok) setApiKeys(await res.json());
    } catch { /* ignore */ }
  }

  async function startEditKey(k: ApiKeyRow) {
    setEditingKey(k.id);
    setEditKeyData({ name: k.name, provider: k.provider, apiKey: k.apiKey, model: k.model, persona: k.persona });
  }

  async function saveEditKey() {
    if (!editingKey) return;
    try {
      await authFetch(`/api/admin/apikeys/${editingKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editKeyData),
      });
      setEditingKey(null);
      setMessage("API Key 已更新");
      const res = await authFetch("/api/admin/apikeys");
      if (res.ok) setApiKeys(await res.json());
    } catch { setMessage("更新失败"); }
  }

  async function deleteApiKey(id: string) {
    if (!confirm("确定删除此 API Key？")) return;
    try {
      await authFetch(`/api/admin/apikeys/${id}`, { method: "DELETE" });
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
    } catch { /* ignore */ }
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
                    {isSuperAdmin && u.id !== currentUserId ? (
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
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{s.authorId ? s.authorId.slice(0, 8) : "—"}...</span>
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

        {/* API Keys Tab */}
        {activeTab === "apikeys" && (
          <div className="adminSection">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <p style={{ margin: 0 }}>管理多个 API Key，编剧小Q 和审核官可绑定不同模型</p>
              <button onClick={() => setShowNewKey(true)}><Plus size={14} /> 添加</button>
            </div>

            {showNewKey && (
              <div className="panel" style={{ marginBottom: 16, padding: 16 }}>
                <div className="formGrid">
                  <label>名称<input value={newKey.name} onChange={(e) => setNewKey((k) => ({ ...k, name: e.target.value }))} placeholder="如：Deepseek主力" /></label>
                  <label>Provider<input value={newKey.provider} onChange={(e) => setNewKey((k) => ({ ...k, provider: e.target.value }))} /></label>
                  <label className="fullSpan">API Key<input value={newKey.apiKey} onChange={(e) => setNewKey((k) => ({ ...k, apiKey: e.target.value }))} placeholder="sk-..." /></label>
                  <label>模型<input value={newKey.model} onChange={(e) => setNewKey((k) => ({ ...k, model: e.target.value }))} /></label>
                  <label>绑定角色
                    <select value={newKey.persona} onChange={(e) => setNewKey((k) => ({ ...k, persona: e.target.value }))}>
                      <option value="both">编剧+审核官</option>
                      <option value="writer">仅编剧小Q</option>
                      <option value="reviewer">仅审核官</option>
                    </select>
                  </label>
                </div>
                <div className="actionRow">
                  <button className="secondaryBtn" onClick={() => setShowNewKey(false)}>取消</button>
                  <button onClick={() => { void createApiKey(); }} disabled={!newKey.name || !newKey.apiKey}>添加</button>
                </div>
              </div>
            )}

            <div className="dataTable">
              <div className="tableHeader" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr auto auto" }}>
                <span>名称</span><span>模型</span><span>绑定角色</span><span>状态</span><span>操作</span>
              </div>
              {apiKeys.map((k) => (
                <div key={k.id} className="tableRow" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr auto auto" }}>
                  <span><strong>{k.name}</strong><br /><span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "monospace" }}>{k.apiKey.slice(0, 12)}...</span></span>
                  <span style={{ fontSize: 12 }}>{k.model}</span>
                  <span style={{ fontSize: 12 }}>
                    {k.persona === "both" ? "编剧+审核官" : k.persona === "writer" ? "仅编剧" : "仅审核官"}
                  </span>
                  <span>
                    <span className={`statusBadge ${k.isActive ? "statusActive" : ""}`} style={{ cursor: "pointer" }}
                      onClick={() => { void toggleApiKey(k.id, k.isActive); }}>
                      {k.isActive ? "启用" : "停用"}
                    </span>
                  </span>
                  <span>
                    <button className="iconBtn" onClick={() => startEditKey(k)} title="编辑">
                      <Settings size={14} />
                    </button>
                    <button className="iconBtn" onClick={() => { void deleteApiKey(k.id); }} title="删除">
                      <Trash2 size={14} />
                    </button>
                  </span>
                </div>
              ))}
              {editingKey && (
                <div className="panel" style={{ marginTop: 12, padding: 16 }}>
                  <h4 style={{ marginBottom: 12 }}>编辑 API Key</h4>
                  <div className="formGrid">
                    <label>名称<input value={editKeyData.name} onChange={(e) => setEditKeyData((d) => ({ ...d, name: e.target.value }))} /></label>
                    <label>Provider<input value={editKeyData.provider} onChange={(e) => setEditKeyData((d) => ({ ...d, provider: e.target.value }))} /></label>
                    <label className="fullSpan">API Key<input value={editKeyData.apiKey} onChange={(e) => setEditKeyData((d) => ({ ...d, apiKey: e.target.value }))} /></label>
                    <label>模型<input value={editKeyData.model} onChange={(e) => setEditKeyData((d) => ({ ...d, model: e.target.value }))} /></label>
                    <label>绑定角色
                      <select value={editKeyData.persona} onChange={(e) => setEditKeyData((d) => ({ ...d, persona: e.target.value }))}>
                        <option value="both">编剧+审核官</option>
                        <option value="writer">仅编剧小Q</option>
                        <option value="reviewer">仅审核官</option>
                      </select>
                    </label>
                  </div>
                  <div className="actionRow">
                    <button className="secondaryBtn" onClick={() => setEditingKey(null)}>取消</button>
                    <button onClick={() => { void saveEditKey(); }}>保存修改</button>
                  </div>
                </div>
              )}
              {apiKeys.length === 0 && (
                <div className="tableRow" style={{ justifyContent: "center", padding: 24 }}>
                  <span style={{ color: "var(--muted)" }}>暂无 API Key，默认使用 .env 中的配置</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
