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
// import { UI } from "../../components/ai/aiTheme";
import { scale, getFontSize } from "../../utils/responsive";
import { IcoHandler } from "../../utils/icoHandler";

const UI = {
  screen: "#F6F2E9",
  cream: "#FEF7E5",
  creamSoft: "#FBF3DE",
  brown: "#5A3B1F",
  brownDeep: "#4E2C10",
  brownText: "#3F250D",
  brownMuted: "#8E6026",
  brownSoft: "#A7782F",
  goldEdgeLeft: "#D2A751",
  goldCenter: "#EBD68D",
  goldEdgeRight: "#CDA044",
  goldBubbleLeft: "#CEA44F",
  goldBubbleCenter: "#ECD796",
  goldBubbleRight: "#D7AF59",
  goldBorder: "#D8B266",
  goldSurface: "#F1DFAB",
  goldSurfaceDark: "#D7B35C",
  goldIconDisc: "#D8B159",
  goldAvatar: "#D4A24B",
  goldHint: "#FFE7A2",
  shadow: "#7B5322",
};

const STARTER_PROMPTS = [
  { id: "p1", icon: "flash-outline", text: "What needs my attention?" },
  { id: "p2", icon: "shield-checkmark-outline", text: "Show expiring warranties" },
  { id: "p3", icon: "storefront-outline", text: "Recommend a store for me" },
  { id: "p4", icon: "receipt-outline", text: "Summarize my spending" },
  { id: "p5", icon: "cube-outline", text: "Review my purchase vault" },
  { id: "p6", icon: "alarm-outline", text: "What reminders are coming?" },
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
        <Ionicons name="person" size={scale(16)} color={UI.cream} />
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

    if (!avatarSource) {
      loadIco();
    }

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
    colors={[UI.goldBubbleLeft, UI.goldBubbleCenter, UI.goldBubbleRight]}
    locations={[0, 0.52, 1]}
    start={{ x: 0, y: 0.5 }}
    end={{ x: 1, y: 0.5 }}
    style={styles.assistantBubble}
  >
    {!!text ? <Text style={styles.assistantText}>{text}</Text> : null}
  </LinearGradient>
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

const StarterCard = ({ prompt, onPress }) => (
  <TouchableOpacity
    style={styles.starterCard}
    activeOpacity={0.85}
    onPress={() => onPress(prompt.text)}
  >
    <LinearGradient
      colors={[UI.goldBubbleLeft, UI.goldBubbleCenter, UI.goldBubbleRight]}
      locations={[0, 0.52, 1]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={styles.starterCardInner}
    >
      <View style={styles.starterIcon}>
        <Ionicons name={prompt.icon} size={scale(16)} color={UI.brownMuted} />
      </View>
      <Text style={styles.starterText} numberOfLines={2}>
        {prompt.text}
      </Text>
      <Ionicons name="chevron-forward" size={scale(14)} color={UI.brownSoft} />
    </LinearGradient>
  </TouchableOpacity>
);

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

  const listData = useMemo(
    () =>
      messages.map((message, index) => ({
        ...message,
        _isLast: isLastAssistantMsg(messages, index),
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
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <StatusBar/>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          activeOpacity={0.85}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={scale(24)} color={UI.cream} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>VaultHive AI Assistant</Text>
        </View>

        <TouchableOpacity
          style={styles.headerButton}
          activeOpacity={0.85}
          onPress={handleNewConversation}
        >
          <Ionicons name="create-outline" size={scale(20)} color={UI.cream} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {!hasMessages && !booting ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptySubtleTitle}>VaultHive AI Assistant</Text>
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
            { paddingBottom: Math.max(insets.bottom + 8, scale(12)) },
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

              <TouchableOpacity
                onPress={() => setAttachment(null)}
                activeOpacity={0.8}
              >
                <Ionicons name="close-circle" size={scale(20)} color={UI.brownMuted} />
              </TouchableOpacity>
            </View>
          ) : null}

          <LinearGradient
            colors={[UI.goldEdgeLeft, UI.goldCenter, UI.goldEdgeRight]}
            locations={[0, 0.52, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.composer}
          >
            <TouchableOpacity
              style={styles.plusButton}
              activeOpacity={0.85}
              onPress={handleAttach}
            >
              <Ionicons name="add" size={scale(24)} color={UI.cream} />
            </TouchableOpacity>

            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Type a message..."
              placeholderTextColor="#9E6F26"
              style={styles.input}
              multiline
              textAlignVertical="center"
              selectionColor={UI.brownMuted}
            />

            <TouchableOpacity style={styles.micButton} activeOpacity={0.85} onPress={() => {}}>
              <Ionicons name="mic-outline" size={scale(18)} color={UI.cream} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
              activeOpacity={0.85}
              disabled={!canSend}
              onPress={() => handleSend()}
            >
              <Ionicons name="send" size={scale(20)} color={UI.cream} />
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
    borderRadius: scale(20),
    alignItems: "center",
    justifyContent: "center",
  },

  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    color: UI.cream,
    fontSize: getFontSize(16),
    fontWeight: "800",
    letterSpacing: -0.2,
  },

  emptyState: {
    flex: 1,
    paddingHorizontal: scale(18),
    paddingTop: scale(26),
  },

  emptySubtleTitle: {
    fontSize: getFontSize(12),
    color: UI.brownMuted,
    fontWeight: "700",
    marginBottom: scale(6),
  },

  emptyTitle: {
    fontSize: getFontSize(22),
    color: UI.brownText,
    fontWeight: "800",
    marginBottom: scale(8),
    letterSpacing: -0.3,
  },

  emptySub: {
    fontSize: getFontSize(13),
    color: UI.brownMuted,
    lineHeight: 18,
    marginBottom: scale(18),
  },

  startersGrid: {
    gap: scale(12),
  },

  starterRow: {
    flexDirection: "row",
    gap: scale(12),
  },

  starterCard: {
    flex: 1,
    borderRadius: scale(18),
    overflow: "hidden",
  },

  starterCardInner: {
    minHeight: scale(78),
    borderRadius: scale(18),
    paddingHorizontal: scale(12),
    paddingVertical: scale(12),
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: UI.goldBorder,
    ...Platform.select({
      ios: {
        shadowColor: UI.shadow,
        shadowOpacity: 0.12,
        shadowRadius: scale(6),
        shadowOffset: { width: 0, height: 3 },
      },
      android: {
        elevation: 2,
      },
    }),
  },

  starterIcon: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: scale(8),
  },

  starterText: {
    flex: 1,
    color: UI.brownText,
    fontSize: getFontSize(12),
    lineHeight: 16,
    fontWeight: "700",
    marginRight: scale(6),
  },

  listContent: {
    paddingTop: scale(12),
    paddingBottom: scale(10),
  },

  messageBlock: {
    marginBottom: scale(12),
  },

  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: scale(10),
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
    flexShrink: 0,
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
    maxWidth: "70%",
    backgroundColor: UI.brown,
    borderRadius: scale(22),
    borderBottomRightRadius: scale(6),
    paddingHorizontal: scale(15),
    paddingVertical: scale(10),
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOpacity: 0.08,
        shadowRadius: scale(6),
        shadowOffset: { width: 0, height: 2 },
      },
      android: {
        elevation: 2,
      },
    }),
  },

  userText: {
    color: UI.cream,
    fontSize: getFontSize(14),
    lineHeight: 20,
    fontWeight: "700",
  },

  assistantBubble: {
    maxWidth: "74%",
    borderRadius: scale(22),
    borderBottomLeftRadius: scale(6),
    paddingHorizontal: scale(15),
    paddingVertical: scale(12),
    borderWidth: 1,
    borderColor: UI.goldBorder,
    ...Platform.select({
      ios: {
        shadowColor: UI.shadow,
        shadowOpacity: 0.12,
        shadowRadius: scale(7),
        shadowOffset: { width: 0, height: 3 },
      },
      android: {
        elevation: 2,
      },
    }),
  },

  assistantText: {
    color: UI.brownText,
    fontSize: getFontSize(14),
    lineHeight: 20,
    fontWeight: "700",
  },

  attachmentBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: scale(10),
    paddingHorizontal: scale(8),
    paddingVertical: scale(5),
    marginBottom: scale(6),
    gap: scale(5),
  },

  attachmentBadgeText: {
    flex: 1,
    color: UI.goldHint,
    fontSize: getFontSize(11),
    fontWeight: "700",
  },

  composerOuter: {
    backgroundColor: UI.screen,
    borderTopWidth: 1,
    borderTopColor: "#E8DBB5",
    paddingHorizontal: scale(8),
    paddingTop: scale(8),
  },

  attachBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: UI.goldSurface,
    borderWidth: 1,
    borderColor: UI.goldBorder,
    borderRadius: scale(14),
    paddingHorizontal: scale(12),
    paddingVertical: scale(8),
    marginBottom: scale(8),
  },

  attachBarLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
  },

  attachBarText: {
    flex: 1,
    color: UI.brownText,
    fontSize: getFontSize(11),
    fontWeight: "700",
  },

  composer: {
    minHeight: scale(50),
    borderRadius: scale(26),
    paddingLeft: scale(12),
    paddingRight: scale(10),
    paddingVertical: scale(4),
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: UI.goldSurfaceDark,
    ...Platform.select({
      ios: {
        shadowColor: UI.shadow,
        shadowOpacity: 0.13,
        shadowRadius: scale(6),
        shadowOffset: { width: 0, height: 3 },
      },
      android: {
        elevation: 3,
      },
    }),
  },

  plusButton: {
    width: scale(32),
    height: scale(32),
    alignItems: "center",
    justifyContent: "center",
    marginRight: scale(2),
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
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    backgroundColor: "rgba(186,145,55,0.38)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: scale(2),
    marginRight: scale(2),
  },

  sendButton: {
    width: scale(30),
    height: scale(30),
    alignItems: "center",
    justifyContent: "center",
  },

  sendButtonDisabled: {
    opacity: 0.42,
  },
});