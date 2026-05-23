"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import { Sparkles } from "lucide-react";

export default function LoginPage() {
  const { login, register } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      router.push("/studio");
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "var(--bg)",
    }}>
      <div style={{
        background: "var(--panel)", border: "1px solid var(--line)",
        borderRadius: 12, padding: 40, width: 380,
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Sparkles size={32} color="var(--accent)" />
          <h2 style={{ marginTop: 12 }}>9527 剧本平台</h2>
          <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 4 }}>
            {mode === "login" ? "登录你的账号" : "创建新账号"}
          </p>
        </div>

        {error && (
          <div className="notice error" style={{ marginBottom: 16 }}>{error}</div>
        )}

        <form onSubmit={(e) => { void handleSubmit(e); }} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "register" && (
            <div>
              <label style={{ fontSize: 13, fontWeight: 600 }}>昵称</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="你的名字" style={{ marginTop: 4 }} />
            </div>
          )}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600 }}>邮箱</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" style={{ marginTop: 4 }} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600 }}>密码</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="输入密码" style={{ marginTop: 4 }} />
          </div>
          <button type="submit" disabled={loading} style={{ marginTop: 8, justifyContent: "center" }}>
            {loading ? "处理中..." : mode === "login" ? "登录" : "注册"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "var(--muted)" }}>
          {mode === "login" ? "还没有账号？" : "已有账号？"}
          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontWeight: 600, minHeight: "auto", padding: 0, marginLeft: 4 }}
          >
            {mode === "login" ? "注册" : "去登录"}
          </button>
        </p>
      </div>
    </div>
  );
}
