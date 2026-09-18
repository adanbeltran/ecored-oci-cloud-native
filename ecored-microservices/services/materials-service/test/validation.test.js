import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError, validateMaterial } from "../src/validation.js";

test("normaliza un material válido", () => {
  const result = validateMaterial({ company_id: "abc", material_type: "Cartón", quantity: "12", unit: "kg", location: "Bogotá" });
  assert.equal(result.quantity, 12);
  assert.equal(result.status, "available");
});

test("rechaza cantidades no positivas", () => {
  assert.throws(() => validateMaterial({ company_id: "abc", material_type: "Cartón", quantity: 0, unit: "kg", location: "Bogotá" }), ValidationError);
});
