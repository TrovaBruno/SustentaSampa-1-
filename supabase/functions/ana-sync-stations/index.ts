// Edge Function: busca o inventário completo de estações da ANA e grava as
// estações fluviométricas ativas na tabela public.river_stations.
// Rode manualmente de vez em quando (ou agende depois): as estações mudam
// muito pouco, não precisa sincronizar toda hora.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANA_BASE = "https://www.ana.gov.br/hidrowebservice/EstacoesTelemetricas";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    // A rota de inventário exige um filtro (Código da Estação, UF ou Bacia).
    // Por padrão sincronizamos só SP; para outros estados, invoque passando
    // { "ufs": ["SP", "RJ", "MG"] } no corpo da requisição.
    let ufs: string[] = ["SP"];
    const body = await req.json().catch(() => null);
    if (body && Array.isArray(body.ufs) && body.ufs.length > 0) {
      ufs = body.ufs;
    } else if (body && typeof body.uf === "string") {
      ufs = [body.uf];
    }

    const token = await getAnaToken();
    const allItems: Array<Record<string, string>> = [];

    for (const uf of ufs) {
      const res = await fetch(
        `${ANA_BASE}/HidroInventarioEstacoes/v1?${encodeURIComponent("Unidade Federativa")}=${encodeURIComponent(uf)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
          },
        },
      );
      if (!res.ok) {
        const bodyText = await res.text();
        throw new Error(
          `Falha ao consultar a ANA para UF=${uf} (HTTP ${res.status}): ${bodyText.slice(0, 300)}`,
        );
      }
      const data = await res.json();
      const items: Array<Record<string, string>> = data?.items ?? [];
      allItems.push(...items);
    }

    // Só estações fluviométricas ativas, com coordenadas válidas e que
    // realmente transmitem dados telemétricos (senão o nível vem sempre nulo).
    const rows = allItems
      .filter(
        (s) =>
          s["Operando"] === "1" &&
          String(s["Tipo_Estacao"] ?? "").toLowerCase().includes("fluvio") &&
          !!s["Data_Periodo_Telemetrica_Inicio"] &&
          s["Latitude"] &&
          s["Longitude"],
      )
      .map((s) => ({
        codigo_estacao: String(s["codigoestacao"]),
        nome: s["Estacao_Nome"] ?? "Sem nome",
        rio_bacia: s["Bacia_Nome"] ?? null,
        municipio: s["Municipio_Nome"] ?? null,
        uf: s["UF_Estacao"] ?? null,
        lat: Number(s["Latitude"]),
        lng: Number(s["Longitude"]),
        updated_at: new Date().toISOString(),
      }));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Remove estações antigas desse(s) UF(s) antes de regravar — evita deixar
    // "lixo" de sincronizações anteriores com filtros mais frouxos.
    await supabase.from("river_stations").delete().in("uf", ufs);

    // Upsert em lotes, pra não mandar um payload gigante de uma vez.
    const chunkSize = 500;
    let upserted = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase
        .from("river_stations")
        .upsert(chunk, { onConflict: "codigo_estacao" });
      if (error) throw error;
      upserted += chunk.length;
    }

    return new Response(JSON.stringify({ total_recebido: allItems.length, gravado: upserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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