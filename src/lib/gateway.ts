import type {
  Agent,
  Approval,
  Conversation,
  Device,
  Message,
  Provider,
} from "../types";

// TODO(CONTRACT): replace this gateway with authenticated /api/v1 resources and the server event stream.
const agents: Agent[] = [
  {
    id: "maya",
    name: "Maya",
    initials: "M",
    role: "Product strategist",
    color: "#ef6045",
    status: "online",
    model: "Claude Sonnet 4",
    runtime: "Chat",
    memoryEnabled: true,
    instructions: "Turn ambiguous product ideas into clear stories, decisions, and next steps.",
    memory: [
      "OpenCrew targets small technical teams.",
      "Prefer concise product briefs.",
      "The v0.1 launch theme is calm, capable software.",
    ],
  },
  {
    id: "linus",
    name: "Linus",
    initials: "L",
    role: "Staff engineer",
    color: "#6e7ee8",
    status: "thinking",
    model: "Auto",
    runtime: "Claude Code",
    workspace: "opencrew.dev",
    memoryEnabled: true,
    instructions: "Work carefully in the repository, explain important tradeoffs, and verify every change.",
    memory: [
      "Use Go for local services.",
      "Keep the self-hosted stack to one process.",
    ],
  },
  {
    id: "noa",
    name: "Noa",
    initials: "N",
    role: "Research partner",
    color: "#25a878",
    status: "online",
    model: "GPT-5",
    runtime: "Chat",
    memoryEnabled: true,
    instructions: "Use reliable evidence, cite primary sources, and separate facts from inference.",
    memory: ["Cite primary sources."],
  },
  {
    id: "patch",
    name: "Patch",
    initials: "P",
    role: "QA engineer",
    color: "#c08732",
    status: "offline",
    model: "Auto",
    runtime: "Codex",
    workspace: "opencrew.dev",
    memoryEnabled: false,
    instructions: "Look for regressions, unclear states, and edge cases before a release ships.",
    memory: [],
  },
];

const conversations: Conversation[] = [
  {
    id: "launch",
    name: "launch-room",
    type: "group",
    agentIds: ["maya", "linus", "noa"],
    unread: 3,
    preview: "Maya drafted the positioning…",
    time: "2m",
  },
  {
    id: "maya-dm",
    name: "Maya",
    type: "dm",
    agentIds: ["maya"],
    preview: "I can turn that into a brief.",
    time: "24m",
  },
  {
    id: "engineering",
    name: "engineering",
    type: "group",
    agentIds: ["linus", "patch"],
    preview: "Runtime checks passed.",
    time: "1h",
  },
  {
    id: "noa-dm",
    name: "Noa",
    type: "dm",
    agentIds: ["noa"],
    preview: "Three sources look reliable.",
    time: "Tue",
  },
];

const messages: Message[] = [
  {
    id: "m1",
    conversationId: "launch",
    author: "you",
    body: "We need a launch plan that feels useful, not loud. @Maya can you frame the story?",
    time: "9:41",
  },
  {
    id: "m2",
    conversationId: "launch",
    author: "maya",
    body: "The strongest story is ownership: your agents, your data, your machines. We can show that through one simple arc — install, invite your crew, start working.",
    time: "9:42",
    replyTo: "m1",
  },
  {
    id: "m3",
    conversationId: "launch",
    author: "linus",
    body: "The install path is shaping up. I’m checking runtime detection and the service health flow now.",
    time: "9:43",
    activity: {
      label: "Running checks",
      detail: "opencrew doctor · 7 of 8 complete",
      state: "running",
    },
  },
  {
    id: "m4",
    conversationId: "launch",
    author: "noa",
    body: "I’ll collect examples of products that explain local-first without making the user learn infrastructure vocabulary.",
    time: "9:44",
  },
];

const providers: Provider[] = [
  {
    id: "claude-sub",
    name: "Claude Subscription",
    detail: "Claude Code detected · logged in",
    status: "available",
    local: true,
  },
  {
    id: "openai",
    name: "OpenAI",
    detail: "••••••••F9a2 · tested 4m ago",
    status: "connected",
  },
  {
    id: "ollama",
    name: "Ollama",
    detail: "Local · 127.0.0.1:11434",
    status: "connected",
    local: true,
  },
];

