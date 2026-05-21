"use client";

import { useState, useRef, useEffect } from "react";
import {
  Folder,
  FileText,
  Settings,
  Send,
  LoaderCircle,
  Bot,
  User,
  Sparkles,
  ChevronRight,
  Plus,
  MoreHorizontal,
  Shield,
  X,
} from "lucide-react";

// Types
type Message = {
  id: string;
  role: "user" | "writer" | "reviewer" | "system";
  content: string;
  timestamp: Date;
};

type ProjectFile = {
  id: string;
  name: string;
  type: "outline" | "script" | "score" | "note";
  content: string;
  updatedAt: Date;
};

type Project = {
  id: string;
  name: string;
  files: ProjectFile[];
  activeFileId: string | null;
};

// Writer AI persona
const WRITER_PERSONA = {
  role: "writer",
  name: "编剧小Q",
  avatar: <Bot size={20} />,
  color: "#0f766e",
  systemPrompt: `你是一个专业的短剧编剧，擅长创作高反转、情绪拉满的剧情。你的风格是：
- 开场即冲突，三分钟内进入主冲突
- 每集结尾留下强悬念钩子
- 人物性格鲜明，对白简洁有力
- 善于制造信息差和身份反转

请用JSON格式回复：
{
  "content": "生成的剧本内容",
  "title": "可选的标题"
}`,
};

// Reviewer AI persona
const REVIEWER_PERSONA = {
  role: "reviewer",
  name: "审核官",
  avatar: <Shield size={20} />,
  color: "#b45309",
  systemPrompt: `你是一个资深剧本审核官，专门挑剔剧本问题。你的风格是：
- 严格指出剧情漏洞和逻辑问题
- 质疑人物行为动机
- 指出节奏拖沓的地方
- 评估商业潜力和观众留存率
- 提出具体的修改建议

请直接用犀利的中文回复，不要客气。`,
};

