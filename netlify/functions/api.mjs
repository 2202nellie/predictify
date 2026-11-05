import { getStore } from "@netlify/blobs";

const j = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", "x-developed-by": "clout" } });
const k = (u) => String(u || "").trim().toLowerCase();
const valid = (u) => /^[A-Za-z0-9_.]{3,16}$/.test(String(u || ""));
const validPin = (p) => typeof p === "string" && p.length >= 4 && p.length <= 12;
const sha = async (t) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))].map((x) => x.toString(16).padStart(2, "0")).join("");
const pinHash = (pin, user) => sha(pin + ":" + k(user));

const handler = async (req) => {
  const st = getStore("predictify");
  const url = new URL(req.url);
  const p = url.pathname.replace(/^\/api\//, "");
  const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));

  if (p === "check") {
    const u = url.searchParams.get("u");
    if (!valid(u)) return j({ available: false, reason: "3-16 letters, numbers, _ or ." });
    const rec = await st.get("users/" + k(u), { type: "json" });
    if (!rec) return j({ available: true });
    return j({ available: false, exists: true, hasPin: !!rec.ph });
  }

  if (p === "register") {
    if (!valid(body.username) || !validPin(body.pin)) return j({ error: "invalid" }, 400);
    const key = "users/" + k(body.username);
    if (await st.get(key)) return j({ error: "taken" }, 409);
    const ph = await pinHash(body.pin, body.username);
    await st.setJSON(key, { name: body.username.trim(), ph }, { onlyIfNew: true });
    const saved = await st.get(key, { type: "json" });
    if (!saved || saved.ph !== ph) return j({ error: "taken" }, 409);
    return j({ username: saved.name, token: body.pin });
  }

  if (p === "login") {
    if (!valid(body.username) || !validPin(body.pin)) return j({ error: "invalid" }, 400);
    const key = "users/" + k(body.username);
    const rec = await st.get(key, { type: "json" });
    if (!rec) return j({ error: "nope" }, 404);
    const ph = await pinHash(body.pin, body.username);
    if (!rec.ph) {
      await st.setJSON(key, { ...rec, ph });
    } else if (rec.ph !== ph) {
      return j({ error: "wrong pin" }, 401);
    }
    return j({ username: rec.name, token: body.pin });
  }

  const profile = async (u) => {
    const rec = await st.get("users/" + k(u), { type: "json" });
    if (!rec) return null;
    return { username: rec.name, pred: await st.get("preds/" + k(u), { type: "json" }), actual: await st.get("actuals/" + k(u), { type: "json" }) };
  };

  if (p === "profile") {
    const d = await profile(url.searchParams.get("u"));
    return d ? j(d) : j({ error: "nope" }, 404);
  }

  const user = req.headers.get("x-user"), tok = req.headers.get("x-token");
  const rec = user && tok ? await st.get("users/" + k(user), { type: "json" }) : null;
  const authed = rec && ((rec.ph && rec.ph === (await pinHash(tok, user))) || (rec.h && rec.h === (await sha(tok))));
  if (!authed) return j({ error: "auth" }, 401);
  const me = k(user);

  if (p === "predictions" || p === "actuals") {
    const a = body.answers;
    if (!a || typeof a !== "object") return j({ error: "bad" }, 400);
    await st.setJSON((p === "predictions" ? "preds/" : "actuals/") + me, { answers: a, at: Date.now() });
    return j({ ok: true });
  }

  const friendsOf = async (u) => (await st.get("friends/" + u, { type: "json" })) || [];
  if (p === "befriend") {
    const f = k(body.friend);
    if (!f || f === me || !(await st.get("users/" + f))) return j({ error: "nope" }, 404);
    for (const [a, b] of [[me, f], [f, me]]) {
      const l = await friendsOf(a);
      if (!l.includes(b)) await st.setJSON("friends/" + a, [...l, b]);
    }
    return j({ ok: true });
  }

  if (p === "friends") {
    const list = await Promise.all((await friendsOf(me)).map(profile));
    return j({ friends: list.filter(Boolean) });
  }

  return j({ error: "not found" }, 404);
};

export default async (req) => {
  try {
    return await handler(req);
  } catch (e) {
    return j({ error: String((e && e.message) || e) }, 500);
  }
};

export const config = { path: "/api/*" };
