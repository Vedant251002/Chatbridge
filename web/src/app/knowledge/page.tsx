import { KnowledgeManager } from "@/components/knowledge/knowledge-manager";

export const dynamic = "force-dynamic";

export default function KnowledgePage() {
  return (
    <div className="kb-page">
      <h1>Knowledge base</h1>
      <p className="sub">
        Upload text or link URLs. Documents are chunked, embedded, and used to ground
        the bot&apos;s replies via semantic search.
      </p>
      <KnowledgeManager />
    </div>
  );
}
