"use client";

import { authFetch } from "../auth-context";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot, Shield, Send, LoaderCircle, Sparkles, Plus, FileText,
  User, ChevronRight, X, CheckCircle2, Lock, ArrowRight, Settings, FolderOpen, Save,
  Download, Upload, Trash2, EyeOff, Maximize2, Unlock,
} from "lucide-react";

// ─── Types ───

type ProjectSummary = {
  id: string; name: string; genre: string | null; status: string;
  currentPhase: string; planLockedAt: string | null; episodeCount: number; updatedAt: string;
};

type PlanData = {
  id: string; projectId: string;
  storyKernel: Record<string, unknown>; worldBuilding: Record<string, unknown>;
  characters: Record<string, unknown>[]; episodeOutlines: Record<string, unknown>[];
  productionNotes: Record<string, unknown>; version: number; lockedAt: string | null;
};

type EpisodeData = {
  id: string; episodeNumber: number; title: string; content: string;
  status: string; version: number;
  score?: { conflict: number; logic: number; pacing: number; characterConsistency: number; commercialPotential: number; originality: number; total: number; suggestions: string[] } | null;
};

type ProjectDetail = {
  id: string; name: string; genre: string | null; status: string; currentPhase: string;
  planLockedAt: string | null; plan: PlanData | null; episodes: EpisodeData[]; messageCount: number;
};

type MessageData = {
  id: string; role: "USER" | "WRITER" | "REVIEWER" | "SYSTEM";
  content: string; phase: string | null; step: number | null; decision: Record<string, unknown> | null;
  createdAt: string;
};

// ─── Persona Config ───

const WRITER_PERSONA = {
  role: "writer" as const, name: "编剧小Q",
  avatar: <Bot size={20} />, color: "#0f766e",
};

const REVIEWER_PERSONA = {
  role: "reviewer" as const, name: "审核官",
  avatar: <Shield size={20} />, color: "#b45309",
};

const PHASE_LABELS: Record<string, string> = {
  STORY_KERNEL: "故事内核", WORLD_BUILDING: "世界观构建",
  CHARACTERS: "人物塑造", EPISODE_OUTLINES: "分集大纲",
  PRODUCTION_NOTES: "制作要点", EPISODE_GENERATION: "分集生成",
};

const PHASE_STEPS = ["STORY_KERNEL", "WORLD_BUILDING", "CHARACTERS", "EPISODE_OUTLINES", "PRODUCTION_NOTES"];

const API = "/api";

