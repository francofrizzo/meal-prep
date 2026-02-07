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
    span.className = "message-body";
    span.style.whiteSpace = "pre-wrap";
    span.textContent = text;
    return span;
  }
}

export function addMessage(role: string, content: string): HTMLElement {
  const msgDiv = document.createElement("div");
  msgDiv.className = `message message-${role}`;
  if (role === "assistant" && content) {
    msgDiv.appendChild(renderMarkdown(content));
  } else {
    const span = document.createElement("span");
    span.style.whiteSpace = "pre-wrap";
    span.textContent = content;
    msgDiv.appendChild(span);
  }
  chatContainer.appendChild(msgDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return msgDiv;
}

export function addTypingIndicator(): HTMLElement {
  const typingDiv = document.createElement("div");
  typingDiv.className = "message message-assistant";
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
    queriesAccordion.className = "queries-accordion";

    const header = document.createElement("div");
    header.className = "queries-header";
    header.textContent = "Consultas SQL";
    header.addEventListener("click", () => {
      queriesAccordion!.classList.toggle("open");
    });

    const content = document.createElement("div");
    content.className = "queries-content";

    queriesAccordion.appendChild(header);
    queriesAccordion.appendChild(content);

    chatContainer.appendChild(queriesAccordion);
  }

  const queryItem = document.createElement("div");
  queryItem.className = "query-item";
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
    item.className = "history-item";
    if (conv.id === activeConversationId) {
      item.classList.add("active");
    }

    const info = document.createElement("div");
    info.className = "history-item-info";

    const title = document.createElement("div");
    title.className = "history-item-title";
    title.textContent = conv.title || "Sin titulo";

    const date = document.createElement("div");
    date.className = "history-item-date";
    date.textContent = formatDate(conv.updated_at);

    info.appendChild(title);
    info.appendChild(date);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "history-item-delete";
    deleteBtn.textContent = "\u00D7";
    deleteBtn.addEventListener("click", (e) => onDelete(conv.id, e as MouseEvent));

    item.appendChild(info);
    item.appendChild(deleteBtn);
    item.addEventListener("click", () => onSwitch(conv.id));

    historyList.appendChild(item);
  }

  if (conversations.length === 0) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
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
    historyOverlay.classList.add("open");
  }
}

export function closeHistoryPanel(): void {
  const historyPanel = document.getElementById("history-panel")!;
  const historyOverlay = document.getElementById("history-overlay")!;
  historyPanel.classList.remove("open");
  historyOverlay.classList.remove("open");
}
