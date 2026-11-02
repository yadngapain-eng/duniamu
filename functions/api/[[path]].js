const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
const json = (d, s = 200) => new Response(JSON.stringify(d), {status:s, headers:{"Content-Type":"application/json",...CORS}});
const err = (m, s = 400) => json({ok:false, error:m}, s);

async function getConfig(env) {
  const raw = await env.MISSION_KV.get("config");
  if (raw) return JSON.parse(raw);
  const def = {
    siteName: "Duniamu",
    slogan: "Selesaikan Misi, Hasilkan 💸",
    owner: "",
    reward: { currency: "IDR", rate: 1000 },
    missions: [
      { id: 1, title: "Star repo GitHub", reward: 10, link: "" },
      { id: 2, title: "Fork repo GitHub", reward: 15, link: "" },
      { id: 3, title: "Follow pemilik", reward: 10, link: "" },
      { id: 4, title: "Buat issue", reward: 20, link: "" },
      { id: 5, title: "Share project", reward: 25, link: "" },
    ],
    payments: [
      { id: "dana", name: "DANA", number: "08xxxxxxxxxx", holder: "Nama Anda", active: true },
      { id: "ovo", name: "OVO", number: "08xxxxxxxxxx", holder: "Nama Anda", active: false },
      { id: "gopay", name: "GoPay", number: "08xxxxxxxxxx", holder: "Nama Anda", active: false },
    ],
    claims: [],
    updatedAt: new Date().toISOString(),
  };
  await env.MISSION_KV.put("config", JSON.stringify(def));
  return def;
}
async function saveConfig(env, cfg) {
  cfg.updatedAt = new Date().toISOString();
  await env.MISSION_KV.put("config", JSON.stringify(cfg));
}
function checkAdmin(request, env) {
  const a = request.headers.get("Authorization") || "";
  const t = a.replace(/^Bearer\s+/i, "");
  return t && t === env.ADMIN_TOKEN;
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const path = (params.path || []).join("/");
  const method = request.method;
  if (method === "OPTIONS") return new Response(null, { headers: CORS });

  try {
    if (path === "config" && method === "GET") {
      const cfg = await getConfig(env);
      return json({ ok: true, data: {
        siteName: cfg.siteName, slogan: cfg.slogan, owner: cfg.owner,
        reward: cfg.reward, missions: cfg.missions,
        payments: cfg.payments.filter(p => p.active),
      }});
    }
    if (path === "claim" && method === "POST") {
      const body = await request.json();
      if (!body.name || !body.contact || !body.paymentMethod || !body.missions)
        return err("Data tidak lengkap");
      const cfg = await getConfig(env);
      const id = "CLM-" + Date.now().toString(36).toUpperCase();
      const totalPoin = body.missions.reduce((s, m) => s + (m.reward || 0), 0);
      const totalUang = totalPoin * (cfg.reward.rate || 0);
      cfg.claims.unshift({
        id, name: String(body.name).slice(0,100),
        contact: String(body.contact).slice(0,100),
        paymentMethod: String(body.paymentMethod).slice(0,50),
        missions: body.missions, totalPoin, totalUang,
        status: "pending", createdAt: new Date().toISOString(),
      });
      if (cfg.claims.length > 1000) cfg.claims = cfg.claims.slice(0, 1000);
      await saveConfig(env, cfg);
      return json({ ok: true, data: { id, totalPoin, totalUang } });
    }
    if (!checkAdmin(request, env)) return err("Unauthorized", 401);
    if (path === "admin/config" && method === "GET")
      return json({ ok: true, data: await getConfig(env) });
    if (path === "admin/config" && method === "PUT") {
      const body = await request.json();
      const cfg = await getConfig(env);
      if (body.siteName !== undefined) cfg.siteName = body.siteName;
      if (body.slogan !== undefined) cfg.slogan = body.slogan;
      if (body.owner !== undefined) cfg.owner = body.owner;
      if (body.reward !== undefined) cfg.reward = body.reward;
      if (Array.isArray(body.missions)) cfg.missions = body.missions;
      if (Array.isArray(body.payments)) cfg.payments = body.payments;
      await saveConfig(env, cfg);
      return json({ ok: true, data: cfg });
    }
    if (path === "admin/claims" && method === "GET") {
      const cfg = await getConfig(env);
      return json({ ok: true, data: cfg.claims || [] });
    }
    if (path.startsWith("admin/claims/") && method === "PUT") {
      const id = path.split("/")[2];
      const body = await request.json();
      const cfg = await getConfig(env);
      const c = cfg.claims.find(x => x.id === id);
      if (!c) return err("Tidak ditemukan", 404);
      if (body.status) c.status = body.status;
      if (body.note) c.note = body.note;
      await saveConfig(env, cfg);
      return json({ ok: true, data: c });
    }
    if (path.startsWith("admin/claims/") && method === "DELETE") {
      const id = path.split("/")[2];
      const cfg = await getConfig(env);
      cfg.claims = cfg.claims.filter(x => x.id !== id);
      await saveConfig(env, cfg);
      return json({ ok: true });
    }
    return err("Route 404", 404);
  } catch (e) {
    return err("Error: " + e.message, 500);
  }
}
