import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Blobatar } from "@blobatar/react";
import {
  Activity,
  AtSign,
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Cpu,
  Database,
  Folder,
  Hash,
  Inbox,
  Laptop,
  LockKeyhole,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Palette,
  Paperclip,
  Plus,
  Reply,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { gateway } from "./lib/gateway";
import type {
  Agent,
  Approval,
  Conversation,
  Device,
  Message,
  Provider,
} from "./types";

type Bootstrap = {
  agents: Agent[];
  conversations: Conversation[];
  messages: Message[];
  providers: Provider[];
  approvals: Approval[];
  device: Device;
};
type Panel = "details" | "settings" | null;
type Toast = { message: string; tone: "info" | "error" };
type AvatarStyle = "blobatar" | "initials";
type View = "messages" | "inbox" | "activity";
type CreateAgentInput = Pick<Agent, "name" | "role" | "model" | "runtime"> & {
  memoryEnabled: boolean;
  workspace?: string;
  personality?: string;
};

const AVATAR_STYLE_KEY = "opencrew:avatar-style";
const AvatarStyleContext = createContext<AvatarStyle>("blobatar");

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Open overlays, oldest first. Escape only ever dismisses the top one, so a
// modal opened from a panel does not close both at once.
const layers: { dismiss: () => void }[] = [];

function useLayer<T extends HTMLElement>(onDismiss: () => void, trap: boolean) {
  const ref = useRef<T>(null);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  // Captured during render: by the time effects run React has already honoured
  // any autoFocus inside the dialog, so the trigger would be lost.
  const restoreTo = useRef<HTMLElement | null>(null);
  if (restoreTo.current === null) {
    restoreTo.current = document.activeElement as HTMLElement | null;
  }
  // Set when this effect (re)runs, so the throwaway cleanup StrictMode performs
  // between the two mount passes does not yank focus back out of the dialog.
  const restoreCancelled = useRef(false);

  useEffect(() => {
    restoreCancelled.current = true;
    const layer = { dismiss: () => dismiss.current() };
    layers.push(layer);
    const focusable = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
      ).filter((element) => element.offsetParent !== null);
    if (trap && !ref.current?.contains(document.activeElement)) {
      (focusable()[0] ?? ref.current)?.focus();
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (layers[layers.length - 1] !== layer) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        layer.dismiss();
        return;
      }
      if (!trap || event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const [first] = items;
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (
        event.shiftKey &&
        (active === first || !ref.current?.contains(active))
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      layers.splice(layers.indexOf(layer), 1);
      if (!trap) return;
      const trigger = restoreTo.current;
      restoreCancelled.current = false;
      // A microtask, not rAF: rAF is throttled to nothing in a hidden tab.
      queueMicrotask(() => {
        if (restoreCancelled.current) return;
        if (trigger && document.contains(trigger)) trigger.focus();
      });
    };
  }, [trap]);

  return ref;
}

const useDialog = (onClose: () => void) =>
  useLayer<HTMLDivElement>(onClose, true);

const isApple = /mac|iphone|ipad/i.test(navigator.userAgent);
const SEARCH_HINT = isApple ? "⌘ K" : "Ctrl K";

export default function App() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [selected, setSelected] = useState("launch");
  const [view, setView] = useState<View>("messages");
  const [panel, setPanel] = useState<Panel>("details");
  const [composer, setComposer] = useState("");
  const [replying, setReplying] = useState<Message | null>(null);
  const [creating, setCreating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const notify = useCallback(
    (message: string, tone: Toast["tone"] = "info") =>
      setToast({ message, tone }),
    [],
  );
  const [mobileNav, setMobileNav] = useState(false);
  const [onboarding, setOnboarding] = useState(
    () => !localStorage.getItem("opencrew:onboarded"),
  );
  const [approvalResults, setApprovalResults] = useState<
    Record<string, string>
  >({});
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyle>(() =>
    localStorage.getItem(AVATAR_STYLE_KEY) === "initials"
      ? "initials"
      : "blobatar",
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const scrolledOnce = useRef(false);

  useEffect(() => {
    gateway.bootstrap().then(setData);
  }, []);
  useEffect(() => {
    const list = bottomRef.current?.parentElement;
    if (!list) return;
    // Landing in a conversation should already be at the bottom; only later
    // messages are worth animating.
    list.scrollTo({
      top: list.scrollHeight,
      behavior: scrolledOnce.current ? "smooth" : "auto",
    });
    scrolledOnce.current = true;
  }, [data?.messages, selected, view]);
  useEffect(() => {
    scrolledOnce.current = false;
  }, [selected]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        // Don't stack search on top of an open dialog.
        if (!layers.length) setSearching(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(
      () => setToast(null),
      toast.tone === "error" ? 5200 : 2800,
    );
    return () => window.clearTimeout(timeout);
  }, [toast]);

  if (!data) return <Loading />;
  if (onboarding)
    return (
      <Onboarding
        onDone={() => {
          localStorage.setItem("opencrew:onboarded", "1");
          setOnboarding(false);
        }}
        providers={data.providers}
        device={data.device}
      />
    );

  const conversation =
    data.conversations.find((item) => item.id === selected) ??
    data.conversations[0];
  const activeAgents = data.agents.filter((agent) =>
    conversation.agentIds.includes(agent.id),
  );
  const visibleMessages = data.messages.filter(
    (message) => message.conversationId === conversation.id,
  );
  const inboxCount =
    data.approvals.length +
    data.conversations.filter((item) => item.unread).length;

  async function send() {
    const value = composer.trim();
    if (!value || sending) return;
    const mine: Message = {
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      author: "you",
      body: value,
      time: "Now",
      replyTo: replying?.id,
    };
    setComposer("");
    setReplying(null);
    setSending(true);
    setData(
      (current) =>
        current && { ...current, messages: [...current.messages, mine] },
    );
    try {
      for await (const streamed of gateway.sendMessage(
        conversation.id,
        value,
      )) {
        setData(
          (current) =>
            current && {
              ...current,
              messages: [
                ...current.messages.filter(
                  (message) => message.id !== "stream",
                ),
                streamed,
              ],
            },
        );
      }
      setData(
        (current) =>
          current && {
            ...current,
            messages: current.messages.map((message) =>
              message.id === "stream"
                ? { ...message, id: crypto.randomUUID(), streaming: false }
                : message,
            ),
          },
      );
    } catch {
      notify(
        "Message could not be delivered. Your draft was restored.",
        "error",
      );
      setComposer(value);
      setData(
        (current) =>
          current && {
            ...current,
            messages: current.messages.filter(
              (message) => message.id !== "stream" && message.id !== mine.id,
            ),
          },
      );
    } finally {
      setSending(false);
    }
  }

  async function decide(
    approval: Approval,
    decision: "once" | "always" | "deny",
  ) {
    await gateway.approve(approval.id, decision);
    setApprovalResults((current) => ({ ...current, [approval.id]: decision }));
  }

  function updateAvatarStyle(style: AvatarStyle) {
    localStorage.setItem(AVATAR_STYLE_KEY, style);
    setAvatarStyle(style);
  }

  function openConversation(id: string) {
    setSelected(id);
    setView("messages");
    setMobileNav(false);
  }

  return (
    <AvatarStyleContext.Provider value={avatarStyle}>
      <div className={`app-shell ${panel ? "panel-open" : ""}`}>
        <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
          <div className="brand">
            <BrandMark />
            <span>OpenCrew</span>
            <button
              className="icon-button mobile-only"
              onClick={() => setMobileNav(false)}
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          </div>
          <button
            className="search"
            onClick={() => setSearching(true)}
            aria-keyshortcuts={isApple ? "Meta+K" : "Control+K"}
          >
            <Search size={15} />
            <span>Search</span>
            <kbd>{SEARCH_HINT}</kbd>
          </button>
          <nav className="primary-nav">
            <button
              className={view === "inbox" ? "active" : ""}
              aria-current={view === "inbox" ? "page" : undefined}
              onClick={() => {
                setView("inbox");
                setPanel(null);
                setMobileNav(false);
              }}
            >
              <Inbox size={17} />
              <span>Inbox</span>
              {inboxCount > 0 && (
                <small aria-label={`${inboxCount} needing attention`}>
                  {inboxCount}
                </small>
              )}
            </button>
            <button
              className={view === "messages" ? "active" : ""}
              aria-current={view === "messages" ? "page" : undefined}
              onClick={() => {
                setView("messages");
                setMobileNav(false);
              }}
            >
              <MessageCircle size={17} />
              <span>Messages</span>
            </button>
            <button
              className={view === "activity" ? "active" : ""}
              aria-current={view === "activity" ? "page" : undefined}
              onClick={() => {
                setView("activity");
                setPanel(null);
                setMobileNav(false);
              }}
            >
              <Activity size={17} />
              <span>Activity</span>
            </button>
          </nav>
          <SidebarSection
            title="Direct messages"
            action={() => setCreating(true)}
          >
            {data.conversations
              .filter((item) => item.type === "dm")
              .map((item) => (
                <ConversationRow
                  key={item.id}
                  item={item}
                  agents={data.agents}
                  active={view === "messages" && selected === item.id}
                  onClick={() => openConversation(item.id)}
                />
              ))}
          </SidebarSection>
          <SidebarSection title="Groups">
            {data.conversations
              .filter((item) => item.type === "group")
              .map((item) => (
                <ConversationRow
                  key={item.id}
                  item={item}
                  agents={data.agents}
                  active={view === "messages" && selected === item.id}
                  onClick={() => openConversation(item.id)}
                />
              ))}
          </SidebarSection>
          <div className="sidebar-footer">
            <button onClick={() => setCreating(true)}>
              <Plus size={17} />
              <span>New agent</span>
            </button>
            <button
              onClick={() => {
                setPanel("settings");
                setMobileNav(false);
              }}
            >
              <Settings size={17} />
              <span>Settings</span>
              <i
                className={
                  data.device.connected ? "device-dot online" : "device-dot"
                }
              />
            </button>
          </div>
        </aside>
        {mobileNav && <Scrim onClose={() => setMobileNav(false)} />}

        <main className="conversation">
          <header className="conversation-header">
            <button
              className="icon-button mobile-only"
              onClick={() => setMobileNav(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <div className="conversation-title">
              {view === "inbox" ? (
                <Inbox size={18} />
              ) : view === "activity" ? (
                <Activity size={18} />
              ) : conversation.type === "group" ? (
                <Hash size={18} />
              ) : (
                <Avatar agent={activeAgents[0]} size="small" />
              )}
              <div>
                <strong>
                  {view === "inbox"
                    ? "Inbox"
                    : view === "activity"
                      ? "Runtime activity"
                      : conversation.name}
                </strong>
                <span>
                  {view === "inbox"
                    ? "Mentions and requests that need you"
                    : view === "activity"
                      ? "Live work across your crew"
                      : conversation.type === "group"
                        ? `${activeAgents.length} agents · you`
                        : activeAgents[0]?.role}
                </span>
              </div>
            </div>
            <div className="header-actions">
              <button
                className="icon-button"
                onClick={() => setSearching(true)}
                aria-label="Search"
              >
                <Search size={18} />
              </button>
              {view === "messages" && (
                <>
                  <button
                    className={`icon-button ${panel === "details" ? "selected" : ""}`}
                    onClick={() =>
                      setPanel(panel === "details" ? null : "details")
                    }
                    aria-expanded={panel === "details"}
                    aria-label="Conversation details"
                  >
                    <CircleHelp size={18} />
                  </button>
                  <button
                    className="icon-button"
                    onClick={() =>
                      notify("More conversation actions are coming soon.")
                    }
                    aria-label="More actions"
                  >
                    <MoreHorizontal size={19} />
                  </button>
                </>
              )}
            </div>
          </header>

          {view === "messages" ? (
            <>
              <section className="message-list">
                <div className="conversation-intro">
                  <div className="stacked-avatars">
                    {activeAgents.map((agent) => (
                      <Avatar key={agent.id} agent={agent} />
                    ))}
                  </div>
                  <h1>
                    {conversation.type === "group"
                      ? `# ${conversation.name}`
                      : conversation.name}
                  </h1>
                  <p>
                    {conversation.type === "group"
                      ? "A shared room for you and your crew. Mention an agent when you want their attention."
                      : `This is the beginning of your conversation with ${conversation.name}.`}
                  </p>
                </div>
                <div className="date-divider">
                  <span>Today</span>
                </div>
                {visibleMessages.map((message) => (
                  <MessageItem
                    key={message.id}
                    message={message}
                    agents={data.agents}
                    allMessages={visibleMessages}
                    onReply={() => setReplying(message)}
                  />
                ))}
                {data.approvals.map(
                  (approval) =>
                    conversation.agentIds.includes(approval.agentId) && (
                      <ApprovalCard
                        key={approval.id}
                        approval={approval}
                        agent={
                          data.agents.find(
                            (item) => item.id === approval.agentId,
                          )!
                        }
                        result={approvalResults[approval.id]}
                        onDecide={(decision) => decide(approval, decision)}
                      />
                    ),
                )}
                <div ref={bottomRef} />
              </section>

              <footer className="composer-wrap">
                {replying && (
                  <div className="reply-banner">
                    <Reply size={14} />
                    <span>
                      Replying to{" "}
                      <strong>
                        {authorName(replying.author, data.agents)}
                      </strong>
                    </span>
                    <button onClick={() => setReplying(null)}>
                      <X size={14} />
                    </button>
                  </div>
                )}
                <div className="composer">
                  <textarea
                    ref={composerRef}
                    value={composer}
                    onChange={(event) => setComposer(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void send();
                      }
                    }}
                    placeholder={`Message ${conversation.type === "group" ? "#" : ""}${conversation.name}`}
                    rows={1}
                  />
                  <div className="composer-tools">
                    <div>
                      <button
                        onClick={() =>
                          notify("Attachments are coming in the next preview.")
                        }
                        aria-label="Add attachment"
                      >
                        <Plus size={18} />
                      </button>
                      <button
                        onClick={() =>
                          notify("File uploads are coming in the next preview.")
                        }
                        aria-label="Attach file"
                      >
                        <Paperclip size={17} />
                      </button>
                      <button
                        onClick={() => {
                          setComposer(
                            (value) =>
                              value +
                              (value.endsWith(" ") || !value ? "@" : " @"),
                          );
                          composerRef.current?.focus();
                        }}
                        aria-label="Mention an agent"
                      >
                        <AtSign size={17} />
                      </button>
                    </div>
                    <span>Shift + Enter for new line</span>
                    <button
                      className="send"
                      disabled={!composer.trim() || sending}
                      onClick={() => void send()}
                      aria-label="Send message"
                    >
                      {sending ? (
                        <span className="spinner" />
                      ) : (
                        <Send size={16} />
                      )}
                    </button>
                  </div>
                </div>
              </footer>
            </>
          ) : (
            <UtilityView
              view={view}
              approvals={data.approvals}
              agents={data.agents}
              conversations={data.conversations}
              onOpenConversation={openConversation}
            />
          )}
        </main>

        {panel === "details" && (
          <DetailsPanel
            conversation={conversation}
            agents={activeAgents}
            onClose={() => setPanel(null)}
            onNotify={notify}
          />
        )}
        {panel === "settings" && (
          <SettingsPanel
            providers={data.providers}
            device={data.device}
            agents={data.agents}
            avatarStyle={avatarStyle}
            onAvatarStyleChange={updateAvatarStyle}
            onNotify={notify}
            onClose={() => setPanel(null)}
          />
        )}
        {creating && (
          <CreateAgent
            onClose={() => setCreating(false)}
            onCreate={async (agent) => {
              const created = await gateway.createAgent(agent);
              setData(
                (current) =>
                  current && {
                    ...current,
                    agents: [...current.agents, created],
                    conversations: [
                      ...current.conversations,
                      {
                        id: `dm-${created.id}`,
                        name: created.name,
                        type: "dm",
                        agentIds: [created.id],
                        preview: "Ready when you are.",
                        time: "Now",
                      },
                    ],
                  },
              );
              setSelected(`dm-${created.id}`);
              setView("messages");
              setPanel("details");
              setCreating(false);
            }}
          />
        )}
        {searching && (
          <SearchDialog
            agents={data.agents}
            conversations={data.conversations}
            onClose={() => setSearching(false)}
            onSelect={(id) => {
              openConversation(id);
              setSearching(false);
            }}
          />
        )}
        {toast && (
          <div
            className={`toast toast-${toast.tone}`}
            role={toast.tone === "error" ? "alert" : "status"}
          >
            {toast.tone === "error" ? (
              <AlertTriangle size={15} />
            ) : (
              <Check size={15} />
            )}{" "}
            {toast.message}
          </div>
        )}
      </div>
    </AvatarStyleContext.Provider>
  );
}

function Onboarding({
  onDone,
  providers,
  device,
}: {
  onDone: () => void;
  providers: Provider[];
  device: Device;
}) {
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [platform, setPlatform] = useState<"unix" | "windows">(() =>
    navigator.userAgent.toLowerCase().includes("windows") ? "windows" : "unix",
  );
  const subscriptionAvailable = providers.some(
    (provider) =>
      provider.id === "claude-sub" && provider.status === "available",
  );
  const [providerMode, setProviderMode] = useState<"subscription" | "api">(
    subscriptionAvailable ? "subscription" : "api",
  );
  const [apiProvider, setApiProvider] = useState("OpenAI");
  const [apiKey, setApiKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const installCommand =
    platform === "windows"
      ? "irm https://opencrew.xyz/install.ps1 | iex"
      : "curl -fsSL https://opencrew.xyz/install.sh | sh";
  const steps = ["Welcome", "Connect", "Provider"];
  return (
    <div className="onboarding">
      <header>
        <div className="brand">
          <BrandMark />
          <span>OpenCrew</span>
        </div>
        <button className="text-button" onClick={onDone}>
          Open demo
        </button>
      </header>
      <div className="onboarding-body">
        <div className="stepper">
          {steps.map((label, index) => (
            <div key={label} className={index <= step ? "complete" : ""}>
              <span>{index < step ? <Check size={13} /> : index + 1}</span>
              <em>{label}</em>
            </div>
          ))}
        </div>
        {step === 0 && (
          <div className="onboarding-card hero-card">
            <div className="eyebrow">Your crew is waiting</div>
            <h1>
              Bring your best agents
              <br />
              into one conversation.
            </h1>
            <p>
              OpenCrew connects models and coding agents you already use. Your
              local credentials stay on your device.
            </p>
            <div className="feature-row">
              <span>
                <MessageCircle size={17} /> Natural conversations
              </span>
              <span>
                <LockKeyhole size={17} /> Local credentials
              </span>
              <span>
                <Zap size={17} /> Live runtime activity
              </span>
            </div>
            <button className="primary-button" onClick={() => setStep(1)}>
              Set up OpenCrew <ChevronRight size={17} />
            </button>
          </div>
        )}
        {step === 1 && (
          <div className="onboarding-card">
            <div className="mini-icon">
              <Laptop size={22} />
            </div>
            <h2>Connect this computer</h2>
            <p>
              Install the local bridge to use Claude Code, Codex, and your
              workspaces securely.
            </p>
            <div className="os-switch" aria-label="Operating system">
              <button
                className={platform === "unix" ? "active" : ""}
                onClick={() => setPlatform("unix")}
              >
                macOS / Linux
              </button>
              <button
                className={platform === "windows" ? "active" : ""}
                onClick={() => setPlatform("windows")}
              >
                Windows
              </button>
            </div>
            <div className="command">
              <code>{installCommand}</code>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(installCommand);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1800);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                <span>{copied ? "Copied" : "Copy"}</span>
                {copied ? <Check size={15} /> : null}
              </button>
            </div>
            <div className="detected">
              <span className="pulse" />
              <div>
                <strong>{device.name}</strong>
                <small>{device.platform} · agentd connected</small>
              </div>
              <Check size={17} />
            </div>
            <div className="onboarding-actions">
              <button className="secondary-button" onClick={() => setStep(0)}>
                Back
              </button>
              <button className="primary-button" onClick={() => setStep(2)}>
                Continue <ChevronRight size={17} />
              </button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="onboarding-card">
            <div className="mini-icon">
              <Cpu size={22} />
            </div>
            <h2>Choose a model provider</h2>
            <p>
              {subscriptionAvailable
                ? "We found a provider that can be used without entering an API key."
                : "Connect a provider to choose the models your agents can use."}
            </p>
            {subscriptionAvailable && (
              <button
                className={`provider-choice ${providerMode === "subscription" ? "selected" : "muted"}`}
                onClick={() => setProviderMode("subscription")}
              >
                <ProviderLogo provider="Claude Subscription" />
                <div>
                  <strong>Claude Subscription</strong>
                  <small>
                    Claude Code detected · Logged in · Subscription available
                  </small>
                </div>
                <span>
                  {providerMode === "subscription" && <Check size={14} />}
                </span>
              </button>
            )}
            <button
              className={`provider-choice ${providerMode === "api" ? "selected" : "muted"}`}
              onClick={() => setProviderMode("api")}
            >
              <div className="provider-logo outline" aria-hidden="true">
                <Plus size={17} />
              </div>
              <div>
                <strong>Use an API provider</strong>
                <small>OpenAI, Anthropic, OpenRouter, Gemini, and more</small>
              </div>
              {providerMode === "api" ? (
                <span>
                  <Check size={14} />
                </span>
              ) : (
                <ChevronRight size={17} />
              )}
            </button>
            {providerMode === "api" && (
              <div className="provider-fields">
                <label>
                  Provider
                  <select
                    value={apiProvider}
                    onChange={(event) => setApiProvider(event.target.value)}
                  >
                    {[
                      "OpenAI",
                      "Anthropic API",
                      "OpenRouter",
                      "Gemini",
                      "DeepSeek",
                      "OpenAI-compatible",
                    ].map((provider) => (
                      <option key={provider}>{provider}</option>
                    ))}
                  </select>
                </label>
                <label>
                  API key
                  <input
                    type="password"
                    autoComplete="off"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="Paste key securely"
                  />
                </label>
              </div>
            )}
            <div className="security-note">
              <ShieldCheck size={16} />
              <span>
                {providerMode === "subscription"
                  ? "Subscription credentials stay local and are never shared with the server."
                  : "The key is sent directly to agentd for encrypted local storage and immediate testing."}
              </span>
            </div>
            <div className="onboarding-actions">
              <button className="secondary-button" onClick={() => setStep(1)}>
                Back
              </button>
              <button
                className="primary-button"
                disabled={
                  connecting || (providerMode === "api" && !apiKey.trim())
                }
                onClick={() => {
                  setConnecting(true);
                  window.setTimeout(onDone, 450);
                }}
              >
                {connecting
                  ? "Testing connection…"
                  : providerMode === "subscription"
                    ? "Use Claude subscription"
                    : `Connect ${apiProvider}`}
                {!connecting && <Check size={17} />}
              </button>
            </div>
          </div>
        )}
      </div>
      <footer>Open source · Self-hostable · Your data</footer>
    </div>
  );
}

function MessageItem({
  message,
  agents,
  allMessages,
  onReply,
}: {
  message: Message;
  agents: Agent[];
  allMessages: Message[];
  onReply: () => void;
}) {
  const agent = agents.find((item) => item.id === message.author);
  const replied = allMessages.find((item) => item.id === message.replyTo);
  return (
    <article className={`message ${message.streaming ? "streaming" : ""}`}>
      {message.author === "you" ? (
        <div className="avatar user-avatar">Y</div>
      ) : (
        <Avatar agent={agent} />
      )}
      <div className="message-content">
        {replied && (
          <div className="reply-reference">
            <Reply size={12} />
            <strong>{authorName(replied.author, agents)}</strong>
            <span>{replied.body}</span>
          </div>
        )}
        <div className="message-meta">
          <strong>{message.author === "you" ? "You" : agent?.name}</strong>
          {agent && (
            <span
              className={`status ${agent.status}`}
              role="img"
              aria-label={agent.status}
            />
          )}
          {agent && <em>{agent.role}</em>}
          <time>{message.time}</time>
        </div>
        <p>
          {renderMentions(message.body, agents)}
          {message.streaming && <i className="cursor" />}
        </p>
        {message.activity && (
          <div className="runtime-card">
            <div className="runtime-icon">
              <Activity size={16} />
            </div>
            <div>
              <strong>{message.activity.label}</strong>
              <span>{message.activity.detail}</span>
            </div>
            <div className="runtime-state">
              <span className="spinner" /> Live
            </div>
          </div>
        )}
      </div>
      <button
        className="message-reply"
        onClick={onReply}
        aria-label={`Reply to ${message.author === "you" ? "your message" : (agent?.name ?? "this message")}`}
      >
        <Reply size={15} />
      </button>
    </article>
  );
}

function ApprovalCard({
  approval,
  agent,
  result,
  onDecide,
}: {
  approval: Approval;
  agent: Agent;
  result?: string;
  onDecide: (decision: "once" | "always" | "deny") => void;
}) {
  return (
    <div className="approval-card">
      <div className="approval-head">
        <div className="approval-icon">
          <ShieldCheck size={18} />
        </div>
        <div>
          <strong>Permission requested</strong>
          <span>{agent.name} needs your approval</span>
        </div>
        <time>{approval.expiresIn}</time>
      </div>
      <div className="approval-command">
        <code>{approval.capability}</code>
        <p>{approval.description}</p>
        <span>
          <Folder size={14} /> {approval.workspace}
        </span>
      </div>
      {result ? (
        <div className="approval-result">
          <Check size={16} />{" "}
          {result === "deny"
            ? "Request denied"
            : result === "always"
              ? "Allowed for this workspace"
              : "Allowed once"}
        </div>
      ) : (
        <div className="approval-actions">
          <button onClick={() => onDecide("deny")}>Deny</button>
          <button onClick={() => onDecide("always")}>Always allow</button>
          <button className="approve" onClick={() => onDecide("once")}>
            Allow once
          </button>
        </div>
      )}
    </div>
  );
}

function DetailsPanel({
  conversation,
  agents,
  onClose,
  onNotify,
}: {
  conversation: Conversation;
  agents: Agent[];
  onClose: () => void;
  onNotify: (message: string) => void;
}) {
  const [tab, setTab] = useState<"people" | "memory">("people");
  const [memoryAgentId, setMemoryAgentId] = useState(agents[0]?.id ?? "");
  const memoryAgent =
    agents.find((agent) => agent.id === memoryAgentId) ?? agents[0];
  const [memory, setMemory] = useState(memoryAgent?.memory.join("\n") ?? "");
  useEffect(() => {
    setMemoryAgentId(agents[0]?.id ?? "");
  }, [conversation.id, agents]);
  useEffect(() => {
    setMemory(memoryAgent?.memory.join("\n") ?? "");
  }, [memoryAgent]);
  return (
    <aside className="detail-panel" aria-label="Conversation details">
      <header>
        <strong>
          {conversation.type === "group" ? "Conversation" : "Agent"} details
        </strong>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close details"
        >
          <X size={18} />
        </button>
      </header>
      <div className="detail-tabs">
        <button
          className={tab === "people" ? "active" : ""}
          onClick={() => setTab("people")}
        >
          People
        </button>
        <button
          className={tab === "memory" ? "active" : ""}
          onClick={() => setTab("memory")}
        >
          Memory
        </button>
      </div>
      {tab === "people" ? (
        <div className="details-content">
          {agents.map((agent) => (
            <div className="agent-profile" key={agent.id}>
              <Avatar agent={agent} size="large" />
              <h3>{agent.name}</h3>
              <p>{agent.role}</p>
              <span className="online-label">
                <i className={`status ${agent.status}`} /> {agent.status}
              </span>
              <div className="profile-grid">
                <span>
                  <Bot size={15} /> Model
                </span>
                <strong>{agent.model}</strong>
                <span>
                  <Cpu size={15} /> Runtime
                </span>
                <strong>{agent.runtime}</strong>
                {agent.workspace && (
                  <>
                    <span>
                      <Folder size={15} /> Workspace
                    </span>
                    <strong>{agent.workspace}</strong>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="memory-editor">
          {agents.length > 1 && (
            <label className="memory-agent-picker">
              Agent
              <select
                value={memoryAgent?.id}
                onChange={(event) => setMemoryAgentId(event.target.value)}
              >
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="memory-heading">
            <Database size={18} />
            <div>
              <strong>Working memory</strong>
              <span>{memoryAgent?.name} uses this across conversations.</span>
            </div>
          </div>
          <textarea
            value={memory}
            onChange={(event) => setMemory(event.target.value)}
            placeholder="Add one memory per line…"
          />
          <div className="memory-footer">
            <span>{memory.split("\n").filter(Boolean).length} memories</span>
            <button
              onClick={() => onNotify(`Memory saved for ${memoryAgent?.name}.`)}
            >
              Save memory
            </button>
          </div>
          <p className="muted-copy">
            You control what this agent remembers. Conversation history is
            managed separately.
          </p>
        </div>
      )}
    </aside>
  );
}

function SettingsPanel({
  providers,
  device,
  agents,
  avatarStyle,
  onAvatarStyleChange,
  onNotify,
  onClose,
}: {
  providers: Provider[];
  device: Device;
  agents: Agent[];
  avatarStyle: AvatarStyle;
  onAvatarStyleChange: (style: AvatarStyle) => void;
  onNotify: (message: string) => void;
  onClose: () => void;
}) {
  const [section, setSection] = useState<
    "providers" | "devices" | "appearance"
  >("providers");
  const [addingProvider, setAddingProvider] = useState(false);
  return (
    <aside className="detail-panel settings-panel">
      <header>
        <strong>Settings</strong>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close settings"
        >
          <X size={18} />
        </button>
      </header>
      <div className="settings-nav">
        <button
          className={section === "providers" ? "active" : ""}
          onClick={() => setSection("providers")}
        >
          <Cpu size={16} /> Providers
        </button>
        <button
          className={section === "devices" ? "active" : ""}
          onClick={() => setSection("devices")}
        >
          <Laptop size={16} /> Devices
        </button>
        <button
          className={section === "appearance" ? "active" : ""}
          onClick={() => setSection("appearance")}
        >
          <Palette size={16} /> Appearance
        </button>
      </div>
      <div className="settings-content">
        {section === "providers" ? (
          <>
            <div className="section-heading">
              <div>
                <h3>Model providers</h3>
                <p>Models your agents can use.</p>
              </div>
              <button onClick={() => setAddingProvider(true)}>
                <Plus size={15} /> Add
              </button>
            </div>
            {providers.map((provider) => (
              <div className="setting-row" key={provider.id}>
                <ProviderLogo provider={provider.name} small />
                <div>
                  <strong>{provider.name}</strong>
                  <span>{provider.detail}</span>
                </div>
                {provider.status === "available" ? (
                  <button
                    className="use-button"
                    onClick={() =>
                      onNotify(`${provider.name} is ready to use.`)
                    }
                  >
                    Use
                  </button>
                ) : (
                  <span className="connected-label">
                    <Check size={13} /> Connected
                  </span>
                )}
              </div>
            ))}
            <div className="local-note">
              <LockKeyhole size={15} />
              <span>Local provider credentials never leave agentd.</span>
            </div>
          </>
        ) : section === "devices" ? (
          <>
            <div className="section-heading">
              <div>
                <h3>Connected devices</h3>
                <p>Computers that can run local agents.</p>
              </div>
            </div>
            <div className="device-card">
              <div className="device-illustration">
                <Laptop size={23} />
              </div>
              <div>
                <strong>{device.name}</strong>
                <span>{device.platform}</span>
                <small>
                  <i className="device-dot online" /> Connected now
                </small>
              </div>
              <span className="device-status-chip">Trusted</span>
            </div>
            <div className="permission-summary">
              <h4>Default permissions</h4>
              {[
                ["Workspace read", "Allow"],
                ["Workspace write", "Ask"],
                ["Shell commands", "Ask"],
                ["Git push", "Deny"],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong className={value.toLowerCase()}>{value}</strong>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="section-heading">
              <div>
                <h3>Agent avatars</h3>
                <p>Choose how agents appear throughout OpenCrew.</p>
              </div>
            </div>
            <fieldset className="avatar-options">
              <legend>Avatar style</legend>
              <label className={avatarStyle === "blobatar" ? "selected" : ""}>
                <input
                  type="radio"
                  name="avatar-style"
                  value="blobatar"
                  checked={avatarStyle === "blobatar"}
                  onChange={() => onAvatarStyleChange("blobatar")}
                />
                <span className="avatar-option-preview">
                  {agents.slice(0, 3).map((agent) => (
                    <Avatar key={agent.id} agent={agent} style="blobatar" />
                  ))}
                </span>
                <span>
                  <strong>Blobatar</strong>
                  <small>
                    Unique geometric faces generated from each agent's name.
                  </small>
                </span>
                <i>{avatarStyle === "blobatar" && <Check size={13} />}</i>
              </label>
              <label className={avatarStyle === "initials" ? "selected" : ""}>
                <input
                  type="radio"
                  name="avatar-style"
                  value="initials"
                  checked={avatarStyle === "initials"}
                  onChange={() => onAvatarStyleChange("initials")}
                />
                <span className="avatar-option-preview">
                  {agents.slice(0, 3).map((agent) => (
                    <Avatar key={agent.id} agent={agent} style="initials" />
                  ))}
                </span>
                <span>
                  <strong>Initials</strong>
                  <small>The classic colored initials used previously.</small>
                </span>
                <i>{avatarStyle === "initials" && <Check size={13} />}</i>
              </label>
            </fieldset>
            <p className="avatar-privacy-note">
              Blobatars are generated locally and stay consistent for each agent
              name.
            </p>
          </>
        )}
      </div>
      {addingProvider && (
        <ProviderSetup
          onClose={() => setAddingProvider(false)}
          onConnected={(name) => {
            setAddingProvider(false);
            onNotify(`${name} connected and tested.`);
          }}
        />
      )}
    </aside>
  );
}

function UtilityView({
  view,
  approvals,
  agents,
  conversations,
  onOpenConversation,
}: {
  view: Exclude<View, "messages">;
  approvals: Approval[];
  agents: Agent[];
  conversations: Conversation[];
  onOpenConversation: (id: string) => void;
}) {
  if (view === "inbox") {
    return (
      <section className="utility-view">
        <div className="utility-intro">
          <span className="utility-icon">
            <Inbox size={21} />
          </span>
          <h1>Everything that needs you</h1>
          <p>Approvals and unread conversations, gathered in one place.</p>
        </div>
        <div className="utility-section-title">
          <span>Needs attention</span>
          <small>{approvals.length}</small>
        </div>
        {approvals.map((approval) => {
          const agent = agents.find((item) => item.id === approval.agentId);
          const conversation = conversations.find((item) =>
            item.agentIds.includes(approval.agentId),
          );
          return (
            <button
              className="inbox-item"
              key={approval.id}
              onClick={() =>
                conversation && onOpenConversation(conversation.id)
              }
            >
              <span className="inbox-symbol">
                <ShieldCheck size={17} />
              </span>
              <span>
                <strong>{agent?.name} needs permission</strong>
                <small>{approval.description}</small>
              </span>
              <em>{approval.expiresIn}</em>
              <ChevronRight size={16} />
            </button>
          );
        })}
        <div className="utility-section-title">
          <span>Unread</span>
        </div>
        {conversations
          .filter((item) => item.unread)
          .map((conversation) => (
            <button
              className="inbox-item"
              key={conversation.id}
              onClick={() => onOpenConversation(conversation.id)}
            >
              <span className="inbox-symbol neutral">
                <MessageCircle size={17} />
              </span>
              <span>
                <strong>{conversation.name}</strong>
                <small>{conversation.preview}</small>
              </span>
              <em>{conversation.time}</em>
              <ChevronRight size={16} />
            </button>
          ))}
      </section>
    );
  }

  const runtimeAgents = agents.filter((agent) => agent.runtime !== "Chat");
  return (
    <section className="utility-view">
      <div className="utility-intro">
        <span className="utility-icon">
          <Activity size={21} />
        </span>
        <h1>Runtime activity</h1>
        <p>Follow active sessions without leaving the conversation.</p>
      </div>
      <div className="activity-summary">
        <div>
          <strong>
            {
              runtimeAgents.filter((agent) => agent.status === "thinking")
                .length
            }
          </strong>
          <span>Running</span>
        </div>
        <div>
          <strong>{runtimeAgents.length}</strong>
          <span>Configured</span>
        </div>
        <div>
          <strong>1</strong>
          <span>Workspace</span>
        </div>
      </div>
      <div className="utility-section-title">
        <span>Sessions</span>
        <small>Live</small>
      </div>
      {runtimeAgents.map((agent) => {
        const conversation = conversations.find((item) =>
          item.agentIds.includes(agent.id),
        );
        return (
          <button
            className="session-row"
            key={agent.id}
            onClick={() => conversation && onOpenConversation(conversation.id)}
          >
            <Avatar agent={agent} />
            <span>
              <strong>{agent.name}</strong>
              <small>
                {agent.runtime} · {agent.workspace ?? "No workspace"}
              </small>
            </span>
            <span className={`session-state ${agent.status}`}>
              <i />
              {agent.status === "thinking"
                ? "Running"
                : agent.status === "online"
                  ? "Ready"
                  : "Offline"}
            </span>
            <ChevronRight size={16} />
          </button>
        );
      })}
    </section>
  );
}

function SearchDialog({
  agents,
  conversations,
  onClose,
  onSelect,
}: {
  agents: Agent[];
  conversations: Conversation[];
  onClose: () => void;
  onSelect: (conversationId: string) => void;
}) {
  const dialogRef = useDialog(onClose);
  const [query, setQuery] = useState("");
  const results = conversations.filter((conversation) => {
    const people = conversation.agentIds
      .map((id) => agents.find((agent) => agent.id === id)?.name ?? "")
      .join(" ");
    return `${conversation.name} ${conversation.preview} ${people}`
      .toLowerCase()
      .includes(query.toLowerCase());
  });
  return (
    <div
      className="modal-layer search-layer"
      onMouseDown={(event) => event.currentTarget === event.target && onClose()}
    >
      <div
        ref={dialogRef}
        className="search-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Search conversations"
      >
        <div className="search-input">
          <Search size={18} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a conversation or agent…"
          />
          <kbd>Esc</kbd>
        </div>
        <div className="search-results">
          <label>
            {query ? `${results.length} results` : "Recent conversations"}
          </label>
          {results.map((conversation) => {
            const agent = agents.find(
              (item) => item.id === conversation.agentIds[0],
            );
            return (
              <button
                key={conversation.id}
                onClick={() => onSelect(conversation.id)}
              >
                {conversation.type === "dm" ? (
                  <Avatar agent={agent} size="small" />
                ) : (
                  <span className="hash-avatar">
                    <Hash size={14} />
                  </span>
                )}
                <span>
                  <strong>{conversation.name}</strong>
                  <small>{conversation.preview}</small>
                </span>
                <em>{conversation.time}</em>
              </button>
            );
          })}
          {results.length === 0 && (
            <div className="empty-search">
              <Search size={22} />
              <strong>No conversations found</strong>
              <span>Try an agent name or a different phrase.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProviderSetup({
  onClose,
  onConnected,
}: {
  onClose: () => void;
  onConnected: (name: string) => void;
}) {
  const choices = [
    "Claude Subscription",
    "Anthropic API",
    "OpenAI",
    "OpenRouter",
    "Gemini",
    "DeepSeek",
    "Ollama",
    "OpenAI-compatible",
  ];
  const dialogRef = useDialog(onClose);
  const [provider, setProvider] = useState("Claude Subscription");
  const [key, setKey] = useState("");
  const [testing, setTesting] = useState(false);
  const needsKey = !["Claude Subscription", "Ollama"].includes(provider);
  return (
    <div
      className="modal-layer"
      onMouseDown={(event) => event.currentTarget === event.target && onClose()}
    >
      <div
        ref={dialogRef}
        className="modal provider-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add provider"
      >
        <header>
          <div>
            <span className="eyebrow">Model provider</span>
            <h2>Add a provider</h2>
            <p>Credentials are stored and tested by agentd on your device.</p>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close provider setup"
          >
            <X size={18} />
          </button>
        </header>
        <div className="form">
          <label>
            Provider
            <select
              value={provider}
              onChange={(event) => {
                setProvider(event.target.value);
                setKey("");
              }}
            >
              {choices.map((choice) => (
                <option key={choice}>{choice}</option>
              ))}
            </select>
          </label>
          {provider === "Claude Subscription" ? (
            <div className="detected compact">
              <span className="pulse" />
              <div>
                <strong>Claude Code detected</strong>
                <small>Logged in · Subscription available</small>
              </div>
              <Check size={17} />
            </div>
          ) : provider === "Ollama" ? (
            <div className="detected compact">
              <span className="pulse" />
              <div>
                <strong>Ollama detected</strong>
                <small>Local · 127.0.0.1:11434</small>
              </div>
              <Check size={17} />
            </div>
          ) : (
            <label>
              API key
              <input
                autoFocus
                type="password"
                autoComplete="off"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder="Paste key securely"
              />
              <small className="field-help">
                <LockKeyhole size={12} /> Never sent to the OpenCrew server
              </small>
            </label>
          )}
          <div className="security-note">
            <ShieldCheck size={16} />
            <span>
              {needsKey
                ? "The credential is encrypted locally and tested directly with the provider."
                : "OpenCrew will use your existing local authentication."}
            </span>
          </div>
        </div>
        <footer>
          <button className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary-button"
            disabled={(needsKey && !key.trim()) || testing}
            onClick={() => {
              setTesting(true);
              window.setTimeout(() => onConnected(provider), 550);
            }}
          >
            {testing
              ? "Testing…"
              : needsKey
                ? "Save and test"
                : `Use ${provider}`}{" "}
            {!testing && <Check size={16} />}
          </button>
        </footer>
      </div>
    </div>
  );
}

function CreateAgent({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (agent: CreateAgentInput) => Promise<void>;
}) {
  const dialogRef = useDialog(onClose);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [model, setModel] = useState("Auto");
  const [runtime, setRuntime] = useState("Chat");
  const [workspace, setWorkspace] = useState("");
  const [personality, setPersonality] = useState("");
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return (
    <div
      className="modal-layer"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Create an agent"
      >
        <header>
          <div>
            <span className="eyebrow">New teammate</span>
            <h2>Create an agent</h2>
            <p>Start simple. You can tune everything later.</p>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close agent creation"
          >
            <X size={18} />
          </button>
        </header>
        <div className="form">
          <label>
            Name
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Maya"
            />
          </label>
          <label>
            Role
            <textarea
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder="What should this agent be great at?"
            />
          </label>
          <div className="simple-options">
            <label>
              Model
              <select
                value={model}
                onChange={(event) => setModel(event.target.value)}
              >
                <option>Auto</option>
                <option>Claude Sonnet 4</option>
                <option>GPT-5</option>
                <option>Gemini 2.5 Pro</option>
              </select>
            </label>
            <label className="memory-toggle">
              <span>
                Memory<strong>Remember useful context</strong>
              </span>
              <input
                type="checkbox"
                checked={memoryEnabled}
                onChange={(event) => setMemoryEnabled(event.target.checked)}
              />
              <i />
            </label>
          </div>
          <button
            className="advanced-toggle"
            aria-expanded={advanced}
            onClick={() => setAdvanced(!advanced)}
          >
            <ChevronDown size={16} className={advanced ? "rotated" : ""} />{" "}
            Advanced options
          </button>
          {advanced && (
            <div className="advanced-options">
              <label>
                Runtime
                <select
                  value={runtime}
                  onChange={(event) => setRuntime(event.target.value)}
                >
                  <option>Chat</option>
                  <option>Claude Code</option>
                  <option>Codex</option>
                </select>
              </label>
              <label>
                Workspace
                <select
                  value={workspace}
                  onChange={(event) => setWorkspace(event.target.value)}
                >
                  <option value="">No workspace</option>
                  <option value="opencrew.dev">opencrew.dev</option>
                </select>
              </label>
              <label>
                Personality
                <textarea
                  value={personality}
                  onChange={(event) => setPersonality(event.target.value)}
                  placeholder="Tone, preferences, and working style…"
                />
              </label>
            </div>
          )}
          {error && <div className="form-error">{error}</div>}
        </div>
        <footer>
          <button className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary-button"
            disabled={!name.trim() || !role.trim() || saving}
            onClick={async () => {
              setSaving(true);
              setError("");
              try {
                await onCreate({
                  name: name.trim(),
                  role: role.trim(),
                  model,
                  runtime,
                  memoryEnabled,
                  workspace: workspace || undefined,
                  personality: personality.trim() || undefined,
                });
              } catch {
                setError("The agent could not be created. Please try again.");
                setSaving(false);
              }
            }}
          >
            {saving ? "Creating…" : "Create agent"}
            <Sparkles size={16} />
          </button>
        </footer>
      </div>
    </div>
  );
}

function Scrim({ onClose }: { onClose: () => void }) {
  const ref = useLayer<HTMLButtonElement>(onClose, false);
  return (
    <button
      ref={ref}
      className="scrim"
      onClick={onClose}
      aria-label="Close navigation"
    />
  );
}

function SidebarSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="sidebar-section">
      <div className="sidebar-label">
        <span>{title}</span>
        {action && (
          <button onClick={action} aria-label={`Add ${title.toLowerCase()}`}>
            <Plus size={14} />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
function ConversationRow({
  item,
  agents,
  active,
  onClick,
}: {
  item: Conversation;
  agents: Agent[];
  active: boolean;
  onClick: () => void;
}) {
  const agent = agents.find((candidate) => candidate.id === item.agentIds[0]);
  return (
    <button
      className={`conversation-row ${active ? "active" : ""}`}
      onClick={onClick}
    >
      {item.type === "dm" ? (
        <Avatar agent={agent} size="tiny" />
      ) : (
        <span className="hash-avatar">
          <Hash size={14} />
        </span>
      )}
      <span>{item.name}</span>
      {item.unread ? (
        <small aria-label={`${item.unread} unread`}>{item.unread}</small>
      ) : null}
    </button>
  );
}
function Avatar({
  agent,
  size = "normal",
  style,
}: {
  agent?: Agent;
  size?: "tiny" | "small" | "normal" | "large";
  style?: AvatarStyle;
}) {
  const preferredStyle = useContext(AvatarStyleContext);
  const resolvedStyle = style ?? preferredStyle;
  return (
    <div
      className={`avatar avatar-${size} ${resolvedStyle === "blobatar" ? "avatar-blobatar" : ""}`}
      style={
        resolvedStyle === "initials"
          ? { background: agent?.color ?? "#777" }
          : undefined
      }
    >
      {resolvedStyle === "blobatar" && agent ? (
        <Blobatar name={agent.name} aria-hidden="true" />
      ) : (
        (agent?.initials ?? "?")
      )}
      {agent && (
        <i
          className={`status ${agent.status}`}
          role="img"
          aria-label={agent.status}
        />
      )}
    </div>
  );
}
function BrandMark() {
  return (
    <span className="brand-mark">
      <i />
      <b />
    </span>
  );
}

function ProviderLogo({
  provider,
  small = false,
}: {
  provider: string;
  small?: boolean;
}) {
  const normalized = provider.toLowerCase();
  const className = `provider-logo${small ? " small" : ""}`;

  if (normalized.includes("claude") || normalized.includes("anthropic")) {
    return (
      <div className={className} aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" />
        </svg>
      </div>
    );
  }

  if (normalized.includes("openai")) {
    return (
      <div className={className} aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z" />
        </svg>
      </div>
    );
  }

  if (normalized.includes("ollama")) {
    return (
      <div className={className} aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M7.905 1.09c.216.085.411.225.588.41.295.306.544.744.734 1.263.191.522.315 1.1.362 1.68a5.054 5.054 0 012.049-.636l.051-.004c.87-.07 1.73.087 2.48.474.101.053.2.11.297.17.05-.569.172-1.134.36-1.644.19-.52.439-.957.733-1.264a1.67 1.67 0 01.589-.41c.257-.1.53-.118.796-.042.401.114.745.368 1.016.737.248.337.434.769.561 1.287.23.934.27 2.163.115 3.645l.053.04.026.019c.757.576 1.284 1.397 1.563 2.35.435 1.487.216 3.155-.534 4.088l-.018.021.002.003c.417.762.67 1.567.724 2.4l.002.03c.064 1.065-.2 2.137-.814 3.19l-.007.01.01.024c.472 1.157.62 2.322.438 3.486l-.006.039a.651.651 0 01-.747.536.648.648 0 01-.54-.742c.167-1.033.01-2.069-.48-3.123a.643.643 0 01.04-.617l.004-.006c.604-.924.854-1.83.8-2.72-.046-.779-.325-1.544-.8-2.273a.644.644 0 01.18-.886l.009-.006c.243-.159.467-.565.58-1.12a4.229 4.229 0 00-.095-1.974c-.205-.7-.58-1.284-1.105-1.683-.595-.454-1.383-.673-2.38-.61a.653.653 0 01-.632-.371c-.314-.665-.772-1.141-1.343-1.436a3.288 3.288 0 00-1.772-.332c-1.245.099-2.343.801-2.67 1.686a.652.652 0 01-.61.425c-1.067.002-1.893.252-2.497.703-.522.39-.878.935-1.066 1.588a4.07 4.07 0 00-.068 1.886c.112.558.331 1.02.582 1.269l.008.007c.212.207.257.53.109.785-.36.622-.629 1.549-.673 2.44-.05 1.018.186 1.902.719 2.536l.016.019a.643.643 0 01.095.69c-.576 1.236-.753 2.252-.562 3.052a.652.652 0 01-1.269.298c-.243-1.018-.078-2.184.473-3.498l.014-.035-.008-.012a4.339 4.339 0 01-.598-1.309l-.005-.019a5.764 5.764 0 01-.177-1.785c.044-.91.278-1.842.622-2.59l.012-.026-.002-.002c-.293-.418-.51-.953-.63-1.545l-.005-.024a5.352 5.352 0 01.093-2.49c.262-.915.777-1.701 1.536-2.269.06-.045.123-.09.186-.132-.159-1.493-.119-2.73.112-3.67.127-.518.314-.95.562-1.287.27-.368.614-.622 1.015-.737.266-.076.54-.059.797.042zm4.116 9.09c.936 0 1.8.313 2.446.855.63.527 1.005 1.235 1.005 1.94 0 .888-.406 1.58-1.133 2.022-.62.375-1.451.557-2.403.557-1.009 0-1.871-.259-2.493-.734-.617-.47-.963-1.13-.963-1.845 0-.707.398-1.417 1.056-1.946.668-.537 1.55-.849 2.485-.849zm0 .896a3.07 3.07 0 00-1.916.65c-.461.37-.722.835-.722 1.25 0 .428.21.829.61 1.134.455.347 1.124.548 1.943.548.799 0 1.473-.147 1.932-.426.463-.28.7-.686.7-1.257 0-.423-.246-.89-.683-1.256-.484-.405-1.14-.643-1.864-.643zm.662 1.21l.004.004c.12.151.095.37-.056.49l-.292.23v.446a.375.375 0 01-.376.373.375.375 0 01-.376-.373v-.46l-.271-.218a.347.347 0 01-.052-.49.353.353 0 01.494-.051l.215.172.22-.174a.353.353 0 01.49.051zm-5.04-1.919c.478 0 .867.39.867.871a.87.87 0 01-.868.871.87.87 0 01-.867-.87.87.87 0 01.867-.872zm8.706 0c.48 0 .868.39.868.871a.87.87 0 01-.868.871.87.87 0 01-.867-.87.87.87 0 01.867-.872zM7.44 2.3l-.003.002a.659.659 0 00-.285.238l-.005.006c-.138.189-.258.467-.348.832-.17.692-.216 1.631-.124 2.782.43-.128.899-.208 1.404-.237l.01-.001.019-.034c.046-.082.095-.161.148-.239.123-.771.022-1.692-.253-2.444-.134-.364-.297-.65-.453-.813a.628.628 0 00-.107-.09L7.44 2.3zm9.174.04l-.002.001a.628.628 0 00-.107.09c-.156.163-.32.45-.453.814-.29.794-.387 1.776-.23 2.572l.058.097.008.014h.03a5.184 5.184 0 011.466.212c.086-1.124.038-2.043-.128-2.722-.09-.365-.21-.643-.349-.832l-.004-.006a.659.659 0 00-.285-.239h-.004z" />
        </svg>
      </div>
    );
  }

  return (
    <div className={className} aria-hidden="true">
      {provider.trim().charAt(0).toUpperCase()}
    </div>
  );
}
function Loading() {
  return (
    <div className="loading" role="status" aria-live="polite">
      <BrandMark />
      <span>Opening your crew…</span>
    </div>
  );
}
function authorName(id: string, agents: Agent[]) {
  return id === "you"
    ? "You"
    : (agents.find((agent) => agent.id === id)?.name ?? "Agent");
}
function renderMentions(body: string, agents: Agent[]) {
  const names = agents.map((agent) => agent.name);
  return body
    .split(/(@\w+)/g)
    .map((part, index) =>
      names.some((name) => part.toLowerCase() === `@${name.toLowerCase()}`) ? (
        <mark key={index}>{part}</mark>
      ) : (
        part
      ),
    );
}
