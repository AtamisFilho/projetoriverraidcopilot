/* Entry do bundle autossuficiente (APK Android / hospedagem estática).
 * Monta o GameShell (menu → partida → fim de jogo) sem depender do Next.js. */

import { createRoot } from "react-dom/client";
import { GameShell } from "@/components/game/GameShell";

const el = document.getElementById("root");
if (el) {
  createRoot(el).render(<GameShell />);
}
