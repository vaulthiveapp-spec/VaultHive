import React, { useMemo, useState } from "react";
import { Platform, TouchableOpacity, View, StyleSheet } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import Ionicons from "react-native-vector-icons/Ionicons";

import Input from "./Input";
import { VaultColors } from "../styles/DesignSystem";
import { scale } from "../utils/responsive";

function toDate(value) {
  const s = String(value || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00`);
    if (!Number.isNaN(d.getTime())) return d;
  }

  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function toIsoDate(date) {
  if (!date || Number.isNaN(date.getTime?.())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function DateInput({
  label,
  value,
  onChangeText,
  placeholder = "YYYY-MM-DD",
  style,
  inputStyle,
  error = null,
}) {
  const [open, setOpen] = useState(false);

  const dateValue = useMemo(() => toDate(value), [value]);
  const iconTop = label ? scale(37) : scale(13);

  return (
    <View style={style}>
      <TouchableOpacity activeOpacity={0.9} onPress={() => setOpen(true)}>
        <Input
          label={label}
          value={String(value || "")}
          onChangeText={onChangeText}
          placeholder={placeholder}
          editable={false}
          error={error}
          inputStyle={[
            {
              paddingRight: scale(46),
            },
            inputStyle,
          ]}
        />

        <View pointerEvents="none" style={[styles.iconWrap, { top: iconTop }]}>
          <Ionicons
            name="calendar-outline"
            size={scale(18)}
            color={VaultColors.textMuted}
          />
        </View>
      </TouchableOpacity>

      {open ? (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display="default"
          onChange={(event, selected) => {
            if (Platform.OS === "ios") {
              if (event?.type === "set" && selected) {
                onChangeText?.(toIsoDate(selected));
              }
              setOpen(false);
              return;
            }

            setOpen(false);
            if (selected) {
              onChangeText?.(toIsoDate(selected));
            }
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    position: "absolute",
    right: scale(14),
    height: scale(46),
    justifyContent: "center",
    alignItems: "center",
  },
});