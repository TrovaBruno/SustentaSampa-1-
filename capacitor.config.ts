import type { CapacitorConfig } from "@capacitor/cli";

// Gerado ao rodar `bunx cap init` — mantenha o appId igual ao que você
// registrar na Play Console (não dá pra trocar depois de publicar).
const config: CapacitorConfig = {
  appId: "com.sustentasampa.app",
  appName: "SustentaSampa",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
};

export default config;
