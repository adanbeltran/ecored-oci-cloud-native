import assert from "node:assert/strict";
import test from "node:test";

import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
} from "jose";

import {
  AuthenticationError,
  createFirebaseTokenValidator,
  extractBearerToken,
} from "../src/firebaseTokenValidator.js";

const projectId = "ecored-test";
const issuer = `https://securetoken.google.com/${projectId}`;

async function createFixture() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  Object.assign(publicJwk, { alg: "RS256", kid: "test-key", use: "sig" });

  const validate = createFirebaseTokenValidator({
    projectId,
    keyResolver: createLocalJWKSet({ keys: [publicJwk] }),
  });

  async function sign({ audience = projectId, expiresIn = "5m" } = {}) {
    return new SignJWT({ email: "estudiante@ejemplo.com" })
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject("firebase-uid-123")
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(privateKey);
  }

  return { sign, validate };
}

test("extrae un token Bearer", () => {
  assert.equal(extractBearerToken("Bearer abc.def.ghi"), "abc.def.ghi");
});

test("rechaza una solicitud sin token Bearer", async () => {
  const { validate } = await createFixture();
  await assert.rejects(() => validate(undefined), AuthenticationError);
});

test("valida firma, issuer, audience y devuelve la identidad", async () => {
  const { sign, validate } = await createFixture();
  const identity = await validate(`Bearer ${await sign()}`);

  assert.deepEqual(identity, {
    uid: "firebase-uid-123",
    email: "estudiante@ejemplo.com",
  });
});

test("rechaza un token emitido para otro proyecto", async () => {
  const { sign, validate } = await createFixture();
  const token = await sign({ audience: "otro-proyecto" });
  await assert.rejects(
    () => validate(`Bearer ${token}`),
    AuthenticationError,
  );
});
