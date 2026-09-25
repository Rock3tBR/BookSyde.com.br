import { createRoot } from "react-dom/client";
import { useState } from "react";
import { BooksydeMascot } from "../src/components/BooksydeMascot";
import { CrowDownloadAnimation } from "../src/components/CrowDownloadAnimation";
import "../src/styles.css";

function Preview() {
  const [paused, setPaused] = useState(false);
  const [state, setState] = useState<"downloading" | "complete">("downloading");
  return <main className="mx-auto max-w-3xl p-8" style={{ minHeight: "200vh" }}>
    <h1 className="font-display text-3xl">Uma pausa para ler</h1>
    <p className="mt-2 text-muted-foreground">BookSyde · Corvo leitor</p>
    <div className="mt-8 flex flex-wrap items-center gap-8 rounded-3xl bg-[#f8f0e4] p-8">
      <BooksydeMascot size={260} paused={paused} />
      <div><CrowDownloadAnimation state={state} /><p className="text-sm text-[#514034]">{state === "complete" ? "Pronto para ler!" : "Baixando seu livro"}</p></div>
    </div>
    <div className="mt-5 flex gap-4">
      <button onClick={() => setPaused(value => !value)}>{paused ? "Reproduzir" : "Pausar"}</button>
      <button onClick={() => setState("complete")}>Concluir download</button>
    </div>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Preview />);
