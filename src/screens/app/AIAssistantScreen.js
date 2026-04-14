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
import { UI } from "../../components/ai/aiTheme";

import { scale, getFontSize } from "../../utils/responsive";
import { IcoHandler } from "../../utils/icoHandler";

const STARTER_PROMPTS = [
  { id: "p1", icon: "flash-outline", text: "What needs my attention?" },
  { id: "p2", icon: "shield-checkmark-outline", text: "Show expiring warranties" },
  { id: "p3", icon: "storefront-outline", text: "Recommend a store for me" },
  { id: "p4", icon: "receipt-outline", text: "Summarize my spending" },
  { id: "p5", icon: "cube-outline", text: "Review my purchase vault" },
  { id: "p6", icon: "alarm-outline", text: "What reminders are coming?" },
];

const HISTORY_ROUTE_CANDIDATES = [
  "AIChatHistory",
  "AIAssistantHistory",
  "AIHistory",
  "ChatHistory",
];

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentLabel(file) {
  if (!file) return "";
  const size = formatBytes(file.size);
  return size ? `${file.name} · ${size}` : file.name || "Attached file";
}

function isLastAssistantMsg(messages, index) {
  if (messages[index]?.role !== "assistant") return false;
  for (let i = index + 1; i < messages.length; i += 1) {
    if (messages[i].role === "assistant") return false;
  }
  return true;
}

const UserAvatar = ({ uri }) => (
  <View style={styles.avatarWrap}>
    {uri ? (
      <Image source={{ uri }} style={styles.avatarImg} contentFit="cover" />
    ) : (
      <View style={styles.avatarFallback}>
        <Ionicons name="person" size={scale(16)} color={UI.surface} />
      </View>
    )}
  </View>
);

const AIAvatar = ({ avatarSource }) => {
  const [icoSource, setIcoSource] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadIco = async () => {
      try {
        const icoAsset = require("../../../assets/AIicon.ico");
        const source = await IcoHandler.getIcoSource(icoAsset);
        if (mounted) setIcoSource(source);
      } catch (error) {
        if (mounted) setIcoSource(null);
      }
    };

    if (!avatarSource) loadIco();

    return () => {
      mounted = false;
    };
  }, [avatarSource]);

  return (
    <View style={styles.avatarWrap}>
      <Image
        source={avatarSource || icoSource || require("../../../assets/icon.png")}
        style={styles.avatarImg}
        contentFit="cover"
      />
    </View>
  );
};

const AssistantBubble = ({ text }) => (
  <LinearGradient
    colors={UI.assistantGradientColors}
    locations={UI.assistantGradientLocations}
    start={{ x: 0, y: 0.5 }}
    end={{ x: 1, y: 0.5 }}
    style={styles.assistantBubble}
  >
    {!!text ? <Text style={styles.assistantText}>{text}</Text> : null}
  </LinearGradient>
);

const StarterCard = ({ prompt, onPress }) => (
  <TouchableOpacity
    activeOpacity={0.84}
    onPress={() => onPress(prompt.text)}
    style={styles.starterCard}
  >
    <LinearGradient
      colors={UI.assistantGradientColors}
      locations={UI.assistantGradientLocations}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={styles.starterCardInner}
    >
      <View style={styles.starterIconWrap}>
        <Ionicons name={prompt.icon} size={scale(16)} color={UI.brownMuted} />
      </View>

      <Text style={styles.starterText} numberOfLines={2}>
        {prompt.text}
      </Text>

      <Ionicons name="chevron-forward" size={scale(14)} color={UI.brownSoft} />
    </LinearGradient>
  </TouchableOpacity>
);

