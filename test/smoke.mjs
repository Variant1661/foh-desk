import assert from "node:assert/strict";

const root = process.env.TEST_BASE_URL || "http://127.0.0.1:3188";

async function json(path, method, body) {
  const response = await fetch(new URL(path, root), {
    method,
    headers: { "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}

const unique = `Integration ${crypto.randomUUID()}`;
const made = await json("/api/messages", "POST", { message: unique });
assert.equal(made.status, 200);
assert.equal((await (await fetch(`${root}/m/${made.data.id}`)).text()).includes(unique), true);
let receipt = await (await fetch(`${root}/r/${made.data.receiptToken}`)).text();
assert.match(receipt, /Not acknowledged yet/);
assert.equal((await json(`/api/messages/${made.data.id}/action`, "POST", { action: "acknowledge" })).status, 200);
receipt = await (await fetch(`${root}/r/${made.data.receiptToken}`)).text();
assert.match(receipt, /Acknowledged/);
assert.equal((await json(`/api/messages/${made.data.id}/action`, "POST", { action: "keep" })).status, 200);
assert.match(await (await fetch(`${root}/m/${made.data.id}`)).text(), /Integration/);
assert.equal((await json(`/api/messages/${made.data.id}/action`, "POST", { action: "destroy" })).status, 200);
assert.doesNotMatch(await (await fetch(`${root}/m/${made.data.id}`)).text(), new RegExp(unique));
assert.match(await (await fetch(`${root}/r/${made.data.receiptToken}`)).text(), /Destroyed now/);

const date = "2026-10-09";
const first = await json("/api/timesheet", "POST", { name: "FOH1", date, timeIn: "09:00", timeOut: null });
assert.equal(first.status, 201);
assert.equal((await json("/api/timesheet", "POST", { name: "FOH1", date, timeIn: "10:00", timeOut: null })).status, 409);
assert.equal((await json("/api/timesheet", "PUT", { id: first.data.id, name: "FOH1", date, timeIn: "09:00", timeOut: "17:00" })).status, 200);
assert.equal((await json("/api/timesheet", "POST", { name: "FOH2", date, timeIn: "12:00", timeOut: "18:00" })).status, 201);
const foh1 = await (await fetch(`${root}/api/timesheet?name=FOH1`)).json();
const foh2 = await (await fetch(`${root}/api/timesheet?name=FOH2`)).json();
assert.equal(foh1.entries.length, 1);
assert.equal(foh1.entries[0].timeOut, "17:00");
assert.equal(foh2.entries.length, 1);
assert.equal(foh2.entries[0].timeIn, "12:00");
assert.equal((await json("/api/timesheet", "POST", { name: "FOH4", date, timeIn: "09:00" })).status, 400);

console.log("FOH Desk smoke test passed");
