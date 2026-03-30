/**
 * AIStructuredContent
 *
 * Renders the rich structured part of an assistant response:
 *   1. Sections (titled bullet lists — no markdown symbols)
 *   2. Cards   (store / receipt / warranty / hub / action)
 *   3. Suggestions (follow-up chip row)
 *
 * Sits below the text bubble of an assistant message.
 * All content is clean — no asterisks, hashes, or backticks.
 */

import React, { memo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import AICardItem from "./AICardItem";
import { scale, getFontSize } from "../../utils/responsive";

// ─── Section ──────────────────────────────────────────────────────────────────

const Section = memo(({ section }) => {
  if (!section?.title && !section?.items?.length) return null;
  return (
    <View style={styles.section}>
      {!!section.title ? (
        <Text style={styles.sectionTitle}>{section.title}</Text>
      ) : null}
      {(section.items || []).map((item, idx) => (
        <View key={idx} style={styles.bulletRow}>
          <View style={styles.bullet} />
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
});

// ─── Suggestion chips ─────────────────────────────────────────────────────────

const SuggestionChip = memo(({ text, onPress }) => (
  <TouchableOpacity
    style={styles.chip}
    activeOpacity={0.8}
    onPress={() => onPress?.(text)}
  >
    <Text style={styles.chipText} numberOfLines={1}>{text}</Text>
    <Ionicons name="arrow-forward-outline" size={scale(11)} color="#8A5509" style={styles.chipArrow} />
  </TouchableOpacity>
));

// ─── Main component ───────────────────────────────────────────────────────────

function AIStructuredContent({ structured, navigation, onSuggestionPress }) {
  if (!structured) return null;

  const hasSections    = structured.sections?.length > 0;
  const hasCards       = structured.cards?.length > 0;
  const hasSuggestions = structured.suggestions?.length > 0;

  if (!hasSections && !hasCards && !hasSuggestions) return null;

  return (
    <View style={styles.container}>
      {/* Sections */}
      {hasSections ? (
        <View style={styles.sectionsWrap}>
          {structured.sections.map((s, i) => (
            <Section key={i} section={s} />
          ))}
        </View>
      ) : null}

      {/* Cards */}
      {hasCards ? (
        <View style={styles.cardsWrap}>
          {structured.cards.map((card, i) => (
            <AICardItem key={card.ref_id || i} card={card} navigation={navigation} />
          ))}
        </View>
      ) : null}

      {/* Suggestion chips */}
      {hasSuggestions ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsContent}
        >
          {structured.suggestions.map((s, i) => (
            <SuggestionChip key={i} text={s} onPress={onSuggestionPress} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

export default memo(AIStructuredContent);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginTop: scale(10),
    marginLeft: scale(52),   // aligns with assistant bubble left edge
    marginRight: scale(8),
  },

  // Sections
  sectionsWrap: {
    marginBottom: scale(8),
  },

  section: {
    backgroundColor: "#FFFBF2",
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: "#F0DDB8",
    padding: scale(12),
    marginBottom: scale(8),
  },

  sectionTitle: {
    fontSize: getFontSize(11),
    fontWeight: "700",
    color: "#8A5509",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: scale(8),
  },

  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: scale(5),
  },

  bullet: {
    width: scale(5),
    height: scale(5),
    borderRadius: scale(3),
    backgroundColor: "#C9A96B",
    marginTop: scale(5),
    marginRight: scale(10),
    flexShrink: 0,
  },

  bulletText: {
    flex: 1,
    fontSize: getFontSize(13),
    color: "#5B3B1F",
    lineHeight: 19,
    fontWeight: "500",
  },

  // Cards
  cardsWrap: {
    marginBottom: scale(4),
  },

  // Suggestion chips
  chipsScroll: {
    marginTop: scale(4),
  },

  chipsContent: {
    paddingRight: scale(8),
    gap: scale(7),
    flexDirection: "row",
  },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(12),
    paddingVertical: scale(7),
    borderRadius: scale(20),
    backgroundColor: "#FEF7E6",
    borderWidth: 1,
    borderColor: "#DCA94D",
  },

  chipText: {
    fontSize: getFontSize(12),
    color: "#5B3B1F",
    fontWeight: "600",
    maxWidth: scale(180),
  },

  chipArrow: {
    marginLeft: scale(4),
  },
});
