import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
import { setApiDomain } from './src/api';
import { ThemeProvider } from './src/ThemeContext';

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);

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

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <NavigationContainer>
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
  );
}
