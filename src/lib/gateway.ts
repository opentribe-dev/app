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
    agentId: "linus",
    capability: "shell.run",
    description: "Run the app production build",
    workspace: "~/Code/opencrew.dev",
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
      agents,
      conversations,
      messages,
      providers,
      approvals,
      device: localDevice(),
    };
  },
  async createAgent(
    input: Pick<
      Agent,
      "name" | "role" | "model" | "runtime" | "workspace"
    > & {
      memoryEnabled?: boolean;
      personality?: string;
    },
  ): Promise<Agent> {
    await delay(260);
    const { memoryEnabled = true, personality, ...agent } = input;
    return {
      id: crypto.randomUUID(),
      initials: agent.name.slice(0, 1).toUpperCase(),
      color: "#7857d8",
      status: "online",
      memory: memoryEnabled && personality ? [personality] : [],
      ...agent,
    };
  },
  async approve(_id: string, _decision: "once" | "always" | "deny") {
    await delay(180);
    return true;
  },
  async *sendMessage(
    conversationId: string,
    body: string,
  ): AsyncGenerator<Message> {
    await delay(350);
    const conversation = conversations.find((item) => item.id === conversationId);
    const mentionedAgent = agents.find((agent) =>
      body.toLowerCase().includes(`@${agent.name.toLowerCase()}`),
    );
    const respondingAgent =
      mentionedAgent ??
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
