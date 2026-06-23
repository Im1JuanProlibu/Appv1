import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Modal, View, TouchableOpacity, StyleSheet, PanResponder, Animated, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { ChatCenteredDots, X } from 'phosphor-react-native';
import { getIntegrationConfig } from '../api';

const DEFAULT_TAWK_PROPERTY_ID = '68eff26471d65e194c0d787d';
const DEFAULT_TAWK_WIDGET_ID = '1j7kklmfg';

function escapeJs(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

export default function FloatingHelpButton({ domainProp }) {
  const [open, setOpen] = useState(false);
  const [tawkConfig, setTawkConfig] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [webviewKey, setWebviewKey] = useState(0);
  const insets = useSafeAreaInsets();

  const pan = useRef(new Animated.ValueXY()).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dx, dy }) => Math.abs(dx) > 5 || Math.abs(dy) > 5,
      onPanResponderGrant: () => {
        pan.setOffset({ x: pan.x._value, y: pan.y._value });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => pan.flattenOffset(),
    })
  ).current;

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    try {
      const raw = await AsyncStorage.getItem('auth');
      if (!raw) { setConfigLoaded(true); return; }
      const auth = JSON.parse(raw);
      const u = auth.user || {};
      setUserInfo({
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
        email: u.email || '',
      });

      let propertyId = DEFAULT_TAWK_PROPERTY_ID;
      let widgetId = DEFAULT_TAWK_WIDGET_ID;
      try {
        const config = await getIntegrationConfig(auth.token, 'tawk');
        if (config?.active && config.active !== 'false' && config.siteId) {
          const parts = config.siteId.split('/');
          propertyId = parts[0] || propertyId;
          widgetId = parts[1] || widgetId;
        }
      } catch (_) {}
      setTawkConfig({ propertyId, widgetId });
    } catch (err) {
      console.log('[FloatingHelp] config error:', err.message);
    } finally {
      setConfigLoaded(true);
    }
  };

  const tawkChatUrl = useMemo(() => {
    if (!tawkConfig?.propertyId) return null;
    return `https://tawk.to/chat/${tawkConfig.propertyId}/${tawkConfig.widgetId}`;
  }, [tawkConfig]);

  // Inject visitor info so support knows who is writing
  const injectedJs = useMemo(() => {
    const name = escapeJs(userInfo?.name);
    const email = escapeJs(userInfo?.email);
    const domain = escapeJs(domainProp);
    return `
      (function() {
        function setVisitor() {
          if (window.Tawk_API && typeof Tawk_API.setAttributes === 'function') {
            Tawk_API.setAttributes({
              name: '${domain} / ${name}',
              email: '${email}',
              domain: '${domain}'
            }, function(err){});
          }
        }
        setVisitor();
        var i = setInterval(function() {
          if (window.Tawk_API && typeof Tawk_API.setAttributes === 'function') {
            setVisitor();
            clearInterval(i);
          }
        }, 1000);
        setTimeout(function(){ clearInterval(i); }, 15000);
      })();
      true;
    `;
  }, [userInfo, domainProp]);

  const handleOpen = () => {
    setWebviewKey(k => k + 1);
    setOpen(true);
  };

  return (
    <>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          {/* Thin close bar above Tawk header */}
          <TouchableOpacity
            onPress={() => setOpen(false)}
            style={styles.closeBar}
            activeOpacity={0.7}
          >
            <X size={16} color="#999" weight="bold" />
          </TouchableOpacity>

          {tawkChatUrl ? (
            <WebView
              key={webviewKey}
              source={{ uri: tawkChatUrl }}
              style={{ flex: 1 }}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
              injectedJavaScript={injectedJs}
              startInLoadingState
              onError={(e) => console.log('[WebView ERROR]', e.nativeEvent)}
              renderLoading={() => (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#08a0f7" />
                </View>
              )}
            />
          ) : (
            <View style={styles.fallback}>
              <ActivityIndicator size="large" color="#08a0f7" />
            </View>
          )}
        </View>
      </Modal>

      <Animated.View
        style={[styles.fab, { transform: [{ translateX: pan.x }, { translateY: pan.y }] }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity onPress={handleOpen} style={styles.fabTouch} accessibilityLabel="Soporte">
          <ChatCenteredDots size={24} color="#fff" weight="fill" />
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeBar: {
    height: 32,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5',
  },
  fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  fab: {
    position: 'absolute', right: 18, bottom: 100,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#08a0f7', elevation: 8,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
    justifyContent: 'center', alignItems: 'center', zIndex: 999,
  },
  fabTouch: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' },
});
