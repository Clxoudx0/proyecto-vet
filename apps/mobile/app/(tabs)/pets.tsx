import { useEffect, useState } from "react";
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

  // modal
  const [open, setOpen] = useState(false);

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
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
  
      const res = await fetch(`${API_URL}/pets`, {
        headers: { Authorization: `Bearer ${token}` },
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
  
        Alert.alert("Error /pets", msg.slice(0, 1200));
        return;
      }
  
      setPets(data.pets ?? []);
    } catch (e: any) {
      Alert.alert("Error", e?.message ? String(e.message) : JSON.stringify(e, null, 2));
    } finally {
      setLoading(false);
    }
  }

  async function createPet() {
    const n = name.trim();
    const s = species.trim();
  
    if (!n) return Alert.alert("Revisa", "Falta el nombre.");
    if (!s) return Alert.alert("Revisa", "Falta la especie. (perro/gato/etc)");
  
    if (birthdate.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(birthdate.trim())) {
      return Alert.alert("Revisa", "Birthdate debe ser YYYY-MM-DD (ej: 2022-05-10)");
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
  
        Alert.alert("Error POST /pets", msg.slice(0, 1200));
        return;
      }
  
      setOpen(false);
      resetForm();
      await loadPets();
    } catch (e: any) {
      Alert.alert("Error", e?.message ? String(e.message) : JSON.stringify(e, null, 2));
    }
  }
  return (
    <LinearGradient colors={["#2E78FF", "#66A6FF"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, padding: 18 }}>
        <Text style={{ color: "white", fontSize: 26, fontWeight: "900" }}>
          Mis Mascotas 🐾
        </Text>

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
                <Text style={{ fontSize: 18, fontWeight: "900" }}>{item.name}</Text>
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

        {/* Floating Button */}
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
          <Text style={{ color: "white", fontSize: 30, fontWeight: "900", marginTop: -2 }}>
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

              <Text style={{ fontWeight: "700" }}>Nacimiento (YYYY-MM-DD)</Text>
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
      </SafeAreaView>
    </LinearGradient>
  );
}