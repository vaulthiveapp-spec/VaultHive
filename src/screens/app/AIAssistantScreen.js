

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "react-native-vector-icons/Ionicons";
import * as DocumentPicker from "expo-document-picker";

import { useAuth } from "../../context/AuthContext";
import { useAlert } from "../../components/AlertProvider";
import { useAIConversation } from "../../hooks/useAIConversation";
import AIStructuredContent from "../../components/ai/AIStructuredContent";
import AIActionBar from "../../components/ai/AIActionBar";
import AITypingIndicator from "../../components/ai/AITypingIndicator";

import { scale, getFontSize } from "../../utils/responsive";
import { IcoHandler } from "../../utils/icoHandler";

const AI_AVATAR_ICO = require("../../../assets/AIicon.ico");



const STARTER_PROMPTS = [
  { id: "p1", icon: "flash-outline",              text: "What needs my attention?" },
  { id: "p2", icon: "shield-checkmark-outline",   text: "Show expiring warranties" },
  { id: "p3", icon: "storefront-outline",         text: "Recommend a store for me" },
  { id: "p4", icon: "receipt-outline",            text: "Summarize my spending" },
  { id: "p5", icon: "cube-outline",               text: "Review my purchase vault" },
  { id: "p6", icon: "alarm-outline",              text: "What reminders are coming?" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  const v = Number(bytes || 0);
  if (!v) return "";
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentLabel(file) {
  if (!file) return "";
  const size = formatBytes(file.size);
  return size ? `${file.name} · ${size}` : file.name || "Attached file";
}

function isLastAssistantMsg(messages, index) {
  if (messages[index]?.role !== "assistant") return false;
  for (let i = index + 1; i < messages.length; i++) {
    if (messages[i].role === "assistant") return false;
  }
  return true;
}

// ─── Avatars ──────────────────────────────────────────────────────────────────

const UserAvatar = ({ uri }) => (
  <View style={styles.avatarWrap}>
    {uri ? (
      <Image source={{ uri }} style={styles.avatarImg} contentFit="cover" />
    ) : (
      <View style={styles.avatarFallback}>
        <Ionicons name="person" size={scale(16)} color="#F8E7B0" />
      </View>
    )}
  </View>
);

const AIAvatar = ({ avatarSource }) => (
  <View style={styles.avatarWrap}>
    <Image source={avatarSource || AI_AVATAR_ICO} style={styles.avatarImg} contentFit="cover" />
  </View>
);

// ─── Message row ──────────────────────────────────────────────────────────────

const MessageRow = React.memo(function MessageRow({
  item,
  isLast,
  userAvatarUri,
  actionProposals,
  navigation,
  onSuggestionPress,
}) {
  const isUser = item.role === "user";

  return (
    <View style={styles.msgBlock}>
      <View style={[styles.msgRow, isUser ? styles.msgRowRight : styles.msgRowLeft]}>
        {!isUser ? <AIAvatar avatarSource={aiAvatarSource} /> : null}

        {isUser ? (
          <View style={styles.userBubble}>
            {item.attachment ? (
              <View style={styles.attachBadge}>
                <Ionicons name="document-attach-outline" size={scale(13)} color="#FFE9A8" />
                <Text style={styles.attachBadgeText} numberOfLines={1}>
                  {attachmentLabel(item.attachment)}
                </Text>
              </View>
            ) : null}
            {!!item.text ? (
              <Text style={styles.userText}>{item.text}</Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.asstBubble}>
            {!!item.text ? (
              <Text style={styles.asstText}>{item.text}</Text>
            ) : null}
          </View>
        )}

        {isUser ? <UserAvatar uri={userAvatarUri} /> : null}
      </View>

      {!isUser && item.structured ? (
        <AIStructuredContent
          structured={item.structured}
          navigation={navigation}
          onSuggestionPress={onSuggestionPress}
        />
      ) : null}

      {!isUser && isLast && actionProposals?.length > 0 ? (
        <AIActionBar proposals={actionProposals} navigation={navigation} />
      ) : null}
    </View>
  );
});

// ─── Starter card ─────────────────────────────────────────────────────────────

const StarterCard = ({ prompt, onPress }) => (
  <TouchableOpacity
    style={styles.starterCard}
    activeOpacity={0.7}
    onPress={() => onPress(prompt.text)}
  >
    <View style={styles.starterIcon}>
      <Ionicons name={prompt.icon} size={scale(16)} color="#8A5509" />
    </View>
    <Text style={styles.starterText} numberOfLines={2}>{prompt.text}</Text>
    <Ionicons name="chevron-forward" size={scale(14)} color="#C9A96B" />
  </TouchableOpacity>
);

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AIAssistantScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const alert = useAlert();

  const userAvatarUri = useMemo(
    () => user?.photoURL || user?.avatar_url || null,
    [user?.photoURL, user?.avatar_url]
  );

  const {
    messages,
    loading,
    booting,
    actionProposals,
    sendMessage,
    startNewConversation,
  } = useAIConversation({ screenContext: "ai_assistant" });

  const [input, setInput]           = useState("");
  const [attachment, setAttachment] = useState(null);
  const [aiAvatarSource, setAiAvatarSource] = useState(AI_AVATAR_ICO);
  const listRef = useRef(null);

  // Load ICO avatar on component mount
  useEffect(() => {
    const loadIcoAvatar = async () => {
      try {
        const icoSource = await IcoHandler.getIcoSource(AI_AVATAR_ICO);
        setAiAvatarSource(icoSource);
      } catch (error) {
        console.warn('Failed to load ICO avatar:', error);
        // Keep the original ICO as fallback
      }
    };
    loadIcoAvatar();
  }, []);

  const hasMessages = messages.length > 0;

  const scrollToEnd = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 120);
  }, []);

  const handleAttach = useCallback(async () => {
    if (loading) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
        type: "*/*",
      });
      if (result.canceled) return;
      const file = result.assets?.[0];
      if (!file) return;
      setAttachment({
        name: file.name || "Attached file",
        uri: file.uri,
        size: file.size || 0,
        mimeType: file.mimeType || "",
      });
    } catch (e) {
      alert?.warning?.("Attachment", e?.message || "Could not attach file.");
    }
  }, [loading, alert]);

  const handleSend = useCallback(async (textOverride = null) => {
    try {
      const text = String(textOverride || input || "").trim();
      if (!text && !attachment) return;
      if (loading) return;

      const finalText = text || "Please review the attached file.";
      const sentAttachment = attachment ? { ...attachment } : null;
      setInput("");
      setAttachment(null);

      await sendMessage({ text: finalText, attachment: sentAttachment });
      scrollToEnd();
    } catch (error) {
      alert?.warning?.("Error", "Failed to send message. Please try again.");
    }
  }, [input, attachment, loading, sendMessage, scrollToEnd, alert]);

  const handleSuggestionPress = useCallback((text) => {
    try {
      handleSend(text);
    } catch (error) {
      alert?.warning?.("Error", "Failed to send message. Please try again.");
    }
  }, [handleSend, alert]);

  const handleNewConversation = useCallback(async () => {
    await startNewConversation();
    setInput("");
    setAttachment(null);
  }, [startNewConversation]);

  // Enrich list items with computed isLast flag
  const listData = useMemo(() => {
    return messages.map((m, i) => ({
      ...m,
      _isLast: isLastAssistantMsg(messages, i),
    }));
  }, [messages]);

  const renderItem = useCallback(({ item }) => (
    <MessageRow
      item={item}
      isLast={item._isLast}
      userAvatarUri={userAvatarUri}
      actionProposals={item._isLast ? actionProposals : []}
      navigation={navigation}
      onSuggestionPress={handleSuggestionPress}
    />
  ), [userAvatarUri, actionProposals, navigation, handleSuggestionPress]);

  const keyExtractor = useCallback(
    (item) => item.message_id || item.id || String(Math.random()),
    []
  );

  const canSend = !loading && (!!String(input || "").trim() || !!attachment);

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#4E2C10" />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <LinearGradient
        colors={["#5B3B1F", "#7A4F2C"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.headerBtn}
          activeOpacity={0.85}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={scale(26)} color="#FEF7E6" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.headerAvatarWrap}>
            <Image source={aiAvatarSource} style={styles.headerAvatar} contentFit="cover" />
          </View>
          <View>
            <Text style={styles.headerTitle}>VaultHive AI</Text>
            <Text style={styles.headerSub}>
              {loading ? "Thinking…" : "Your purchase assistant"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.headerBtn}
          activeOpacity={0.85}
          onPress={handleNewConversation}
        >
          <Ionicons name="create-outline" size={scale(22)} color="#F6D586" />
        </TouchableOpacity>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
        keyboardVerticalOffset={0}
      >
        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {!hasMessages && !booting ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyHero}>
              <Image source={aiAvatarSource} style={styles.emptyAvatar} contentFit="cover" />
            </View>
            <Text style={styles.emptyTitle}>How can I help?</Text>
            <Text style={styles.emptySub}>
              Ask about purchases, warranties & reminders
            </Text>
            <View style={styles.startersGrid}>
              {STARTER_PROMPTS.reduce((rows, prompt, index) => {
                if (index % 2 === 0) {
                  rows.push([prompt]);
                } else {
                  rows[rows.length - 1].push(prompt);
                }
                return rows;
              }, []).map((row, rowIndex) => (
                <View key={rowIndex} style={styles.starterRow}>
                  {row.map((p) => (
                    <StarterCard key={p.id} prompt={p} onPress={handleSuggestionPress} />
                  ))}
                </View>
              ))}
            </View>
          </View>
        ) : (
          /* ── Message list ─────────────────────────────────────────────── */
          <FlatList
            ref={listRef}
            data={listData}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToEnd}
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={loading ? <AITypingIndicator /> : null}
          />
        )}

        {/* ── Composer ────────────────────────────────────────────────────── */}
        <View
          style={[
            styles.composerOuter,
            { paddingBottom: Math.max(insets.bottom + 6, 14) },
          ]}
        >
          {attachment ? (
            <View style={styles.attachBar}>
              <View style={styles.attachBarLeft}>
                <Ionicons name="document-attach-outline" size={scale(15)} color="#5B3B1F" />
                <Text style={styles.attachBarText} numberOfLines={1}>
                  {attachmentLabel(attachment)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setAttachment(null)} activeOpacity={0.8}>
                <Ionicons name="close-circle" size={scale(20)} color="#9A6030" />
              </TouchableOpacity>
            </View>
          ) : null}

          <LinearGradient
            colors={["#C9973A", "#F0DD98", "#C89636"]}
            start={{ x: 0.03, y: 0.3 }}
            end={{ x: 0.97, y: 0.7 }}
            style={styles.composer}
          >
            <TouchableOpacity
              style={styles.composerBtn}
              activeOpacity={0.85}
              onPress={handleAttach}
            >
              <Ionicons name="add" size={scale(22)} color="#4E2C10" />
            </TouchableOpacity>

            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask about your purchases…"
              placeholderTextColor="#7A5225"
              style={styles.input}
              multiline
              textAlignVertical="center"
            />

            <TouchableOpacity
              style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
              activeOpacity={0.85}
              disabled={!canSend}
              onPress={() => handleSend()}
            >
              <Ionicons name="send" size={scale(17)} color="#FFFBF0" />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: "#F6F2EA" },
  flex:  { flex: 1 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(6),
    paddingTop: 0,
    paddingBottom: scale(12),
  },
  headerBtn: {
    width: scale(44),
    height: scale(44),
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
  },
  headerAvatarWrap: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    overflow: "hidden",
    backgroundColor: "#D4A04A",
  },
  headerAvatar: { width: "100%", height: "100%" },
  headerTitle: {
    color: "#FEF7E6",
    fontSize: getFontSize(16),
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  headerSub: {
    color: "#F6D586",
    fontSize: getFontSize(11),
    fontWeight: "500",
    opacity: 0.85,
  },

  // Empty / starter
  emptyState: {
    flex: 1,
    paddingHorizontal: scale(20),
    paddingTop: scale(20),
    alignItems: "center",
  },
  emptyHero: {
    width: scale(60),
    height: scale(60),
    borderRadius: scale(30),
    overflow: "hidden",
    marginBottom: scale(12),
    backgroundColor: "#E8D4A0",
  },
  emptyAvatar: { width: "100%", height: "100%" },
  emptyTitle: {
    fontSize: getFontSize(20),
    fontWeight: "700",
    color: "#3D2208",
    marginBottom: scale(6),
    letterSpacing: -0.4,
  },
  emptySub: {
    fontSize: getFontSize(13),
    color: "#8A5509",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: scale(20),
    paddingHorizontal: scale(12),
  },
  startersGrid: { width: "100%", gap: scale(12) },
  starterRow: { flexDirection: "row", gap: scale(12) },
  starterCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBF2",
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: "#EDD898",
    paddingHorizontal: scale(12),
    paddingVertical: scale(10),
    gap: scale(8),
  },
  starterIcon: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(8),
    backgroundColor: "#FEF7E6",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  starterText: {
    flex: 1,
    fontSize: getFontSize(12),
    color: "#3D2208",
    fontWeight: "600",
    lineHeight: 16,
  },

  // Message list
  listContent: { paddingTop: scale(16), paddingBottom: scale(8) },
  msgBlock:    { marginBottom: scale(6) },
  msgRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: scale(12),
  },
  msgRowLeft:  { justifyContent: "flex-start" },
  msgRowRight: { justifyContent: "flex-end" },

  // Avatars
  avatarWrap: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    overflow: "hidden",
    marginHorizontal: scale(4),
    flexShrink: 0,
    backgroundColor: "#D4A04A",
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarFallback: {
    flex: 1,
    backgroundColor: "#5B3B1F",
    alignItems: "center",
    justifyContent: "center",
  },

  // Bubbles
  userBubble: {
    maxWidth: "76%",
    backgroundColor: "#5B3B1F",
    borderRadius: scale(20),
    borderBottomRightRadius: scale(5),
    paddingHorizontal: scale(16),
    paddingVertical: scale(11),
  },
  userText: {
    fontSize: getFontSize(15),
    color: "#FEF7E6",
    lineHeight: 22,
    fontWeight: "500",
  },
  asstBubble: {
    maxWidth: "76%",
    backgroundColor: "#FFFBF0",
    borderRadius: scale(20),
    borderBottomLeftRadius: scale(5),
    paddingHorizontal: scale(16),
    paddingVertical: scale(11),
    borderWidth: 1,
    borderColor: "#EDD898",
  },
  asstText: {
    fontSize: getFontSize(15),
    color: "#2A1505",
    lineHeight: 22,
    fontWeight: "500",
  },

  // Attachment badge inside user bubble
  attachBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: scale(10),
    paddingHorizontal: scale(8),
    paddingVertical: scale(5),
    marginBottom: scale(6),
    gap: scale(5),
  },
  attachBadgeText: {
    flex: 1,
    fontSize: getFontSize(11),
    color: "#FFE9A8",
    fontWeight: "600",
  },

  // Composer
  composerOuter: {
    paddingHorizontal: scale(14),
    paddingTop: scale(10),
    backgroundColor: "#F6F2EA",
    borderTopWidth: 1,
    borderTopColor: "#EDD898",
  },
  attachBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEDCA0",
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: "#D0A24A",
    paddingHorizontal: scale(12),
    paddingVertical: scale(8),
    marginBottom: scale(8),
    gap: scale(8),
  },
  attachBarLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
  },
  attachBarText: {
    flex: 1,
    fontSize: getFontSize(11),
    color: "#2A1B0D",
    fontWeight: "600",
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: scale(28),
    paddingLeft: scale(8),
    paddingRight: scale(8),
    paddingVertical: scale(6),
    minHeight: scale(54),
  },
  composerBtn: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    minHeight: scale(22),
    maxHeight: scale(110),
    paddingHorizontal: scale(10),
    paddingTop: scale(6),
    paddingBottom: scale(6),
    color: "#3D2208",
    fontSize: getFontSize(15),
    lineHeight: 21,
    fontWeight: "500",
  },
  sendBtn: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(19),
    backgroundColor: "#5B3B1F",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: scale(4),
  },
  sendBtnDisabled: { opacity: 0.4 },
});
