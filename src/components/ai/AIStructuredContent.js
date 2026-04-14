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
import { UI } from "./aiTheme";

const Section = memo(({ section }) => {
  if (!section?.title && !section?.items?.length) return null;

  return (
    <View style={styles.section}>
      {!!section.title ? <Text style={styles.sectionTitle}>{section.title}</Text> : null}

      {(section.items || []).map((item, index) => (
        <View key={`${section.title || "section"}-${index}`} style={styles.bulletRow}>
          <View style={styles.bullet} />
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
});

const SuggestionChip = memo(({ text, onPress }) => (
  <TouchableOpacity
    style={styles.chip}
    activeOpacity={0.82}
    onPress={() => onPress?.(text)}
  >
    <Text style={styles.chipText} numberOfLines={1}>
      {text}
    </Text>
    <Ionicons
      name="arrow-forward-outline"
      size={scale(11)}
      color={UI.brownMuted}
      style={styles.chipArrow}
    />
  </TouchableOpacity>
));

function AIStructuredContent({ structured, navigation, onSuggestionPress }) {
  if (!structured) return null;

  const hasSections = structured.sections?.length > 0;
  const hasCards = structured.cards?.length > 0;
  const hasSuggestions = structured.suggestions?.length > 0;

  if (!hasSections && !hasCards && !hasSuggestions) return null;

  return (
    <View style={styles.container}>
      {hasSections ? (
        <View style={styles.sectionsWrap}>
          {structured.sections.map((section, index) => (
            <Section key={`section-${index}`} section={section} />
          ))}
        </View>
      ) : null}

      {hasCards ? (
        <View style={styles.cardsWrap}>
          {structured.cards.map((card, index) => (
            <AICardItem
              key={card.ref_id || `card-${index}`}
              card={card}
              navigation={navigation}
            />
          ))}
        </View>
      ) : null}

      {hasSuggestions ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsContent}
        >
          {structured.suggestions.map((suggestion, index) => (
            <SuggestionChip
              key={`suggestion-${index}`}
              text={suggestion}
              onPress={onSuggestionPress}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

export default memo(AIStructuredContent);

const styles = StyleSheet.create({
  container: {
    marginTop: scale(8),
    marginLeft: scale(46),
    marginRight: scale(10),
  },

  sectionsWrap: {
    marginBottom: scale(8),
  },

  section: {
    backgroundColor: UI.surface,
    borderRadius: scale(14),
    borderWidth: 1,
    borderColor: UI.goldBorderSoft,
    padding: scale(12),
    marginBottom: scale(8),
  },

  sectionTitle: {
    fontSize: getFontSize(11),
    fontWeight: "800",
    color: UI.brownSoft,
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
    backgroundColor: UI.brownSoft,
    marginTop: scale(6),
    marginRight: scale(10),
    flexShrink: 0,
  },

  bulletText: {
    flex: 1,
    fontSize: getFontSize(13),
    color: UI.brownText,
    lineHeight: 19,
    fontWeight: "600",
  },

  cardsWrap: {
    marginBottom: scale(4),
  },

  chipsScroll: {
    marginTop: scale(4),
  },

  chipsContent: {
    paddingRight: scale(8),
  },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(12),
    paddingVertical: scale(7),
    borderRadius: scale(18),
    backgroundColor: UI.surface,
    borderWidth: 1,
    borderColor: UI.goldBorder,
    marginRight: scale(7),
  },

  chipText: {
    fontSize: getFontSize(12),
    color: UI.brownText,
    fontWeight: "700",
    maxWidth: scale(180),
  },

  chipArrow: {
    marginLeft: scale(4),
  },
});