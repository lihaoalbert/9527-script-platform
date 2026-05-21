const { PrismaClient, ScriptLockStatus, ScriptStatus, UserRole } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const now = new Date();

  await prisma.$transaction([
    prisma.scriptUsageLog.deleteMany(),
    prisma.scriptDownload.deleteMany(),
    prisma.scriptComment.deleteMany(),
    prisma.scriptScore.deleteMany(),
    prisma.scriptLock.deleteMany(),
    prisma.creditTransaction.deleteMany(),
    prisma.creditAccount.deleteMany(),
    prisma.script.deleteMany(),
    prisma.aiPrompt.deleteMany(),
    prisma.aiTask.deleteMany(),
    prisma.user.deleteMany()
  ]);

  await prisma.user.createMany({
    data: [
      {
        id: "demo-user-1",
        email: "creator1@9527.local",
        name: "苏晚",
        role: UserRole.CREATOR,
        passwordHash: "seeded-password-hash"
      },
      {
        id: "demo-user-2",
        email: "creator2@9527.local",
        name: "林祈",
        role: UserRole.CREATOR,
        passwordHash: "seeded-password-hash"
      },
      {
        id: "demo-buyer-1",
        email: "buyer1@9527.local",
        name: "顾承洲",
        role: UserRole.BUYER,
        passwordHash: "seeded-password-hash"
      },
      {
        id: "demo-admin-1",
        email: "admin@9527.local",
        name: "运营管理员",
        role: UserRole.ADMIN,
        passwordHash: "seeded-password-hash"
      }
    ]
  });

  await prisma.creditAccount.createMany({
    data: [
      { userId: "demo-user-1", balance: 1200 },
      { userId: "demo-user-2", balance: 900 },
      { userId: "demo-buyer-1", balance: 600 },
      { userId: "demo-admin-1", balance: 5000 }
    ]
  });

  await prisma.creditTransaction.createMany({
    data: [
      {
        userId: "demo-user-1",
        amount: 1200,
        reason: "SEED_INITIAL_BALANCE",
        createdAt: now
      },
      {
        userId: "demo-user-2",
        amount: 900,
        reason: "SEED_INITIAL_BALANCE",
        createdAt: now
      },
      {
        userId: "demo-buyer-1",
        amount: 700,
        reason: "SEED_INITIAL_BALANCE",
        createdAt: now
      },
      {
        userId: "demo-buyer-1",
        amount: -100,
        reason: "LOCK_SCRIPT",
        referenceId: "script_demo_2",
        createdAt: now
      }
    ]
  });

  await prisma.script.createMany({
    data: [
      {
        id: "script_demo_1",
        title: "替嫁后我成了短剧女王",
        genre: "甜宠逆袭",
        tags: ["豪门", "替嫁", "逆袭"],
        summary: "女主替姐姐进入豪门婚约，在被全家轻视的局面中一步步翻盘。",
        content:
          "第一集，婚礼前夜，苏晚被迫代替姐姐出嫁。她以为自己只是棋子，却在踏入顾家那一刻发现，每个人都在等她出错。顾承洲冷眼看着她，提出三个月后离婚的协议。苏晚没有哭，只在协议最后一页加了一句：如果我赢了，这场婚姻由我说了算。第二天清晨，顾家长辈故意在家宴上发难，苏晚却借一场直播反手让顾家品牌热度暴涨，所有人第一次意识到，这个替嫁的新娘并不打算任人摆布。",
        wordCount: 241,
        status: ScriptStatus.PUBLISHED,
        aiScore: 88,
        authorId: "demo-user-1",
        createdAt: now,
        updatedAt: now
      },
      {
        id: "script_demo_2",
        title: "消失的第七集",
        genre: "悬疑反转",
        tags: ["悬疑", "反转", "都市"],
        summary: "匿名手机里的第七段视频，指向女主被人为抹去的人生。",
        content:
          "林祈收到一部匿名手机，里面只保存着七段视频。前六段记录着她从未经历过的过去，第七段却是一片黑屏，只留下一个时间：今晚十一点。她试图报警，却发现每一个接触过视频的人都在刻意回避她。直到她在废弃影院看到自己的名字出现在放映单上，才意识到，真正消失的不是一集内容，而是她自己曾经存在过的证据。",
        wordCount: 172,
        status: ScriptStatus.LOCKED,
        aiScore: 84,
        authorId: "demo-user-2",
        lockedById: "demo-buyer-1",
        lockedAt: now,
        createdAt: now,
        updatedAt: now
      }
    ]
  });

  await prisma.scriptLock.create({
    data: {
      id: "lock_demo_1",
      scriptId: "script_demo_2",
      userId: "demo-buyer-1",
      status: ScriptLockStatus.ACTIVE,
      createdAt: now
    }
  });

  await prisma.scriptScore.createMany({
    data: [
      {
        scriptId: "script_demo_1",
        total: 88,
        conflict: 90,
        logic: 82,
        pacing: 87,
        commercialPotential: 92,
        aiRate: 18,
        suggestions: [
          "第三集加重女主与豪门长辈的正面冲突。",
          "在中段增加情感线误判，拉高追更欲。"
        ],
        createdAt: now
      },
      {
        scriptId: "script_demo_2",
        total: 84,
        conflict: 81,
        logic: 86,
        pacing: 82,
        commercialPotential: 80,
        aiRate: 16,
        suggestions: [
          "尽早交代第七集的倒计时压力。",
          "强化反派视角，提高压迫感。"
        ],
        createdAt: now
      }
    ]
  });

  await prisma.aiPrompt.createMany({
    data: [
      {
        key: "outline-short-drama",
        title: "短剧大纲生成",
        template: "基于题材、核心设定和角色目标，生成 3 段式大纲与下一步建议。"
      },
      {
        key: "generate-short-drama",
        title: "短剧草案生成",
        template: "输出短剧标题、摘要、人物建议、分集钩子和正文试写。"
      },
      {
        key: "score-short-drama",
        title: "短剧 AI 评分",
        template: "对冲突、逻辑、节奏、商业潜力和 AI 率进行评估。"
      }
    ]
  });

  const [userCount, scriptCount, promptCount] = await Promise.all([
    prisma.user.count(),
    prisma.script.count(),
    prisma.aiPrompt.count()
  ]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        users: userCount,
        scripts: scriptCount,
        prompts: promptCount
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