const MessageRow = React.memo(function MessageRow({
  item,
  isLast,
  userAvatarUri,
  actionProposals,
  navigation,
  onSuggestionPress,
  aiAvatarSource,
}) {
  const isUser = item.role === "user";

  return (
    <View style={styles.messageBlock}>
      <View style={[styles.messageRow, isUser ? styles.messageRowRight : styles.messageRowLeft]}>
        {!isUser ? <AIAvatar avatarSource={aiAvatarSource} /> : null}

        {isUser ? (
          <View style={styles.userBubble}>
            {item.attachment ? (
              <View style={styles.attachmentBadge}>
                <Ionicons
                  name="document-attach-outline"
                  size={scale(13)}
                  color={UI.goldHint}
                />
                <Text style={styles.attachmentBadgeText} numberOfLines={1}>
                  {attachmentLabel(item.attachment)}
                </Text>
              </View>
            ) : null}

            {!!item.text ? <Text style={styles.userText}>{item.text}</Text> : null}
          </View>
        ) : (
          <AssistantBubble text={item.text} />
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

  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [aiAvatarSource, setAiAvatarSource] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const loadIcoAvatar = async () => {
      try {
        const icoAsset = require("../../../assets/AIicon.ico");
        const icoSource = await IcoHandler.getIcoSource(icoAsset);
        if (mounted) setAiAvatarSource(icoSource);
      } catch (error) {
        if (mounted) setAiAvatarSource(require("../../../assets/icon.png"));
      }
    };

    loadIcoAvatar();

    return () => {
      mounted = false;
    };
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
    } catch (error) {
      alert?.warning?.("Attachment", error?.message || "Could not attach file.");
    }
  }, [alert, loading]);

  const handleSend = useCallback(
    async (textOverride = null) => {
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
    },
    [alert, attachment, input, loading, scrollToEnd, sendMessage]
  );

  const handleSuggestionPress = useCallback(
    (text) => {
      handleSend(text);
    },
    [handleSend]
  );

  const handleNewConversation = useCallback(async () => {
    await startNewConversation();
    setInput("");
    setAttachment(null);
  }, [startNewConversation]);

  const handleOpenHistory = useCallback(() => {
    const routeNames = navigation?.getState?.()?.routeNames || [];
    const historyRoute = HISTORY_ROUTE_CANDIDATES.find((name) =>
      routeNames.includes(name)
    );

    if (historyRoute) {
      navigation.navigate(historyRoute);
      return;
    }

    alert?.warning?.(
      "Chat history",
      "Add a history screen route like AIChatHistory to open previous chats."
    );
  }, [alert, navigation]);

  const listData = useMemo(
    () =>
      (messages || []).map((message, index) => ({
        ...message,
        _isLast: isLastAssistantMsg(messages || [], index),
      })),
    [messages]
  );

  const renderItem = useCallback(
    ({ item }) => (
      <MessageRow
        item={item}
        isLast={item._isLast}
        userAvatarUri={userAvatarUri}
        actionProposals={item._isLast ? actionProposals : []}
        navigation={navigation}
        onSuggestionPress={handleSuggestionPress}
        aiAvatarSource={aiAvatarSource}
      />
    ),
    [
      actionProposals,
      aiAvatarSource,
      handleSuggestionPress,
      navigation,
      userAvatarUri,
    ]
  );

  const keyExtractor = useCallback(
    (item, index) => item.message_id || item.id || `message-${index}`,
    []
  );

  const canSend = !loading && (!!String(input || "").trim() || !!attachment);

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={UI.brown} translucent={false} />

      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
        >
          <Ionicons name="chevron-back" size={scale(24)} color={UI.surface} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>VaultHive AI Assistant</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleOpenHistory}
          onLongPress={handleNewConversation}
          style={styles.headerButton}
        >
          <Ionicons name="time-outline" size={scale(20)} color={UI.surface} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {!hasMessages && !booting ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEyebrow}>VaultHive AI Assistant</Text>
            <Text style={styles.emptyTitle}>How can I help?</Text>
            <Text style={styles.emptySub}>
              Ask about purchases, warranties, reminders, and next steps.
            </Text>

            <View style={styles.startersGrid}>
              {STARTER_PROMPTS.reduce((rows, prompt, index) => {
                if (index % 2 === 0) rows.push([prompt]);
                else rows[rows.length - 1].push(prompt);
                return rows;
              }, []).map((row, rowIndex) => (
                <View key={`row-${rowIndex}`} style={styles.starterRow}>
                  {row.map((prompt) => (
                    <StarterCard
                      key={prompt.id}
                      prompt={prompt}
                      onPress={handleSuggestionPress}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>
        ) : (
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

        <View
          style={[
            styles.composerOuter,
            { paddingBottom: Math.max(insets.bottom + scale(6), scale(12)) },
          ]}
        >
          {attachment ? (
            <View style={styles.attachBar}>
              <View style={styles.attachBarLeft}>
                <Ionicons
                  name="document-attach-outline"
                  size={scale(15)}
                  color={UI.brown}
                />
                <Text style={styles.attachBarText} numberOfLines={1}>
                  {attachmentLabel(attachment)}
                </Text>
              </View>

              <TouchableOpacity activeOpacity={0.8} onPress={() => setAttachment(null)}>
                <Ionicons name="close-circle" size={scale(20)} color={UI.brownMuted} />
              </TouchableOpacity>
            </View>
          ) : null}

          <LinearGradient
            colors={UI.composerGradientColors}
            locations={UI.composerGradientLocations}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.composer}
          >
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleAttach}
              style={styles.plusButton}
            >
              <Ionicons name="add" size={scale(22)} color={UI.surface} />
            </TouchableOpacity>

            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Type a message..."
              placeholderTextColor="#9F742D"
              style={styles.input}
              multiline
              textAlignVertical="center"
              selectionColor={UI.brownMuted}
            />

            <TouchableOpacity activeOpacity={0.85} onPress={() => {}} style={styles.micButton}>
              <Ionicons name="mic-outline" size={scale(16)} color={UI.surface} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!canSend}
              onPress={() => handleSend()}
              style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
            >
              <Ionicons name="send" size={scale(18)} color={UI.surface} />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: UI.screen,
  },

  flex: {
    flex: 1,
  },

  header: {
    backgroundColor: UI.brown,
    flexDirection: "row",
    alignItems: "center",
    minHeight: scale(54),
    paddingHorizontal: scale(8),
    paddingBottom: scale(6),
  },

  headerButton: {
    width: scale(40),
    height: scale(40),
    alignItems: "center",
    justifyContent: "center",
  },

  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    color: UI.surface,
    fontSize: getFontSize(16),
    fontWeight: "800",
    letterSpacing: -0.2,
  },

  emptyState: {
    flex: 1,
    paddingTop: scale(18),
    paddingHorizontal: scale(14),
  },

  emptyEyebrow: {
    color: UI.brownMuted,
    fontSize: getFontSize(11),
    fontWeight: "700",
    marginBottom: scale(4),
  },

  emptyTitle: {
    color: UI.brownText,
    fontSize: getFontSize(23),
    fontWeight: "800",
    marginBottom: scale(6),
  },

  emptySub: {
    color: UI.brownMuted,
    fontSize: getFontSize(12),
    lineHeight: 18,
    marginBottom: scale(16),
  },

  startersGrid: {
    width: "100%",
  },

  starterRow: {
    flexDirection: "row",
    marginBottom: scale(10),
  },

  starterCard: {
    flex: 1,
    marginHorizontal: scale(3),
    borderRadius: scale(17),
    overflow: "hidden",
  },

  starterCardInner: {
    minHeight: scale(74),
    borderRadius: scale(17),
    borderWidth: 1,
    borderColor: UI.goldBorder,
    paddingHorizontal: scale(12),
    paddingVertical: scale(10),
    flexDirection: "row",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: UI.shadow,
        shadowOpacity: 0.08,
        shadowRadius: scale(5),
        shadowOffset: { width: 0, height: 2 },
      },
      android: {
        elevation: 2,
      },
    }),
  },

  starterIconWrap: {
    width: scale(26),
    height: scale(26),
    borderRadius: scale(13),
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: scale(8),
  },

  starterText: {
    flex: 1,
    color: UI.brownText,
    fontSize: getFontSize(12),
    lineHeight: 15,
    fontWeight: "700",
    marginRight: scale(6),
  },

  listContent: {
    paddingTop: scale(10),
    paddingBottom: scale(8),
  },

  messageBlock: {
    marginBottom: scale(12),
  },

  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: scale(8),
  },

  messageRowLeft: {
    justifyContent: "flex-start",
  },

  messageRowRight: {
    justifyContent: "flex-end",
  },

  avatarWrap: {
    width: scale(34),
    height: scale(34),
    borderRadius: scale(17),
    overflow: "hidden",
    marginHorizontal: scale(4),
    backgroundColor: UI.goldAvatar,
  },

  avatarImg: {
    width: "100%",
    height: "100%",
  },

  avatarFallback: {
    flex: 1,
    backgroundColor: UI.brown,
    alignItems: "center",
    justifyContent: "center",
  },

  userBubble: {
    maxWidth: "68%",
    backgroundColor: UI.brown,
    borderRadius: scale(20),
    borderBottomRightRadius: scale(6),
    paddingHorizontal: scale(14),
    paddingVertical: scale(10),
  },

  userText: {
    color: UI.surface,
    fontSize: getFontSize(14),
    lineHeight: 19,
    fontWeight: "700",
  },

  assistantBubble: {
    maxWidth: "72%",
    borderRadius: scale(20),
    borderBottomLeftRadius: scale(6),
    paddingHorizontal: scale(14),
    paddingVertical: scale(10),
    borderWidth: 1,
    borderColor: UI.goldBorder,
    ...Platform.select({
      ios: {
        shadowColor: UI.shadow,
        shadowOpacity: 0.1,
        shadowRadius: scale(6),
        shadowOffset: { width: 0, height: 3 },
      },
      android: {
        elevation: 2,
      },
    }),
  },

  assistantText: {
    color: UI.brownText,
    fontSize: getFontSize(13.5),
    lineHeight: 19,
    fontWeight: "700",
  },

  attachmentBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: scale(10),
    paddingHorizontal: scale(8),
    paddingVertical: scale(5),
    marginBottom: scale(6),
  },

  attachmentBadgeText: {
    flex: 1,
    color: UI.goldHint,
    fontSize: getFontSize(11),
    fontWeight: "700",
    marginLeft: scale(5),
  },

  composerOuter: {
    backgroundColor: UI.screen,
    borderTopWidth: 1,
    borderTopColor: UI.divider,
    paddingHorizontal: scale(8),
    paddingTop: scale(8),
  },

  attachBar: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: UI.goldBorder,
    backgroundColor: UI.surfaceSoft,
    borderRadius: scale(14),
    paddingHorizontal: scale(12),
    paddingVertical: scale(8),
    marginBottom: scale(8),
  },

  attachBarLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  attachBarText: {
    flex: 1,
    marginLeft: scale(6),
    color: UI.brownText,
    fontSize: getFontSize(11),
    fontWeight: "700",
  },

  composer: {
    minHeight: scale(50),
    borderRadius: scale(25),
    borderWidth: 1,
    borderColor: "#C8953D",
    paddingLeft: scale(10),
    paddingRight: scale(8),
    paddingVertical: scale(4),
    flexDirection: "row",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: UI.shadow,
        shadowOpacity: 0.12,
        shadowRadius: scale(6),
        shadowOffset: { width: 0, height: 3 },
      },
      android: {
        elevation: 3,
      },
    }),
  },

  plusButton: {
    width: scale(28),
    height: scale(28),
    alignItems: "center",
    justifyContent: "center",
    marginRight: scale(3),
  },

  input: {
    flex: 1,
    minHeight: scale(24),
    maxHeight: scale(110),
    paddingHorizontal: scale(6),
    paddingVertical: scale(6),
    color: UI.brownText,
    fontSize: getFontSize(14),
    lineHeight: 19,
    fontWeight: "600",
  },

  micButton: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    backgroundColor: "rgba(140,95,33,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: scale(4),
  },

  sendButton: {
    width: scale(28),
    height: scale(28),
    alignItems: "center",
    justifyContent: "center",
  },

  sendButtonDisabled: {
    opacity: 0.4,
  },
});