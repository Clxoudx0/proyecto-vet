// apps/api/app.js
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

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
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
// IMPORTANTE: usar supabaseAdmin para que NO falle por RLS
async function ensureProfile(user) {
  const { data: existing, error: selErr } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (selErr) throw selErr;

  if (!existing) {
    const { error: insErr } = await supabaseAdmin.from("profiles").insert([
      {
        id: user.id,
        full_name: user.user_metadata?.full_name ?? null,
        phone: null,
      },
    ]);
    if (insErr) throw insErr;
  }
}

function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ message: "No autorizado (admin)" });
  }
  next();
}

// ---------- ROUTES ----------
app.get("/health", (req, res) => {
  res.json({ ok: true, message: "API OK" });
});

app.get("/routes", (req, res) => {
  res.json({
    ok: true,
    routes: [
      "/health",
      "/routes",
      "/me",
      "/auth/register",
      "/auth/login",
      "/profile",
      "/pets",
      "/appointments",
      "/appointments/:id",
      "/appointments/:id/cancel",
      "/pets/:petId/visits",
      "/pets/:petId/treatments",
      "/admin/stats",
      "/admin/appointments",
      "/admin/appointments/:id",
    ],
  });
});

app.get("/me", requireAuth, async (req, res) => {
  return res.json({ ok: true, user: req.user });
});

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

// ADMIN STATS (simulado con password del usuario)
// Devuelve totales globales: usuarios, mascotas, citas
app.post("/admin/stats", requireAuth, async (req, res) => {
  try {
    const { password } = req.body ?? {};
    if (!password) return res.status(400).json({ message: "password es requerido" });

    const email = req.user?.email;
    if (!email) return res.status(400).json({ message: "Tu usuario no tiene email" });

    // ✅ Verificar que la contraseña ingresada sea correcta
    // (re-login usando anon key)
    const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginErr || !loginData?.session) {
      return res.status(401).json({ message: "Contraseña incorrecta" });
    }

    // ✅ Totales globales (service role)
    // Usuarios (Auth)
    const { data: usersData, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1, // no importa, el total viene en `total` (cuando está disponible)
      page: 1,
    });
    if (usersErr) return res.status(400).json({ message: usersErr.message });

    // Si `total` no existiera, fallback a length (menos exacto)
    const usersTotal =
      typeof usersData?.total === "number" ? usersData.total : (usersData?.users?.length ?? 0);

    // Mascotas (tabla pets)
    const { count: petsTotal, error: petsErr } = await supabaseAdmin
      .from("pets")
      .select("id", { count: "exact", head: true });

    if (petsErr) return res.status(400).json({ message: petsErr.message });

    // Citas (tabla appointments)
    const { count: appointmentsTotal, error: apErr } = await supabaseAdmin
      .from("appointments")
      .select("id", { count: "exact", head: true });

    if (apErr) return res.status(400).json({ message: apErr.message });

    return res.json({
      ok: true,
      stats: {
        users: usersTotal,
        pets: petsTotal ?? 0,
        appointments: appointmentsTotal ?? 0,
      },
    });
  } catch (e) {
    return res.status(500).json({ message: String(e) });
  }
});


// PROFILE
app.get("/profile", requireAuth, async (req, res) => {
  try {
    await ensureProfile(req.user);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, phone, created_at")
      .eq("id", req.user.id)
      .single();

    if (error) return res.status(400).json({ message: error.message });

    return res.json({ ok: true, profile: data });
  } catch (e) {
    return res.status(500).json({ message: String(e) });
  }
});

app.put("/profile", requireAuth, async (req, res) => {
  try {
    await ensureProfile(req.user);

    const { full_name, phone } = req.body ?? {};

    const { data, error } = await supabase
      .from("profiles")
      .update({
        full_name: full_name ?? null,
        phone: phone ?? null,
      })
      .eq("id", req.user.id)
      .select("id, full_name, phone, created_at")
      .single();

    if (error) return res.status(400).json({ message: error.message });

    return res.json({ ok: true, profile: data });
  } catch (e) {
    return res.status(500).json({ message: String(e) });
  }
});

// PETS
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

