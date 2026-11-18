import { describe, it, expect } from "vitest";
import { translateAuthError } from "./auth-errors";

describe("translateAuthError", () => {
  it("traduz credenciais inválidas (VAL03)", () => {
    expect(translateAuthError(new Error("Invalid login credentials"))).toBe(
      "E-mail ou senha incorretos.",
    );
  });

  it("traduz e-mail não confirmado e e-mail já cadastrado", () => {
    expect(translateAuthError(new Error("Email not confirmed"))).toContain("Confirme seu e-mail");
    expect(translateAuthError(new Error("User already registered"))).toContain(
      "já está cadastrado",
    );
  });

  it("traduz senha curta e limite de tentativas", () => {
    expect(translateAuthError(new Error("Password should be at least 6 characters."))).toContain(
      "pelo menos 6",
    );
    expect(translateAuthError(new Error("email rate limit exceeded"))).toContain(
      "Muitas tentativas",
    );
  });

  it("traduz falha de rede", () => {
    expect(translateAuthError(new TypeError("Failed to fetch"))).toContain("Sem conexão");
  });

  it("usa a mensagem padrão para erros desconhecidos ou vazios", () => {
    expect(translateAuthError(new Error("something odd"))).toBe("Falha na autenticação.");
    expect(translateAuthError(null, "Não foi possível enviar o link.")).toBe(
      "Não foi possível enviar o link.",
    );
  });
});
