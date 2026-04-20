import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,

  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../ThemeContext';
import { login, getApiBase } from '../api';
import { ProlibuLogoVertical } from '../components/ProlibuLogo';
import { ProlibuSpinner } from '../components/ProlibuLoader';
import { Eye, EyeSlash } from 'phosphor-react-native';

export default function LoginScreen({ navigation }) {
  const { colors: COLORS, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Campos requeridos', 'Ingresa tu email y contraseña.');
      return;
    }
    setLoading(true);
    try {
      const res = await login(email.trim(), password);
      const data = res.data || res;

      // El token viene en data.token.accessToken (objeto con accessToken + expirationDate)
      const token =
        (typeof data.token === 'object' ? data.token?.accessToken : data.token) ||
        data.accessToken ||
        res._accessToken ||
        '';

      // El ID del usuario está en la raíz de la respuesta
      const userId = data.id || data._id || data.userId || data.agentId || '';

      // Los datos del usuario están en la raíz
      // Extraer rol desde acl.roles (objeto con nombres de roles como claves)
      const aclRoles = data.acl?.roles || {};
      const roleKeys = Object.keys(aclRoles);
      const isAdmin = roleKeys.some(r => ['admin', 'superadmin', 'super'].includes(r.toLowerCase()));
      const role = roleKeys[0] || '';

      const user = {
        id: userId,
        email: data.email || email.trim(),
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        role,
        isAdmin,
      };

      if (!token) {
        Alert.alert('Sin token', 'Login exitoso pero no se recibió token.');
        console.log('Login response:', JSON.stringify(res));
        return;
      }

      if (!userId) {
        Alert.alert('Sin ID', 'No se pudo obtener el ID del usuario.');
        console.log('Login response:', JSON.stringify(res));
        return;
      }

      const authData = { token, user, userId };
      await AsyncStorage.setItem('auth', JSON.stringify(authData));
      navigation.replace('Proposals');
    } catch (e) {
      Alert.alert('Error al ingresar', e.message || 'Credenciales incorrectas o sin conexión.');
    } finally {
      setLoading(false);
    }
  }

  const styles = makeStyles(COLORS);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.bg} />
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Logo */}
          <View style={styles.logoContainer}>
            <ProlibuLogoVertical scale={1} />
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Iniciar sesión</Text>

            <Text style={styles.label}>Usuario</Text>
            <TextInput
              style={styles.input}
              placeholder="usuario@prolibu.com"
              placeholderTextColor={COLORS.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />

            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.inputFlex}
                placeholder="••••••••"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="go"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
                {showPassword
                  ? <EyeSlash size={20} color={COLORS.textMuted} />
                  : <Eye size={20} color={COLORS.textMuted} />}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ProlibuSpinner />
              ) : (
                <Text style={styles.btnText}>Ingresar</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footer}>
              {getApiBase().replace('https://', '').replace('/v1', '')}
            </Text>
            <TouchableOpacity
              onPress={async () => {
                await AsyncStorage.multiRemove(['domain', 'auth']);
                navigation.replace('Domain');
              }}
            >
              <Text style={styles.footerLink}>Cambiar cuenta</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.bg },
    kav: { flex: 1 },
    scroll: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 24,
    },
    logoContainer: {
      alignItems: 'center',
      marginBottom: 36,
    },
    card: {
      backgroundColor: C.card,
      borderRadius: 16,
      padding: 28,
      borderWidth: 1,
      borderColor: C.border,
    },
    cardTitle: {
      color: C.text,
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 20,
    },
    label: {
      color: C.textMuted,
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    input: {
      backgroundColor: C.bg,
      color: C.text,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      padding: 14,
      fontSize: 15,
      marginBottom: 16,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.bg,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      marginBottom: 16,
    },
    inputFlex: {
      flex: 1,
      color: C.text,
      padding: 14,
      fontSize: 15,
    },
    eyeBtn: { paddingHorizontal: 14, justifyContent: 'center' },
    btn: {
      backgroundColor: C.accent,
      borderRadius: 10,
      padding: 16,
      alignItems: 'center',
      marginTop: 4,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 28,
      gap: 12,
    },
    footer: {
      color: C.textMuted,
      fontSize: 11,
    },
    footerLink: {
      color: C.accent,
      fontSize: 11,
      fontWeight: '600',
    },
  });
}
