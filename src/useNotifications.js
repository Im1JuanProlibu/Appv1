import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { getApiBase, registerPushToken } from './api';

// Mostrar notificación como banner aunque la app esté en primer plano (iOS y Android)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const STORAGE_KEY = 'prolibu_notifications';
const MAX_NOTIFICATIONS = 50;

/**
 * Hook que se conecta al socket privado de Prolibu (puerto 3001),
 * autentica con el accessToken y escucha eventos common.proposalView.
 *
 * Flujo del backend:
 *  1. cliente emite: authenticate { accessToken }
 *  2. servidor responde: authenticated { socketId }
 *  3. servidor emite al canal socketId: { action, data }
 */
export function useNotifications(token, auth) {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [connected, setConnected] = useState(false);
  const [liveViewing, setLiveViewing] = useState({}); // { [proposalId]: true }
  const [notifPermission, setNotifPermission] = useState('undetermined'); // 'granted' | 'denied' | 'undetermined'
  const [expoPushToken, setExpoPushToken] = useState(null);
  const socketRef = useRef(null);
  const socketIdRef = useRef(null);
  // Deduplicar: evita múltiples notificaciones de la misma propuesta en < 30s
  const lastNotifRef = useRef({});
  // Bandera para saber si los permisos fueron concedidos
  const notifPermittedRef = useRef(false);

  // Pedir permisos al montar (iOS + Android 13+) y obtener push token
  useEffect(() => {
    async function setupNotifications() {
      try {
        // Canal de Android PRIMERO (debe existir antes de pedir permisos)
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('prolibu', {
            name: 'Prolibu — Alertas de vista',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#4285F4',
            sound: 'default',
            enableLights: true,
            enableVibrate: true,
            showBadge: true,
          });
        }

        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        notifPermittedRef.current = finalStatus === 'granted';
        setNotifPermission(finalStatus);
        console.log('[Notifications] Permisos:', finalStatus);

        // Obtener Expo Push Token para notificaciones con app cerrada
        if (finalStatus === 'granted') {
          try {
            const projectId =
              Constants.expoConfig?.extra?.eas?.projectId ??
              Constants.easConfig?.projectId;
            const pushTokenData = await Notifications.getExpoPushTokenAsync(
              projectId ? { projectId } : {}
            );
            const pushToken = pushTokenData.data;
            setExpoPushToken(pushToken);

            // Registrar en el backend (silencioso si el endpoint no existe)
            const userId = auth?.userId || auth?.user?.id || auth?.user?._id || null;
            if (token && pushToken) {
              registerPushToken(pushToken, token, userId).catch(() => {});
            }
          } catch (e) {
            // push tokens no disponibles en Expo Go SDK 53+ — ignorar
          }
        }
      } catch (e) {
        console.log('[Notifications] Error setup:', e.message);
      }
    }
    setupNotifications();
  }, [token]);

  // Cargar notificaciones persistidas al inicio
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const list = JSON.parse(raw);
        setNotifications(list);
        setUnread(list.filter((n) => !n.read).length);
      } catch {}
    });
  }, []);

  // Conectar socket cuando hay token
  useEffect(() => {
    if (!token) return;

    // El servidor socket.io v4.5.4 escucha en el puerto 3001 (HTTPS vía nginx).
    const base = getApiBase().replace('/v1', ''); // https://fanalca.prolibu.com
    const socketUrl = `${base}:3001`;

    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity,
      timeout: 10000,
      forceNew: true,
      // El servidor verifica CORS; enviamos el mismo Origin que usaría el browser.
      extraHeaders: {
        Origin: base,
      },
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      // Autenticar con el token
      socket.emit('authenticate', { accessToken: token });
    });

    socket.on('disconnect', () => {
      setConnected(false);
      socketIdRef.current = null;
    });

    socket.on('connect_error', (err) => {
      console.log('[Socket] Error de conexión:', err.message);
    });

    // El servidor responde con el socketId único del usuario
    socket.on('authenticated', (payload) => {
      const socketId = typeof payload === 'string' ? payload : (payload?.socketId || payload?.id || '');
      console.log('[Socket] Autenticado, socketId:', socketId);

      // Quitar listener anterior antes de agregar uno nuevo (evita duplicados en reconexión)
      if (socketIdRef.current) socket.off(socketIdRef.current);
      socketIdRef.current = socketId;

      socket.on(socketId, (event) => {
        const { action, data } = event || {};
        if (action === 'common.proposalView') {
          handleProposalView(data);
        }
      });
    });

    return () => {
      if (socketIdRef.current) socket.off(socketIdRef.current);
      socket.disconnect();
    };
  }, [token]);

  function handleProposalView(data) {
    const proposalTitle = data?.proposal?.title || data?.title || 'Propuesta';
    const leadName = data?.lead?.firstName
      ? `${data.lead.firstName} ${data.lead.lastName || ''}`.trim()
      : (data?.source || 'Cliente');
    const proposalId = data?.proposal?.id || data?.proposal?._id || data?.id || '';

    // Deduplicar: ignorar si la misma propuesta fue vista hace menos de 30s
    const now = Date.now();
    if (proposalId && lastNotifRef.current[proposalId] && now - lastNotifRef.current[proposalId] < 30000) {
      return;
    }
    if (proposalId) lastNotifRef.current[proposalId] = now;

    // Banner del sistema operativo
    if (notifPermittedRef.current) {
      Notifications.scheduleNotificationAsync({
        content: {
          title: `👁 ${leadName} vio tu propuesta`,
          body: proposalTitle,
          sound: 'default',
          data: { proposalId },
          ...(Platform.OS === 'android' && { channelId: 'prolibu' }),
        },
        trigger: null,
      }).catch((e) => console.log('[Notifications] Error al mostrar banner:', e.message));
    }

    const notification = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      type: 'view',
      proposalTitle,
      proposalNumber: data?.proposal?.proposalNumber || data?.proposalNumber || '',
      proposalId: data?.proposal?.id || data?.proposal?._id || data?.id || '',
      leadName,
      leadEmail: data?.lead?.email || data?.source || '',
      timestamp: new Date().toISOString(),
      read: false,
    };

    setNotifications((prev) => {
      const updated = [notification, ...prev].slice(0, MAX_NOTIFICATIONS);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    setUnread((prev) => prev + 1);

    // Marcar la propuesta como "siendo vista ahora" y limpiar tras 60s
    const pid = notification.proposalId;
    if (pid) {
      setLiveViewing((prev) => ({ ...prev, [pid]: true }));
      setTimeout(() => {
        setLiveViewing((prev) => {
          const next = { ...prev };
          delete next[pid];
          return next;
        });
      }, 60000);
    }

  }

  const markAllRead = useCallback(() => {
    setUnread(0);
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnread(0);
    AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const STATUS_LABEL_MAP = { Draft: 'Borrador', Ready: 'Lista', Approved: 'Aprobada', Denied: 'Negada' };

  const addStatusChangeNotification = useCallback((proposalTitle, proposalId, fromStatus, toStatus) => {
    const fromLabel = STATUS_LABEL_MAP[fromStatus] || fromStatus;
    const toLabel = STATUS_LABEL_MAP[toStatus] || toStatus;
    const notification = {
      id: `sc-${Date.now()}-${proposalId}`,
      type: 'status_change',
      proposalTitle,
      proposalId,
      fromStatus,
      toStatus,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => {
      const updated = [notification, ...prev].slice(0, MAX_NOTIFICATIONS);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    setUnread((prev) => prev + 1);
    if (notifPermittedRef.current) {
      Notifications.scheduleNotificationAsync({
        content: {
          title: `📋 Propuesta ${toLabel}`,
          body: `"${proposalTitle}" cambió de ${fromLabel} a ${toLabel}`,
          sound: 'default',
          data: { proposalId },
          ...(Platform.OS === 'android' && { channelId: 'prolibu' }),
        },
        trigger: null,
      }).catch(() => {});
    }
  }, []);

  // Última vista por proposalId, calculada desde el historial de notificaciones
  const lastViewed = {};
  for (const n of notifications) {
    if (n.type === 'view' && n.proposalId && !lastViewed[n.proposalId]) {
      lastViewed[n.proposalId] = { timestamp: n.timestamp, leadName: n.leadName };
    }
  }

  return { notifications, unread, connected, liveViewing, lastViewed, markAllRead, clearAll, notifPermission, expoPushToken, addStatusChangeNotification };
}
