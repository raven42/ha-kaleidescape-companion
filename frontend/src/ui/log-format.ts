/** Readable views of sanitized records; no rendering of HTML or arbitrary paths. */
export type LogRow = Record<string, unknown>;
const names: Record<string, string> = {
  resource: "Resource",
  target: "Backend",
  actor: "User",
  related: "Linked record",
  trace: "Originating request",
  trigger: "Triggered by",
  revision: "Record revision",
  command: "Protocol command",
  failure: "Cause",
  reason: "Explanation code",
  stage: "Stage",
  check: "Validation check",
  count: "Count",
  status: "Response code",
  attempt: "Verification attempt",
  elapsed_ms: "Elapsed milliseconds",
  title_match: "Title",
  interval_match: "Time interval",
  description_match: "Description",
  values: "Opt-in movie metadata",
};
const failures: Record<string, string> = {
  provider:
    "The provider raised an error; its original text was withheld for privacy.",
  missing_field:
    "A required field is missing. Check the API adapter's input mapping.",
  invalid_type: "An argument or returned value has an unexpected type.",
  timeout: "The operation exceeded its time limit.",
  connection: "The connection failed or was interrupted.",
  authorization: "Authentication or access was denied.",
  unsupported: "The destination does not support this operation.",
  validation: "The input or returned data failed validation.",
};
export function logMessage(row: LogRow): string {
  if (typeof row.message === "string" && row.message) return row.message;
  const base = `${String(row.logger ?? "Operation")}: ${String(row.operation ?? "operation")} ${String(row.outcome ?? "recorded")}.`;
  return `${base}${typeof row.failure === "string" && failures[row.failure] ? " " + failures[row.failure] : ""}`;
}
export function logSource(row: LogRow, full = false): string {
  const file = row.file;
  const line = row.line;
  if (typeof line !== "number" || !Number.isInteger(line) || line < 0)
    return "Not recorded";
  if (file === "external") return `External caller:${line}`;
  if (
    typeof file !== "string" ||
    !/^[A-Za-z_][\w]*(?:\/[A-Za-z_][\w]*)*\.py$/.test(file)
  )
    return "Not recorded";
  return `${full ? file : file.split("/").at(-1)}:${line}`;
}
export function logDetails(row: LogRow): [string, string][] {
  return Object.entries(names).flatMap(([key, label]): [string, string][] => {
    const value = row[key];
    if (value === undefined || value === null) return [];
    return [
      [
        label,
        typeof value === "boolean"
          ? value
            ? "Matches"
            : "Differs"
          : typeof value === "object"
            ? JSON.stringify(value, null, 2)
            : String(value).replaceAll("_", " "),
      ],
    ];
  });
}
export function logText(row: LogRow): string {
  const details = logDetails(row)
    .map(([label, value]) => `  ${label}: ${value}`)
    .join("\n");
  return `${String(row.timestamp ?? "")} ${String(row.level ?? "")} [${logSource(row, true)}] ${logMessage(row)}${details ? "\n" + details : ""}`;
}
