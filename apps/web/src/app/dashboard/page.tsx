"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../auth-context";
import { authFetch } from "../auth-context";
import { Sparkles, BookOpen, WalletCards, FolderOpen, Plus, ArrowRight, Clock } from "lucide-react";

type ProjectSummary = {
  id: string; name: string; genre: string | null; status: string;
  currentPhase: string; episodeCount: number; updatedAt: string;
};

type ScriptItem = {
  id: string; title: string; status: string; wordCount: number; aiScore?: number | null;
};

const PHASE_LABELS: Record<string, string> = {
  STORY_KERNEL: "故事内核", WORLD_BUILDING: "世界观构建", CHARACTERS: "人物塑造",
  EPISODE_OUTLINES: "分集大纲", PRODUCTION_NOTES: "制作要点", EPISODE_GENERATION: "分集生成",
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [scripts, setScripts] = useState<ScriptItem[]>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [pRes, sRes, cRes] = await Promise.all([
          authFetch("/api/studio/projects"),
          authFetch("/api/scripts"),
          authFetch("/api/credits"),
        ]);
        if (pRes.ok) setProjects(await pRes.json());
        if (sRes.ok) setScripts(await sRes.json());
        if (cRes.ok) setCredits((await cRes.json()).balance);
      } catch { /* ignore */ }
      setLoading(false);
    }
    void load();
  }, []);

  const activeProjects = projects.filter((p) => p.status !== "ARCHIVED");
  const completedProjects = projects.filter((p) => p.status === "COMPLETED");

  return (
    <div>
      <header className="topbar">
        <div>
          <h1>{user ? `${user.name}的工作台` : "工作台"}</h1>
          <p>{user?.email}</p>
        </div>
      </header>

      {/* Stats */}
      <div className="metrics">
        <article>
          <strong>{loading ? "..." : activeProjects.length}</strong>
          <span>进行中的项目</span>
        </article>
        <article>
          <strong>{loading ? "..." : completedProjects.length}</strong>
          <span>已完成项目</span>
        </article>
        <article>
          <strong>{loading ? "..." : scripts.length}</strong>
          <span>剧本库</span>
        </article>
        <article>
          <strong>{loading ? "..." : credits ?? 0}</strong>
          <span>当前积分</span>
        </article>
      </div>

      {/* Quick actions */}
      <section style={{ marginTop: 24 }}>
        <div className="sectionHead">
          <h2>快速开始</h2>
        </div>
        <div className="quickActions">
          <Link href="/studio" className="actionCard">
            <div className="actionIcon" style={{ background: "var(--accent)" + "20", color: "var(--accent)" }}>
              <Plus size={24} />
            </div>
            <div className="actionText">
              <strong>新建项目</strong>
              <p>在 Studio 中开始新的剧本创作</p>
            </div>
            <ArrowRight size={20} className="actionArrow" />
          </Link>
          <Link href="/scripts" className="actionCard">
            <div className="actionIcon" style={{ background: "#b4530920", color: "#b45309" }}>
              <BookOpen size={24} />
            </div>
            <div className="actionText">
              <strong>剧本库</strong>
              <p>浏览和管理已提交的剧本</p>
            </div>
            <ArrowRight size={20} className="actionArrow" />
          </Link>
          <Link href="/credits" className="actionCard">
            <div className="actionIcon" style={{ background: "#0f766e20", color: "#0f766e" }}>
              <WalletCards size={24} />
            </div>
            <div className="actionText">
              <strong>积分管理</strong>
              <p>查看余额和交易记录</p>
            </div>
            <ArrowRight size={20} className="actionArrow" />
          </Link>
        </div>
      </section>

      {/* Recent projects */}
      <section style={{ marginTop: 28 }}>
        <div className="sectionHead">
          <h2>最近项目</h2>
          <Link href="/studio" className="secondaryBtn" style={{ textDecoration: "none", fontSize: 13 }}>
            全部 <ArrowRight size={14} />
          </Link>
        </div>
        {activeProjects.length > 0 ? (
          <div className="recentList">
            {activeProjects.slice(0, 5).map((p) => (
              <Link key={p.id} href={`/studio`} className="recentItem"
                onClick={(e) => { e.preventDefault(); window.location.href = "/studio"; }}>
                <div>
                  <strong>{p.name}</strong>
                  <p>
                    <span style={{ marginRight: 8 }}>
                      {p.status === "PLANNING" ? "规划中" : p.status === "EPISODES" ? "分集生成中" : p.status}
                    </span>
                    <span>{PHASE_LABELS[p.currentPhase] ?? p.currentPhase}</span>
                    {p.episodeCount > 0 && <span> · {p.episodeCount}集</span>}
                  </p>
                </div>
                <span className={p.status === "EPISODES" ? "tag locked" : "tag"}>
                  {p.status === "PLANNING" ? "规划" : p.status === "EPISODES" ? "创作" : p.status}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="emptyState">
            <FolderOpen size={24} />
            <div>
              <p>还没有项目</p>
              <Link href="/studio" style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>
                去 Studio 创建第一个项目
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* Recent scripts */}
      <section style={{ marginTop: 28 }}>
        <div className="sectionHead">
          <h2>剧本库</h2>
          <Link href="/scripts" className="secondaryBtn" style={{ textDecoration: "none", fontSize: 13 }}>
            全部 <ArrowRight size={14} />
          </Link>
        </div>
        {scripts.length > 0 ? (
          <div className="recentList">
            {scripts.slice(0, 5).map((s) => (
              <Link key={s.id} href={`/scripts?id=${s.id}`} className="recentItem">
                <div>
                  <strong>{s.title}</strong>
                  <p>
                    {Math.max(1, Math.round(s.wordCount / 1000))}k字
                    {s.aiScore && <span> · AI评分 {s.aiScore}</span>}
                  </p>
                </div>
                <span className={s.status === "LOCKED" ? "tag locked" : "tag"}>
                  {s.status === "PUBLISHED" ? "可锁定" : s.status === "LOCKED" ? "已锁定" : s.status}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="emptyState">
            <BookOpen size={24} />
            <p>暂无剧本，项目完成后可提交到剧本库</p>
          </div>
        )}
      </section>
    </div>
  );
}
