"use client";

import { useFormState } from "react-dom";
import { createEvidenceAction } from "../actions";
import { initialActionState, type ActionState } from "../action-state";

type SectionOption = {
  id: string;
  title: string;
};

type Props = {
  systemId: string;
  defaultOwner: string;
  sections: SectionOption[];
};

export function EvidenceForm({ systemId, defaultOwner, sections }: Props) {
  const [state, formAction] = useFormState<ActionState, FormData>(
    createEvidenceAction,
    initialActionState
  );

  return (
    <form action={formAction} className="stack-form">
      <input type="hidden" name="systemId" value={systemId} />
      <label>
        Title
        <input name="title" required />
      </label>
      <label>
        Description
        <textarea name="description" rows={2} required />
      </label>
      <label>
        Section
        <select name="sectionId" defaultValue="">
          <option value="">Unassigned</option>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Evidence Type
        <select name="type" defaultValue="URL">
          <option value="URL">URL</option>
          <option value="FILE">File</option>
        </select>
      </label>
      <label>
        URL (if type is URL)
        <input name="sourceUrl" type="url" placeholder="https://..." />
      </label>
      <label>
        File (if type is FILE)
        <input name="file" type="file" />
      </label>
      <label>
        Owner
        <input name="owner" defaultValue={defaultOwner} required />
      </label>
      <label>
        Status
        <select name="status" defaultValue="COMPLETE">
          <option value="COMPLETE">COMPLETE</option>
          <option value="INCOMPLETE">INCOMPLETE</option>
        </select>
      </label>
      <label>
        Last Reviewed Date
        <input name="lastReviewedDate" type="date" />
      </label>
      {state.status === "error" && <p className="chip incomplete inline-chip">{state.message}</p>}
      {state.status === "success" && <p className="chip complete inline-chip">{state.message}</p>}
      <button type="submit" className="button">
        Attach Evidence
      </button>
    </form>
  );
}
