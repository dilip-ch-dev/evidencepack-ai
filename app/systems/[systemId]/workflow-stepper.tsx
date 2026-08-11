type Props = {
  answered: number;
  required: number;
  evidenceCount: number;
  hasAssessment: boolean;
};

export function WorkflowStepper({ answered, required, evidenceCount, hasAssessment }: Props) {
  const answeredComplete = required > 0 && answered === required;
  const steps = [
    { label: "Import", complete: true, href: "#overview" },
    { label: "Answer", complete: answeredComplete, href: "#questionnaire" },
    { label: "Evidence", complete: evidenceCount > 0, href: "#evidence" },
    { label: "Assess", complete: hasAssessment, href: "#assessment" },
    { label: "Export", complete: hasAssessment, href: "#overview" }
  ];
  const current = steps.findIndex((step) => !step.complete);

  return (
    <nav aria-label="TrueCite workflow" className="panel-surface overflow-x-auto p-4">
      <ol className="grid min-w-[560px] grid-cols-5 gap-2">
        {steps.map((step, index) => {
          const active = index === current || (current === -1 && index === steps.length - 1);
          return (
            <li key={step.label}>
              <a href={step.href} aria-current={active ? "step" : undefined} className={`block rounded-xl border px-3 py-3 transition ${active ? "border-signal-300 bg-signal-50" : "border-slate-200 bg-white"}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${step.complete ? "bg-emerald-100 text-emerald-800" : active ? "bg-signal-700 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {step.complete ? "✓" : index + 1}
                </span>
                <span className="mt-2 block text-xs font-semibold text-ink-900">{step.label}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
