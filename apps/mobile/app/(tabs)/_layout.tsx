import { Tabs } from "expo-router";
import { Text } from "react-native";

function TabIcon({ label }: { label: string }) {
  // Por ahora texto simple; después ponemos íconos bonitos
  return <Text style={{ fontSize: 12 }}>{label}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          height: 62,
          paddingBottom: 10,
          paddingTop: 10,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Inicio",
          tabBarIcon: () => <TabIcon label="🏠" />,
        }}
      />
      <Tabs.Screen
        name="pets"
        options={{
          title: "Mascotas",
          tabBarIcon: () => <TabIcon label="🐾" />,
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: "Citas",
          tabBarIcon: () => <TabIcon label="📅" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: () => <TabIcon label="👤" />,
        }}
      />
    </Tabs>
  );
}