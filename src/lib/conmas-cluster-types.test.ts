import test from "node:test";
import assert from "node:assert/strict";
import { TYPE_NUM_TO_STRING, VALID_CLUSTER_TYPE_NAMES } from "./conmas-cluster-types.ts";

test("TYPE_NUM_TO_STRING maps known codes correctly", () => {
  assert.equal(TYPE_NUM_TO_STRING[30], "KeyboardText");
  assert.equal(TYPE_NUM_TO_STRING[40], "Date");
  assert.equal(TYPE_NUM_TO_STRING[65], "InputNumeric");
  assert.equal(TYPE_NUM_TO_STRING[67], "Calculate");
  assert.equal(TYPE_NUM_TO_STRING[70], "Select");
  assert.equal(TYPE_NUM_TO_STRING[90], "Check");
  assert.equal(TYPE_NUM_TO_STRING[100], "Image");
  assert.equal(TYPE_NUM_TO_STRING[119], "Handwriting");
});

test("VALID_CLUSTER_TYPE_NAMES contains all TYPE_NUM_TO_STRING values", () => {
  for (const name of Object.values(TYPE_NUM_TO_STRING)) {
    assert.ok(VALID_CLUSTER_TYPE_NAMES.has(name), `Missing: ${name}`);
  }
});

test("VALID_CLUSTER_TYPE_NAMES size matches TYPE_NUM_TO_STRING entries", () => {
  const values = new Set(Object.values(TYPE_NUM_TO_STRING));
  assert.equal(VALID_CLUSTER_TYPE_NAMES.size, values.size);
});

test("TYPE_NUM_TO_STRING does not contain unknown codes", () => {
  assert.equal(TYPE_NUM_TO_STRING[0], undefined);
  assert.equal(TYPE_NUM_TO_STRING[999], undefined);
});
