import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../../src/config";
import { useFocusEffect } from "@react-navigation/native";

type Pet = {
  id: string;
  name: string;
  species: string;
  breed?: string;
  birthdate?: string;
  notes?: string;
};

function extractErrorMessage(e: any) {
  if (!e) return "Error desconocido";
  if (typeof e === "string") return e;
  if (e?.message) return String(e.message);
  try {
    return JSON.stringify(e, null, 2);
  } catch {
    return "Error desconocido";
  }
}

export default function Pets() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);

  // modal crear mascota
  const [open, setOpen] = useState(false);

  // ✅ modal tratamientos
  const [treatmentsOpen, setTreatmentsOpen] = useState(false);

  // lista tratamientos (solo UI)
  const TREATMENTS = [
    { title: "Vacunación", desc: "Vacunas según edad y calendario." },
    { title: "Desparasitación", desc: "Interna y externa." },
    { title: "Consulta general", desc: "Revisión completa y diagnóstico." },
    { title: "Emergencias", desc: "Atención prioritaria." },
    { title: "Cirugía", desc: "Procedimientos programados." },
    { title: "Limpieza dental", desc: "Profilaxis y cuidado dental." },
    { title: "Laboratorio", desc: "Exámenes y pruebas." },
    { title: "Grooming", desc: "Baño, corte y limpieza." },
  ];

  // form
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [breed, setBreed] = useState("");
  const [birthdate, setBirthdate] = useState(""); // YYYY-MM-DD
  const [notes, setNotes] = useState("");

  function resetForm() {
    setName("");
    setSpecies("");
    setBreed("");
    setBirthdate("");
    setNotes("");
  }

  async function loadPets() {
    setLoading(true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12s

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        // IMPORTANTE: apaga loading igual
        setPets([]);
        Alert.alert("Sesión", "No hay token. Cierra sesión e inicia de nuevo.");
        return;
      }

      const res = await fetch(`${API_URL}/pets`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      const raw = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw; // puede ser HTML o texto
      }

      if (!res.ok) {
        const msg =
          typeof data === "string"
            ? data
            : typeof data?.message === "string"
            ? data.message
            : JSON.stringify(data, null, 2);

        Alert.alert("Error /pets", (msg || `HTTP ${res.status}`).slice(0, 1200));
        return;
      }

      setPets(data.pets ?? []);
    } catch (e: any) {
      const msg =
        e?.name === "AbortError"
          ? "La API tardó demasiado (timeout). Intenta de nuevo."
          : e?.message
          ? String(e.message)
          : extractErrorMessage(e);

      Alert.alert("Error", msg);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }

  async function createPet() {
    const n = name.trim();
    const s = species.trim();

    if (!n) return Alert.alert("Revisa", "Falta el nombre.");
    if (!s) return Alert.alert("Revisa", "Falta la especie. (perro/gato/etc)");

    if (birthdate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(birthdate.trim())) {
      return Alert.alert(
        "Revisa",
        "Birthdate debe ser YYYY-MM-DD (ej: 2022-05-10)"
      );
    }

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return Alert.alert("Error", "No hay sesión.");

      const res = await fetch(`${API_URL}/pets`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: n,
          species: s,
          breed: breed.trim() || null,
          birthdate: birthdate.trim() || null,
          notes: notes.trim() || null,
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
        const msg =
          typeof data === "string"
            ? data
            : typeof data?.message === "string"
            ? data.message
            : JSON.stringify(data, null, 2);

        Alert.alert(
          "Error POST /pets",
          (msg || `HTTP ${res.status}`).slice(0, 1200)
        );
        return;
      }

      setOpen(false);
      resetForm();
      await loadPets();
    } catch (e: any) {
      Alert.alert(
        "Error",
        e?.message ? String(e.message) : extractErrorMessage(e)
      );
    }
  }

  // ✅ CLAVE: recargar cada vez que entras a la pestaña
  useFocusEffect(
    useCallback(() => {
      loadPets();
    }, [])
  );

  return (
    <LinearGradient colors={["#2E78FF", "#66A6FF"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, padding: 18 }}>
        {/* Header con botón Tratamientos */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ color: "white", fontSize: 26, fontWeight: "900" }}>
            Mis Mascotas 🐾
          </Text>

          <TouchableOpacity
            onPress={() => setTreatmentsOpen(true)}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.18)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.25)",
            }}
          >
            <Text style={{ color: "white", fontWeight: "900" }}>
              Tratamientos
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 16 }} />

        {loading ? (
          <ActivityIndicator color="white" size="large" />
        ) : (
          <FlatList
            data={pets}
            keyExtractor={(item) => item.id}
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
                <Text style={{ fontSize: 18, fontWeight: "900" }}>
                  {item.name}
                </Text>
                <Text style={{ color: "#555", marginTop: 4 }}>
                  {item.species}
                  {item.breed ? ` • ${item.breed}` : ""}
                </Text>
                {item.birthdate ? (
                  <Text style={{ color: "#777", marginTop: 4 }}>
                    Nacimiento: {item.birthdate}
                  </Text>
                ) : null}
                {item.notes ? (
                  <Text style={{ color: "#777", marginTop: 4 }}>
                    Notas: {item.notes}
                  </Text>
                ) : null}
              </View>
            )}
            ListEmptyComponent={
              <Text style={{ color: "white", marginTop: 20, fontWeight: "700" }}>
                No tienes mascotas registradas.
              </Text>
            }
            contentContainerStyle={{ paddingBottom: 90 }}
          />
        )}

        {/* Floating Button (+) */}
        <TouchableOpacity
          onPress={() => setOpen(true)}
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
          <Text
            style={{
              color: "white",
              fontSize: 30,
              fontWeight: "900",
              marginTop: -2,
            }}
          >
            +
          </Text>
        </TouchableOpacity>

        {/* Modal Create Pet */}
        <Modal visible={open} transparent animationType="fade">
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.55)",
              justifyContent: "center",
              padding: 18,
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
                Nueva mascota
              </Text>

              <View style={{ height: 12 }} />

              <Text style={{ fontWeight: "700" }}>Nombre *</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Luna"
                style={{
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                  borderRadius: 14,
                  padding: 12,
                  marginTop: 6,
                  marginBottom: 10,
                }}
              />

              <Text style={{ fontWeight: "700" }}>Especie *</Text>
              <TextInput
                value={species}
                onChangeText={setSpecies}
                placeholder="perro / gato"
                style={{
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                  borderRadius: 14,
                  padding: 12,
                  marginTop: 6,
                  marginBottom: 10,
                }}
              />

              <Text style={{ fontWeight: "700" }}>Raza</Text>
              <TextInput
                value={breed}
                onChangeText={setBreed}
                placeholder="mestiza"
                style={{
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                  borderRadius: 14,
                  padding: 12,
                  marginTop: 6,
                  marginBottom: 10,
                }}
              />

              <Text style={{ fontWeight: "700" }}>
                Nacimiento (YYYY-MM-DD)
              </Text>
              <TextInput
                value={birthdate}
                onChangeText={setBirthdate}
                placeholder="2022-05-10"
                style={{
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                  borderRadius: 14,
                  padding: 12,
                  marginTop: 6,
                  marginBottom: 10,
                }}
              />

              <Text style={{ fontWeight: "700" }}>Notas</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Muy tranquila"
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
                  onPress={createPet}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 14,
                    backgroundColor: "#2E78FF",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontWeight: "900", color: "white" }}>
                    Guardar
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ✅ Modal Tratamientos (sale desde arriba) */}
        <Modal visible={treatmentsOpen} transparent animationType="slide">
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }}>
            {/* tocar afuera cierra */}
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => setTreatmentsOpen(false)}
              style={{ flex: 1 }}
            />

            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                paddingTop: 52,
                paddingBottom: 14,
                paddingHorizontal: 16,
                backgroundColor: "white",
                borderBottomLeftRadius: 22,
                borderBottomRightRadius: 22,
                shadowColor: "#000",
                shadowOpacity: 0.2,
                shadowRadius: 12,
                elevation: 10,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: "900" }}>
                  Tratamientos disponibles
                </Text>

                <TouchableOpacity
                  onPress={() => setTreatmentsOpen(false)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    backgroundColor: "#EEF2FF",
                  }}
                >
                  <Text style={{ fontWeight: "900", color: "#1D4ED8" }}>
                    Cerrar
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ height: 10 }} />

              {TREATMENTS.map((t) => (
                <View
                  key={t.title}
                  style={{
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: "#F1F5F9",
                  }}
                >
                  <Text style={{ fontWeight: "900", fontSize: 15 }}>
                    {t.title}
                  </Text>
                  <Text style={{ color: "#475569", marginTop: 3 }}>
                    {t.desc}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}