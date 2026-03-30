import { VaultColors } from '../styles/DesignSystem';
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const Palette = {
  overlay: '#00000066',
  card: VaultColors.surface,
  primary: VaultColors.textMuted,
  textDark: VaultColors.textPrimary,
  text: VaultColors.textSecondary,
  danger: VaultColors.error,
  warn: VaultColors.warning,
  ok: VaultColors.success,
};

const AlertContext = createContext(null);

const toMs = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export const AlertProvider = ({
  children,
  maxWidth = 520,
  closeOnBackdropPress = true,
  lockAfterPressMs = 250,
  closeOnBackPress = true,
}) => {
  const [state, setState] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    iconName: undefined,
    actions: [{ text: 'OK' }],
    onDismiss: undefined,
    autoCloseMs: undefined,
  });

  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width * 0.96, maxWidth);

  const timerRef = useRef(null);
  const onDismissRef = useRef(undefined);
  const actionLockRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const close = useCallback(() => {
    clearTimer();
    setState((s) => ({ ...s, visible: false }));

    const cb = onDismissRef.current;
    onDismissRef.current = undefined;

    if (typeof cb === 'function') {
      setTimeout(cb, 0);
    }
  }, [clearTimer]);

  const open = useCallback(
    (opts = {}) => {
      clearTimer();

      const next = {
        visible: true,
        title: '',
        message: '',
        type: 'info',
        iconName: undefined,
        actions: [{ text: 'OK' }],
        onDismiss: undefined,
        autoCloseMs: undefined,
        ...opts,
      };

      onDismissRef.current = next.onDismiss;
      setState(next);

      const ms = toMs(next.autoCloseMs);
      if (ms) timerRef.current = setTimeout(close, ms);
    },
    [clearTimer, close]
  );

  const colorByType = useMemo(() => {
    if (state.type === 'success') return Palette.ok;
    if (state.type === 'warning') return Palette.warn;
    if (state.type === 'error') return Palette.danger;
    return Palette.primary;
  }, [state.type]);

  const iconNameByType = useMemo(() => {
    if (state.iconName) return state.iconName;
    if (state.type === 'success') return 'checkmark-circle';
    if (state.type === 'warning') return 'warning';
    if (state.type === 'error') return 'close-circle';
    return 'information-circle';
  }, [state.type, state.iconName]);

  const api = useMemo(
    () => ({
      open,
      close,
      info: (title, message, extra = {}) =>
        open({ type: 'info', title, message, ...extra }),
      success: (title, message, extra = {}) =>
        open({ type: 'success', title, message, ...extra }),
      warning: (title, message, extra = {}) =>
        open({ type: 'warning', title, message, ...extra }),
      error: (title, message, extra = {}) =>
        open({ type: 'error', title, message, ...extra }),
    }),
    [open, close]
  );

  const Backdrop = closeOnBackdropPress ? Pressable : View;

  const handleActionPress = useCallback(
    (action) => {
      if (actionLockRef.current) return;
      actionLockRef.current = true;

      close();

      setTimeout(() => {
        try {
          if (typeof action?.onPress === 'function') action.onPress();
        } finally {
          setTimeout(() => {
            actionLockRef.current = false;
          }, lockAfterPressMs);
        }
      }, 0);
    },
    [close, lockAfterPressMs]
  );

  const handleRequestClose = useCallback(() => {
    close();
  }, [close]);

  const handleShow = useCallback(() => {
    if (!closeOnBackPress) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!state.visible) return false;
      close();
      return true;
    });
    return () => sub.remove();
  }, [closeOnBackPress, close, state.visible]);

  return (
    <AlertContext.Provider value={api}>
      {children}
      <Modal
        transparent
        visible={state.visible}
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        hardwareAccelerated
        onRequestClose={handleRequestClose}
        onShow={handleShow}
      >
        <Backdrop
          style={styles.overlay}
          onPress={closeOnBackdropPress ? close : undefined}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={[styles.card, { width: cardWidth }]}>
              <View style={[styles.iconWrap, { backgroundColor: `${colorByType}1A` }]}>
                <Ionicons name={iconNameByType} size={40} color={colorByType} />
              </View>

              {!!state.title && <Text style={styles.title}>{state.title}</Text>}
              {!!state.message && <Text style={styles.msg}>{state.message}</Text>}

              <View style={styles.actions}>
                {(state.actions && state.actions.length ? state.actions : [{ text: 'OK' }]).map(
                  (a, i) => (
                    <TouchableOpacity
                      key={`${a?.text || 'OK'}-${i}`}
                      style={[
                        styles.btn,
                        a?.style === 'destructive' && styles.btnDestructive,
                      ]}
                      activeOpacity={0.85}
                      onPress={() => handleActionPress(a)}
                    >
                      <Text
                        style={[
                          styles.btnText,
                          a?.style === 'destructive' && styles.btnTextDestructive,
                        ]}
                      >
                        {a?.text || 'OK'}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            </View>
          </Pressable>
        </Backdrop>
      </Modal>
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlert must be used within <AlertProvider>');
  return ctx;
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Palette.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: Palette.card,
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Palette.textDark,
    textAlign: 'center',
    marginBottom: 8,
  },
  msg: {
    fontSize: 16,
    color: Palette.text,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 18,
  },
  actions: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: Palette.primary,
    borderRadius: 24,
    marginTop: 6,
  },
  btnDestructive: {
    backgroundColor: '#FFE7E7',
  },
  btnText: {
    color: VaultColors.surfaceAlt,
    fontWeight: '700',
    fontSize: 16,
  },
  btnTextDestructive: {
    color: Palette.danger,
  },
});
