type DemoScript = {
  id: string;
  title: string;
  genre?: string;
  content: string;
  wordCount: number;
  status: string;
  aiScore?: number;
  authorId: string;
  lockedById?: string;
  lockedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

type DemoCreditAccount = {
  userId: string;
  balance: number;
};

type DemoCreditTransaction = {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  referenceId?: string;
  createdAt: Date;
};

type DemoScriptLock = {
  id: string;
  scriptId: string;
  userId: string;
  status: string;
  createdAt: Date;
};

const now = new Date();

const makeId = () => Math.random().toString(36).slice(2, 10);

export const demoStore = {
  scripts: [
    {
      id: "script_demo_1",
      title: "替嫁后我成了短剧女王",
      genre: "甜宠逆袭",
      content:
        "第一集，婚礼前夜，苏晚被迫代替姐姐出嫁。她以为自己只是棋子，却在踏入顾家那一刻发现，每个人都在等她出错。顾承洲冷眼看着她，提出三个月后离婚的协议。苏晚没有哭，只在协议最后一页加了一句：如果我赢了，这场婚姻由我说了算。第二天清晨，顾家长辈故意在家宴上发难，苏晚却借一场直播反手让顾家品牌热度暴涨，所有人第一次意识到，这个替嫁的新娘并不打算任人摆布。",
      wordCount: 241,
      status: "PUBLISHED",
      aiScore: 88,
      authorId: "demo-user-1",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "script_demo_2",
      title: "消失的第七集",
      genre: "悬疑反转",
      content:
        "林祈收到一部匿名手机，里面只保存着七段视频。前六段记录着她从未经历过的过去，第七段却是一片黑屏，只留下一个时间：今晚十一点。她试图报警，却发现每一个接触过视频的人都在刻意回避她。直到她在废弃影院看到自己的名字出现在放映单上，才意识到，真正消失的不是一集内容，而是她自己曾经存在过的证据。",
      wordCount: 172,
      status: "LOCKED",
      aiScore: 84,
      authorId: "demo-user-2",
      lockedById: "demo-buyer-1",
      lockedAt: now,
      createdAt: now,
      updatedAt: now
    }
  ] as DemoScript[],
  creditAccounts: [
    { userId: "demo-user-1", balance: 1200 },
    { userId: "demo-user-2", balance: 900 },
    { userId: "demo-buyer-1", balance: 600 }
  ] as DemoCreditAccount[],
  creditTransactions: [] as DemoCreditTransaction[],
  scriptLocks: [
    {
      id: "lock_demo_1",
      scriptId: "script_demo_2",
      userId: "demo-buyer-1",
      status: "ACTIVE",
      createdAt: now
    }
  ] as DemoScriptLock[],
  makeId
};
