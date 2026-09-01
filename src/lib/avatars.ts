export type AvatarOption = {
  id: string;
  label: string;
  color: string;
  threshold: number;
};

/** Cores desbloqueadas por marco de pontos acumulados (não é gasto — é conquista). */
export const AVATAR_CATALOG: AvatarOption[] = [
  { id: "default", label: "Padrão", color: "#8a8a8a", threshold: 0 },
  { id: "green", label: "Verde Esperança", color: "#4CAF50", threshold: 50 },
  { id: "blue", label: "Azul Alerta", color: "#2196F3", threshold: 150 },
  { id: "purple", label: "Roxo Vigilante", color: "#9C27B0", threshold: 300 },
  { id: "gold", label: "Dourado Guardião", color: "#D4AF37", threshold: 500 },
  { id: "red", label: "Vermelho Sentinela", color: "#F44336", threshold: 1000 },
];

export function isAvatarUnlocked(option: AvatarOption, points: number): boolean {
  return points >= option.threshold;
}

export function avatarColorFor(id: string): string {
  return AVATAR_CATALOG.find((a) => a.id === id)?.color ?? AVATAR_CATALOG[0]!.color;
}
