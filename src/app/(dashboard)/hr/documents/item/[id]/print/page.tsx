import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";

export default async function DocumentPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("document_instances")
    .select("title, rendered_body")
    .eq("id", id)
    .maybeSingle();

  if (!doc) {
    notFound();
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px", fontFamily: "serif" }}>
      <PrintButton />
      <h1 style={{ textAlign: "center", fontSize: 20, fontWeight: 700, marginBottom: 32, letterSpacing: 4 }}>
        {doc.title}
      </h1>
      <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.9 }}>{doc.rendered_body}</div>
    </div>
  );
}
