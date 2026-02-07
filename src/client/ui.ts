import { marked } from "marked";
import DOMPurify from "dompurify";

const chatContainer = document.getElementById("chat-container")!;

let queriesAccordion: HTMLElement | null = null;

const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "a", "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "code", "pre", "blockquote", "hr",
  "table", "thead", "tbody", "tr", "th", "td",
];

function renderMarkdown(text: string): HTMLElement {
  try {
    const rawHtml = marked.parse(text, { gfm: true, breaks: false }) as string;
    const safeHtml = DOMPurify.sanitize(rawHtml, {
      ALLOWED_TAGS,
      ALLOWED_ATTR: ["href", "target"],
    });
    const wrap = document.createElement("div");
    wrap.className = "message-body";
    wrap.innerHTML = safeHtml;
    return wrap;
  } catch {
    const span = document.createElement("span");
    span.className = "message-body whitespace-pre-wrap";
    span.textContent = text;
    return span;
  }
}

export function addMessage(role: string, content: string): HTMLElement {
  const msgDiv = document.createElement("div");

  if (role === "user") {
    msgDiv.className =
      "message-user self-end max-w-[90%] px-3 py-2 rounded text-sm whitespace-pre-wrap break-words text-term-user bg-term-user/5 border border-term-user/10";
  } else if (role === "assistant") {
    msgDiv.className =
      "self-start max-w-[90%] px-3 py-2 rounded text-sm break-words text-term-text bg-term-surface border border-term-border";
  } else if (role === "system") {
    msgDiv.className =
      "self-center text-term-text-muted text-xs italic py-1";
  } else if (role === "error") {
    msgDiv.className =
      "self-center text-term-error text-xs py-1";
  }

  if (role === "assistant" && content) {
    msgDiv.appendChild(renderMarkdown(content));
  } else {
    const span = document.createElement("span");
    span.className = "whitespace-pre-wrap";
    span.textContent = content;
    msgDiv.appendChild(span);
  }
  chatContainer.appendChild(msgDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return msgDiv;
}

export function addTypingIndicator(): HTMLElement {
  const typingDiv = document.createElement("div");
  typingDiv.className =
    "typing-cursor self-start text-term-text-dim text-sm px-3 py-2";
  typingDiv.textContent = "...";
  typingDiv.id = "typing-indicator";
  chatContainer.appendChild(typingDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return typingDiv;
}

export function removeTypingIndicator(): void {
  const typingDiv = document.getElementById("typing-indicator");
  if (typingDiv) {
    typingDiv.remove();
  }
}

export function removeQueriesAccordion(): void {
  if (queriesAccordion && queriesAccordion.parentNode) {
    queriesAccordion.parentNode.removeChild(queriesAccordion);
    queriesAccordion = null;
  }
}

export function addQueryToAccordion(query: string): void {
  if (!queriesAccordion) {
    queriesAccordion = document.createElement("div");
    queriesAccordion.className = "queries-accordion my-1 text-[11px]";

    const header = document.createElement("div");
    header.className =
      "queries-header flex items-center gap-1.5 py-0.5 cursor-pointer text-term-text-muted hover:text-term-text-dim select-none";
    header.textContent = "queries ejecutadas";
    header.addEventListener("click", () => {
      queriesAccordion!.classList.toggle("open");
    });

    const content = document.createElement("div");
    content.className = "queries-content pl-3 pt-1";

    queriesAccordion.appendChild(header);
    queriesAccordion.appendChild(content);

    chatContainer.appendChild(queriesAccordion);
  }

  const queryItem = document.createElement("div");
  queryItem.className =
    "my-0.5 px-2 py-1 bg-term-bg rounded text-[11px] whitespace-pre-wrap break-all text-term-accent-dim font-mono border border-term-border";
  queryItem.textContent = query;

  const content = queriesAccordion.querySelector(".queries-content")!;
  content.appendChild(queryItem);

  chatContainer.scrollTop = chatContainer.scrollHeight;
}

export function clearChat(): void {
  chatContainer.innerHTML = "";
}

export function renderHistoryPanel(
  conversations: { id: string; title: string; updated_at: string }[],
  activeConversationId: string | null,
  onSwitch: (id: string) => void,
  onDelete: (id: string, event: MouseEvent) => void,
): void {
  const historyList = document.getElementById("history-list")!;
  historyList.innerHTML = "";

  for (const conv of conversations) {
    const item = document.createElement("div");
    item.className =
      "flex justify-between items-start gap-2 px-3 py-2.5 rounded cursor-pointer hover:bg-term-raised transition-colors";
    if (conv.id === activeConversationId) {
      item.className += " bg-term-raised border-l-2 border-term-accent";
    }

    const info = document.createElement("div");
    info.className = "flex-1 min-w-0";

    const title = document.createElement("div");
    title.className =
      "text-xs text-term-text truncate";
    title.textContent = conv.title || "Sin titulo";

    const date = document.createElement("div");
    date.className = "text-[11px] text-term-text-muted mt-0.5";
    date.textContent = formatDate(conv.updated_at);

    info.appendChild(title);
    info.appendChild(date);

    const deleteBtn = document.createElement("button");
    deleteBtn.className =
      "text-term-text-muted hover:text-term-error text-base leading-none cursor-pointer shrink-0";
    deleteBtn.textContent = "\u00D7";
    deleteBtn.addEventListener("click", (e) => onDelete(conv.id, e as MouseEvent));

    item.appendChild(info);
    item.appendChild(deleteBtn);
    item.addEventListener("click", () => onSwitch(conv.id));

    historyList.appendChild(item);
  }

  if (conversations.length === 0) {
    const empty = document.createElement("div");
    empty.className = "px-6 py-8 text-center text-term-text-muted text-xs";
    empty.textContent = "No hay conversaciones";
    historyList.appendChild(empty);
  }
}

function formatDate(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Recien";
  if (diffMins < 60) return `hace ${diffMins}m`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays < 7) return `hace ${diffDays}d`;
  return d.toLocaleDateString("es-AR");
}

export function toggleHistoryPanel(): void {
  const historyPanel = document.getElementById("history-panel")!;
  const historyOverlay = document.getElementById("history-overlay")!;
  const isOpen = historyPanel.classList.contains("open");
  if (isOpen) {
    closeHistoryPanel();
  } else {
    historyPanel.classList.add("open");
    historyOverlay.classList.remove("hidden");
  }
}

export function closeHistoryPanel(): void {
  const historyPanel = document.getElementById("history-panel")!;
  const historyOverlay = document.getElementById("history-overlay")!;
  historyPanel.classList.remove("open");
  historyOverlay.classList.add("hidden");
}
