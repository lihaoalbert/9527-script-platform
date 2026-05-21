"use client";

import { useEffect, useState } from "react";
import { Users, BookOpen, Wallet, Bot, Settings } from "lucide-react";

type Script = {
  id: string;
  title: string;
  status: string;
  authorId: string;
  wordCount: number;
};

type User = {
  id: string;
  userId: string;
  balance: number;
};

type TabKey = "users" | "scripts" | "credits" | "ai";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("users");
  const [scripts, setScripts] = useState<Script[]>([]);
  const [users, setUsers] = useState<User[]>([
    { id: "1", userId: "demo-user-1", balance: 1200 },
    { id: "2", userId: "demo-user-2", balance: 900 },
    { id: "3", userId: "demo-buyer-1", balance: 600 },
  ]);
  const [loading, setLoading] = useState(false);

  const tabs: Array<{ key: TabKey; label: string; icon: typeof Users }> = [
    { key: "users", label: "用户管理", icon: Users },
    { key: "scripts", label: "剧本审核", icon: BookOpen },
    { key: "credits", label: "积分流水", icon: Wallet },
    { key: "ai", label: "AI配置", icon: Bot },
  ];

  useEffect(() => {
    if (activeTab === "scripts") {
      void fetch("http://127.0.0.1:4000/scripts")
        .then((r) => r.ok ? r.json() : null)
        .then((data) => data && setScripts(data))
        .catch(console.error);
    }
  }, [activeTab]);

  const statusLabels: Record<string, string> = {
    DRAFT: "草稿",
    PENDING_REVIEW: "待审核",
    PUBLISHED: "已发布",
    LOCKED: "已锁定",
    IN_USE: "使用中",
    SOLD: "已售出",
  };

  return (
    <div>
      <header className="topbar">
        <div>
          <span className="eyebrow">后台管理</span>
          <h1>系统管理后台</h1>
        </div>
      </header>

      <div className="adminTabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`adminTab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="adminContent">
        {activeTab === "users" && (
          <div className="adminSection">
            <div className="sectionHead">
              <h2>用户列表</h2>
            </div>
            <div className="dataTable">
              <div className="tableHeader">
                <span>用户ID</span>
                <span>余额</span>
                <span>操作</span>
              </div>
              {users.map((user) => (
                <div key={user.id} className="tableRow">
                  <span>{user.userId}</span>
                  <span className="balance">{user.balance}</span>
                  <button className="secondaryBtn">调整积分</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "scripts" && (
          <div className="adminSection">
            <div className="sectionHead">
              <h2>剧本列表</h2>
            </div>
            <div className="dataTable">
              <div className="tableHeader">
                <span>标题</span>
                <span>作者</span>
                <span>字数</span>
                <span>状态</span>
                <span>操作</span>
              </div>
              {scripts.map((script) => (
                <div key={script.id} className="tableRow">
                  <span className="scriptTitle">{script.title}</span>
                  <span>{script.authorId}</span>
                  <span>{Math.round(script.wordCount / 1000)}k</span>
                  <span className="statusBadge">{statusLabels[script.status] ?? script.status}</span>
                  <button className="secondaryBtn">审核</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "credits" && (
          <div className="adminSection">
            <div className="sectionHead">
              <h2>积分流水</h2>
            </div>
            <div className="emptyState">
              <Wallet size={18} />
              暂无积分流水记录
            </div>
          </div>
        )}

        {activeTab === "ai" && (
          <div className="adminSection">
            <div className="sectionHead">
              <h2>AI 配置</h2>
            </div>
            <div className="panel">
              <div className="configGrid">
                <div className="configItem">
                  <label>AI 提供商</label>
                  <span>MiniMax</span>
                </div>
                <div className="configItem">
                  <label>模型</label>
                  <span>MiniMax-M2.7</span>
                </div>
                <div className="configItem">
                  <label>大纲费用</label>
                  <span>20 积分/次</span>
                </div>
                <div className="configItem">
                  <label>生成费用</label>
                  <span>50 积分/次</span>
                </div>
                <div className="configItem">
                  <label>评分费用</label>
                  <span>10 积分/次</span>
                </div>
                <div className="configItem">
                  <label>状态</label>
                  <span className="statusActive">运行中</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}