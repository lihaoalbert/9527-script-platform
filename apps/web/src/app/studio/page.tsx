"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot, Shield, Send, LoaderCircle, Sparkles, Plus, FileText,
  User, ChevronRight, X, CheckCircle2, Lock, ArrowRight, Trash2, FolderOpen,
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

const API = "http://127.0.0.1:4000";

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
  const [rightView, setRightView] = useState<"plan" | "episode" | "scores">("plan");
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null);

  // Modal
  const [showNewProject, setShowNewProject] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGenre, setNewGenre] = useState("");

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
      const res = await fetch(`${API}/studio/projects?ownerId=demo-user-1`);
      if (res.ok) setProjects(await res.json());
    } catch (e) { console.error(e); }
  }

  async function selectProject(id: string) {
    setActiveProjectId(id);
    try {
      const [detailRes, msgRes] = await Promise.all([
        fetch(`${API}/studio/projects/${id}`),
        fetch(`${API}/studio/projects/${id}/messages?limit=50`),
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
      const res = await fetch(`${API}/studio/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), genre: newGenre.trim() || undefined, ownerId: "demo-user-1" }),
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
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API}/studio/projects/${activeProjectId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, targetPersona: activePersona }),
      });
      if (res.ok) {
        const { userMessage, aiMessage } = await res.json();
        setMessages((prev) => [...prev, userMessage, aiMessage]);
        // Refresh project detail (plan may have updated)
        const detailRes = await fetch(`${API}/studio/projects/${activeProjectId}`);
        if (detailRes.ok) setProjectDetail(await detailRes.json());
      }
    } catch (e) {
      setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: "SYSTEM", content: `Error: ${e}`, phase: null, step: null, decision: null, createdAt: new Date().toISOString() }]);
    } finally {
      setLoading(false);
    }
  }

  async function advanceStep() {
    if (!activeProjectId) return;
    try {
      const res = await fetch(`${API}/studio/projects/${activeProjectId}/advance`, { method: "POST" });
      if (res.ok) {
        const d = await selectProject(activeProjectId);
      }
    } catch (e) { console.error(e); }
  }

  async function lockPlan() {
    if (!activeProjectId) return;
    try {
      const res = await fetch(`${API}/studio/projects/${activeProjectId}/lock-plan`, { method: "POST" });
      if (res.ok) {
        await selectProject(activeProjectId);
        setRightView("episode");
      }
    } catch (e) { console.error(e); }
  }

  async function forceLockEpisode(epNum: number) {
    if (!activeProjectId) return;
    try {
      await fetch(`${API}/studio/projects/${activeProjectId}/episodes/${epNum}/force-lock`, { method: "POST" });
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
              <button
                key={p.id}
                className={`projectListItem ${p.id === activeProjectId ? "active" : ""}`}
                onClick={() => { void selectProject(p.id); }}
              >
                <div className="projectItemTop">
                  <span className="projectItemName">{p.name}</span>
                  <span className={`projectStatus status${p.status}`}>{p.status === "PLANNING" ? "规划中" : p.status === "EPISODES" ? "生成中" : p.status === "COMPLETED" ? "已完成" : "已归档"}</span>
                </div>
                <div className="projectItemMeta">
                  <span>{PHASE_LABELS[p.currentPhase] ?? p.currentPhase}</span>
                  {p.episodeCount > 0 && <span>· {p.episodeCount}集</span>}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Phase progress for active project */}
        {projectDetail && isPlanning && (
          <div className="phaseProgress">
            <div className="phaseLabel">创作进度</div>
            <div className="phaseSteps">
              {PHASE_STEPS.map((step, i) => (
                <div key={step} className={`phaseStep ${i < currentPhaseIndex ? "done" : i === currentPhaseIndex ? "current" : ""}`}>
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

        {projectDetail && isEpisodes && (
          <div className="phaseProgress">
            <div className="phaseLabel">分集进度</div>
            <div className="episodeMiniList">
              {projectDetail.episodes.map((ep) => (
                <button
                  key={ep.episodeNumber}
                  className={`episodeMiniItem ${ep.status === "LOCKED" ? "locked" : ""} ${selectedEpisode === ep.episodeNumber ? "active" : ""}`}
                  onClick={() => { setSelectedEpisode(ep.episodeNumber); setRightView("episode"); }}
                >
                  <span>第{ep.episodeNumber}集</span>
                  {ep.status === "LOCKED" ? <Lock size={12} /> : <LoaderCircle size={12} className="spin" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* Middle Panel — Chat */}
      <main className="studioMiddle">
        <div className="chatHeader">
          <div className="roleSelector">
            <button
              className={`roleBtn ${activePersona === "writer" ? "active" : ""}`}
              onClick={() => setActivePersona("writer")}
              style={{ "--role-color": WRITER_PERSONA.color } as React.CSSProperties}
            >
              {WRITER_PERSONA.avatar}
              {WRITER_PERSONA.name}
            </button>
            <button
              className={`roleBtn ${activePersona === "reviewer" ? "active" : ""}`}
              onClick={() => setActivePersona("reviewer")}
              style={{ "--role-color": REVIEWER_PERSONA.color } as React.CSSProperties}
            >
              {REVIEWER_PERSONA.avatar}
              {REVIEWER_PERSONA.name}
            </button>
          </div>
          {projectDetail && (
            <div className="phaseIndicator">
              {PHASE_LABELS[projectDetail.currentPhase] ?? projectDetail.currentPhase}
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
                  <LoaderCircle size={16} className="spin" /> 思考中...
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chatInput">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={activeProjectId ? `向${activePersona === "writer" ? WRITER_PERSONA.name : REVIEWER_PERSONA.name}描述你的想法...` : "先选择或创建一个项目"}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); }
            }}
            disabled={!activeProjectId}
          />
          <button onClick={() => { void sendMessage(); }} disabled={loading || !input.trim() || !activeProjectId}>
            <Send size={18} />
          </button>
        </div>
      </main>

      {/* Right Panel — Plan / Episode View */}
      <aside className="studioRight">
        {!projectDetail ? (
          <div className="emptyPreview">
            <FileText size={48} />
            <p>选择左侧项目查看详情</p>
          </div>
        ) : rightView === "plan" && projectDetail.plan ? (
          <div className="planView">
            <div className="rightHeader">
              <h2>项目规划书</h2>
              {projectDetail.plan.lockedAt && <span className="lockedBadge"><Lock size={12} /> 已锁定</span>}
            </div>
            <div className="planSections">
              <PlanSection title="故事内核" data={projectDetail.plan.storyKernel} />
              <PlanSection title="世界观构建" data={projectDetail.plan.worldBuilding} />
              <PlanSection title="人物塑造" data={projectDetail.plan.characters} isArray />
              <PlanSection title="分集大纲" data={projectDetail.plan.episodeOutlines} isArray />
              <PlanSection title="制作要点" data={projectDetail.plan.productionNotes} />
            </div>
          </div>
        ) : rightView === "episode" ? (
          <div className="episodeView">
            <div className="rightHeader">
              <h2>
                {selectedEpisode ? `第${selectedEpisode}集` : "分集列表"}
              </h2>
            </div>
            {!selectedEpisode ? (
              <div className="episodeList">
                {projectDetail.episodes.map((ep) => (
                  <button
                    key={ep.episodeNumber}
                    className={`episodeItem ${ep.status === "LOCKED" ? "locked" : ""}`}
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
                    </div>
                  </button>
                ))}
              </div>
            ) : (() => {
              const ep = projectDetail.episodes.find((e) => e.episodeNumber === selectedEpisode);
              if (!ep) return <div className="emptyState">未找到该集</div>;
              return (
                <div className="episodeDetail">
                  <button className="backBtn" onClick={() => setSelectedEpisode(null)}>
                    <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> 返回列表
                  </button>
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

function PlanSection({ title, data, isArray }: { title: string; data: Record<string, unknown> | Record<string, unknown>[]; isArray?: boolean }) {
  const [open, setOpen] = useState(false);
  const isEmpty = isArray ? (data as unknown[]).length === 0 : Object.keys(data as Record<string, unknown>).length === 0;

  return (
    <div className="planSection">
      <button className="planSectionHeader" onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span className="planSectionStatus">{isEmpty ? "待完善" : open ? "收起" : "展开"}</span>
      </button>
      {open && (
        <div className="planSectionBody">
          {isEmpty ? (
            <p className="planHint">此部分尚未填写，在对话中与编剧小Q讨论完善。</p>
          ) : (
            <pre className="planJson">{JSON.stringify(data, null, 2)}</pre>
          )}
        </div>
      )}
    </div>
  );
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
