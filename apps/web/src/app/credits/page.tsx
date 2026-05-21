"use client";

import { useEffect, useState } from "react";
import { WalletCards, ArrowDownLeft, ArrowUpRight, Clock } from "lucide-react";

type CreditAccount = {
  userId: string;
  balance: number;
};

type Transaction = {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
};

export default function CreditsPage() {
  const [account, setAccount] = useState<CreditAccount | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCredits() {
      try {
        const res = await fetch("http://127.0.0.1:4000/credits/demo-user-1");
        if (res.ok) {
          const data = await res.json();
          setAccount({ userId: data.userId, balance: data.balance });
          setTransactions(data.transactions || []);
        }
      } catch (e) {
        console.error("Failed to load credits:", e);
      }
      setLoading(false);
    }
    void loadCredits();
  }, []);

  return (
    <div>
      <header className="topbar">
        <div>
          <span className="eyebrow">积分管理</span>
          <h1>我的积分账户</h1>
        </div>
      </header>

      <div className="creditsLayout">
        <div className="creditMain">
          <div className="creditCard">
            <div className="creditIcon">
              <WalletCards size={32} />
            </div>
            <div className="creditBalance">
              <span className="creditLabel">当前余额</span>
              <strong>{loading ? "..." : account?.balance ?? 0}</strong>
              <span className="creditUnit">积分</span>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 20 }}>
            <h3>积分说明</h3>
            <ul className="cleanList">
              <li>AI 生成大纲消耗 20 积分/次</li>
              <li>AI 生成剧本消耗 50 积分/次</li>
              <li>AI 评分消耗 10 积分/次</li>
              <li>锁定剧本消耗 100 积分/部</li>
            </ul>
          </div>
        </div>

        <div className="creditSide">
          <div className="panel">
            <h3>交易记录</h3>
            {transactions.length > 0 ? (
              <div className="transactionList">
                {transactions.map((tx) => (
                  <div key={tx.id} className="transactionItem">
                    <div className={`txIcon ${tx.amount >= 0 ? "positive" : "negative"}`}>
                      {tx.amount >= 0 ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                    </div>
                    <div className="txInfo">
                      <strong>{tx.reason}</strong>
                      <span><Clock size={12} /> {new Date(tx.createdAt).toLocaleString("zh-CN")}</span>
                    </div>
                    <span className={`txAmount ${tx.amount >= 0 ? "positive" : "negative"}`}>
                      {tx.amount >= 0 ? "+" : ""}{tx.amount}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="emptyState">
                <WalletCards size={18} />
                暂无交易记录
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}