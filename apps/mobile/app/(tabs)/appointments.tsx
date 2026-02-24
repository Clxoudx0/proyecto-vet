import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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

type Pet = { id: string; name: string; species: string; breed?: string };

type Appointment = {
  id: string;
  owner_id: string;
  pet_id: string | null;
  scheduled_at: string;
  reason: string | null;
  status: string | null;
  created_at?: string;
};

function pickMsg(data: any, fallback: string) {
  if (typeof data === "string") return data;
  if (typeof data?.message === "string") return data.message;
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return fallback;
  }
}

function formatWhen(iso: string) {
  // iso: 2026-02-22T18:00:00+00:00 (o similar)
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function Appointments() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Appointment[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);

  // modal
  const [open, setOpen] = useState(false);

  // form
  const [petId, setPetId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [scheduledAt, setScheduledAt] = useState(""); // YYYY-MM-DD HH:mm
  const [saving, setSaving] = useState(false);

  const petNameById = useMemo(() => {
    const map = new Map<string, string>();
    pets.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [pets]);

  function resetForm() {
    setPetId("");
    setReason("");
    setScheduledAt("");
  }

  async function authToken() {
    const t = await AsyncStorage.getItem("token");
    if (!t) throw new Error("No hay sesión (token).");
    return t;
  }

  async function loadPets() {
    const token = await authToken();
    const res = await fetch(`${API_URL}/pets`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const raw = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
    if (!res.ok) throw new Error(pickMsg(data, `HTTP ${res.status}`));
    setPets(data.pets ?? []);
  }

  async function loadAppointments() {
    const token = await authToken();
    const res = await fetch(`${API_URL}/appointments`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const raw = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
    if (!res.ok) throw new Error(pickMsg(data, `HTTP ${res.status}`));
    setItems(data.appointments ?? []);
  }

  async function refreshAll() {
    try {
      setLoading(true);
      await Promise.all([loadPets(), loadAppointments()]);
    } catch (e: any) {
      Alert.alert("Error", e?.message ? String(e.message) : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  function validate(): string | null {
    if (!reason.trim()) return "Falta el motivo (reason).";
    if (!scheduledAt.trim()) return "Falta la fecha y hora (YYYY-MM-DD HH:mm).";

    // validación simple
    if (!/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(scheduledAt.trim())) {
      return "Formato inválido. Usa: YYYY-MM-DD HH:mm (ej: 2026-02-22 18:00)";
    }
    return null;
  }

  async function createAppointment() {
    const err = validate();
    if (err) return Alert.alert("Revisa", err);

    try {
      setSaving(true);
      const token = await authToken();

      // Convertimos "YYYY-MM-DD HH:mm" a ISO
      const iso = new Date(scheduledAt.trim().replace(" ", "T") + ":00").toISOString();

      const res = await fetch(`${API_URL}/appointments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pet_id: petId || null, // opcional
          scheduled_at: iso,
          reason: reason.trim(),
        }),
      });

      const raw = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }

      if (!res.ok) {
        Alert.alert("Error POST /appointments", pickMsg(data, `HTTP ${res.status}`).slice(0, 1200));
        return;
      }

      setOpen(false);
      resetForm();
      await loadAppointments();
    } catch (e: any) {
      Alert.alert("Error", e?.message ? String(e.message) : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <LinearGradient colors={["#2E78FF", "#66A6FF"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, padding: 18 }}>
        <Text style={{ color: "white", fontSize: 26, fontWeight: "900" }}>
          Citas 📅
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.85)", marginTop: 6 }}>
          Solicita y revisa tus citas
        </Text>

        <View style={{ height: 16 }} />

        {loading ? (
          <ActivityIndicator color="white" size="large" />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(it) => it.id}
            renderItem={({ item }) => (
              <View
                style={{
                  backgroundColor: "white",
                  borderRadius: 20,
                  padding: 16,
                  marginBottom: 14,
                  shadowColor: "#000",
                  shadowOpacity: 0.12,
                  shadowRadius: 6,
                  elevation: 4,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "900" }}>
                  {item.reason || "Cita"}
                </Text>

                <Text style={{ color: "#444", marginTop: 6 }}>
                  🕒 {formatWhen(item.scheduled_at)}
                </Text>

                <Text style={{ color: "#444", marginTop: 6 }}>
                  🐾 {item.pet_id ? (petNameById.get(item.pet_id) ?? "Mascota") : "Sin mascota"}
                </Text>

                <View style={{ marginTop: 10, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "#EEF2FF" }}>
                  <Text style={{ color: "#1D4ED8", fontWeight: "900" }}>
                    {item.status ?? "pending"}
                  </Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <Text style={{ color: "white", marginTop: 20, fontWeight: "700" }}>
                Aún no tienes citas.
              </Text>
            }
            contentContainerStyle={{ paddingBottom: 90 }}
          />
        )}

        {/* Floating Button */}
        <TouchableOpacity
          onPress={() => {
            if (pets.length === 0) {
              Alert.alert("Primero", "Crea una mascota antes (pestaña Mascotas).");
              return;
            }
            setOpen(true);
          }}
          style={{
            position: "absolute",
            right: 18,
            bottom: 18,
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: "#0B4DFF",
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#000",
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 8,
          }}
        >
          <Text style={{ color: "white", fontSize: 30, fontWeight: "900", marginTop: -2 }}>
            +
          </Text>
        </TouchableOpacity>

        {/* Modal Create Appointment */}
        <Modal visible={open} transparent animationType="fade">
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.55)",
              justifyContent: "center",
              padding: 18,
            }}
          >
            <View style={{ backgroundColor: "white", borderRadius: 22, padding: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: "900" }}>Nueva cita</Text>

              <View style={{ height: 12 }} />

              <Text style={{ fontWeight: "700" }}>Mascota *</Text>

              {/* Selector simple (botones) */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8, marginBottom: 12 }}>
                {pets.map((p) => {
                  const active = petId === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => setPetId(p.id)}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 999,
                        backgroundColor: active ? "#2E78FF" : "#EEF2FF",
                      }}
                    >
                      <Text style={{ color: active ? "white" : "#1D4ED8", fontWeight: "900" }}>
                        {p.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={{ fontWeight: "700" }}>Motivo *</Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder="Vacuna anual"
                style={{
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                  borderRadius: 14,
                  padding: 12,
                  marginTop: 6,
                  marginBottom: 10,
                }}
              />

              <Text style={{ fontWeight: "700" }}>Fecha y hora *</Text>
              <TextInput
                value={scheduledAt}
                onChangeText={setScheduledAt}
                placeholder="2026-02-22 18:00"
                style={{
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                  borderRadius: 14,
                  padding: 12,
                  marginTop: 6,
                  marginBottom: 14,
                }}
              />

              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  onPress={() => {
                    setOpen(false);
                    resetForm();
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 14,
                    backgroundColor: "#EEF2FF",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontWeight: "900", color: "#1D4ED8" }}>
                    Cancelar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={createAppointment}
                  disabled={saving}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 14,
                    backgroundColor: saving ? "#93C5FD" : "#2E78FF",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontWeight: "900", color: "white" }}>
                    {saving ? "Guardando..." : "Guardar"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}