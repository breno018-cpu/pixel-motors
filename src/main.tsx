import { createRoot } from "react-dom/client";
import "@fontsource/figtree/400.css";
import "@fontsource/figtree/500.css";
import "@fontsource/figtree/600.css";
import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";
import App from "./App.tsx";
import "./index.css";

// Auto-recuperação de chunks desatualizados após novo deploy
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Nova versão do sistema disponível. Atualizando aplicação...', event);
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);
