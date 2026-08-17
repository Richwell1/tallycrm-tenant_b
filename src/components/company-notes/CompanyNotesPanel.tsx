import { useState } from "react";
import { MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCompanyNotes, useCreateCompanyNote } from "@/lib/company-notes-data";

interface CompanyNotesPanelProps {
  companyId: string;
  companyName: string;
}

export function CompanyNotesPanel({ companyId, companyName }: CompanyNotesPanelProps) {
  const [body, setBody] = useState("");
  const notes = useCompanyNotes(companyId);
  const createNote = useCreateCompanyNote(companyId);

  function saveNote() {
    const nextBody = body.trim();
    if (!nextBody) return;
    createNote.mutate(nextBody, {
      onSuccess: () => {
        setBody("");
        toast.success("Note added");
      },
      onError: (error) =>
        toast.error("Could not add note", { description: (error as Error).message }),
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-xs)]">
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={`Write a note about ${companyName}...`}
          className="min-h-24 resize-y"
          maxLength={5000}
        />
        <div className="mt-3 flex justify-end">
          <Button type="button" onClick={saveNote} disabled={!body.trim() || createNote.isPending}>
            {createNote.isPending ? "Saving…" : "Add note"}
          </Button>
        </div>
      </section>

      {notes.isLoading ? (
        <div className="space-y-3" aria-label="Loading company notes">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : notes.isError ? (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-5 text-sm text-danger">
          <p className="font-semibold">Could not load notes</p>
          <p className="mt-1">{(notes.error as Error).message}</p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => notes.refetch()}>
            Try again
          </Button>
        </div>
      ) : notes.data?.length ? (
        <div className="space-y-3">
          {notes.data.map((note) => (
            <article
              key={note.id}
              className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-xs)]"
            >
              <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{note.body}</p>
              <time
                dateTime={note.created_at}
                className="mt-3 block text-xs font-medium text-text-muted"
              >
                {new Date(note.created_at).toLocaleString()}
              </time>
            </article>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
          <MessageSquareText className="h-7 w-7 text-text-muted" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-foreground">No notes yet</p>
          <p className="mt-1 text-sm text-text-secondary">
            Add the first note for this company above.
          </p>
        </div>
      )}
    </div>
  );
}
