import test from "node:test";
import assert from "node:assert/strict";
import {findInPlan, pageFragments, viewFromFragment, taskTiming} from "../lib/everyday";
import {seed, filtered} from "../lib/domain";
test("every page round-trips through its public fragment without record identifiers", () => {
  for (const [view, fragment] of Object.entries(pageFragments)) assert.equal(viewFromFragment("#" + fragment), view);
  for (const fragment of ["#main", "#not-a-page", "#%70eople", "#People"]) assert.equal(viewFromFragment(fragment), null);
});
test("an empty finder offers page navigation rather than private record previews", () => {
  const results = findInPlan(seed(), " ");
  assert.equal(results.length, 7);
  assert.ok(results.every(r => r.kind === "page" && !r.record));
});
test("finder matches accented names and combines search terms without searching technical metadata", () => {
  const state = {people:[{id:"secret-record-id",name:"Élena Ellis",email:"elena@example.test",note:"confidential unrelated notes"}]};
  assert.equal(findInPlan(state, "elena ellis")[0].label, "Élena Ellis");
  assert.equal(findInPlan(state, "secret-record-id").length, 0);
  assert.equal(findInPlan(state, "confidential unrelated").length, 0);
  assert.equal(findInPlan(state, "elena absent").length, 0);
});
test("global find cannot surface accounts or private letters removed by the actual helper filter", () => {
  const state = seed();
  const permitted = filtered(state, "helper", "emergency");
  for (const account of state.accounts) assert.ok(!findInPlan(permitted, account.name).some(r => r.kind === "account"));
  for (const document of state.documents.filter(d => d.visibility === "private")) assert.ok(!findInPlan(permitted, document.title).some(r => r.kind === "document"));
});
test("finder directs tasks to their own area and caps broad matches", () => {
  const tasks = Array.from({length:20}, (_,i) => ({id:String(i),title:"Review record "+i,category:"accounts",owner:"Maria"}));
  const results = findInPlan({tasks}, "Review record");
  assert.equal(results.length,12);
  assert.ok(results.every(r => r.view === "Accounts & policies" && r.kind === "task"));
});
test("finder leaves its supplied workspace untouched", () => {
  const state=seed(), before=JSON.stringify(state);
  findInPlan(state,"Maria");
  assert.equal(JSON.stringify(state),before);
});
test("past recorded dates are overdue, including an earlier time today", () => {
  const now = new Date(2030,4,20,12,0);
  assert.equal(taskTiming(new Date(2030,4,19,12,0).toISOString(),"open",now),"overdue");
  assert.equal(taskTiming(new Date(2030,4,20,11,59).toISOString(),"professional-review",now),"overdue");
});
test("later today and future dates remain distinct", () => {
  const now = new Date(2030,4,20,12,0);
  assert.equal(taskTiming(new Date(2030,4,20,13,0).toISOString(),"open",now),"today");
  assert.equal(taskTiming(new Date(2030,4,21,13,0).toISOString(),"open",now),"upcoming");
});
test("completed steps and absent or invalid dates never acquire an overdue badge", () => {
  const now = new Date(2030,4,20,12,0);
  assert.equal(taskTiming(new Date(2030,4,19).toISOString(),"complete",now),null);
  assert.equal(taskTiming("invalid","open",now),null);
  assert.equal(taskTiming(null,"open",now),null);
});
