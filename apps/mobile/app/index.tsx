import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  AppStateStatus,
  ImageBackground,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../src/config";
import { useRouter } from "expo-router";

type MeResponse = { ok: boolean; user?: { id: string; email?: string } };
type LoginResponse = {
  ok: boolean;
  access_token?: string;
  user?: { id: string; email?: string };
  message?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Index() {
  const router = useRouter();

  // UI mode
  const [mode, setMode] = useState<"login" | "register">("login");

  // form (SIN defaults)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  // session
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");

  // usage tracking
  const sessionStartRef = useRef<number | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const usageKey = useMemo(() => (userId ? `usage_seconds_${userId}` : null), [userId]);

  function validate(): string | null {
    const e = email.trim();

    if (!e) return "Falta el correo.";
    if (!EMAIL_RE.test(e)) return "El correo no tiene un formato válido.";
    if (!password) return "Falta la contraseña.";
    if (password.length < 8) return "La contraseña debe tener mínimo 8 caracteres.";

    if (mode === "register") {
      if (!confirm) return "Confirma la contraseña.";
      if (confirm !== password) return "Las contraseñas no coinciden.";
    }
    return null;
  }

  async function fetchMe(accessToken: string) {
    const res = await fetch(`${API_URL}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = (await res.json().catch(() => ({}))) as MeResponse;
    if (!res.ok || !data?.user?.id) throw new Error("No se pudo obtener /me");
    return data.user;
  }

  async function accumulateUsageSeconds() {
    if (!usageKey) return;
    const start = sessionStartRef.current;
    if (!start) return;

    const now = Date.now();
    const deltaSec = Math.max(0, Math.floor((now - start) / 1000));
    sessionStartRef.current = now;

    const prevStr = await AsyncStorage.getItem(usageKey);
    const prev = prevStr ? Number(prevStr) : 0;
    const next = prev + (Number.isFinite(deltaSec) ? deltaSec : 0);
    await AsyncStorage.setItem(usageKey, String(next));
  }

  // Restore session
  useEffect(() => {
    (async () => {
      const savedToken = await AsyncStorage.getItem("token");
      const savedUserId = await AsyncStorage.getItem("user_id");
      const savedEmail = await AsyncStorage.getItem("user_email");

      if (savedToken && savedUserId) {
        setToken(savedToken);
        setUserId(savedUserId);
        setUserEmail(savedEmail ?? "");
        sessionStartRef.current = Date.now();

        // ✅ ir al dashboard automáticamente si ya hay sesión guardada
        router.replace("/(tabs)/home");
      }
    })();
  }, []);

  useEffect(() => {
    if (token) {
      router.replace("/(tabs)/home");
    }
  }, [token]);


  // Track time in app (only when logged in)
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (!token || !usageKey) return;

      // going background -> add usage
      if (
        (prevState === "active" && nextState === "background") ||
        (prevState === "active" && nextState === "inactive")
      ) {
        await accumulateUsageSeconds();
      }

      // coming back active -> restart timer
      if ((prevState === "background" || prevState === "inactive") && nextState === "active") {
        sessionStartRef.current = Date.now();
      }
    });

    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, usageKey]);

  async function onLogin() {
    const err = validate();
    if (err) return Alert.alert("Revisa", err);

    try {
      setLoading(true);

      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = (await res.json().catch(() => ({}))) as LoginResponse;

      if (!res.ok || !data?.access_token) {
        Alert.alert("Error", data?.message ?? `HTTP ${res.status}`);
        return;
      }

      const meUser = await fetchMe(data.access_token);

      await AsyncStorage.setItem("token", data.access_token);
      await AsyncStorage.setItem("user_id", meUser.id);
      await AsyncStorage.setItem("user_email", meUser.email ?? email.trim());
      

      await AsyncStorage.setItem("session_start_ms", String(Date.now()));

      setToken(data.access_token);
      setUserId(meUser.id);
      setUserEmail(meUser.email ?? email.trim());

      sessionStartRef.current = Date.now();

      // ✅ ir al dashboard
      router.replace("/(tabs)/home");
    } catch (e) {
      Alert.alert("Error", String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onRegister() {
    const err = validate();
    if (err) return Alert.alert("Revisa", err);

    try {
      setLoading(true);

      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = (await res.json().catch(() => ({}))) as { message?: string };

      if (!res.ok) {
        Alert.alert("Error", data?.message ?? `HTTP ${res.status}`);
        return;
      }

      Alert.alert(
        "Listo ✅",
        "Cuenta creada. Ahora inicia sesión.\n(Si Supabase pide confirmación por email, revisa tu correo.)"
      );

      setMode("login");
      setPassword("");
      setConfirm("");
    } catch (e) {
      Alert.alert("Error", String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onLogout() {
    try {
      if (token && usageKey) await accumulateUsageSeconds();
    } catch {}

    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("user_id");
    await AsyncStorage.removeItem("user_email");
    await AsyncStorage.removeItem("session_start_ms");

    setToken(null);
    setUserId("");
    setUserEmail("");
    setEmail("");
    setPassword("");
    setConfirm("");
    setMode("login");
    sessionStartRef.current = null;
  }

  // =========================
  // UI
  // =========================
  // =========================
// UI
// =========================
if (token) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B0F14" }}>
      <ImageBackground
        source={require("../assets/bg-vet.jpg")}
        style={{ flex: 1 }}
        resizeMode="cover"
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }}>
          <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
            <View
              style={{
                borderRadius: 30,
                padding: 22,
                backgroundColor: "rgba(255,255,255,0.12)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.18)",
                shadowColor: "#000",
                shadowOpacity: 0.25,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 8 },
                elevation: 8,
              }}
            >
              <Text style={{ color: "white", fontSize: 22, fontWeight: "900" }}>
                Sesión iniciada ✅
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.82)", marginTop: 10 }}>
                {userEmail || "Usuario"}
              </Text>

              <TouchableOpacity
                onPress={onLogout}
                style={{
                  marginTop: 18,
                  paddingVertical: 14,
                  borderRadius: 16,
                  backgroundColor: "rgba(255,255,255,0.16)",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "white", fontWeight: "900", letterSpacing: 1 }}>
                  CERRAR SESIÓN
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B0F14" }}>
      <ImageBackground
        source={require("../assets/bg-vet.jpg")}
        style={{ flex: 1 }}
        resizeMode="cover"
      >
        {/* Overlay oscuro para que SIEMPRE se vea en modo oscuro */}
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }}>
          <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
            <View
              style={{
                borderRadius: 30,
                padding: 22,
                backgroundColor: "rgba(255,255,255,0.12)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.18)",
                shadowColor: "#000",
                shadowOpacity: 0.25,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 8 },
                elevation: 8,
              }}
            >
              <Text style={{ color: "white", fontSize: 28, fontWeight: "900", textAlign: "center" }}>
                VetApp
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.75)", textAlign: "center", marginTop: 6 }}>
                {mode === "login" ? "Inicia sesión" : "Crea tu cuenta"}
              </Text>

              <View style={{ height: 18 }} />

              <Text style={{ color: "rgba(255,255,255,0.85)", marginBottom: 6 }}>
                Email
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder=""
                placeholderTextColor="rgba(255,255,255,0.55)"
                style={{
                  color: "white",
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(255,255,255,0.55)",
                  paddingVertical: 10,
                  marginBottom: 16,
                }}
              />

              <Text style={{ color: "rgba(255,255,255,0.85)", marginBottom: 6 }}>
                Password
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder=""
                placeholderTextColor="rgba(255,255,255,0.55)"
                style={{
                  color: "white",
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(255,255,255,0.55)",
                  paddingVertical: 10,
                  marginBottom: mode === "register" ? 16 : 22,
                }}
              />

              {mode === "register" && (
                <>
                  <Text style={{ color: "rgba(255,255,255,0.85)", marginBottom: 6 }}>
                    Confirmar password
                  </Text>
                  <TextInput
                    value={confirm}
                    onChangeText={setConfirm}
                    secureTextEntry
                    placeholder="********"
                    placeholderTextColor="rgba(255,255,255,0.55)"
                    style={{
                      color: "white",
                      borderBottomWidth: 1,
                      borderBottomColor: "rgba(255,255,255,0.55)",
                      paddingVertical: 10,
                      marginBottom: 22,
                    }}
                  />
                </>
              )}

              <TouchableOpacity
                onPress={mode === "login" ? onLogin : onRegister}
                disabled={loading}
                style={{
                  paddingVertical: 14,
                  borderRadius: 16,
                  backgroundColor: loading
                    ? "rgba(255,255,255,0.18)"
                    : "rgba(255,255,255,0.16)",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "white", fontWeight: "900", letterSpacing: 1 }}>
                  {loading ? "CARGANDO..." : mode === "login" ? "LOGIN" : "REGISTRAR"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setMode((m) => (m === "login" ? "register" : "login"));
                  setPassword("");
                  setConfirm("");
                }}
                style={{ marginTop: 12, alignItems: "center" }}
              >
                <Text style={{ color: "rgba(255,255,255,0.78)", fontWeight: "700" }}>
                  {mode === "login" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}