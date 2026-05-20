import {
  BookOpen,
  Bot,
  Download,
  Gauge,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
  WalletCards
} from "lucide-react";

const scripts = [
  { title: "替嫁后我成了短剧女王", type: "甜宠逆袭", status: "可锁定", score: 88, words: "2.1万字" },
  { title: "重生之商业女帝", type: "重生复仇", status: "审核中", score: 91, words: "2.8万字" },
  { title: "消失的第七集", type: "悬疑反转", status: "已锁定", score: 84, words: "1.7万字" }
];

const workflow = [
  "题材定位",
  "角色设定",
  "大纲生成",
  "分集创作",
  "AI评分",
  "审核上架"
];

export default function HomePage() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brandMark">9527</span>
          <div>
            <strong>剧本平台</strong>
            <small>创作 · 评分 · 运营</small>
          </div>
        </div>
        <nav>
          <a className="active" href="#dashboard"><Gauge size={18} />工作台</a>
          <a href="#scripts"><BookOpen size={18} />剧本库</a>
          <a href="#create"><Sparkles size={18} />AI创作</a>
          <a href="#score"><Bot size={18} />剧本评分</a>
          <a href="#credits"><WalletCards size={18} />积分运营</a>
          <a href="#admin"><ShieldCheck size={18} />后台管理</a>
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <h1>9527剧本平台 MVP</h1>
            <p>把剧本从创作、评分、上架、锁定到下载授权串成一条清晰的业务线。</p>
          </div>
          <button><Sparkles size={18} />新建剧本</button>
        </header>

        <section id="dashboard" className="metrics">
          <article><strong>128</strong><span>剧本总量</span></article>
          <article><strong>36</strong><span>可锁定剧本</span></article>
          <article><strong>421k</strong><span>AI生成字数</span></article>
          <article><strong>18,600</strong><span>积分消耗</span></article>
        </section>

        <section className="grid">
          <div id="scripts" className="panel wide">
            <div className="panelHead">
              <div>
                <h2>剧本管理</h2>
                <p>搜索、试读、独占锁定、下载 txt/md。</p>
              </div>
              <div className="search"><Search size={16} />搜索题材、标题、作者</div>
            </div>
            <div className="scriptList">
              {scripts.map((script) => (
                <article className="scriptRow" key={script.title}>
                  <div>
                    <h3>{script.title}</h3>
                    <p>{script.type} · {script.words} · AI评分 {script.score}</p>
                  </div>
                  <span className={script.status === "已锁定" ? "tag locked" : "tag"}>{script.status}</span>
                  <button className="iconBtn" aria-label="锁定剧本"><LockKeyhole size={17} /></button>
                  <button className="iconBtn" aria-label="下载剧本"><Download size={17} /></button>
                </article>
              ))}
            </div>
          </div>

          <div id="create" className="panel">
            <h2>AI 协作创作</h2>
            <p>按步骤生成 1 万到 3 万字短剧/漫剧剧本，支持一键生成和人工改写。</p>
            <div className="steps">
              {workflow.map((item, index) => (
                <span key={item}>{index + 1}. {item}</span>
              ))}
            </div>
          </div>

          <div id="score" className="panel">
            <h2>AI 评分</h2>
            <p>分析冲突强度、逻辑完整性、AI率、商业潜力和分集钩子。</p>
            <div className="scoreBox">
              <strong>87</strong>
              <span>综合评分</span>
            </div>
          </div>

          <div id="credits" className="panel">
            <h2>积分体系</h2>
            <p>创作奖励积分，锁定和下载剧本消耗积分，所有变更保留流水。</p>
            <ul>
              <li>注册赠送、创作奖励、审核通过奖励</li>
              <li>AI生成、深度评分、独占锁定扣减</li>
              <li>管理员可审核调整积分</li>
            </ul>
          </div>

          <div id="admin" className="panel">
            <h2>运营后台</h2>
            <p>用户、剧本、审核、积分、AI提示词和系统规则统一管理。</p>
            <div className="adminGrid">
              <span>用户管理</span>
              <span>剧本审核</span>
              <span>积分流水</span>
              <span>AI配置</span>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
