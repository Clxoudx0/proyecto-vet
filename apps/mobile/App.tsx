import { useEffect, useState } from "react";
import {
  Alert,
  ImageBackground,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "./src/config";

type LoginResponse = {
  ok: boolean;
  access_token?: string;
  user?: { id: string; email?: string };
  message?: string;
};

export default function App() {
  const [email, setEmail] = useState("testvet123@correo.com");
  const [password, setPassword] = useState("12345678");
  const [status, setStatus] = useState<"loading" | "logged_out" | "logged_in">(
    "loading"
  );
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem("token");
      if (saved) {
        setToken(saved);
        setStatus("logged_in");
        try {
          const me = await fetch(`${API_URL}/me`, {
            headers: { Authorization: `Bearer ${saved}` },
          }).then((r) => r.json());
          setUserEmail(me?.user?.email ?? "");
        } catch {}
      } else {
        setStatus("logged_out");
      }
    })();
  }, []);

  async function onLogin() {
    try {
      setStatus("loading");
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json().catch(() => ({}))) as LoginResponse;

      if (!res.ok || !data?.access_token) {
        Alert.alert("Error", data?.message ?? `HTTP ${res.status}`);
        setStatus("logged_out");
        return;
      }

      await AsyncStorage.setItem("token", data.access_token);
      setToken(data.access_token);
      setUserEmail(data?.user?.email ?? email);
      setStatus("logged_in");
    } catch (e) {
      Alert.alert("Error", String(e));
      setStatus("logged_out");
    }
  }

  async function onLogout() {
    await AsyncStorage.removeItem("token");
    setToken(null);
    setUserEmail("");
    setStatus("logged_out");
  }

  // ---------- UI ----------
  if (status === "logged_in") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0B0F14" }}>
        <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
          <View
            style={{
              backgroundColor: "rgba(255,255,255,0.08)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.12)",
              borderRadius: 26,
              padding: 20,
            }}
          >
            <Text style={{ color: "white", fontSize: 22, fontWeight: "800" }}>
              Sesión iniciada ✅
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.75)", marginTop: 10 }}>
              Usuario: {userEmail || "desconocido"}
            </Text>
            <Text
              style={{ color: "rgba(255,255,255,0.6)", marginTop: 10 }}
              numberOfLines={1}
            >
              Token: {token?.slice(0, 18)}...
            </Text>

            <TouchableOpacity
              onPress={onLogout}
              style={{
                marginTop: 18,
                paddingVertical: 12,
                borderRadius: 14,
                backgroundColor: "rgba(255,255,255,0.14)",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "white", fontWeight: "700" }}>
                Cerrar sesión
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // loading o logged_out -> mismo fondo bonito
  return (
    <ImageBackground
      source={require("./assets/bg-vet.jpg")}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      {/* overlay oscuro para que SIEMPRE se vea bien en modo oscuro */}
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
            <View
              style={{
                borderRadius: 30,
                padding: 22,
                backgroundColor: "rgba(255,255,255,0.12)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.18)",
                // sombra simple cross-platform
                shadowColor: "#000",
                shadowOpacity: 0.25,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 8 },
                elevation: 8,
              }}
            >
              <Text
                style={{
                  color: "white",
                  fontSize: 26,
                  fontWeight: "900",
                  textAlign: "center",
                  marginBottom: 18,
                }}
              >
                VetApp
              </Text>

              <Text style={{ color: "rgba(255,255,255,0.85)", marginBottom: 6 }}>
                Email
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="correo@ejemplo.com"
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

              <TouchableOpacity
                onPress={onLogin}
                disabled={status === "loading"}
                style={{
                  paddingVertical: 14,
                  borderRadius: 16,
                  backgroundColor:
                    status === "loading"
                      ? "rgba(255,255,255,0.22)"
                      : "rgba(255,255,255,0.18)",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "white", fontWeight: "800", letterSpacing: 1 }}>
                  {status === "loading" ? "CARGANDO..." : "LOGIN"}
                </Text>
              </TouchableOpacity>

              <Text
                style={{
                  color: "rgba(255,255,255,0.6)",
                  textAlign: "center",
                  marginTop: 14,
                  fontSize: 12,
                }}
              >
                API: {API_URL}
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
}