import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../../src/config";
import { useRouter } from "expo-router";

type Pet = { id: string };
type Appointment = { id: string; status?: string | null };

type AdminStatsResponse = {
  ok?: boolean;
  stats?: { users: number; pets: number; appointments: number };
  message?: string;
};

async function authToken() {
  const t = await AsyncStorage.getItem("token");
  if (!t) throw new Error("No hay sesión (token).");
  return t;
}

export default function Profile() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  // user
  const [email, setEmail] = useState("");

  // counts (usuario)
  const [petsCount, setPetsCount] = useState(0);
  const [appointmentsCount, setAppointmentsCount] = useState(0);
  const [cancelledCount, setCancelledCount] = useState(0);

  // admin
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminPass, setAdminPass] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminStats, setAdminStats] = useState<{
    users: number;
    pets: number;
    appointments: number;
  } | null>(null);

  async function loadStatsOnce() {
    const token = await authToken();

    // email (guardado en login)
    const savedEmail = await AsyncStorage.getItem("user_email");
    setEmail(savedEmail ?? "");

    // pets
    const petsRes = await fetch(`${API_URL}/pets`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const petsData = await petsRes.json().catch(() => ({}));
    if (!petsRes.ok)
      throw new Error(petsData?.message ?? `HTTP ${petsRes.status}`);
    const pets: Pet[] = petsData?.pets ?? [];
    setPetsCount(pets.length);

    // appointments
    const apRes = await fetch(`${API_URL}/appointments`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const apData = await apRes.json().catch(() => ({}));
    if (!apRes.ok) throw new Error(apData?.message ?? `HTTP ${apRes.status}`);
    const apps: Appointment[] = apData?.appointments ?? [];
    setAppointmentsCount(apps.length);
    setCancelledCount(
      apps.filter((a) => (a.status ?? "").toLowerCase() === "cancelled").length
    );
  }

  async function refreshAll() {
    try {
      setLoading(true);
      await loadStatsOnce();
    } catch (e: any) {
      Alert.alert("Error", e?.message ? String(e.message) : String(e));
    } finally {
      setLoading(false);
    }
  }

  function openAdmin() {
    setAdminPass("");
    setAdminStats(null);
    setAdminOpen(true);
  }

  async function fetchAdminStats() {
    if (!adminPass.trim()) {
      Alert.alert("Revisa", "Escribe tu contraseña.");
      return;
    }

    try {
      setAdminLoading(true);
      const token = await authToken();

      const res = await fetch(`${API_URL}/admin/stats`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: adminPass }),
      });

      const data = (await res.json().catch(() => ({}))) as AdminStatsResponse;

      if (!res.ok) {
        Alert.alert("Administración", data?.message ?? `HTTP ${res.status}`);
        return;
      }

      if (!data?.stats) {
        Alert.alert("Administración", "No llegaron stats.");
        return;
      }

      setAdminStats(data.stats);
    } catch (e: any) {
      Alert.alert("Error", e?.message ? String(e.message) : String(e));
    } finally {
      setAdminLoading(false);
    }
  }

  async function onLogout() {
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("user_id");
    await AsyncStorage.removeItem("user_email");

    // opcional: si guardaste otras cosas
    await AsyncStorage.removeItem("session_start_ms");

    // ✅ mandar al login
    router.replace("/");
  }

  useEffect(() => {
    refreshAll();
  }, []);

  return (
    <LinearGradient colors={["#2E78FF", "#66A6FF"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, padding: 18 }}>
        {/* Header + botón admin pequeño */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Text style={{ color: "white", fontSize: 26, fontWeight: "900" }}>
              Perfil 👤
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.85)", marginTop: 6 }}>
              Resumen de tu cuenta
            </Text>
          </View>

          <TouchableOpacity
            onPress={openAdmin}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.18)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.25)",
            }}
          >
            <Text style={{ color: "white", fontWeight: "900" }}>
              Administración
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 16 }} />

        {loading ? (
          <ActivityIndicator color="white" size="large" />
        ) : (
          <View style={{ gap: 12 }}>
            <View
              style={{
                backgroundColor: "white",
                borderRadius: 20,
                padding: 16,
                shadowColor: "#000",
                shadowOpacity: 0.12,
                shadowRadius: 6,
                elevation: 4,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "900" }}>Usuario</Text>
              <Text style={{ marginTop: 6, color: "#444" }}>
                {email || "Sin email"}
              </Text>
            </View>

            <View
              style={{
                backgroundColor: "white",
                borderRadius: 20,
                padding: 16,
                shadowColor: "#000",
                shadowOpacity: 0.12,
                shadowRadius: 6,
                elevation: 4,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "900" }}>Actividad</Text>

              <Text style={{ marginTop: 10, color: "#444" }}>
                🐾 Mascotas creadas:{" "}
                <Text style={{ fontWeight: "900" }}>{petsCount}</Text>
              </Text>

              <Text style={{ marginTop: 6, color: "#444" }}>
                📅 Citas creadas:{" "}
                <Text style={{ fontWeight: "900" }}>{appointmentsCount}</Text>
              </Text>

              <Text style={{ marginTop: 6, color: "#444" }}>
                ❌ Citas canceladas:{" "}
                <Text style={{ fontWeight: "900" }}>{cancelledCount}</Text>
              </Text>
            </View>

            <TouchableOpacity
              onPress={refreshAll}
              style={{
                backgroundColor: "rgba(255,255,255,0.18)",
                borderRadius: 16,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <Text
                style={{ color: "white", fontWeight: "900", letterSpacing: 1 }}
              >
                ACTUALIZAR
              </Text>
            </TouchableOpacity>

            {/* ✅ BOTÓN CERRAR SESIÓN */}
            <TouchableOpacity
              onPress={onLogout}
              style={{
                backgroundColor: "rgba(0,0,0,0.25)",
                borderRadius: 16,
                paddingVertical: 14,
                alignItems: "center",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.25)",
              }}
            >
              <Text
                style={{ color: "white", fontWeight: "900", letterSpacing: 1 }}
              >
                CERRAR SESIÓN
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ===================== MODAL ADMIN ===================== */}
        <Modal visible={adminOpen} transparent animationType="fade">
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.55)",
              justifyContent: "flex-start",
              padding: 18,
              paddingTop: 70,
            }}
          >
            <View
              style={{
                backgroundColor: "white",
                borderRadius: 22,
                padding: 16,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "900" }}>
                Administración
              </Text>
              <Text style={{ marginTop: 6, color: "#555" }}>
                Ingresa tu contraseña para ver los totales globales.
              </Text>

              <View style={{ height: 12 }} />

              <Text style={{ fontWeight: "700" }}>Contraseña *</Text>
              <TextInput
                value={adminPass}
                onChangeText={setAdminPass}
                secureTextEntry
                placeholder="Tu contraseña"
                style={{
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                  borderRadius: 14,
                  padding: 12,
                  marginTop: 6,
                  marginBottom: 12,
                }}
              />

              <TouchableOpacity
                onPress={fetchAdminStats}
                disabled={adminLoading}
                style={{
                  paddingVertical: 12,
                  borderRadius: 14,
                  backgroundColor: adminLoading ? "#93C5FD" : "#2E78FF",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontWeight: "900", color: "white" }}>
                  {adminLoading ? "Verificando..." : "ENTRAR"}
                </Text>
              </TouchableOpacity>

              {/* Panel stats */}
              {adminStats ? (
                <View style={{ marginTop: 14, gap: 10 }}>
                  <View
                    style={{
                      backgroundColor: "#EEF2FF",
                      borderRadius: 16,
                      padding: 12,
                    }}
                  >
                    <Text style={{ fontWeight: "900", color: "#1D4ED8" }}>
                      👥 Usuarios registrados: {adminStats.users}
                    </Text>
                  </View>

                  <View
                    style={{
                      backgroundColor: "#EEF2FF",
                      borderRadius: 16,
                      padding: 12,
                    }}
                  >
                    <Text style={{ fontWeight: "900", color: "#1D4ED8" }}>
                      🐾 Mascotas totales: {adminStats.pets}
                    </Text>
                  </View>

                  <View
                    style={{
                      backgroundColor: "#EEF2FF",
                      borderRadius: 16,
                      padding: 12,
                    }}
                  >
                    <Text style={{ fontWeight: "900", color: "#1D4ED8" }}>
                      📅 Citas totales: {adminStats.appointments}
                    </Text>
                  </View>
                </View>
              ) : null}

              <View style={{ height: 12 }} />

              <TouchableOpacity
                onPress={() => {
                  setAdminOpen(false);
                  setAdminPass("");
                  setAdminStats(null);
                }}
                style={{
                  paddingVertical: 12,
                  borderRadius: 14,
                  backgroundColor: "#EEF2FF",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontWeight: "900", color: "#1D4ED8" }}>
                  Cerrar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}