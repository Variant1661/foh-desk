import assert from "node:assert/strict";

const root = process.env.TEST_BASE_URL || "http://127.0.0.1:3188";
const codes = {
  FOH1: process.env.TEST_FOH1_CODE,
  FOH2: process.env.TEST_FOH2_CODE,
  FOH3: process.env.TEST_FOH3_CODE,
  ADMIN: process.env.TEST_FOH_ADMIN_CODE,
};
if (Object.values(codes).some((code) => !code)) throw new Error("Set all four TEST_FOH*_CODE values for the local test server.");

async function request(path, method = "GET", body, cookie) {
  const response = await fetch(new URL(path, root), {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body && JSON.stringify(body),
  });
  const data = response.headers.get("content-type")?.includes("application/json") ? await response.json() : await response.text();
  return { status: response.status, data, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}

async function login(name) {
  const result = await request("/api/auth/login", "POST", { name, code: codes[name] });
  assert.equal(result.status, 200);
  assert.ok(result.cookie?.startsWith("foh_session="));
  return result.cookie;
}

const date = "2026-10-09";
assert.match((await request("/")).data, /Access code/);
assert.equal((await request("/api/timesheet?name=ALL")).status, 401);
assert.equal((await request("/api/messages", "POST", { message: "Unauthenticated" })).status, 401);
assert.equal((await request("/api/auth/login", "POST", { name: "FOH1", code: "0000" })).status, 401);

const foh1 = await login("FOH1");
assert.match((await request("/", "GET", undefined, foh1)).data, /FOH1 timesheet/);
assert.equal((await request("/api/timesheet?name=ALL", "GET", undefined, foh1)).status, 403);
assert.equal((await request("/api/timesheet?name=FOH2", "GET", undefined, foh1)).status, 403);
assert.equal((await request("/api/timesheet", "POST", { name: "FOH2", date, timeIn: "09:00" }, foh1)).status, 403);

const unique = `Integration ${crypto.randomUUID()}`;
const message = await request("/api/messages", "POST", { message: unique }, foh1);
assert.equal(message.status, 200);
assert.match((await request(`/m/${message.data.id}`)).data, new RegExp(unique));
assert.equal((await request(`/api/messages/${message.data.id}/action`, "POST", { action: "acknowledge" })).status, 200);
assert.equal((await request(`/api/messages/${message.data.id}/action`, "POST", { action: "destroy" })).status, 200);
assert.doesNotMatch((await request(`/m/${message.data.id}`)).data, new RegExp(unique));
assert.match((await request(`/r/${message.data.receiptToken}`)).data, /Acknowledged/);

const own = await request("/api/timesheet", "POST", { name: "FOH1", date, timeIn: "09:00" }, foh1);
assert.equal(own.status, 201);
assert.equal((await request("/api/timesheet", "POST", { name: "FOH1", date, timeIn: "10:00" }, foh1)).status, 409);
assert.equal((await request("/api/timesheet", "PUT", { id: own.data.id, name: "FOH1", date, timeIn: "09:00", timeOut: "17:00" }, foh1)).status, 200);
assert.equal((await request("/api/timesheet", "DELETE", { id: own.data.id, name: "FOH2" }, foh1)).status, 403);
assert.equal((await request("/api/timesheet", "DELETE", { id: own.data.id, name: "FOH1" }, foh1)).status, 200);

const admin = await login("ADMIN");
assert.match((await request("/", "GET", undefined, admin)).data, /All timesheets/);
const entry1 = await request("/api/timesheet", "POST", { name: "FOH1", date, timeIn: "08:00", timeOut: "16:00" }, admin);
const entry2 = await request("/api/timesheet", "POST", { name: "FOH2", date, timeIn: "10:00", timeOut: "18:00" }, admin);
assert.equal(entry1.status, 201);
assert.equal(entry2.status, 201);
assert.equal((await request("/api/timesheet?name=ALL", "GET", undefined, admin)).data.entries.length, 2);
assert.equal((await request("/api/timesheet", "PUT", { id: entry2.data.id, originalName: "FOH2", name: "FOH3", date, timeIn: "11:00", timeOut: "19:00" }, admin)).status, 200);
assert.equal((await request("/api/timesheet?name=FOH3", "GET", undefined, admin)).data.entries[0].timeIn, "11:00");
assert.equal((await request("/api/timesheet", "DELETE", { id: entry1.data.id, name: "FOH1" }, admin)).status, 200);
assert.equal((await request("/api/timesheet", "DELETE", { id: entry2.data.id, name: "FOH3" }, admin)).status, 200);

const foh2 = await login("FOH2");
assert.equal((await request("/api/timesheet?name=FOH1", "GET", undefined, foh2)).status, 403);
assert.deepEqual((await request("/api/timesheet?name=FOH2", "GET", undefined, foh2)).data.entries, []);
assert.equal((await request("/api/auth/logout", "POST", undefined, foh2)).status, 200);
assert.equal((await request("/api/timesheet?name=FOH2", "GET", undefined, foh2)).status, 401);

const foh3 = await login("FOH3");
assert.equal((await request("/api/timesheet?name=FOH3", "GET", undefined, foh3)).status, 200);
assert.equal((await request("/api/auth/logout", "POST", undefined, foh3)).status, 200);

for (let attempt = 0; attempt < 10; attempt++) {
  assert.equal((await request("/api/auth/login", "POST", { name: "FOH3", code: "0000" })).status, 401);
}
assert.equal((await request("/api/auth/login", "POST", { name: "FOH3", code: "0000" })).status, 429);

console.log("FOH Desk access, admin, and message checks passed");