export default function StudioPage() {
  // Project list
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);

  // Chat
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activePersona, setActivePersona] = useState<"writer" | "reviewer">("writer");

  // Right panel
  const [rightView, setRightView] = useState<"plan" | "episode" | "scores" | "prompts">("plan");
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null);

  // Auto mode
  const [autoRunning, setAutoRunning] = useState(false);

  // Prompts
  const [prompts, setPrompts] = useState<Array<{ key: string; title: string; template: string; enabled: boolean; isCustomized: boolean }>>([]);
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null);
  const [editTemplate, setEditTemplate] = useState("");

  // Modal
  const [fullscreen, setFullscreen] = useState<{ title: string; content: string } | null>(null);

  const [showNewProject, setShowNewProject] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGenre, setNewGenre] = useState("");

  async function loadPrompts() {
    try {
      const res = await authFetch(`${API}/studio/prompts`);
      if (res.ok) setPrompts(await res.json());
    } catch (e) { console.error(e); }
  }

  async function savePrompt(key: string) {
    try {
      await authFetch(`${API}/studio/prompts/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: editTemplate, enabled: true }),
      });
      setEditingPrompt(null);
      await loadPrompts();
    } catch (e) { console.error(e); }
  }

  async function resetPrompt(key: string) {
    try {
      const res = await authFetch(`${API}/studio/prompts/${key}`, { method: "DELETE" });
      if (res.ok) {
        const def = await res.json();
        setEditTemplate(def.template);
        await loadPrompts();
      }
    } catch (e) { console.error(e); }
  }

  // @-mention
  const [showMentions, setShowMentions] = useState(false);
  const [mentionIdx, setMentionIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const MENTIONS = [
    { role: "writer" as const, name: WRITER_PERSONA.name, color: WRITER_PERSONA.color },
    { role: "reviewer" as const, name: REVIEWER_PERSONA.name, color: REVIEWER_PERSONA.color },
  ];

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setInput(val);

    // Only show mentions when user is actively typing a @name (no space after @ yet)
    const lastAt = val.lastIndexOf("@");
    if (lastAt >= 0) {
      const afterAt = val.slice(lastAt);
      const hasSpace = afterAt.includes(" ");
      const mentionLen = afterAt.split(/\s/)[0].length;
      if (!hasSpace && mentionLen >= 1 && mentionLen <= 6) {
        setShowMentions(true);
        setMentionIdx(0);
        return;
      }
    }
    setShowMentions(false);
  }

  function selectMention(persona: typeof MENTIONS[0]) {
    const lastAt = input.lastIndexOf("@");
    const before = input.slice(0, lastAt);
    setInput(before + `@${persona.name} `);
    setActivePersona(persona.role);
    setShowMentions(false);
    textareaRef.current?.focus();
  }

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (showMentions) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx((i) => Math.min(i + 1, MENTIONS.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIdx((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); selectMention(MENTIONS[mentionIdx]); return; }
      if (e.key === "Escape") { setShowMentions(false); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); }
  }

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const res = await authFetch(`${API}/studio/projects`);
      if (res.ok) setProjects(await res.json());
    } catch (e) { console.error(e); }
  }

  async function selectProject(id: string) {
    setActiveProjectId(id);
    try {
      const [detailRes, msgRes] = await Promise.all([
        authFetch(`${API}/studio/projects/${id}`),
        authFetch(`${API}/studio/projects/${id}/messages?limit=50`),
      ]);
      if (detailRes.ok) {
        const d = await detailRes.json();
        setProjectDetail(d);
        setRightView(d.status === "EPISODES" ? "episode" : "plan");
      }
      if (msgRes.ok) {
        const msgs = await msgRes.json();
        setMessages(msgs.reverse());
      }
    } catch (e) { console.error(e); }
  }

  async function createProject() {
    if (!newName.trim()) return;
    try {
      const res = await authFetch(`${API}/studio/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), genre: newGenre.trim() || undefined }),
      });
      if (res.ok) {
        setShowNewProject(false);
        setNewName("");
        setNewGenre("");
        await loadProjects();
        const p = await res.json();
        await selectProject(p.id);
      }
    } catch (e) { console.error(e); }
  }

  async function sendMessage() {
    if (!input.trim() || !activeProjectId || loading) return;
    const content = input;
    const persona = activePersona;
    const personaName = persona === "writer" ? WRITER_PERSONA.name : REVIEWER_PERSONA.name;

    // Optimistically add user message immediately
    const userMsg: MessageData = {
      id: `user-${Date.now()}`, role: "USER", content,
      phase: null, step: null, decision: null, createdAt: new Date().toISOString(),
    };
    setInput("");
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await authFetch(`${API}/studio/projects/${activeProjectId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, targetPersona: persona }),
      });
      if (res.ok) {
        const { userMessage: serverUserMsg, aiMessage } = await res.json();
        // Replace optimistic user message with server version, add AI response
        setMessages((prev) => prev.map((m) => m.id === userMsg.id ? serverUserMsg : m).concat(aiMessage));
        const detailRes = await authFetch(`${API}/studio/projects/${activeProjectId}`);
        if (detailRes.ok) setProjectDetail(await detailRes.json());
      }
    } catch (e) {
      setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: "SYSTEM", content: `发送失败：${e}`, phase: null, step: null, decision: null, createdAt: new Date().toISOString() }]);
    } finally {
      setLoading(false);
    }
  }

  async function advanceStep() {
    if (!activeProjectId) return;
    try {
      const res = await authFetch(`${API}/studio/projects/${activeProjectId}/advance`, { method: "POST" });
      if (res.ok) {
        const d = await selectProject(activeProjectId);
      }
    } catch (e) { console.error(e); }
  }

  async function lockPlan() {
    if (!activeProjectId) return;
    try {
      const res = await authFetch(`${API}/studio/projects/${activeProjectId}/lock-plan`, { method: "POST" });
      if (res.ok) {
        await selectProject(activeProjectId);
        setRightView("episode");
      }
    } catch (e) { console.error(e); }
  }

  async function unlockPlan() {
    if (!activeProjectId || !confirm("解锁规划书后可以修改前面阶段的内容。确定解锁？")) return;
    try {
      const res = await authFetch(`${API}/studio/projects/${activeProjectId}/unlock-plan`, { method: "POST" });
      if (res.ok) await selectProject(activeProjectId);
    } catch (e) { console.error(e); }
  }

  async function goToPhase(phase: string) {
    if (!activeProjectId) return;
    try {
      await authFetch(`${API}/studio/projects/${activeProjectId}/go-phase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase }),
      });
      await selectProject(activeProjectId);
    } catch (e) { console.error(e); }
  }

  async function startAutoMode() {
    if (!activeProjectId) return;
    try {
      await authFetch(`${API}/studio/projects/${activeProjectId}/auto-mode/start`, { method: "POST" });
      setAutoRunning(true);
    } catch (e) { console.error(e); }
  }

  async function stopAutoMode() {
    if (!activeProjectId) return;
    try {
      await authFetch(`${API}/studio/projects/${activeProjectId}/auto-mode/stop`, { method: "POST" });
      setAutoRunning(false);
      await selectProject(activeProjectId);
    } catch (e) { console.error(e); }
  }

  // Poll for new messages when auto mode is running
  useEffect(() => {
    if (!autoRunning || !activeProjectId) return;
    const interval = setInterval(async () => {
      try {
        const res = await authFetch(`${API}/studio/projects/${activeProjectId}/messages?limit=80`);
        if (res.ok) {
          const msgs = await res.json();
          setMessages(msgs.reverse());
          const detailRes = await authFetch(`${API}/studio/projects/${activeProjectId}`);
          if (detailRes.ok) setProjectDetail(await detailRes.json());
          // Check if still running
          const statusRes = await authFetch(`${API}/studio/projects/${activeProjectId}/auto-mode/status`);
          if (statusRes.ok) {
            const status = await statusRes.json();
            if (!status.running) setAutoRunning(false);
          }
        }
      } catch (e) { /* ignore poll errors */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [autoRunning, activeProjectId]);

  // Check auto mode status on project select
  useEffect(() => {
    if (!activeProjectId) return;
    (async () => {
      try {
        const res = await authFetch(`${API}/studio/projects/${activeProjectId}/auto-mode/status`);
        if (res.ok) {
          const status = await res.json();
          setAutoRunning(status.running);
        }
      } catch (e) { /* ignore */ }
    })();
  }, [activeProjectId]);

  function downloadProject() {
    if (!activeProjectId) return;
    window.open(`${API}/studio/projects/${activeProjectId}/download`, "_blank");
  }

  async function submitToLibrary() {
    if (!activeProjectId) return;
    try {
      const res = await authFetch(`${API}/studio/projects/${activeProjectId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        alert(`已提交到剧本库！剧本ID: ${data.scriptId}`);
        await selectProject(activeProjectId);
        await loadProjects();
      }
    } catch (e) { console.error(e); }
  }

  async function archiveProject(id: string) {
    try {
      await authFetch(`${API}/studio/projects/${id}`, { method: "DELETE" });
      if (activeProjectId === id) {
        setActiveProjectId(null);
        setProjectDetail(null);
        setMessages([]);
      }
      await loadProjects();
    } catch (e) { console.error(e); }
  }

  async function deleteProjectPermanently(id: string) {
    if (!confirm("确定永久删除此项目？此操作不可撤销。")) return;
    try {
      await authFetch(`${API}/studio/projects/${id}/permanent`, { method: "DELETE" });
      if (activeProjectId === id) {
        setActiveProjectId(null);
        setProjectDetail(null);
        setMessages([]);
      }
      await loadProjects();
    } catch (e) { console.error(e); }
  }

  async function forceLockEpisode(epNum: number) {
    if (!activeProjectId) return;
    try {
      await authFetch(`${API}/studio/projects/${activeProjectId}/episodes/${epNum}/force-lock`, { method: "POST" });
      await selectProject(activeProjectId);
    } catch (e) { console.error(e); }
  }

  async function unlockEpisode(epNum: number) {
    if (!activeProjectId) return;
    try {
      await authFetch(`${API}/studio/projects/${activeProjectId}/episodes/${epNum}/unlock`, { method: "POST" });
      await selectProject(activeProjectId);
    } catch (e) { console.error(e); }
  }

  const currentPhaseIndex = projectDetail ? PHASE_STEPS.indexOf(projectDetail.currentPhase) : 0;
  const isPlanning = projectDetail?.status === "PLANNING";
  const isEpisodes = projectDetail?.status === "EPISODES";

  return (
    <div className="studioV2">
      {/* Left Panel — Projects */}
      <aside className="studioLeft">
        <div className="leftHeader">
          <h2>项目</h2>
          <button className="iconBtn" onClick={() => setShowNewProject(true)} title="新建项目">
            <Plus size={16} />
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="emptyFiles">
            <FolderOpen size={24} />
            <span>暂无项目</span>
            <span className="fileHint">点击 + 创建你的第一个项目</span>
          </div>
        ) : (
          <div className="projectList">
            {projects.map((p) => (
              <div key={p.id} className={`projectListItem ${p.id === activeProjectId ? "active" : ""}`}>
                <div className="projectItemClickable" onClick={() => { void selectProject(p.id); }}>
                  <div className="projectItemTop">
                    <span className="projectItemName">{p.name}</span>
                    <span className={`projectStatus status${p.status}`}>{p.status === "PLANNING" ? "规划中" : p.status === "EPISODES" ? "生成中" : p.status === "COMPLETED" ? "已完成" : "已归档"}</span>
                  </div>
                  <div className="projectItemMeta">
                    <span>{PHASE_LABELS[p.currentPhase] ?? p.currentPhase}</span>
                    {p.episodeCount > 0 && <span>· {p.episodeCount}集</span>}
                  </div>
                </div>
                <div className="projectItemActions">
                  <button className="iconBtnMini" onClick={(e) => { e.stopPropagation(); void archiveProject(p.id); }} title="归档">
                    <EyeOff size={12} />
                  </button>
                  <button className="iconBtnMini danger" onClick={(e) => { e.stopPropagation(); void deleteProjectPermanently(p.id); }} title="删除">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Phase progress for active project */}
        {projectDetail && isPlanning && (
          <div className="phaseProgress">
            <div className="phaseLabel">创作进度</div>
            <div className="phaseSteps">
              {PHASE_STEPS.map((step, i) => (
                <div key={step}
                  className={`phaseStep ${i < currentPhaseIndex ? "done" : i === currentPhaseIndex ? "current" : ""}`}
                  onClick={() => { if (i !== currentPhaseIndex) { void goToPhase(step); } }}
                  style={{ cursor: i !== currentPhaseIndex ? "pointer" : "default" }}
                  title={i !== currentPhaseIndex ? `跳转到${PHASE_LABELS[step]}` : "当前阶段"}>
                  <div className="phaseDot">{i < currentPhaseIndex ? <CheckCircle2 size={12} /> : i + 1}</div>
                  <span className="phaseStepLabel">{PHASE_LABELS[step]}</span>
                </div>
              ))}
            </div>
            {currentPhaseIndex < PHASE_STEPS.length - 1 && (
              <button className="advanceBtn" onClick={() => { void advanceStep(); }}>
                <ArrowRight size={14} /> 推进到下一步
              </button>
            )}
            {currentPhaseIndex >= PHASE_STEPS.length - 1 && (
              <button className="lockPlanBtn" onClick={() => { void lockPlan(); }}>
                <Lock size={14} /> 锁定规划书
              </button>
            )}
          </div>
        )}

        <div className="leftFooter">
          <button className="configBtn" onClick={() => { loadPrompts(); setRightView("prompts"); }}>
            <Settings size={16} />
            <span>提示词管理</span>
          </button>
        </div>
      </aside>

      {/* Middle Panel — Chat */}
      <main className="studioMiddle">
        <div className="chatHeader">
          <div className="chatHeaderLeft">
            {projectDetail ? (
              <>
                <div className="projectTitle">{projectDetail.name}</div>
                <div className="projectSubtitle">
                  <span className={`projectStatus status${projectDetail.status}`}>
                    {projectDetail.status === "PLANNING" ? "规划中" : projectDetail.status === "EPISODES" ? "生成中" : "已完成"}
                  </span>
                  <span>{PHASE_LABELS[projectDetail.currentPhase] ?? projectDetail.currentPhase}</span>
                  <span>更新于 {new Date(projectDetail.plan?.lockedAt ?? "").toLocaleDateString("zh-CN") || "刚刚"}</span>
                </div>
              </>
            ) : (
              <div className="projectTitle">选择或创建一个项目</div>
            )}
          </div>
          {projectDetail && (
            <div className="chatHeaderActions">
              <button
                className={`autoModeToggle ${autoRunning ? "active" : ""}`}
                onClick={() => { autoRunning ? void stopAutoMode() : void startAutoMode(); }}
              >
                {autoRunning ? <><LoaderCircle size={14} className="spin" /> 自动中</> : <><Sparkles size={14} /> 自动</>}
              </button>
              <button className="toolbarBtn" onClick={downloadProject} title="下载">
                <Download size={14} />
              </button>
              {projectDetail.episodes.some((e) => e.status === "LOCKED") && (
                <button className="toolbarBtn submit" onClick={() => { void submitToLibrary(); }}>
                  <Upload size={14} /> 提交
                </button>
              )}
            </div>
          )}
        </div>

        <div className="chatMessages">
          {messages.length === 0 && !activeProjectId && (
            <div className="emptyState tall">
              <Sparkles size={24} />
              <p>选择或创建一个项目开始创作</p>
            </div>
          )}
          {messages.map((msg) => {
            const persona = msg.role === "WRITER" ? WRITER_PERSONA : msg.role === "REVIEWER" ? REVIEWER_PERSONA : null;
            const isSystem = msg.role === "SYSTEM";
            return (
              <div key={msg.id} className={`message ${msg.role.toLowerCase()} ${isSystem ? "system" : ""}`}>
                {persona && (
                  <div className="messageAvatar" style={{ background: persona.color }}>
                    {persona.avatar}
                  </div>
                )}
                {msg.role === "USER" && (
                  <div className="messageAvatar userAvatar"><User size={16} /></div>
                )}
                {isSystem && (
                  <div className="messageAvatar systemAvatar"><Sparkles size={16} /></div>
                )}
                <div className="messageContent">
                  {persona && <div className="messageName">{persona.name}</div>}
                  {isSystem && <div className="messageName">系统</div>}
                  <div className="messageText">{msg.content}</div>
                  {msg.decision && msg.role !== "SYSTEM" && (
                    <div className="messageDecision">
                      <CheckCircle2 size={12} /> 已提交结构化数据
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="message loading">
              <div className="messageAvatar" style={{ background: activePersona === "writer" ? WRITER_PERSONA.color : REVIEWER_PERSONA.color }}>
                {activePersona === "writer" ? <Bot size={16} /> : <Shield size={16} />}
              </div>
              <div className="messageContent">
                <div className="messageName">{activePersona === "writer" ? WRITER_PERSONA.name : REVIEWER_PERSONA.name}</div>
                <div className="messageText loading">
                  <LoaderCircle size={16} className="spin" />
                  <span>{activePersona === "writer" ? `${WRITER_PERSONA.name} 正在创作中` : `${REVIEWER_PERSONA.name} 正在审查中`}</span>
                  <span className="loadingDots"><span>.</span><span>.</span><span>.</span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chatInput">
          <div className="chatInputWrapper">
            {showMentions && (
              <div className="mentionDropdown">
                {MENTIONS.map((m, i) => (
                  <button
                    key={m.role}
                    className={`mentionItem ${i === mentionIdx ? "active" : ""}`}
                    onClick={() => selectMention(m)}
                    onMouseEnter={() => setMentionIdx(i)}
                  >
                    <span className="mentionDot" style={{ background: m.color }} />
                    {m.name}
                  </button>
                ))}
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              placeholder={activeProjectId ? "输入 @ 选择对话角色..." : "先选择或创建一个项目"}
              onKeyDown={handleInputKeyDown}
              disabled={!activeProjectId}
            />
          </div>
          <div className="chatInputRight">
            <span className="activePersonaBadge" style={{ background: activePersona === "writer" ? WRITER_PERSONA.color : REVIEWER_PERSONA.color }}>
              @{activePersona === "writer" ? WRITER_PERSONA.name : REVIEWER_PERSONA.name}
            </span>
            <button onClick={() => { void sendMessage(); }} disabled={loading || !input.trim() || !activeProjectId}>
              <Send size={18} />
            </button>
          </div>
        </div>
      </main>

      {/* Right Panel — Plan / Episode / Prompts View */}
      <aside className="studioRight">
        {rightView === "prompts" ? (
          <div className="promptManager">
            <div className="rightHeader">
              <h2>提示词管理</h2>
              <button className="iconBtn" onClick={() => setRightView(projectDetail ? "plan" : "plan")}>
                <X size={16} />
              </button>
            </div>
            <div className="promptList">
              {prompts.map((p) => (
                <div key={p.key} className={`promptItem ${editingPrompt === p.key ? "editing" : ""}`}>
                  <div className="promptItemHeader" onClick={() => {
                    setEditingPrompt(editingPrompt === p.key ? null : p.key);
                    setEditTemplate(p.template);
                  }}>
                    <div className="promptItemTitle">
                      <span className="promptKey">{p.key}</span>
                      <span className="promptTitle">{p.title}</span>
                    </div>
                    <div className="promptItemMeta">
                      {p.isCustomized && <span className="customBadge">已自定义</span>}
                      <ChevronRight size={14} style={{ transform: editingPrompt === p.key ? "rotate(90deg)" : "" }} />
                    </div>
                  </div>
                  {editingPrompt === p.key && (
                    <div className="promptItemBody">
                      <textarea
                        value={editTemplate}
                        onChange={(e) => setEditTemplate(e.target.value)}
                        rows={12}
                        className="promptEditor"
                      />
                      <div className="promptActions">
                        <button className="secondaryBtn" onClick={() => { void resetPrompt(p.key); }}>
                          恢复默认
                        </button>
                        <button onClick={() => { void savePrompt(p.key); }}>
                          <Save size={14} /> 保存
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : !projectDetail ? (
          <div className="emptyPreview">
            <FileText size={48} />
            <p>选择左侧项目查看详情</p>
          </div>
        ) : rightView === "plan" && projectDetail.plan ? (
          <div className="planView">
            <div className="rightHeader">
              <h2>项目规划书</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {projectDetail.plan.lockedAt && (
                  <>
                    <span className="lockedBadge"><Lock size={12} /> 已锁定</span>
                    <button className="viewPlanToggle" onClick={() => { void unlockPlan(); }}>
                      <Unlock size={14} /> 解锁
                    </button>
                  </>
                )}
                {isEpisodes && (
                  <button className="viewPlanToggle" onClick={() => setRightView("episode")}>
                    <FileText size={14} /> 分集列表
                  </button>
                )}
              </div>
            </div>
            <div className="planSections">
              <PlanSection title="故事内核" data={projectDetail.plan.storyKernel} onMaximize={(t, c) => setFullscreen({ title: t, content: c })} />
              <PlanSection title="世界观构建" data={projectDetail.plan.worldBuilding} onMaximize={(t, c) => setFullscreen({ title: t, content: c })} />
              <PlanSection title="人物塑造" data={projectDetail.plan.characters} isArray onMaximize={(t, c) => setFullscreen({ title: t, content: c })} />
              <PlanSection title="分集大纲" data={projectDetail.plan.episodeOutlines} isArray onMaximize={(t, c) => setFullscreen({ title: t, content: c })} />
              <PlanSection title="制作要点" data={projectDetail.plan.productionNotes} onMaximize={(t, c) => setFullscreen({ title: t, content: c })} />
            </div>
          </div>
        ) : rightView === "episode" ? (
          <div className="episodeView">
            <div className="rightHeader">
              <h2>
                {selectedEpisode ? `第${selectedEpisode}集` : "分集列表"}
              </h2>
              <button className="viewPlanToggle" onClick={() => setRightView("plan")}>
                <FileText size={14} /> 规划书
              </button>
            </div>
            {!selectedEpisode ? (
              <div className="episodeList">
                {projectDetail.episodes.map((ep) => (
                  <button
                    key={ep.episodeNumber}
                    className={`episodeItem ${ep.status === "LOCKED" ? "locked" : ""} ${ep.status !== "LOCKED" ? "inProgress" : ""}`}
                    onClick={() => setSelectedEpisode(ep.episodeNumber)}
                  >
                    <div className="episodeItemLeft">
                      <span className="episodeNumber">第{ep.episodeNumber}集</span>
                      <span className="episodeTitle">{ep.title}</span>
                    </div>
                    <div className="episodeItemRight">
                      {ep.score && (
                        <span className={`episodeScoreBadge ${ep.score.total >= 90 ? "pass" : "fail"}`}>
                          {ep.score.total}分
                        </span>
                      )}
                      <span className={`episodeStatus status${ep.status}`}>
                        {ep.status === "LOCKED" ? "已锁定" : ep.status === "REVISION" ? "修订中" : ep.status === "IN_REVIEW" ? "审核中" : "草稿"}
                      </span>
                      {ep.version > 1 && <span className="revisionBadge">v{ep.version}</span>}
                      {ep.status === "LOCKED" && (
                        <button className="iconBtnMini" onClick={(e) => { e.stopPropagation(); void unlockEpisode(ep.episodeNumber); }} title="解锁重新审查">
                          <Lock size={12} />
                        </button>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (() => {
              const ep = projectDetail.episodes.find((e) => e.episodeNumber === selectedEpisode);
              if (!ep) return <div className="emptyState">未找到该集</div>;
              return (
                <div className="episodeDetail">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <button className="backBtn" onClick={() => setSelectedEpisode(null)}>
                      <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> 返回列表
                    </button>
                    <button className="maxBtn" onClick={() => setFullscreen({ title: ep.title, content: ep.content })} title="全屏查看">
                      <Maximize2 size={16} />
                    </button>
                  </div>
                  <div className="fileMeta">
                    <span className="fileType">{ep.status}</span>
                    <span className="fileDate">v{ep.version}</span>
                  </div>
                  <pre className="fileContent">{ep.content}</pre>
                  {ep.score && (
                    <div className="scoreBreakdown">
                      <h4>评分详情 {ep.score.total >= 90 ? "✅ 通过" : "❌ 未通过"}</h4>
                      <div className="scoreGrid2">
                        <ScoreBar label="冲突强度" value={ep.score.conflict} />
                        <ScoreBar label="逻辑完整性" value={ep.score.logic} />
                        <ScoreBar label="节奏控制" value={ep.score.pacing} />
                        <ScoreBar label="人物一致性" value={ep.score.characterConsistency} />
                        <ScoreBar label="商业潜力" value={ep.score.commercialPotential} />
                        <ScoreBar label="原创指数" value={ep.score.originality} />
                      </div>
                      {ep.score.suggestions.length > 0 && (
                        <div className="scoreSuggestions">
                          <h4>修改建议</h4>
                          {ep.score.suggestions.map((s, i) => (
                            <div key={i} className="scoreSuggestion">{i + 1}. {s}</div>
                          ))}
                        </div>
                      )}
                      {ep.status !== "LOCKED" && ep.version >= 3 && (
                        <div className="deadlockWarning">
                          已修订 {ep.version} 次仍未通过。你可以强制锁定此集或继续修订。
                          <button onClick={() => { void forceLockEpisode(ep.episodeNumber); }}>强制锁定</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="emptyPreview"><p>加载中...</p></div>
        )}
      </aside>

      {/* Fullscreen Reader */}
      {fullscreen && (
        <div className="fsOverlay" onClick={() => setFullscreen(null)}>
          <div className="fsContent" onClick={(e) => e.stopPropagation()}>
            <div className="fsHeader">
              <h2>{fullscreen.title}</h2>
              <button className="iconBtn" onClick={() => setFullscreen(null)}><X size={18} /></button>
            </div>
            <pre className="fsBody">{fullscreen.content}</pre>
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {showNewProject && (
        <div className="modalOverlay" onClick={() => setShowNewProject(false)}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <h3>新建项目</h3>
              <button className="iconBtn" onClick={() => setShowNewProject(false)}><X size={16} /></button>
            </div>
            <div className="modalBody">
              <label>项目名称</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="如：甜宠逆袭之电竞女王" onKeyDown={(e) => { if (e.key === "Enter") { void createProject(); } }} />
              <label>题材（可选）</label>
              <input value={newGenre} onChange={(e) => setNewGenre(e.target.value)} placeholder="如：甜宠逆袭" />
            </div>
            <div className="modalFooter">
              <button className="secondaryBtn" onClick={() => setShowNewProject(false)}>取消</button>
              <button onClick={() => { void createProject(); }} disabled={!newName.trim()}>创建项目</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───

function PlanSection({ title, data, isArray, onMaximize }: { title: string; data: Record<string, unknown> | Record<string, unknown>[]; isArray?: boolean; onMaximize: (title: string, content: string) => void }) {
  const actuallyArray = isArray || Array.isArray(data);
  const isEmpty = actuallyArray ? (Array.isArray(data) ? data.length : 0) === 0 : Object.keys(data as Record<string, unknown>).length === 0;
  const [open, setOpen] = useState(!isEmpty);

  useEffect(() => {
    if (!isEmpty) setOpen(true);
  }, [isEmpty]);

  const fullContent = JSON.stringify(data, null, 2);

  return (
    <div className="planSection">
      <div className="planSectionHeader" onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {!isEmpty && (
            <button className="maxBtn" onClick={(e) => { e.stopPropagation(); onMaximize(title, fullContent); }} title="全屏查看">
              <Maximize2 size={14} />
            </button>
          )}
          <span className="planSectionStatus">{isEmpty ? "待完善" : open ? "收起" : "展开"}</span>
        </div>
      </div>
      {open && (
        <div className="planSectionBody">
          {isEmpty ? (
            <p className="planHint">此部分尚未填写，在对话中与编剧小Q讨论完善。</p>
          ) : (isArray || Array.isArray(data)) ? (
            <div className="planFields">
              {(Array.isArray(data) ? data : []).map((item, i) => (
                <div key={i} className="planCard">
                  <div className="planCardIndex">{item.episodeNumber ? `第${item.episodeNumber}集` : item.name ? String(item.name) : `#${i + 1}`}</div>
                  <div className="planCardBody">
                    {Object.entries(item).filter(([k]) => !["episodeNumber", "name"].includes(k) || !item.episodeNumber).map(([k, v]) => (
                      <div key={k} className="planField">
                        <span className="planFieldLabel">{k}</span>
                        <span className="planFieldValue">
                          {typeof v === "string" ? v : Array.isArray(v) ? v.map((x, j) => <div key={j} className="planFieldNested">{typeof x === "object" ? JSON.stringify(x) : String(x)}</div>) : JSON.stringify(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="planFields">
              {Object.entries(data as Record<string, unknown>).map(([k, v]) => (
                <div key={k} className="planField">
                  <span className="planFieldLabel">{fieldLabel(k)}</span>
                  <span className="planFieldValue">
                    {Array.isArray(v)
                      ? v.map((x, j) => <div key={j} className="planFieldNested">{typeof x === "object" ? JSON.stringify(x, null, 1) : String(x)}</div>)
                      : typeof v === "object" && v !== null
                        ? <pre className="planFieldJson">{JSON.stringify(v, null, 2)}</pre>
                        : String(v)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function fieldLabel(key: string): string {
  const labels: Record<string, string> = {
    logline: "Logline", theme: "主题", externalConflict: "外部冲突", internalConflict: "内部冲突",
    relationshipConflict: "关系冲突", emotionalHook: "情感钩子", chosenPath: "创作路径",
    setting: "背景设定", rules: "世界规则", powerStructure: "权力结构", hiddenInfo: "隐藏信息",
    tone: "基调", targetAudience: "目标受众", competitiveAnalysis: "差异化分析",
    risks: "风险点", coreSellingPoint: "核心卖点", promotionAngles: "宣发角度",
    paths: "创作路径选项", traits: "特征", surfaceDesire: "表面欲望", deepNeed: "真正需求",
    fear: "软肋/恐惧", arc: "角色弧线", signatureLine: "代表台词", relationships: "关系",
    role: "角色定位", age: "年龄", coreEvent: "核心事件", hook: "钩子",
    emotionalPeak: "情绪高点", infoRevealed: "揭示信息", subplotProgress: "支线进展",
    title: "标题",
  };
  return labels[key] ?? key;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 90 ? "var(--accent)" : value >= 70 ? "#b45309" : "#dc2626";
  return (
    <div className="scoreBar">
      <div className="scoreBarLabel">{label}</div>
      <div className="scoreBarTrack">
        <div className="scoreBarFill" style={{ width: `${value}%`, background: color }} />
      </div>
      <div className="scoreBarValue" style={{ color }}>{value}</div>
    </div>
  );
}
