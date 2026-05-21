"use client";

import { useEffect, useState } from "react";
import { Search, LockKeyhole, Download, LoaderCircle } from "lucide-react";

type ScriptItem = {
  id: string;
  title: string;
  genre?: string;
  status: string;
  wordCount: number;
  aiScore?: number | null;
  createdAt: string;
  updatedAt: string;
};

type PreviewResponse = {
  id: string;
  title: string;
  preview: string;
  previewLength: number;
};

const statusMap: Record<string, string> = {
  PUBLISHED: "可锁定",
  LOCKED: "已锁定",
  DRAFT: "草稿",
  PENDING_REVIEW: "审核中",
  IN_USE: "使用中",
  SOLD: "已售出",
  OFFLINE: "已下架",
  DISPUTED: "争议中",
};

export default function ScriptsPage() {
  const [scripts, setScripts] = useState<ScriptItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState({ list: false, preview: false, lock: "" as string });

  async function loadScripts(query = "") {
    setLoading((l) => ({ ...l, list: true }));
    try {
      const res = await fetch(
        `http://127.0.0.1:4000/scripts${query ? `?q=${encodeURIComponent(query)}` : ""}`
      );
      if (res.ok) {
        const data: ScriptItem[] = await res.json();
        setScripts(data);
        if (!selectedId && data[0]) {
          setSelectedId(data[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to load scripts:", e);
    } finally {
      setLoading((l) => ({ ...l, list: false }));
    }
  }

  async function loadPreview(scriptId: string) {
    setLoading((l) => ({ ...l, preview: true }));
    try {
      const res = await fetch(`http://127.0.0.1:4000/scripts/${scriptId}/preview`);
      setPreview(await res.json());
    } catch (e) {
      console.error("Failed to load preview:", e);
    } finally {
      setLoading((l) => ({ ...l, preview: false }));
    }
  }

  async function handleLock(scriptId: string) {
    setLoading((l) => ({ ...l, lock: scriptId }));
    try {
      await fetch(`http://127.0.0.1:4000/scripts/${scriptId}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "demo-buyer-1" }),
      });
      await loadScripts(search);
    } catch (e) {
      console.error("Failed to lock script:", e);
    } finally {
      setLoading((l) => ({ ...l, lock: "" }));
    }
  }

  useEffect(() => {
    void loadScripts();
  }, []);

  useEffect(() => {
    if (selectedId) {
      void loadPreview(selectedId);
    }
  }, [selectedId]);

  return (
    <div>
      <header className="topbar">
        <div>
          <span className="eyebrow">剧本库</span>
          <h1>剧本浏览与管理</h1>
        </div>
      </header>

      <div className="searchRow" style={{ marginBottom: 20 }}>
        <label className="searchBox" style={{ flex: 1, maxWidth: 400 }}>
          <Search size={16} />
          <input
            placeholder="搜索题材、标题、作者"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button className="secondaryBtn" onClick={() => void loadScripts(search)}>
          {loading.list ? <LoaderCircle size={16} className="spin" /> : <Search size={16} />}
          搜索
        </button>
      </div>

      <div className="libraryGrid">
        <div className="scriptList">
          {scripts.map((script) => (
            <article
              key={script.id}
              className={`scriptRow ${script.id === selectedId ? "selected" : ""}`}
              onClick={() => setSelectedId(script.id)}
            >
              <div>
                <h3>{script.title}</h3>
                <p>
                  {script.genre ?? "未分类"} · {Math.max(1, Math.round(script.wordCount / 1000))}k字
                </p>
              </div>
              <span className={script.status === "LOCKED" ? "tag locked" : "tag"}>
                {statusMap[script.status] ?? script.status}
              </span>
              <button
                className="iconBtn"
                aria-label="锁定剧本"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleLock(script.id);
                }}
                disabled={script.status === "LOCKED" || loading.lock === script.id}
              >
                {loading.lock === script.id ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <LockKeyhole size={17} />
                )}
              </button>
              <button className="iconBtn" aria-label="下载剧本" disabled>
                <Download size={17} />
              </button>
            </article>
          ))}
          {scripts.length === 0 && !loading.list && (
            <div className="emptyState">暂无剧本</div>
          )}
        </div>

        <div className="previewCard">
          <div className="panelTitle">
            <div>
              <span className="eyebrow">试读</span>
              <h3>{preview?.title ?? "请选择剧本"}</h3>
            </div>
            {loading.preview && <LoaderCircle size={16} className="spin" />}
          </div>
          <p className="previewMeta">展示前 10% 或最多 1000 字</p>
          <div className="previewBody">
            {preview?.preview ?? "选中左侧剧本后，这里会显示试读内容。"}
          </div>
        </div>
      </div>
    </div>
  );
}