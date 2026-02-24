import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, Text, View } from "react-native";

export default function Home() {
  return (
    <LinearGradient colors={["#2E78FF", "#66A6FF"]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, padding: 18 }}>
        <Text style={{ color: "white", fontSize: 26, fontWeight: "900" }}>
          Mi Hogar
        </Text>

        <View style={{ height: 16 }} />

        <View
          style={{
            backgroundColor: "white",
            borderRadius: 18,
            padding: 16,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "800" }}>
            Bienvenido 🐶🐱
          </Text>
          <Text style={{ marginTop: 6, color: "#555" }}>
            Aquí verás tus mascotas, citas y tratamientos.
          </Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}