import { ExportSection } from "../components/ExportSection";
import { useSession } from "../state/SessionProvider";

export function ExportPage() {
  const { vm, withCompleteSystem } = useSession();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-page-title font-bold">Export</h1>
        <p className="text-caption text-text-muted">
          design.md for your AI coding tool, or cleaned JSON as your save file. Copy and download
          pass through the completeness gate — nothing ships with missing elements.
        </p>
      </header>

      <ExportSection
        projectName={vm.projectName}
        designMd={vm.designMd}
        exportInput={vm.exportInput}
        gapCount={vm.gapCount}
        withCompleteSystem={withCompleteSystem}
      />
    </div>
  );
}
