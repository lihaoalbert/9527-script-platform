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

type DemoProject = {
  id: string;
  name: string;
  genre: string | null;
  status: string;
  currentPhase: string;
  ownerId: string;
  planLockedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type DemoProjectPlan = {
  id: string;
  projectId: string;
  storyKernel: Record<string, unknown>;
  worldBuilding: Record<string, unknown>;
  characters: Record<string, unknown>[];
  episodeOutlines: Record<string, unknown>[];
  productionNotes: Record<string, unknown>;
  version: number;
  lockedAt: Date | null;
};

type DemoConversationMessage = {
  id: string;
  projectId: string;
  role: string;
  content: string;
  phase: string | null;
  step: number | null;
  decision: Record<string, unknown> | null;
  createdAt: Date;
};

const now = new Date();

const makeId = () => Math.random().toString(36).slice(2, 10);

let idCounter = 0;
const nextId = () => `${makeId()}-${++idCounter}`;

export const demoStore = {
  scripts: [] as DemoScript[],
  creditAccounts: [] as DemoCreditAccount[],
  creditTransactions: [] as DemoCreditTransaction[],
  scriptLocks: [] as DemoScriptLock[],
  projects: [] as DemoProject[],
  projectPlans: [] as DemoProjectPlan[],
  conversationMessages: [] as DemoConversationMessage[],
  makeId,
  nextId,
  now: () => new Date(),
};
