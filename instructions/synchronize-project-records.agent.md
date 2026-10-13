- **Input:** Provide the verified milestone, decision, or scope change; its evidence and effective date; and the current `backlog.md`, `TODO.md`, and `project_spec.md`. For a material scope or decision change, also provide `change_request_registry.md` and whether the request is proposed, accepted, deferred, rejected, or implemented.
- For evidence handling, follow [`./validate-evidence.agent.md`](./validate-evidence.agent.md).
- **Process:**
  + Verify the claimed change against repository evidence, test results, or an explicit decision.
  + Compare the affected statements and decision IDs across the backlog, TODO, and project specification before editing.
  + Update only the affected sections in all three documents, preserving their existing status conventions and distinguishing verified facts from open questions.
  + For a material change request, add the next `CR-NNN` row with its date, impact, status, and links to the synchronized records. Do not create a registry entry for routine progress with no scope or decision change.
  + Re-read the changed sections and check that their scope, decision IDs, statuses, and links agree.
- **Output:** Update the applicable Markdown records and return a concise change summary listing each changed file, the synchronized decision or milestone, the evidence used, and any remaining discrepancies.
- **Constraints:** Do not modify unrelated sections, invent dates, mark planned work complete, or silently resolve an undecided requirement. Keep `backlog.md`, `TODO.md`, and `project_spec.md` consistent; preserve the change registry's status definitions and chronological IDs.
