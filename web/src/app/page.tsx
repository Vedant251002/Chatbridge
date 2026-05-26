import { PromptEditor } from "@/components/prompt-editor";
import { WhatsAppQr } from "@/components/whatsapp-qr";
import { AllowedNumbersManager } from "@/components/allowed-numbers-manager";

export default function Home() {
  return (
    <div className="wrap">
      <section className="hero">
        <span className="pill">Admin Console</span>
        <h1>WhatsApp AI</h1>
        <p className="sub">
          Configure the AI prompt, link your WhatsApp, and ground replies with
          your own knowledge base.
        </p>
      </section>

      <div className="grid">
        <PromptEditor />
        <WhatsAppQr />
        <AllowedNumbersManager />
      </div>
    </div>
  );
}
