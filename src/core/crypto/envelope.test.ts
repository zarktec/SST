import { beforeAll, describe, expect, it } from "vitest";
import { blindIndex, decrypt, encrypt, maskSecret, rewrap } from "./envelope";

beforeAll(() => {
  process.env.ENCRYPTION_MASTER_KEY = Buffer.alloc(32, 1).toString("base64");
  process.env.ENCRYPTION_MASTER_KEY_V2 = Buffer.alloc(32, 2).toString("base64");
  process.env.BLIND_INDEX_KEY = Buffer.alloc(32, 3).toString("base64");
});

describe("envelope encryption", () => {
  it("cifra y descifra", () => {
    const enc = encrypt("prv_prod_secreto", "integration:wompi:prod:private_key");
    expect(enc).not.toContain("secreto");
    expect(decrypt(enc, "integration:wompi:prod:private_key")).toBe("prv_prod_secreto");
  });

  it("produce ciphertext distinto cada vez", () => {
    expect(encrypt("x", "a")).not.toBe(encrypt("x", "a"));
  });

  it("falla con otro contexto (AAD)", () => {
    const enc = encrypt("x", "campo:a");
    expect(() => decrypt(enc, "campo:b")).toThrow();
  });

  it("falla si se altera el ciphertext", () => {
    const parts = encrypt("hola", "a").split(".");
    parts[4] = Buffer.from("zzzz").toString("base64url");
    expect(() => decrypt(parts.join("."), "a")).toThrow();
  });

  it("rota la llave maestra sin re-cifrar los datos", () => {
    const enc = encrypt("valor", "a");
    process.env.ENCRYPTION_KEY_VERSION = "2";
    try {
      const rotated = rewrap(enc, "a");
      expect(rotated.split(".")[1]).toBe("2");
      expect(rotated.split(".")[4]).toBe(enc.split(".")[4]);
      expect(decrypt(rotated, "a")).toBe("valor");
    } finally {
      delete process.env.ENCRYPTION_KEY_VERSION;
    }
  });
});

describe("blind index", () => {
  it("es determinista y normaliza", () => {
    expect(blindIndex(" 1234 ", "t1:doc")).toBe(blindIndex("1234", "t1:doc"));
  });
  it("cambia con el contexto", () => {
    expect(blindIndex("1234", "t1:doc")).not.toBe(blindIndex("1234", "t2:doc"));
  });
});

describe("maskSecret", () => {
  it("conserva prefijo y últimos 4", () => {
    expect(maskSecret("prv_prod_abcdefgh3f9a")).toBe("prv_prod_••••••3f9a");
  });
  it("oculta secretos cortos", () => {
    expect(maskSecret("abc")).toBe("••••••••");
  });
});
