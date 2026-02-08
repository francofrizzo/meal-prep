import { handleUserMessage } from "./chat";
import { addMessage } from "./ui";
import { toggleHistoryPanel, closeHistoryPanel } from "./ui";
import {
  loadConversations,
  saveCurrentConversation,
  startNewChat,
  initConversations,
  conversationHistory,
} from "./conversations";
import type { ChatMessage } from "./types";

const userInput = document.getElementById("user-input") as HTMLTextAreaElement;
const sendBtn = document.getElementById("send-btn") as HTMLButtonElement;
const downloadSqlBtn = document.getElementById("download-sql-btn")!;
const historyToggleBtn = document.getElementById("history-toggle")!;
const historyOverlay = document.getElementById("history-overlay")!;
const historyClose = document.getElementById("history-close")!;
const newChatBtn = document.getElementById("new-chat-btn")!;

declare global {
  interface Window {
    mealPrepDebug?: {
      getHistory: () => ChatMessage[];
      printHistory: () => void;
      getLastToolCalls: () => ChatMessage[];
    };
  }
}

// Database export
async function downloadSqlDump(): Promise<void> {
  try {
    const response = await fetch("/api/export/sql");
    const sql = await response.text();
    const blob = new Blob([sql], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mealprep_${new Date().toISOString().split("T")[0]}.sql`;
    a.click();
    URL.revokeObjectURL(url);
    addMessage("system", "Dump SQL descargado.");
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    addMessage("error", `Error al descargar dump SQL: ${message}`);
  }
}

// Event listeners
sendBtn.addEventListener("click", () => {
  handleUserMessage(userInput.value, sendBtn, userInput);
  userInput.value = "";
  userInput.style.height = "auto";
});

userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});

userInput.addEventListener("input", () => {
  userInput.style.overflow = "hidden";
  userInput.style.height = "auto";
  const h = Math.min(userInput.scrollHeight, 120);
  userInput.style.height = h + "px";
  userInput.style.overflow = "";
});

downloadSqlBtn.addEventListener("click", downloadSqlDump);
historyToggleBtn.addEventListener("click", toggleHistoryPanel);
historyOverlay.addEventListener("click", closeHistoryPanel);
historyClose.addEventListener("click", closeHistoryPanel);
newChatBtn.addEventListener("click", startNewChat);

// Initialize
window.addEventListener("beforeunload", () => saveCurrentConversation());

initConversations();

loadConversations().then(() => {
  startNewChat();
  userInput.focus();
});

window.mealPrepDebug = {
  getHistory: () => conversationHistory,
  printHistory: () => {
    // eslint-disable-next-line no-console
    console.log(conversationHistory);
  },
  getLastToolCalls: () =>
    conversationHistory.filter(
      (m) => m.role === "assistant" && m.tool_calls && m.tool_calls.length > 0,
    ),
};
