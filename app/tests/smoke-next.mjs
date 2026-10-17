import assert from "node:assert/strict";
const base = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3001";
for (const [path, text] of [
  ["/", "PACT"],
  ["/crear", "Crea tu"],
  ["/conectar", "Cargando tu sesi"],
  ["/dashboard", "Cargando tu sesi"],
  ["/configuracion", "Cargando tu sesi"],
  ["/iniciar-sesion", "Cargando acceso"],
  ["/registro", "Cargando registro"],
  ["/explorar", "Encuentra tu"],
  ["/solicitudes", "Cargando tu sesi"],
  ["/solicitudes/nueva", "Cargando tu sesi"],
  ["/postulaciones", "Cargando tu sesi"],
  ["/portafolio", "Cargando tu sesi"],
  ["/creditos", "Cargando tu sesi"],
  ["/cuenta", "Cargando tu sesi"],
  ["/integraciones", "Cargando tu sesi"],
]) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200, path);
  assert.ok((await response.text()).includes(text), path + " renders its page");
  console.log(`OK ${path}`);
}
for (const path of [
  "/api/auth/me",
  "/api/agreements",
  "/api/dashboard",
  "/api/portfolio",
  "/api/applications",
  "/api/credits",
  "/api/agent-keys",
  "/api/webhooks",
]) {
  const response = await fetch(base + path);
  assert.equal(response.status, 401, path + " requires session");
  assert.equal((await response.json()).error, "unauthenticated");
  console.log(`OK ${path}: protected backend`);
}
const prepare = await fetch(base + "/api/agreements/prepare", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{}",
});
assert.equal(prepare.status, 401);
const invalidNonce = await fetch(base + "/api/auth/nonce", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ address: "invalid" }),
});
assert.equal(invalidNonce.status, 400);
console.log(
  "OK prepare requires session; nonce rejects invalid address without writing",
);
for (const path of [
  "/pact-logo.svg",
  "/illustrations/persona.svg",
  "/fonts/intropol/intropol-regular.otf",
])
  assert.equal((await fetch(base + path)).status, 200, path);
console.log("OK migrated logos, illustrations and fonts");
