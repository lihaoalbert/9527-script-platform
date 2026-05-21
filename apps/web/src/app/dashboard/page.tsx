"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, BookOpen, WalletCards, ArrowRight, CheckCircle2 } from "lucide-react";

type ScriptItem = {
  id: string;
  title: string;
  status: string;
  wordCount: number;
  aiScore?: number | null;
};

type CreditAccount = {
  userId: string;
  balance: number;
};

const creationSteps = [
  { key: "brief", label: "设定输入", desc: "先定题材、角色与目标字数" },
  { key: "outline", label: "大纲建议", desc: "AI 先出标题方向与情节骨架" },
  { key: "draft", label: "草案生成", desc: "形成可编辑的正文草案与分集钩子" },
  { key: "score", label: "评分润色", desc: "看冲突、逻辑、AI 率并继续改写" },
];

const quickActions = [
  {
    href: "/studio",
    icon: Sparkles,
    label: "AI 创作",
    desc: "开始一个新的剧本创作",
    color: "var(--accent)",
  },
  {
    href: "/scripts",
    icon: BookOpen,
    label: "剧本库",
    desc: "浏览和管理已有剧本",
    color: "#b45309",
  },
  {
    href: "/credits",
    icon: WalletCards,
    label: "积分管理",
    desc: "查看余额和交易记录",
    color: "#0f766e",
  },
];

export default function DashboardPage() {
  const [scripts, setScripts] = useState<ScriptItem[]>([]);
  const [credits, setCredits] = useState<CreditAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const scriptsRes = await fetch("http://127.0.0.1:4000/scripts");
        if (scriptsRes.ok) {
          setScripts(await scriptsRes.json());
        }
      } catch (e) {
        console.error("Failed to load scripts:", e);
      }
      try {
        const creditsRes = await fetch("http://127.0.0.1:4000/credits/demo-user-1");
        if (creditsRes.ok) {
          const creditData = await creditsRes.json();
          setCredits({ userId: creditData.userId, balance: creditData.balance });
        }
      } catch (e) {
        console.error("Failed to load credits:", e);
      }
      setLoading(false);
    }
    void loadData();
  }, []);

  const availableScripts = scripts.filter((s) => s.status === "PUBLISHED");

  return (
    <div>
      <header className="topbar">
        <div>
          <span className="eyebrow">9527剧本平台 · 工作台</span>
          <h1>欢迎回来，创作者</h1>
          <p>从这里开始你的剧本创作之旅</p>
        </div>
      </header>

      <section className="heroGrid">
        <article className="heroCard">
          <div className="heroCopy">
            <span className="eyebrow">AI 创作流程</span>
            <h2>四步完成剧本创作</h2>
            <p>从设定输入到 AI 评分，每一步都清晰可控。</p>
          </div>
          <div className="heroFlow">
            {creationSteps.map((step, index) => (
              <div className="flowItem active" key={step.key}>
                <strong>0{index + 1}</strong>
                <span>{step.label}</span>
              </div>
            ))}
          </div>
        </article>

        <div className="metrics">
          <article>
            <strong>{scripts.length}</strong>
            <span>剧本总量</span>
          </article>
          <article>
            <strong>{availableScripts.length}</strong>
            <span>可锁定剧本</span>
          </article>
          <article>
            <strong>18000</strong>
            <span>目标字数</span>
          </article>
          <article>
            <strong>{loading ? "..." : credits?.balance ?? 0}</strong>
            <span>当前积分</span>
          </article>
        </div>
      </section>

      <section>
        <div className="sectionHead">
          <div>
            <span className="eyebrow">快捷入口</span>
            <h2>快速开始</h2>
          </div>
        </div>
        <div className="quickActions">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href} className="actionCard">
              <div
                className="actionIcon"
                style={{ background: action.color + "20", color: action.color }}
              >
                <action.icon size={24} />
              </div>
              <div className="actionText">
                <strong>{action.label}</strong>
                <p>{action.desc}</p>
              </div>
              <ArrowRight size={20} className="actionArrow" />
            </Link>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 24 }}>
        <div className="sectionHead">
          <div>
            <span className="eyebrow">最近活动</span>
            <h2>创作状态</h2>
          </div>
        </div>
        {scripts.length > 0 ? (
          <div className="recentList">
            {scripts.slice(0, 5).map((script) => (
              <Link
                key={script.id}
                href={`/scripts?id=${script.id}`}
                className="recentItem"
              >
                <div>
                  <strong>{script.title}</strong>
                  <p>
                    {Math.max(1, Math.round(script.wordCount / 1000))}k字 · AI评分{" "}
                    {script.aiScore ?? "--"}
                  </p>
                </div>
                <span className={script.status === "LOCKED" ? "tag locked" : "tag"}>
                  {script.status === "PUBLISHED"
                    ? "可锁定"
                    : script.status === "LOCKED"
                    ? "已锁定"
                    : script.status}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="emptyState">
            <BookOpen size={18} />
            暂无剧本，开始创作你的第一部作品吧
          </div>
        )}
      </section>
    </div>
  );
}