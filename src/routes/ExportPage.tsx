import { ExportSection } from "../components/ExportSection";
import { useSession } from "../state/SessionProvider";

export function ExportPage() {
  const { vm, withAgentExportReady } = useSession();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-page-title font-bold">Export</h1>
        <p className="text-caption text-text-muted">
          design.md for your AI coding tool (needs system notes), or cleaned JSON as your save file
          — always available for Figma.
        </p>
      </header>

      <ExportSection
        projectName={vm.projectName}
        designMd={vm.designMd}
        exportInput={vm.exportInput}
        gapCount={vm.gapCount}
        withAgentExportReady={withAgentExportReady}
      />
    </div>
  );
}
