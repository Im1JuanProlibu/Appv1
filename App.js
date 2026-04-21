import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import DomainScreen from './src/screens/DomainScreen';
import LoginScreen from './src/screens/LoginScreen';
import AgentsScreen from './src/screens/AgentsScreen';
import ProposalsScreen from './src/screens/ProposalsScreen';
import EditorScreen from './src/screens/EditorScreen';
import CreateProposalScreen from './src/screens/CreateProposalScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { COLORS } from './src/theme';
import { setApiDomain, getProposal } from './src/api';
import { ThemeProvider } from './src/ThemeContext';
import { LanguageProvider } from './src/i18n';

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);
  const navigationRef = useRef(null);
  const notificationListener = useRef(null);
  const responseListener = useRef(null);

  useEffect(() => {
    async function bootstrap() {
      const domain = await AsyncStorage.getItem('domain');
      if (!domain) {
        setInitialRoute('Domain');
        return;
      }
      setApiDomain(domain);
      const auth = await AsyncStorage.getItem('auth');
      setInitialRoute(auth ? 'Proposals' : 'Login');
    }
    bootstrap();
  }, []);

  // Manejar tap en notificación push (app cerrada o en background)
  useEffect(() => {
    // Listener para cuando el usuario toca una notificación
    responseListener.current = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const proposalId = response.notification.request.content.data?.proposalId;
      if (!proposalId || !navigationRef.current) return;
      try {
        const raw = await AsyncStorage.getItem('auth');
        if (!raw) return;
        const auth = JSON.parse(raw);
        const proposal = await getProposal(proposalId, auth.token);
        const data = proposal?.data || proposal;
        if (data?.id || data?._id) {
          navigationRef.current.navigate('Editor', { proposal: data, auth });
        }
      } catch (e) {
        console.log('[PushTap] No se pudo navegar:', e.message);
      }
    });

    return () => {
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  return (
    <LanguageProvider>
    <ThemeProvider>
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator
            initialRouteName={initialRoute}
            screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
          >
            <Stack.Screen name="Domain" component={DomainScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Agents" component={AgentsScreen} />
            <Stack.Screen name="Proposals" component={ProposalsScreen} />
            <Stack.Screen name="Editor" component={EditorScreen} />
            <Stack.Screen name="CreateProposal" component={CreateProposalScreen} />
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="Reports" component={ReportsScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </ThemeProvider>
    </LanguageProvider>
  );
}
