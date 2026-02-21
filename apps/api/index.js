import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Middleware: obtener usuario desde token Bearer
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization ?? "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) return res.status(401).json({ message: "Falta token Bearer" });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ message: "Token inválido" });
    }

    req.user = data.user;
    next();
  } catch (e) {
    return res.status(500).json({ message: String(e) });
  }
}

// Asegurar que exista el profile para el usuario (evita FK error)
async function ensureProfile(user) {
  const { data: existing, error: selErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (selErr) throw selErr;

  if (!existing) {
    const { error: insErr } = await supabase.from("profiles").insert([
      {
        id: user.id,
        full_name: user.user_metadata?.full_name ?? null,
        phone: null,
      },
    ]);
    if (insErr) throw insErr;
  }
}

app.get("/health", (req, res) => {
  res.json({ ok: true, message: "API OK" });
});

// Debug: ver rutas (para confirmar que /pets existe)
app.get("/routes", (req, res) => {
  res.json({
    ok: true,
    routes: [
      "/health",
      "/routes",
      "/me",
      "/auth/register",
      "/auth/login",
      "/pets",
      "/appointments",
    ],
  });
});

// Ver mi usuario (requiere token)
app.get("/me", requireAuth, async (req, res) => {
  return res.json({ ok: true, user: req.user });
});

// Registro
app.post("/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "email y password son requeridos" });
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return res.status(400).json({ message: error.message });

    return res.json({ ok: true, data });
  } catch (e) {
    return res.status(500).json({ message: String(e) });
  }
});

// Login
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "email y password son requeridos" });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return res.status(401).json({ message: error.message });

    return res.json({
      ok: true,
      access_token: data.session?.access_token,
      user: data.user,
    });
  } catch (e) {
    return res.status(500).json({ message: String(e) });
  }
});


// =====================
// APPOINTMENTS (Citas)
// =====================

// Listar mis citas
app.get("/appointments", requireAuth, async (req, res) => {
    try {
      const ownerId = req.user.id;
  
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("owner_id", ownerId)
        .order("scheduled_at", { ascending: true });
  
      if (error) return res.status(400).json({ message: error.message });
  
      return res.json({ ok: true, appointments: data ?? [] });
    } catch (e) {
      return res.status(500).json({ message: String(e) });
    }
  });
  
  // Crear cita
  app.post("/appointments", requireAuth, async (req, res) => {
    try {
      await ensureProfile(req.user);
  
      const ownerId = req.user.id;
      const { pet_id, scheduled_at, reason } = req.body ?? {};
  
      if (!scheduled_at) {
        return res.status(400).json({ message: "scheduled_at es requerido (ISO)" });
      }
  
      // pet_id puede ser null (si no quieres obligarlo)
      const { data, error } = await supabase
        .from("appointments")
        .insert([
          {
            owner_id: ownerId,
            pet_id: pet_id ?? null,
            scheduled_at, // ejemplo: "2026-02-21T18:00:00Z"
            reason: reason ?? null,
            status: "pending",
          },
        ])
        .select()
        .single();
  
      if (error) return res.status(400).json({ message: error.message });
  
      return res.json({ ok: true, appointment: data });
    } catch (e) {
      return res.status(500).json({ message: String(e) });
    }
  });

// =====================
// PETS (Mascotas)
// =====================

// Listar mis mascotas
app.get("/pets", requireAuth, async (req, res) => {
  try {
    const ownerId = req.user.id;

    const { data, error } = await supabase
      .from("pets")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });

    if (error) return res.status(400).json({ message: error.message });

    return res.json({ ok: true, pets: data ?? [] });
  } catch (e) {
    return res.status(500).json({ message: String(e) });
  }
});

// Crear mascota
app.post("/pets", requireAuth, async (req, res) => {
  try {
    // Asegura que exista profiles.id = user.id
    await ensureProfile(req.user);

    const ownerId = req.user.id;
    const { name, species, breed, birthdate, notes } = req.body ?? {};

    if (!name || !species) {
      return res.status(400).json({ message: "name y species son requeridos" });
    }

    const { data, error } = await supabase
      .from("pets")
      .insert([
        {
          owner_id: ownerId,
          name,
          species,
          breed: breed ?? null,
          birthdate: birthdate ?? null, // "YYYY-MM-DD" o null
          notes: notes ?? null,
        },
      ])
      .select()
      .single();

    if (error) return res.status(400).json({ message: error.message });

    return res.json({ ok: true, pet: data });
  } catch (e) {
    return res.status(500).json({ message: String(e) });
  }
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`API corriendo en http://localhost:${PORT}`));