// Edge Function: retorna o nível (cota, em metros) e a vazão mais recentes
// de uma estação telemétrica da ANA, dado o código da estação.
// As credenciais (ANA_IDENTIFICADOR / ANA_SENHA) ficam só aqui, como secrets
// — nunca chegam ao navegador do usuário.

const ANA_BASE = "https://www.ana.gov.br/hidrowebservice/EstacoesTelemetricas";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cache do token em memória: dura enquanto a function ficar "quente".
// Token da ANA vale 60 min; renovamos com folga aos 55 min.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAnaToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }
  const identificador = Deno.env.get("ANA_IDENTIFICADOR");
  const senha = Deno.env.get("ANA_SENHA");
  if (!identificador || !senha) {
    throw new Error("Credenciais da ANA não configuradas (rode supabase secrets set).");
  }
  const res = await fetch(`${ANA_BASE}/OAUth/v1`, {
    method: "GET",
    headers: {
      Identificador: identificador,
      Senha: senha,
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) {
    throw new Error(`Falha ao autenticar na ANA (HTTP ${res.status}).`);
  }
  const data = await res.json();
  const token = data?.items?.tokenautenticacao;
  if (!token) {
    throw new Error("Resposta de autenticação da ANA sem token.");
  }
  cachedToken = { value: token, expiresAt: Date.now() + 55 * 60 * 1000 };
  return token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { codigo } = await req.json();
    if (!codigo || typeof codigo !== "string") {
      return new Response(JSON.stringify({ error: "Parâmetro 'codigo' é obrigatório." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await getAnaToken();
    const url =
      `${ANA_BASE}/HidroinfoanaSerieTelemetricaAdotada/v1` +
      `?${encodeURIComponent("Código da Estação")}=${encodeURIComponent(codigo)}` +
      `&${encodeURIComponent("Tipo Filtro Data")}=DATA_LEITURA` +
      `&${encodeURIComponent("Range Intervalo de busca")}=DIAS_30`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) {
      const bodyText = await res.text();
      throw new Error(`Falha ao consultar a ANA (HTTP ${res.status}): ${bodyText.slice(0, 300)}`);
    }
    const data = await res.json();
    const items: Array<Record<string, string>> = data?.items ?? [];

    // A API devolve várias leituras (até 30 dias); pegamos a mais recente.
    const latest = items
      .slice()
      .sort((a, b) => (a.Data_Hora_Medicao! > b.Data_Hora_Medicao! ? -1 : 1))[0];

    if (!latest) {
      return new Response(
        JSON.stringify({ codigo, nivel_m: null, vazao_m3s: null, medido_em: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cotaCm = Number(latest["Cota_Adotada"]);
    const vazao = Number(latest["Vazao_Adotada"]);

    return new Response(
      JSON.stringify({
        codigo,
        nivel_m: Number.isFinite(cotaCm) ? Number((cotaCm / 100).toFixed(2)) : null,
        vazao_m3s: Number.isFinite(vazao) ? vazao : null,
        medido_em: latest["Data_Hora_Medicao"] ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : JSON.stringify(err, Object.getOwnPropertyNames(err ?? {}));
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