export default function StudioV2Page() {
  // Project state
  const [project, setProject] = useState<Project>({
    id: "demo-project",
    name: "我的剧本项目",
    files: [],
    activeFileId: null,
  });

  // Chat state
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "system",
      content: "欢迎来到AI剧本创作工作室！编剧小Q和审核官已就位。你可以：\n1. 描述你的剧本设定\n2. 让编剧生成大纲/正文\n3. 审核官会挑剔问题\n4. 你可以随时修改对话中的内容\n\n开始创作吧！",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeRole, setActiveRole] = useState<"writer" | "reviewer">("writer");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message to AI
  async function sendMessage(content: string) {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Call API based on active role
      const endpoint = activeRole === "writer" ? "/ai/generate-script" : "/ai/review";
      const res = await fetch(`http://127.0.0.1:4000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre: "甜宠逆袭",
          premise: content,
          protagonist: "女主",
          targetWords: 5000,
          episodes: 12,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const aiMessage: Message = {
          id: `${activeRole}-${Date.now()}`,
          role: activeRole,
          content: typeof data === "string" ? data : data.content || JSON.stringify(data, null, 2),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);

        // Save to project files if it's a script
        if (activeRole === "writer" && data.title) {
          saveToProject(data.title, "script", data.content || String(data));
        }
      } else {
        throw new Error("API error");
      }
    } catch (e) {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "system",
        content: `生成失败，请重试。错误: ${e}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }

  // Save content to project files
  function saveToProject(name: string, type: ProjectFile["type"], content: string) {
    const newFile: ProjectFile = {
      id: `file-${Date.now()}`,
      name,
      type,
      content,
      updatedAt: new Date(),
    };
    setProject((prev) => ({
      ...prev,
      files: [...prev.files, newFile],
      activeFileId: newFile.id,
    }));
  }

  // Select active file
  function selectFile(fileId: string) {
    const file = project.files.find((f) => f.id === fileId);
    if (file) {
      setProject((prev) => ({ ...prev, activeFileId: fileId }));
    }
  }

  // Get file icon
  function getFileIcon(type: ProjectFile["type"]) {
    switch (type) {
      case "outline":
        return <FileText size={16} />;
      case "script":
        return <FileText size={16} />;
      case "score":
        return <Shield size={16} />;
      default:
        return <FileText size={16} />;
    }
  }

  const activeFile = project.files.find((f) => f.id === project.activeFileId);

  return (
    <div className="studioV2">
      {/* Left Panel - Navigation */}
      <aside className="studioLeft">
        <div className="leftHeader">
          <h2>项目</h2>
          <button className="iconBtn"><Plus size={16} /></button>
        </div>

        <div className="projectName">
          <Folder size={16} />
          <span>{project.name}</span>
        </div>

        <div className="fileList">
          <div className="fileListHeader">文件</div>
          {project.files.length === 0 ? (
            <div className="emptyFiles">
              <FileText size={16} />
              <span>暂无文件</span>
              <span className="fileHint">AI生成后自动保存</span>
            </div>
          ) : (
            project.files.map((file) => (
              <button
                key={file.id}
                className={`fileItem ${project.activeFileId === file.id ? "active" : ""}`}
                onClick={() => selectFile(file.id)}
              >
                {getFileIcon(file.type)}
                <span className="fileName">{file.name}</span>
                <ChevronRight size={14} className="fileArrow" />
              </button>
            ))
          )}
        </div>

        <div className="leftFooter">
          <button className="configBtn">
            <Settings size={16} />
            <span>配置</span>
          </button>
        </div>
      </aside>

      {/* Middle Panel - Chat */}
      <main className="studioMiddle">
        <div className="chatHeader">
          <div className="roleSelector">
            <button
              className={`roleBtn ${activeRole === "writer" ? "active" : ""}`}
              onClick={() => setActiveRole("writer")}
              style={{ "--role-color": WRITER_PERSONA.color } as React.CSSProperties}
            >
              <Bot size={16} />
              {WRITER_PERSONA.name}
            </button>
            <button
              className={`roleBtn ${activeRole === "reviewer" ? "active" : ""}`}
              onClick={() => setActiveRole("reviewer")}
              style={{ "--role-color": REVIEWER_PERSONA.color } as React.CSSProperties}
            >
              <Shield size={16} />
              {REVIEWER_PERSONA.name}
            </button>
          </div>
        </div>

        <div className="chatMessages">
          {messages.map((msg) => {
            const persona = msg.role === "writer" ? WRITER_PERSONA : msg.role === "reviewer" ? REVIEWER_PERSONA : null;
            return (
              <div key={msg.id} className={`message ${msg.role}`}>
                {persona && (
                  <div className="messageAvatar" style={{ background: persona.color }}>
                    {persona.avatar}
                  </div>
                )}
                {msg.role === "user" && (
                  <div className="messageAvatar userAvatar">
                    <User size={16} />
                  </div>
                )}
                {msg.role === "system" && (
                  <div className="messageAvatar systemAvatar">
                    <Sparkles size={16} />
                  </div>
                )}
                <div className="messageContent">
                  {persona && <div className="messageName">{persona.name}</div>}
                  <div className="messageText">{msg.content}</div>
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="message loading">
              <div className="messageAvatar" style={{ background: activeRole === "writer" ? WRITER_PERSONA.color : REVIEWER_PERSONA.color }}>
                {activeRole === "writer" ? <Bot size={16} /> : <Shield size={16} />}
              </div>
              <div className="messageContent">
                <div className="messageName">{activeRole === "writer" ? WRITER_PERSONA.name : REVIEWER_PERSONA.name}</div>
                <div className="messageText loading">
                  <LoaderCircle size={16} className="spin" />
                  思考中...
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
            placeholder={`向${activeRole === "writer" ? WRITER_PERSONA.name : REVIEWER_PERSONA.name}描述你的想法...`}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input);
              }
            }}
          />
          <button onClick={() => void sendMessage(input)} disabled={loading || !input.trim()}>
            <Send size={18} />
          </button>
        </div>
      </main>

      {/* Right Panel - Result */}
      <aside className="studioRight">
        <div className="rightHeader">
          <h2>{activeFile ? activeFile.name : "结果展示"}</h2>
          {activeFile && (
            <button className="iconBtn" onClick={() => setProject((p) => ({ ...p, activeFileId: null }))}>
              <X size={16} />
            </button>
          )}
        </div>

        {activeFile ? (
          <div className="filePreview">
            <div className="fileMeta">
              <span className="fileType">{activeFile.type}</span>
              <span className="fileDate">{activeFile.updatedAt.toLocaleTimeString()}</span>
            </div>
            <pre className="fileContent">{activeFile.content}</pre>
          </div>
        ) : (
          <div className="emptyPreview">
            <FileText size={48} />
            <p>选择左侧文件预览</p>
            <p className="hint">或者让AI生成新内容</p>
          </div>
        )}
      </aside>
    </div>
  );
}