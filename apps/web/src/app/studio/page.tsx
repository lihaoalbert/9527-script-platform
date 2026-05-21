"use client";

import { useState } from "react";
import { Bot, Sparkles, CheckCircle2, LoaderCircle, ArrowRight } from "lucide-react";

type OutlineResponse = {
  provider: string;
  titleOptions: string[];
  outline: string[];
  nextSteps: string[];
};

type GeneratedScript = {
  provider: string;
  title: string;
  summary: string;
  targetWords: number;
  episodes: number;
  tone: string;
  protagonist: string;
  characters: string[];
  episodeBeats: Array<{ episode: number; title: string; hook: string }>;
  content: string;
};

type ScoreResponse = {
  total: number;
  conflict: number;
  logic: number;
  pacing: number;
  commercialPotential: number;
  aiRate: number;
  suggestions: string[];
};

const creationSteps = [
  { key: "brief", label: "设定输入" },
  { key: "outline", label: "大纲建议" },
  { key: "draft", label: "草案生成" },
  { key: "score", label: "评分润色" },
];

const promptPresets = [
  { title: "甜宠逆袭", genre: "甜宠逆袭", protagonist: "苏晚", tone: "高反转、情绪拉满", premise: "女主替姐姐进入豪门婚约，在被全家轻视的局面中一步步翻盘" },
  { title: "悬疑反转", genre: "悬疑反转", protagonist: "林祈", tone: "都市悬疑、强信息差", premise: "匿名手机里的第七段视频，逐步揭开女主被人为抹去的人生" },
  { title: "重生复仇", genre: "重生复仇", protagonist: "沈知遥", tone: "狠节奏、冷反击", premise: "女主重生回商业联姻前夜，带着前世记忆逐一反杀背叛者" },
];

const initialForm = {
  genre: "甜宠逆袭",
  premise: "女主替姐姐进入豪门婚约，在被全家轻视的局面中一步步翻盘",
  protagonist: "苏晚",
  tone: "高反转、情绪拉满",
  targetWords: 18000,
  episodes: 12,
};

