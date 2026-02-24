import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, Text, TouchableOpacity, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

export default function Profile() {
  const router = useRouter();

  async function logout() {
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("user_id");
    await AsyncStorage.removeItem("user_email");
    router.replace("/");
  }

  return (
    <LinearGradient colors={["#2E78FF", "#66A6FF"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, padding: 18 }}>
        <Text style={{ color: "white", fontSize: 26, fontWeight: "900" }}>
          Perfil
        </Text>

        <View style={{ height: 16 }} />

        <View style={{ backgroundColor: "white", borderRadius: 18, padding: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: "800" }}>
            Cuenta
          </Text>

          <TouchableOpacity
            onPress={logout}
            style={{
              marginTop: 14,
              backgroundColor: "#2E78FF",
              paddingVertical: 12,
              borderRadius: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "white", fontWeight: "900" }}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}