app.post("/pets", requireAuth, async (req, res) => {
  try {
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
          birthdate: birthdate ?? null,
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

// APPOINTMENTS
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

app.post("/appointments", requireAuth, async (req, res) => {
  try {
    await ensureProfile(req.user);

    const ownerId = req.user.id;
    const { pet_id, scheduled_at, reason } = req.body ?? {};

    if (!scheduled_at) {
      return res
        .status(400)
        .json({ message: "scheduled_at es requerido (ISO)" });
    }

    const { data, error } = await supabase
      .from("appointments")
      .insert([
        {
          owner_id: ownerId,
          pet_id: pet_id ?? null,
          scheduled_at,
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

// Editar cita (motivo/fecha/mascota) - SOLO dueño
app.put("/appointments/:id", requireAuth, async (req, res) => {
  try {
    await ensureProfile(req.user);

    const ownerId = req.user.id;
    const id = req.params.id;

    const { pet_id, scheduled_at, reason } = req.body ?? {};

    // Validaciones básicas
    if (scheduled_at && typeof scheduled_at !== "string") {
      return res.status(400).json({ message: "scheduled_at debe ser string ISO" });
    }
    if (reason && typeof reason !== "string") {
      return res.status(400).json({ message: "reason debe ser string" });
    }

    // Solo edita su propia cita
    const { data, error } = await supabase
      .from("appointments")
      .update({
        pet_id: pet_id ?? null,
        scheduled_at: scheduled_at ?? undefined, // si no viene, no lo cambia
        reason: reason ?? undefined,             // si no viene, no lo cambia
      })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .select()
      .single();

    if (error) return res.status(400).json({ message: error.message });
    if (!data) return res.status(404).json({ message: "Cita no encontrada" });

    return res.json({ ok: true, appointment: data });
  } catch (e) {
    return res.status(500).json({ message: String(e) });
  }
});
// ✅ Cancelar cita (status = cancelled)
app.patch("/appointments/:id/cancel", requireAuth, async (req, res) => {
  try {
    const ownerId = req.user.id;
    const id = req.params.id;

    const { data, error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("owner_id", ownerId)
      .select()
      .single();

    if (error) return res.status(400).json({ message: error.message });
    if (!data) return res.status(404).json({ message: "Cita no encontrada" });

    return res.json({ ok: true, appointment: data });
  } catch (e) {
    return res.status(500).json({ message: String(e) });
  }
});

// VISITS
app.get("/pets/:petId/visits", requireAuth, async (req, res) => {
  try {
    const { petId } = req.params;

    const { data: pet, error: petErr } = await supabase
      .from("pets")
      .select("id, owner_id")
      .eq("id", petId)
      .single();

    if (petErr) return res.status(400).json({ message: petErr.message });
    if (!pet || pet.owner_id !== req.user.id) {
      return res.status(403).json({ message: "No autorizado" });
    }

    const { data, error } = await supabase
      .from("pet_visits")
      .select("*")
      .eq("pet_id", petId)
      .order("visit_date", { ascending: false });

    if (error) return res.status(400).json({ message: error.message });

    return res.json({ ok: true, visits: data ?? [] });
  } catch (e) {
    return res.status(500).json({ message: String(e) });
  }
});

app.post("/pets/:petId/visits", requireAuth, async (req, res) => {
  try {
    await ensureProfile(req.user);

    const { petId } = req.params;
    const { visit_date, notes } = req.body ?? {};

    const { data: pet, error: petErr } = await supabase
      .from("pets")
      .select("id, owner_id")
      .eq("id", petId)
      .single();

    if (petErr) return res.status(400).json({ message: petErr.message });
    if (!pet || pet.owner_id !== req.user.id) {
      return res.status(403).json({ message: "No autorizado" });
    }

    const { data, error } = await supabase
      .from("pet_visits")
      .insert([
        {
          pet_id: petId,
          visit_date: visit_date ?? new Date().toISOString(),
          notes: notes ?? null,
        },
      ])
      .select()
      .single();

    if (error) return res.status(400).json({ message: error.message });

    return res.json({ ok: true, visit: data });
  } catch (e) {
    return res.status(500).json({ message: String(e) });
  }
});

// TREATMENTS
app.get("/pets/:petId/treatments", requireAuth, async (req, res) => {
  try {
    const { petId } = req.params;

    const { data: pet, error: petErr } = await supabase
      .from("pets")
      .select("id, owner_id")
      .eq("id", petId)
      .single();

    if (petErr) return res.status(400).json({ message: petErr.message });
    if (!pet || pet.owner_id !== req.user.id) {
      return res.status(403).json({ message: "No autorizado" });
    }

    const { data, error } = await supabase
      .from("treatments")
      .select("*")
      .eq("pet_id", petId)
      .order("created_at", { ascending: false });

    if (error) return res.status(400).json({ message: error.message });

    return res.json({ ok: true, treatments: data ?? [] });
  } catch (e) {
    return res.status(500).json({ message: String(e) });
  }
});

app.post("/pets/:petId/treatments", requireAuth, async (req, res) => {
  try {
    await ensureProfile(req.user);

    const { petId } = req.params;
    const { title, description, start_date, end_date, status } = req.body ?? {};

    if (!title) return res.status(400).json({ message: "title es requerido" });

    const { data: pet, error: petErr } = await supabase
      .from("pets")
      .select("id, owner_id")
      .eq("id", petId)
      .single();

    if (petErr) return res.status(400).json({ message: petErr.message });
    if (!pet || pet.owner_id !== req.user.id) {
      return res.status(403).json({ message: "No autorizado" });
    }

    const { data, error } = await supabase
      .from("treatments")
      .insert([
        {
          pet_id: petId,
          title,
          description: description ?? null,
          start_date: start_date ?? null,
          end_date: end_date ?? null,
          status: status ?? "active",
        },
      ])
      .select()
      .single();

    if (error) return res.status(400).json({ message: error.message });

    return res.json({ ok: true, treatment: data });
  } catch (e) {
    return res.status(500).json({ message: String(e) });
  }
});

// ADMIN
app.get("/admin/appointments", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("appointments")
      .select("*")
      .order("scheduled_at", { ascending: true });

    if (error) return res.status(400).json({ message: error.message });

    return res.json({ ok: true, appointments: data ?? [] });
  } catch (e) {
    return res.status(500).json({ message: String(e) });
  }
});

app.patch("/admin/appointments/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body ?? {};

    const allowed = ["pending", "confirmed", "cancelled", "done"];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        message: `status inválido. Usa: ${allowed.join(", ")}`,
      });
    }

    const { data, error } = await supabaseAdmin
      .from("appointments")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) return res.status(400).json({ message: error.message });

    return res.json({ ok: true, appointment: data });
  } catch (e) {
    return res.status(500).json({ message: String(e) });
  }
});

export default app;