export default function StudioPage() {
  const [form, setForm] = useState(initialForm);
  const [outline, setOutline] = useState<OutlineResponse | null>(null);
  const [generated, setGenerated] = useState<GeneratedScript | null>(null);
  const [score, setScore] = useState<ScoreResponse | null>(null);
  const [loading, setLoading] = useState({ outline: false, generate: false, score: false, save: false });
  const [message, setMessage] = useState({ type: "", text: "" });

  const activeStep = score ? "score" : generated ? "draft" : outline ? "outline" : "brief";
  const currentStepIndex = creationSteps.findIndex((s) => s.key === activeStep);

  async function handleOutline() {
    setLoading((l) => ({ ...l, outline: true }));
    setMessage({ type: "", text: "" });
    try {
      const res = await fetch("http://127.0.0.1:4000/ai/outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genre: form.genre, premise: form.premise }),
      });
      setOutline(await res.json());
    } catch (e) {
      setMessage({ type: "error", text: "AI大纲生成失败" });
    } finally {
      setLoading((l) => ({ ...l, outline: false }));
    }
  }

  async function handleGenerate() {
    setLoading((l) => ({ ...l, generate: true }));
    setMessage({ type: "", text: "" });
    try {
      const res = await fetch("http://127.0.0.1:4000/ai/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setGenerated(await res.json());
      setScore(null);
    } catch (e) {
      setMessage({ type: "error", text: "AI草案生成失败" });
    } finally {
      setLoading((l) => ({ ...l, generate: false }));
    }
  }

  async function handleScore(content?: string) {
    if (!content) return;
    setLoading((l) => ({ ...l, score: true }));
    setMessage({ type: "", text: "" });
    try {
      const res = await fetch("http://127.0.0.1:4000/ai/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      setScore(await res.json());
    } catch (e) {
      setMessage({ type: "error", text: "AI评分失败" });
    } finally {
      setLoading((l) => ({ ...l, score: false }));
    }
  }

  async function handleSaveDraft() {
    if (!generated) return;
    setLoading((l) => ({ ...l, save: true }));
    try {
      await fetch("http://127.0.0.1:4000/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: generated.title, genre: form.genre, content: generated.content, authorId: "demo-user-1" }),
      });
      setMessage({ type: "success", text: "剧本已保存到剧本库" });
    } catch (e) {
      setMessage({ type: "error", text: "保存失败" });
    } finally {
      setLoading((l) => ({ ...l, save: false }));
    }
  }

  function applyPreset(preset: typeof promptPresets[0]) {
    setForm({ genre: preset.genre, premise: preset.premise, protagonist: preset.protagonist, tone: preset.tone, targetWords: 18000, episodes: 12 });
  }

  return (
    <div>
      <header className="topbar">
        <div>
          <span className="eyebrow">AI创作工作室</span>
          <h1>剧本创作全流程</h1>
        </div>
      </header>

      {message.text && (
        <div className={`notice ${message.type}`}>{message.text}</div>
      )}

      <div className="studioGrid">
        <aside className="studioRail">
          <div className="panel railPanel">
            <h3>创作阶段</h3>
            <div className="stageList">
              {creationSteps.map((step, index) => (
                <div key={step.key} className={`stageItem ${index === currentStepIndex ? "current" : index < currentStepIndex ? "done" : ""}`}>
                  <div className="stageIndex">
                    {index < currentStepIndex ? <CheckCircle2 size={16} /> : <span>{index + 1}</span>}
                  </div>
                  <div>
                    <strong>{step.label}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel railPanel">
            <h3>快速预设</h3>
            <div className="presetList">
              {promptPresets.map((preset) => (
                <button key={preset.title} className="presetCard" onClick={() => applyPreset(preset)}>
                  <strong>{preset.title}</strong>
                  <span>{preset.premise.slice(0, 40)}...</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="studioMain">
          <div className="panel studioPanel">
            <div className="panelTitle">
              <div>
                <span className="eyebrow">Step 1</span>
                <h3>项目 Brief</h3>
              </div>
              <span className="miniBadge">为漫剧 / 短剧优化</span>
            </div>

            <div className="formGrid">
              <label>题材<input value={form.genre} onChange={(e) => setForm((f) => ({ ...f, genre: e.target.value }))} /></label>
              <label>主角名<input value={form.protagonist} onChange={(e) => setForm((f) => ({ ...f, protagonist: e.target.value }))} /></label>
              <label className="fullSpan">核心设定<textarea rows={4} value={form.premise} onChange={(e) => setForm((f) => ({ ...f, premise: e.target.value }))} /></label>
              <label>风格<input value={form.tone} onChange={(e) => setForm((f) => ({ ...f, tone: e.target.value }))} /></label>
              <label>目标字数<input type="number" min={10000} max={30000} step={1000} value={form.targetWords} onChange={(e) => setForm((f) => ({ ...f, targetWords: Number(e.target.value) }))} /></label>
              <label>集数<input type="number" min={6} max={30} value={form.episodes} onChange={(e) => setForm((f) => ({ ...f, episodes: Number(e.target.value) }))} /></label>
            </div>

            <div className="actionRow">
              <button className="secondaryBtn" onClick={() => void handleOutline()} disabled={loading.outline}>
                {loading.outline ? <LoaderCircle size={16} className="spin" /> : <Bot size={16} />}
                生成大纲
              </button>
              <button onClick={() => void handleGenerate()} disabled={loading.generate}>
                {loading.generate ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}
                一键生成
              </button>
            </div>
          </div>

          <div className="panel studioPanel">
            <div className="panelTitle">
              <div>
                <span className="eyebrow">Step 2</span>
                <h3>结构建议</h3>
              </div>
              <span className="miniBadge">{outline?.provider ?? "等待生成"}</span>
            </div>
            {outline ? (
              <>
                <div className="chipRow">
                  {outline.titleOptions.map((t) => <span key={t} className="chip">{t}</span>)}
                </div>
                <ul className="cleanList">
                  {outline.outline.map((o, i) => <li key={i}>{o}</li>)}
                </ul>
                <div className="nextActionStrip">
                  {outline.nextSteps.map((s, i) => <span key={i}>{s}</span>)}
                </div>
              </>
            ) : (
              <div className="emptyState">
                <Bot size={18} />
                生成大纲后显示标题方向和情节骨架
              </div>
            )}
          </div>
        </div>

        <aside className="studioOutput">
          <div className="panel outputPanel">
            <div className="panelTitle">
              <div>
                <span className="eyebrow">Step 3</span>
                <h3>草案编辑器</h3>
              </div>
              <span className="miniBadge">{generated?.provider ?? "未生成"}</span>
            </div>
            {generated ? (
              <>
                <div className="draftHeader">
                  <strong>{generated.title}</strong>
                  <p>{generated.summary}</p>
                  <div className="statRow">
                    <span>{generated.episodes} 集</span>
                    <span>{generated.targetWords} 字</span>
                  </div>
                </div>
                <div className="miniColumns">
                  <div>
                    <h4>人物</h4>
                    <ul className="cleanList">
                      {generated.characters.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h4>分集钩子</h4>
                    <ul className="cleanList">
                      {generated.episodeBeats.slice(0, 4).map((b) => <li key={b.episode}>第{b.episode}集：{b.hook}</li>)}
                    </ul>
                  </div>
                </div>
                <div className="draftEditor">
                  <div className="editorHead">
                    <h4>正文</h4>
                    <div className="actionRow compact">
                      <button className="secondaryBtn" onClick={() => void handleScore(generated.content)} disabled={loading.score}>
                        {loading.score ? <LoaderCircle size={16} className="spin" /> : <Bot size={16} />}
                        AI评分
                      </button>
                      <button onClick={() => void handleSaveDraft()} disabled={loading.save}>
                        {loading.save ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}
                        保存
                      </button>
                    </div>
                  </div>
                  <textarea rows={12} value={generated.content} onChange={(e) => setGenerated((g) => g ? { ...g, content: e.target.value } : g)} />
                </div>
              </>
            ) : (
              <div className="emptyState tall">
                <Sparkles size={18} />
                点击「一键生成」获取剧本草案
              </div>
            )}
          </div>

          <div className="panel outputPanel">
            <div className="panelTitle">
              <div>
                <span className="eyebrow">Step 4</span>
                <h3>评分结果</h3>
              </div>
            </div>
            {score ? (
              <>
                <div className="scoreHero">
                  <strong>{score.total}</strong>
                  <span>综合评分</span>
                </div>
                <div className="scoreGrid">
                  <span>冲突 {score.conflict}</span>
                  <span>逻辑 {score.logic}</span>
                  <span>节奏 {score.pacing}</span>
                  <span>商业潜力 {score.commercialPotential}</span>
                  <span>AI率 {score.aiRate}%</span>
                </div>
                <ul className="cleanList">
                  {score.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </>
            ) : (
              <div className="emptyState">
                <ArrowRight size={18} />
                生成草案后进行评分
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}