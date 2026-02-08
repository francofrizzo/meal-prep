import { ChatMessage, Conversation } from "./types";
import { addMessage, clearChat, renderHistoryPanel, closeHistoryPanel, addQueryToAccordion, resetQueriesAccordion } from "./ui";

export const conversationHistory: ChatMessage[] = [];
let conversations: Conversation[] = [];
let activeConversationId: string | null = null;

function generateConversationId(): string {
  return "conv_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
}

export async function loadConversations(): Promise<void> {
  try {
    const response = await fetch("/api/conversations");
    if (response.ok) {
      conversations = (await response.json()) as Conversation[];
      renderConversationList();
    }
  } catch (e) {
    console.error("Failed to load conversations:", e);
  }
}

export async function saveCurrentConversation(): Promise<void> {
  if (!activeConversationId || conversationHistory.length === 0) return;

  const title =
    conversationHistory.find((m) => m.role === "user")?.content?.slice(0, 50) || "Nueva conversacion";

  try {
    await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: activeConversationId,
        title,
        history: conversationHistory,
      }),
    });
    await loadConversations();
  } catch (e) {
    console.error("Failed to save conversation:", e);
  }
}

export async function switchToConversation(id: string): Promise<void> {
  await saveCurrentConversation();

  try {
    const response = await fetch(`/api/conversations/${id}`);
    if (response.ok) {
      const conv = (await response.json()) as Conversation;
      activeConversationId = conv.id;
      conversationHistory.length = 0;
      if (conv.history) {
        conversationHistory.push(...conv.history);
      }
      renderChat();
      closeHistoryPanel();
    }
  } catch (e) {
    console.error("Failed to load conversation:", e);
  }
}

export async function deleteConversation(id: string, event: MouseEvent): Promise<void> {
  event.stopPropagation();

  if (!confirm("Borrar esta conversacion?")) return;

  try {
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });

    if (id === activeConversationId) {
      startNewChat();
    }

    await loadConversations();
  } catch (e) {
    console.error("Failed to delete conversation:", e);
  }
}

export function startNewChat(): void {
  saveCurrentConversation();
  activeConversationId = generateConversationId();
  conversationHistory.length = 0;
  clearChat();
  addMessage("system", "Nueva conversación. Preguntame lo que quieras sobre meal prep.");
  closeHistoryPanel();
  const userInput = document.getElementById("user-input") as HTMLTextAreaElement;
  userInput.focus();
}

function renderChat(): void {
  clearChat();
  resetQueriesAccordion();
  conversationHistory.forEach((msg) => {
    if (msg.role === "user") {
      addMessage("user", msg.content || "");
    } else if (msg.role === "assistant") {
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        const assistantEl = addMessage("assistant", msg.content || "");
        for (const tc of msg.tool_calls) {
          if (tc.function.name === "execute_sql") {
            try {
              const args = JSON.parse(tc.function.arguments) as { query: string };
              addQueryToAccordion(args.query, assistantEl);
            } catch {
              addQueryToAccordion(tc.function.arguments, assistantEl);
            }
          }
        }
      } else {
        addMessage("assistant", msg.content || "");
      }
    }
  });
}

function renderConversationList(): void {
  renderHistoryPanel(conversations, activeConversationId, switchToConversation, deleteConversation);
}

export function initConversations(): void {
  activeConversationId = generateConversationId();
}
