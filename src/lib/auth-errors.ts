/**
 * Traduz as mensagens de erro do serviço de autenticação (Supabase Auth, em inglês)
 * para português, atendendo ao RNF11 (interface em português).
 */
const TRANSLATIONS: Array<[needle: string, message: string]> = [
  ["invalid login credentials", "E-mail ou senha incorretos."],
  ["email not confirmed", "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada."],
  ["user already registered", "Este e-mail já está cadastrado. Tente entrar."],
  ["already been registered", "Este e-mail já está cadastrado. Tente entrar."],
  ["password should be at least", "A senha precisa ter pelo menos 6 caracteres."],
  ["unable to validate email", "E-mail inválido. Confira o endereço digitado."],
  ["invalid format", "E-mail inválido. Confira o endereço digitado."],
  ["rate limit", "Muitas tentativas. Aguarde um pouco e tente novamente."],
  ["for security purposes", "Muitas tentativas. Aguarde um pouco e tente novamente."],
  ["failed to fetch", "Sem conexão com o servidor. Verifique sua internet e tente novamente."],
  ["networkerror", "Sem conexão com o servidor. Verifique sua internet e tente novamente."],
  [
    "network request failed",
    "Sem conexão com o servidor. Verifique sua internet e tente novamente.",
  ],
];

export function translateAuthError(err: unknown, fallback = "Falha na autenticação."): string {
  const raw =
    err && typeof err === "object" && "message" in err
      ? String((err as { message: unknown }).message)
      : typeof err === "string"
        ? err
        : "";
  const text = raw.toLowerCase();
  for (const [needle, message] of TRANSLATIONS) {
    if (text.includes(needle)) return message;
  }
  return fallback;
}
