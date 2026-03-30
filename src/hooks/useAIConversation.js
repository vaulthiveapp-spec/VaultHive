/**
 * useAIConversation
 *
 * Manages the full AI conversation lifecycle:
 *   - Create or resume a conversation in SQLite
 *   - Load message history on mount
 *   - Build AI context (cached 30 min)
 *   - Call aiService.chat with full history + context
 *   - Persist every user and assistant message via offlineActions
 *   - Expose structured response shape to the UI
 *
 * The hook is intentionally screen-agnostic so it can later power
 * context-linked conversations from HubDetailScreen, ReceiptDetailsScreen, etc.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { makePushId } from "../utils/pushId";
import {
  createAIConversationOffline,
  appendAIMessageOffline,
} from "../services/offlineActions";
import {
  getConversation,
  listMessages,
  listConversations,
} from "../services/repo/repoAI";
import { buildAIContext } from "../services/aiContextBuilder";
import aiService from "../services/aiService";

// ─── Constants ─────────────────────────────────────────────────────────────────

const HISTORY_WINDOW = 10;       // messages sent as history to the edge function
const WELCOME_CONV_TITLE = "New conversation";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function safeParseStructured(message) {
  if (!message?.structured_json) return null;
  try {
    return JSON.parse(message.structured_json);
  } catch {
    return null;
  }
}

function messageToHistoryItem(msg) {
  return {
    role: msg.role,
    // Send both fields: 'text' (read by historyToInput in the edge function)
    // and 'content' (Phase 9 hook convention). The server accepts either.
    text:    msg.text || "",
    content: msg.text || "",
  };
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useAIConversation({ linkedEntityType = null, linkedEntityId = null, screenContext = "ai_assistant" } = {}) {
  const { user } = useAuth();
  const uid = user?.uid;

  // ── State ────────────────────────────────────────────────────────────────────
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages]             = useState([]);
  const [loading, setLoading]               = useState(false);
  const [booting, setBooting]               = useState(true);   // initial load
  const [context, setContext]               = useState(null);
  const [actionProposals, setActionProposals] = useState([]);

  const mountedRef = useRef(true);
  const contextRef = useRef(null);

  // ── Boot: load or create conversation ────────────────────────────────────────

  const boot = useCallback(async () => {
    if (!uid) { setBooting(false); return; }
    try {
      // Try to resume the most recent active conversation
      const convList = await listConversations(uid, 1).catch(() => []);
      let convId = convList?.[0]?.conversation_id || null;

      if (!convId) {
        // No existing conversation — create one
        convId = makePushId();
        await createAIConversationOffline(uid, {
          conversation_id: convId,
          title: WELCOME_CONV_TITLE,
          screen_context: screenContext,
          linked_entity: linkedEntityType
            ? { type: linkedEntityType, id: linkedEntityId }
            : null,
        });
      }

      if (!mountedRef.current) return;
      setConversationId(convId);

      // Load messages
      const rows = await listMessages(uid, convId, 80).catch(() => []);
      if (mountedRef.current) {
        setMessages(
          (rows || []).map((r) => ({
            ...r,
            structured: safeParseStructured(r),
          }))
        );
      }
    } catch {
      // Boot failures are non-fatal — chat still works in memory
    } finally {
      if (mountedRef.current) setBooting(false);
    }
  }, [uid, linkedEntityType, linkedEntityId, screenContext]);

  // ── Pre-warm context in background ───────────────────────────────────────────

  const warmContext = useCallback(async () => {
    if (!uid) return;
    try {
      const ctx = await buildAIContext(uid, { forceRefresh: false });
      if (mountedRef.current) {
        contextRef.current = ctx;
        setContext(ctx);
      }
    } catch {}
  }, [uid]);

  useEffect(() => {
    mountedRef.current = true;
    boot();
    warmContext();
    return () => { mountedRef.current = false; };
  }, [boot, warmContext]);

  // ── Start a fresh conversation ────────────────────────────────────────────────

  const startNewConversation = useCallback(async () => {
    if (!uid) return;
    const newId = makePushId();
    try {
      await createAIConversationOffline(uid, {
        conversation_id: newId,
        title: WELCOME_CONV_TITLE,
        screen_context: screenContext,
        linked_entity: linkedEntityType
          ? { type: linkedEntityType, id: linkedEntityId }
          : null,
      });
    } catch {}
    if (mountedRef.current) {
      setConversationId(newId);
      setMessages([]);
      setActionProposals([]);
    }
  }, [uid, screenContext, linkedEntityType, linkedEntityId]);

  // ── Send a message ────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async ({ text, attachment = null }) => {
      if (!uid || !text?.trim()) return;
      if (loading) return;

      const convId = conversationId || makePushId();
      if (!conversationId) {
        // Lazily create conversation if boot failed
        try {
          await createAIConversationOffline(uid, {
            conversation_id: convId,
            title: WELCOME_CONV_TITLE,
            screen_context: screenContext,
          });
        } catch {}
        if (mountedRef.current) setConversationId(convId);
      }

      const userMsgId = makePushId();
      const userMsg = {
        message_id: userMsgId,
        conversation_id: convId,
        role: "user",
        text: text.trim(),
        attachment: attachment || null,
        structured: null,
        created_at_ms: Date.now(),
      };

      // Optimistic UI: add user message immediately
      if (mountedRef.current) {
        setMessages((prev) => [...prev, userMsg]);
        setLoading(true);
      }

      // Persist user message
      try {
        await appendAIMessageOffline(uid, convId, {
          message_id: userMsgId,
          role: "user",
          text: userMsg.text,
          attachment: attachment || null,
        });
      } catch {}

      // Build context (use cached if available)
      let ctx = contextRef.current;
      if (!ctx) {
        try { ctx = await buildAIContext(uid, { forceRefresh: false }); } catch {}
        if (mountedRef.current) { contextRef.current = ctx; setContext(ctx); }
      }

      // Build history window from current messages
      const historyItems = [...messages, userMsg]
        .slice(-HISTORY_WINDOW)
        .map(messageToHistoryItem);

      // Call AI
      let aiResponse = null;
      try {
        aiResponse = await aiService.chat({
          uid,
          message: userMsg.text,
          history: historyItems,
          context: ctx,
          attachment: attachment || null,
        });
      } catch (err) {
        aiResponse = {
          reply: "Something went wrong. Please try again.",
          sections: [],
          cards: [],
          suggestions: [],
          action_proposals: [],
          transcript: "",
        };
      }

      if (!mountedRef.current) return;

      const asstMsgId = makePushId();
      const structured = {
        sections:         aiResponse.sections         || [],
        cards:            aiResponse.cards            || [],
        suggestions:      aiResponse.suggestions      || [],
        action_proposals: aiResponse.action_proposals || [],
        transcript:       aiResponse.transcript       || "",
      };

      const asstMsg = {
        message_id: asstMsgId,
        conversation_id: convId,
        role: "assistant",
        text: aiResponse.reply || "",
        structured,
        created_at_ms: Date.now(),
      };

      // Persist assistant message with full structured payload
      try {
        await appendAIMessageOffline(uid, convId, {
          message_id: asstMsgId,
          role: "assistant",
          text: asstMsg.text,
          structured: structured,
        });
      } catch {}

      if (mountedRef.current) {
        setMessages((prev) => [...prev, asstMsg]);
        setActionProposals(aiResponse.action_proposals || []);
        setLoading(false);
      }
    },
    [uid, conversationId, loading, messages, screenContext]
  );

  return {
    conversationId,
    messages,
    loading,
    booting,
    context,
    actionProposals,
    sendMessage,
    startNewConversation,
    refreshContext: warmContext,
  };
}

export default useAIConversation;