const approvals: Approval[] = [
  {
    id: "a1",
    conversationId: "launch",
    agentId: "linus",
    capability: "shell.run",
    description: "Run the app production build",
    workspace: "~/Code/opencrew.dev",
    requestedAt: "9:45",
    expiresIn: "4:52",
  },
];
const device: Device = {
  id: "local-device",
  name: "This computer",
  platform: "Detected locally",
  connected: true,
  lastSeen: "Now",
};

const delay = (ms = 160) => new Promise((resolve) => setTimeout(resolve, ms));

function localDevice(): Device {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes("win")) {
    return { ...device, name: "This Windows PC", platform: "Windows" };
  }
  if (platform.includes("mac")) {
    return { ...device, name: "This Mac", platform: "macOS" };
  }
  if (platform.includes("linux")) {
    return { ...device, name: "This Linux computer", platform: "Linux" };
  }
  return device;
}

export const gateway = {
  async bootstrap() {
    await delay();
    return {
      agents: agents.map((agent) => ({ ...agent, memory: [...agent.memory] })),
      conversations: conversations.map((conversation) => ({ ...conversation, agentIds: [...conversation.agentIds] })),
      messages: messages.map((message) => ({ ...message })),
      providers: providers.map((provider) => ({ ...provider })),
      approvals: approvals.map((approval) => ({ ...approval })),
      device: localDevice(),
    };
  },
  async createAgent(
    input: Pick<
      Agent,
      "name" | "role" | "model" | "runtime" | "workspace"
    > & {
      memoryEnabled?: boolean;
      instructions?: string;
    },
  ): Promise<Agent> {
    await delay(260);
    const { memoryEnabled = true, instructions, ...agent } = input;
    const created: Agent = {
      id: crypto.randomUUID(),
      initials: agent.name.slice(0, 1).toUpperCase(),
      color: "#7857d8",
      status: "online",
      memoryEnabled,
      instructions,
      memory: [],
      ...agent,
    };
    agents.push(created);
    return created;
  },
  async updateAgent(
    id: string,
    input: Partial<
      Pick<
        Agent,
        | "name"
        | "role"
        | "model"
        | "runtime"
        | "workspace"
        | "instructions"
        | "memoryEnabled"
        | "memory"
      >
    >,
  ): Promise<Agent> {
    await delay(220);
    const current = agents.find((agent) => agent.id === id);
    if (!current) throw new Error("Agent not found");
    const updated = {
      ...current,
      ...input,
      initials: input.name?.slice(0, 1).toUpperCase() ?? current.initials,
    };
    agents.splice(agents.indexOf(current), 1, updated);
    return updated;
  },
  async approve(_id: string, _decision: "once" | "always" | "deny") {
    await delay(180);
    return true;
  },
  async dismissApproval(id: string) {
    await delay(120);
    const index = approvals.findIndex((approval) => approval.id === id);
    if (index !== -1) approvals.splice(index, 1);
    return true;
  },
  async *sendMessage(
    conversationId: string,
    body: string,
    preferredAgentId?: string,
  ): AsyncGenerator<Message> {
    await delay(350);
    const conversation = conversations.find((item) => item.id === conversationId);
    const mentionedAgent = agents.find((agent) =>
      body.toLowerCase().includes(`@${agent.name.toLowerCase()}`),
    );
    const respondingAgent =
      mentionedAgent ??
      agents.find((agent) => agent.id === preferredAgentId) ??
      agents.find((agent) => conversation?.agentIds.includes(agent.id)) ??
      agents[0];
    const answer = body.toLowerCase().includes("launch")
      ? "I’ll turn this into a focused launch checklist with owners, dependencies, and a clear first milestone."
      : "Got it. I’ll take the next pass and keep the work visible here as it progresses.";
    let current = "";
    for (const word of answer.split(" ")) {
      current += (current ? " " : "") + word;
      await delay(42);
      yield {
        id: "stream",
        conversationId,
        author: respondingAgent.id,
        body: current,
        time: "Now",
        streaming: true,
      };
    }
  },
};
