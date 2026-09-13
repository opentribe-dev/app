import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowLeft, AtSign, Bot, Check, ChevronDown, ChevronRight, CircleHelp, Cpu, Database, Folder, Hash, Inbox, Laptop, LockKeyhole, Menu, MessageCircle, MoreHorizontal, Paperclip, Plus, Radio, Reply, Search, Send, Settings, ShieldCheck, Sparkles, Users, X, Zap } from "lucide-react";
import { gateway } from "./lib/gateway";
import type { Agent, Approval, Conversation, Device, Message, Provider } from "./types";

type Bootstrap = { agents: Agent[]; conversations: Conversation[]; messages: Message[]; providers: Provider[]; approvals: Approval[]; device: Device };
type Panel = "details" | "settings" | null;

export default function App() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [selected, setSelected] = useState("launch");
  const [panel, setPanel] = useState<Panel>("details");
  const [composer, setComposer] = useState("");
  const [replying, setReplying] = useState<Message | null>(null);
  const [creating, setCreating] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [onboarding, setOnboarding] = useState(() => !localStorage.getItem("opencrew:onboarded"));
  const [approvalResults, setApprovalResults] = useState<Record<string, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { gateway.bootstrap().then(setData); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [data?.messages]);

  if (!data) return <Loading />;
  if (onboarding) return <Onboarding onDone={() => { localStorage.setItem("opencrew:onboarded", "1"); setOnboarding(false); }} providers={data.providers} device={data.device} />;

  const conversation = data.conversations.find((item) => item.id === selected) ?? data.conversations[0];
  const activeAgents = data.agents.filter((agent) => conversation.agentIds.includes(agent.id));
  const visibleMessages = data.messages.filter((message) => message.conversationId === conversation.id);

  async function send() {
    const value = composer.trim(); if (!value) return;
    const mine: Message = { id: crypto.randomUUID(), conversationId: conversation.id, author: "you", body: value, time: "Now", replyTo: replying?.id };
    setComposer(""); setReplying(null); setData((current) => current && ({ ...current, messages: [...current.messages, mine] }));
    for await (const streamed of gateway.sendMessage(conversation.id, value)) {
      setData((current) => current && ({ ...current, messages: [...current.messages.filter((message) => message.id !== "stream"), streamed] }));
    }
    setData((current) => current && ({ ...current, messages: current.messages.map((message) => message.id === "stream" ? { ...message, id: crypto.randomUUID(), streaming: false } : message) }));
  }

  async function decide(approval: Approval, decision: "once" | "always" | "deny") {
    await gateway.approve(approval.id, decision); setApprovalResults((current) => ({ ...current, [approval.id]: decision }));
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <div className="brand"><BrandMark /><span>OpenCrew</span><button className="icon-button mobile-only" onClick={() => setMobileNav(false)}><X size={18} /></button></div>
      <button className="search"><Search size={15} /><span>Search</span><kbd>⌘ K</kbd></button>
      <nav className="primary-nav">
        <button><Inbox size={17} /><span>Inbox</span><small>3</small></button>
        <button className="active"><MessageCircle size={17} /><span>Messages</span></button>
        <button><Activity size={17} /><span>Activity</span></button>
      </nav>
      <SidebarSection title="Direct messages" action={() => setCreating(true)}>
        {data.conversations.filter((item) => item.type === "dm").map((item) => <ConversationRow key={item.id} item={item} agents={data.agents} active={selected === item.id} onClick={() => { setSelected(item.id); setMobileNav(false); }} />)}
      </SidebarSection>
      <SidebarSection title="Groups" action={() => undefined}>
        {data.conversations.filter((item) => item.type === "group").map((item) => <ConversationRow key={item.id} item={item} agents={data.agents} active={selected === item.id} onClick={() => { setSelected(item.id); setMobileNav(false); }} />)}
      </SidebarSection>
      <div className="sidebar-footer">
        <button onClick={() => setCreating(true)}><Plus size={17} /><span>New agent</span></button>
        <button onClick={() => setPanel("settings")}><Settings size={17} /><span>Settings</span><i className={data.device.connected ? "device-dot online" : "device-dot"} /></button>
      </div>
    </aside>
    {mobileNav && <button className="scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}

    <main className="conversation">
      <header className="conversation-header">
        <button className="icon-button mobile-only" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
        <div className="conversation-title">{conversation.type === "group" ? <Hash size={18} /> : <Avatar agent={activeAgents[0]} size="small" />}<div><strong>{conversation.name}</strong><span>{conversation.type === "group" ? `${activeAgents.length} agents · you` : activeAgents[0]?.role}</span></div></div>
        <div className="header-actions"><button className="icon-button"><Search size={18} /></button><button className={`icon-button ${panel === "details" ? "selected" : ""}`} onClick={() => setPanel(panel === "details" ? null : "details")}><CircleHelp size={18} /></button><button className="icon-button"><MoreHorizontal size={19} /></button></div>
      </header>

      <section className="message-list">
        <div className="conversation-intro">
          <div className="stacked-avatars">{activeAgents.map((agent) => <Avatar key={agent.id} agent={agent} />)}</div>
          <h1>{conversation.type === "group" ? `# ${conversation.name}` : conversation.name}</h1>
          <p>{conversation.type === "group" ? "A shared room for you and your crew. Mention an agent when you want their attention." : `This is the beginning of your conversation with ${conversation.name}.`}</p>
        </div>
        <div className="date-divider"><span>Today</span></div>
        {visibleMessages.map((message) => <MessageItem key={message.id} message={message} agents={data.agents} allMessages={visibleMessages} onReply={() => setReplying(message)} />)}
        {data.approvals.map((approval) => conversation.agentIds.includes(approval.agentId) && <ApprovalCard key={approval.id} approval={approval} agent={data.agents.find((item) => item.id === approval.agentId)!} result={approvalResults[approval.id]} onDecide={(decision) => decide(approval, decision)} />)}
        <div ref={bottomRef} />
      </section>

      <footer className="composer-wrap">
        {replying && <div className="reply-banner"><Reply size={14} /><span>Replying to <strong>{authorName(replying.author, data.agents)}</strong></span><button onClick={() => setReplying(null)}><X size={14} /></button></div>}
        <div className="composer">
          <textarea value={composer} onChange={(event) => setComposer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder={`Message ${conversation.type === "group" ? "#" : ""}${conversation.name}`} rows={1} />
          <div className="composer-tools"><div><button><Plus size={18} /></button><button><Paperclip size={17} /></button><button><AtSign size={17} /></button></div><span>Shift + Enter for new line</span><button className="send" disabled={!composer.trim()} onClick={() => void send()}><Send size={16} /></button></div>
        </div>
      </footer>
    </main>

    {panel === "details" && <DetailsPanel conversation={conversation} agents={activeAgents} onClose={() => setPanel(null)} />}
    {panel === "settings" && <SettingsPanel providers={data.providers} device={data.device} onClose={() => setPanel(null)} />}
    {creating && <CreateAgent onClose={() => setCreating(false)} onCreate={async (agent) => { const created = await gateway.createAgent(agent); setData((current) => current && ({ ...current, agents: [...current.agents, created], conversations: [...current.conversations, { id: `dm-${created.id}`, name: created.name, type: "dm", agentIds: [created.id], preview: "Ready when you are.", time: "Now" }] })); setCreating(false); }} />}
  </div>;
}

function Onboarding({ onDone, providers, device }: { onDone: () => void; providers: Provider[]; device: Device }) {
  const [step, setStep] = useState(0); const [copied, setCopied] = useState(false);
  const steps = ["Welcome", "Connect", "Provider"];
  return <div className="onboarding">
    <header><div className="brand"><BrandMark /><span>OpenCrew</span></div><button className="text-button" onClick={onDone}>Open demo</button></header>
    <div className="onboarding-body">
      <div className="stepper">{steps.map((label, index) => <div key={label} className={index <= step ? "complete" : ""}><span>{index < step ? <Check size={13} /> : index + 1}</span><em>{label}</em></div>)}</div>
      {step === 0 && <div className="onboarding-card hero-card"><div className="eyebrow">Your crew is waiting</div><h1>Bring your best agents<br />into one conversation.</h1><p>OpenCrew connects models and coding agents you already use. Your local credentials stay on your device.</p><div className="feature-row"><span><MessageCircle size={17} /> Natural conversations</span><span><LockKeyhole size={17} /> Local credentials</span><span><Zap size={17} /> Live runtime activity</span></div><button className="primary-button" onClick={() => setStep(1)}>Set up OpenCrew <ChevronRight size={17} /></button></div>}
      {step === 1 && <div className="onboarding-card"><div className="mini-icon"><Laptop size={22} /></div><h2>Connect this computer</h2><p>Install the local bridge to use Claude Code, Codex, and your workspaces securely.</p><div className="command"><code>curl -fsSL https://opencrew.xyz/install.sh | sh</code><button onClick={() => { void navigator.clipboard?.writeText("curl -fsSL https://opencrew.xyz/install.sh | sh"); setCopied(true); }}><span>{copied ? "Copied" : "Copy"}</span>{copied ? <Check size={15} /> : null}</button></div><div className="detected"><span className="pulse" /><div><strong>{device.name}</strong><small>{device.platform} · agentd connected</small></div><Check size={17} /></div><div className="onboarding-actions"><button className="secondary-button" onClick={() => setStep(0)}>Back</button><button className="primary-button" onClick={() => setStep(2)}>Continue <ChevronRight size={17} /></button></div></div>}
      {step === 2 && <div className="onboarding-card"><div className="mini-icon"><Cpu size={22} /></div><h2>Choose a model provider</h2><p>We found a provider that can be used without entering an API key.</p><div className="provider-choice selected"><div className="provider-logo">A</div><div><strong>Claude Subscription</strong><small>Claude Code detected · Logged in · Subscription available</small></div><span><Check size={14} /></span></div><button className="provider-choice muted"><div className="provider-logo outline">+</div><div><strong>Use an API provider</strong><small>OpenAI, Anthropic, OpenRouter, Gemini, and more</small></div><ChevronRight size={17} /></button><div className="security-note"><ShieldCheck size={16} /><span>Subscription credentials stay local and are never shared with the server.</span></div><div className="onboarding-actions"><button className="secondary-button" onClick={() => setStep(1)}>Back</button><button className="primary-button" onClick={onDone}>Use Claude subscription <Check size={17} /></button></div></div>}
    </div>
    <footer>Open source · Self-hostable · Your data</footer>
  </div>;
}

function MessageItem({ message, agents, allMessages, onReply }: { message: Message; agents: Agent[]; allMessages: Message[]; onReply: () => void }) {
  const agent = agents.find((item) => item.id === message.author); const replied = allMessages.find((item) => item.id === message.replyTo);
  return <article className={`message ${message.streaming ? "streaming" : ""}`}>
    {message.author === "you" ? <div className="avatar user-avatar">Y</div> : <Avatar agent={agent} />}
    <div className="message-content">
      {replied && <div className="reply-reference"><Reply size={12} /><strong>{authorName(replied.author, agents)}</strong><span>{replied.body}</span></div>}
      <div className="message-meta"><strong>{message.author === "you" ? "You" : agent?.name}</strong>{agent && <span className={`status ${agent.status}`} />}{agent && <em>{agent.role}</em>}<time>{message.time}</time></div>
      <p>{renderMentions(message.body, agents)}{message.streaming && <i className="cursor" />}</p>
      {message.activity && <div className="runtime-card"><div className="runtime-icon"><Activity size={16} /></div><div><strong>{message.activity.label}</strong><span>{message.activity.detail}</span></div><div className="runtime-state"><span className="spinner" /> Live</div></div>}
    </div>
    <button className="message-reply" onClick={onReply}><Reply size={15} /></button>
  </article>;
}

function ApprovalCard({ approval, agent, result, onDecide }: { approval: Approval; agent: Agent; result?: string; onDecide: (decision: "once" | "always" | "deny") => void }) {
  return <div className="approval-card"><div className="approval-head"><div className="approval-icon"><ShieldCheck size={18} /></div><div><strong>Permission requested</strong><span>{agent.name} needs your approval</span></div><time>{approval.expiresIn}</time></div><div className="approval-command"><code>{approval.capability}</code><p>{approval.description}</p><span><Folder size={14} /> {approval.workspace}</span></div>{result ? <div className="approval-result"><Check size={16} /> {result === "deny" ? "Request denied" : result === "always" ? "Allowed for this workspace" : "Allowed once"}</div> : <div className="approval-actions"><button onClick={() => onDecide("deny")}>Deny</button><button onClick={() => onDecide("always")}>Always allow</button><button className="approve" onClick={() => onDecide("once")}>Allow once</button></div>}</div>;
}

function DetailsPanel({ conversation, agents, onClose }: { conversation: Conversation; agents: Agent[]; onClose: () => void }) {
  const [tab, setTab] = useState<"people" | "memory">("people"); const [memory, setMemory] = useState(agents[0]?.memory.join("\n") ?? "");
  return <aside className="detail-panel"><header><strong>{conversation.type === "group" ? "Conversation" : "Agent"} details</strong><button className="icon-button" onClick={onClose}><X size={18} /></button></header><div className="detail-tabs"><button className={tab === "people" ? "active" : ""} onClick={() => setTab("people")}>People</button><button className={tab === "memory" ? "active" : ""} onClick={() => setTab("memory")}>Memory</button></div>{tab === "people" ? <div className="details-content">{agents.map((agent) => <div className="agent-profile" key={agent.id}><Avatar agent={agent} size="large" /><h3>{agent.name}</h3><p>{agent.role}</p><span className="online-label"><i className={`status ${agent.status}`} /> {agent.status}</span><div className="profile-grid"><span><Bot size={15} /> Model</span><strong>{agent.model}</strong><span><Cpu size={15} /> Runtime</span><strong>{agent.runtime}</strong>{agent.workspace && <><span><Folder size={15} /> Workspace</span><strong>{agent.workspace}</strong></>}</div></div>)}</div> : <div className="memory-editor"><div className="memory-heading"><Database size={18} /><div><strong>Working memory</strong><span>{agents[0]?.name} uses this across conversations.</span></div></div><textarea value={memory} onChange={(event) => setMemory(event.target.value)} placeholder="Add one memory per line…" /><div className="memory-footer"><span>{memory.split("\n").filter(Boolean).length} memories</span><button>Save memory</button></div><p className="muted-copy">You control what this agent remembers. Conversation history is managed separately.</p></div>}</aside>;
}

function SettingsPanel({ providers, device, onClose }: { providers: Provider[]; device: Device; onClose: () => void }) {
  const [section, setSection] = useState<"providers" | "devices">("providers");
  return <aside className="detail-panel settings-panel"><header><strong>Settings</strong><button className="icon-button" onClick={onClose}><X size={18} /></button></header><div className="settings-nav"><button className={section === "providers" ? "active" : ""} onClick={() => setSection("providers")}><Cpu size={16} /> Providers</button><button className={section === "devices" ? "active" : ""} onClick={() => setSection("devices")}><Laptop size={16} /> Devices</button></div><div className="settings-content">{section === "providers" ? <><div className="section-heading"><div><h3>Model providers</h3><p>Models your agents can use.</p></div><button><Plus size={15} /> Add</button></div>{providers.map((provider) => <div className="setting-row" key={provider.id}><div className="provider-logo small">{provider.name[0]}</div><div><strong>{provider.name}</strong><span>{provider.detail}</span></div>{provider.status === "available" ? <button className="use-button">Use</button> : <span className="connected-label"><Check size={13} /> Connected</span>}</div>)}<div className="local-note"><LockKeyhole size={15} /><span>Local provider credentials never leave agentd.</span></div></> : <><div className="section-heading"><div><h3>Connected devices</h3><p>Computers that can run local agents.</p></div></div><div className="device-card"><div className="device-illustration"><Laptop size={23} /></div><div><strong>{device.name}</strong><span>{device.platform}</span><small><i className="device-dot online" /> Connected now</small></div><MoreHorizontal size={17} /></div><div className="permission-summary"><h4>Default permissions</h4>{[["Workspace read", "Allow"], ["Workspace write", "Ask"], ["Shell commands", "Ask"], ["Git push", "Deny"]].map(([label, value]) => <div key={label}><span>{label}</span><strong className={value.toLowerCase()}>{value}</strong></div>)}</div></>}</div></aside>;
}

function CreateAgent({ onClose, onCreate }: { onClose: () => void; onCreate: (agent: Pick<Agent, "name" | "role" | "model" | "runtime">) => Promise<void> }) {
  const [name, setName] = useState(""); const [role, setRole] = useState(""); const [advanced, setAdvanced] = useState(false); const [model, setModel] = useState("Auto"); const [runtime, setRuntime] = useState("Chat"); const [saving, setSaving] = useState(false);
  return <div className="modal-layer" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><div className="modal"><header><div><span className="eyebrow">New teammate</span><h2>Create an agent</h2><p>Start simple. You can tune everything later.</p></div><button className="icon-button" onClick={onClose}><X size={18} /></button></header><div className="form"><label>Name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Maya" /></label><label>Role<textarea value={role} onChange={(event) => setRole(event.target.value)} placeholder="What should this agent be great at?" /></label><div className="simple-options"><label>Model<select value={model} onChange={(event) => setModel(event.target.value)}><option>Auto</option><option>Claude Sonnet 4</option><option>GPT-5</option><option>Gemini 2.5 Pro</option></select></label><label className="memory-toggle"><span>Memory<strong>Remember useful context</strong></span><input type="checkbox" defaultChecked /><i /></label></div><button className="advanced-toggle" onClick={() => setAdvanced(!advanced)}><ChevronDown size={16} className={advanced ? "rotated" : ""} /> Advanced options</button>{advanced && <div className="advanced-options"><label>Runtime<select value={runtime} onChange={(event) => setRuntime(event.target.value)}><option>Chat</option><option>Claude Code</option><option>Codex</option></select></label><label>Workspace<select><option>No workspace</option><option>opencrew.dev</option></select></label><label>Personality<textarea placeholder="Tone, preferences, and working style…" /></label></div>}</div><footer><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={!name.trim() || !role.trim() || saving} onClick={async () => { setSaving(true); await onCreate({ name, role, model, runtime }); }}>{saving ? "Creating…" : "Create agent"}<Sparkles size={16} /></button></footer></div></div>;
}

function SidebarSection({ title, action, children }: { title: string; action: () => void; children: React.ReactNode }) { return <section className="sidebar-section"><div className="sidebar-label"><span>{title}</span><button onClick={action}><Plus size={14} /></button></div>{children}</section>; }
function ConversationRow({ item, agents, active, onClick }: { item: Conversation; agents: Agent[]; active: boolean; onClick: () => void }) { const agent = agents.find((candidate) => candidate.id === item.agentIds[0]); return <button className={`conversation-row ${active ? "active" : ""}`} onClick={onClick}>{item.type === "dm" ? <Avatar agent={agent} size="tiny" /> : <span className="hash-avatar"><Hash size={14} /></span>}<span>{item.name}</span>{item.unread && <small>{item.unread}</small>}</button>; }
function Avatar({ agent, size = "normal" }: { agent?: Agent; size?: "tiny" | "small" | "normal" | "large" }) { return <div className={`avatar avatar-${size}`} style={{ background: agent?.color ?? "#777" }}>{agent?.initials ?? "?"}{agent && <i className={`status ${agent.status}`} />}</div>; }
function BrandMark() { return <span className="brand-mark"><i /><b /></span>; }
function Loading() { return <div className="loading"><BrandMark /><span>Opening your crew…</span></div>; }
function authorName(id: string, agents: Agent[]) { return id === "you" ? "You" : agents.find((agent) => agent.id === id)?.name ?? "Agent"; }
function renderMentions(body: string, agents: Agent[]) { const names = agents.map((agent) => agent.name); return body.split(/(@\w+)/g).map((part, index) => names.some((name) => part.toLowerCase() === `@${name.toLowerCase()}`) ? <mark key={index}>{part}</mark> : part); }
