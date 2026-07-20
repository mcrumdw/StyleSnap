import { generateCleanedJson, type ExportInput } from "../engine/export";

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function projectSlug(projectName: string): string {
  return projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Safe download basename from the project name (fallback: stylesnap). */
export function exportBasename(projectName: string): string {
  return projectSlug(projectName) || "stylesnap";
}

export function downloadDesignMd(projectName: string, designMd: string) {
  downloadFile(`${exportBasename(projectName)}.md`, designMd, "text/markdown");
}

export function downloadCleanedJson(projectName: string, exportInput: ExportInput) {
  downloadFile(
    `${exportBasename(projectName)}.json`,
    JSON.stringify(generateCleanedJson(exportInput), null, 2),
    "application/json",
  );
}
