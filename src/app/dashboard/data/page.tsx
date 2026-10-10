"use client";

import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Download, FileUp, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import { useFleet } from "@/components/fleet-provider";
import { Badge, Button, Card, CardHeader } from "@/components/ui";
import {
  CSV_SPECS,
  costsToCsv,
  flightsToCsv,
  maintenanceToCsv,
  parseCosts,
  parseFlights,
  parseMaintenance,
  type ParseResult,
  type UploadKind,
} from "@/lib/csv";

const MAX_FILE_BYTES = 2_000_000;

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DataPage() {
  const { dataset, uploads, resetUploads, applyUpload } = useFleet();
  const p = dataset.profile;
  const hasUploads = !!(uploads.flights || uploads.costs || uploads.maintenance);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Data upload</h2>
          <p className="mt-1 text-sm text-text-2">
            Replace {p.tail}&apos;s sample data with your own flight log, cost ledger and maintenance tracking. Every metric recalculates
            instantly.
          </p>
        </div>
        {hasUploads && (
          <Button variant="secondary" onClick={resetUploads}>
            <RotateCcw size={14} aria-hidden /> Reset {p.tail} to sample data
          </Button>
        )}
      </div>

      <Card className="flex items-start gap-3 p-4 text-sm text-text-2">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <p>
          Files are parsed and validated in your browser and stored in local storage on this device. They are sent to the server only to generate
          AI recommendations and chat answers, and are not retained.
        </p>
      </Card>

      <UploadCard
        kind="flights"
        active={!!uploads.flights}
        template={() => download(`${p.tail}-flight-log.csv`, flightsToCsv(dataset.flights))}
        parse={parseFlights}
        onApply={(rows) => applyUpload({ flights: rows })}
      />
      <UploadCard
        kind="costs"
        active={!!uploads.costs}
        template={() => download(`${p.tail}-costs.csv`, costsToCsv(dataset.costs))}
        parse={parseCosts}
        onApply={(rows) => applyUpload({ costs: rows })}
      />
      <UploadCard
        kind="maintenance"
        active={!!uploads.maintenance}
        template={() => download(`${p.tail}-maintenance.csv`, maintenanceToCsv(dataset.maintenance))}
        parse={parseMaintenance}
        onApply={(rows) => applyUpload({ maintenance: rows })}
        extra={
          <label className="flex items-center gap-2 text-xs text-text-2">
            Current airframe total time
            <input
              type="number"
              min={0}
              defaultValue={dataset.airframeHours}
              key={dataset.airframeHours}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v >= 0 && v !== dataset.airframeHours) applyUpload({ airframeHours: v });
              }}
              className="num w-24 rounded-md border border-border-strong bg-surface-2 px-2 py-1 text-text"
            />
            hrs
          </label>
        }
      />
    </div>
  );
}

function UploadCard<T>({
  kind,
  active,
  template,
  parse,
  onApply,
  extra,
}: {
  kind: UploadKind;
  active: boolean;
  template: () => void;
  parse: (text: string) => ParseResult<T>;
  onApply: (rows: T[]) => void;
  extra?: React.ReactNode;
}) {
  const spec = CSV_SPECS[kind];
  const inputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<(ParseResult<T> & { fileName: string }) | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file: File) => {
    setApplied(false);
    setFileError(null);
    setResult(null);
    if (!/\.(csv|txt)$/i.test(file.name)) return setFileError("Please choose a .csv file.");
    if (file.size > MAX_FILE_BYTES) return setFileError("File is larger than 2 MB.");
    const text = await file.text();
    setResult({ ...parse(text), fileName: file.name });
  };

  const errors = result?.issues.filter((i) => i.level === "error") ?? [];
  const warnings = result?.issues.filter((i) => i.level === "warning") ?? [];
  const canApply = !!result && result.missingColumns.length === 0 && result.rows.length > 0;

  return (
    <Card>
      <CardHeader
        icon={<FileUp size={15} />}
        title={spec.title}
        subtitle={spec.description}
        right={
          <div className="flex items-center gap-2">
            {active && <Badge tone="amber">Using uploaded file</Badge>}
            <Button variant="ghost" className="text-xs" onClick={template}>
              <Download size={13} aria-hidden /> Download sample CSV
            </Button>
          </div>
        }
      />
      <div className="grid gap-4 px-5 pb-5 lg:grid-cols-5">
        <div className="overflow-x-auto lg:col-span-3">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead>
              <tr className="text-[11px] tracking-wide text-muted uppercase">
                <th className="py-1.5 pr-3 font-medium">Column</th>
                <th className="py-1.5 pr-3 font-medium">Format</th>
                <th className="py-1.5 font-medium">Example</th>
              </tr>
            </thead>
            <tbody>
              {spec.columns.map((c) => (
                <tr key={c.name} className="border-t border-border align-top">
                  <td className="num py-1.5 pr-3 whitespace-nowrap text-text">
                    {c.name}
                    {c.required && <span className="ml-1 text-amber">*</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-text-2">{c.description}</td>
                  <td className="num py-1.5 whitespace-nowrap text-muted">{c.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-muted">
            <span className="text-amber">*</span> required. Headers are case-insensitive.
          </p>
        </div>

        <div className="space-y-3 lg:col-span-2">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) void handleFile(f);
            }}
            className={clsx(
              "flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center transition-colors",
              dragging ? "border-accent bg-accent/5" : "border-border-strong",
            )}
          >
            <FileUp size={20} className="mb-2 text-muted" aria-hidden />
            <p className="text-sm text-text-2">Drop a CSV here or</p>
            <Button variant="secondary" className="mt-2 text-xs" onClick={() => inputRef.current?.click()}>
              Choose file
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = "";
              }}
            />
          </div>

          {fileError && (
            <p className="flex items-center gap-1.5 text-xs text-[#ff8080]">
              <XCircle size={13} aria-hidden /> {fileError}
            </p>
          )}

          {result && (
            <div className="space-y-2 rounded-xl border border-border bg-surface-2/50 p-3 text-xs" aria-live="polite">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-text">{result.fileName}</span>
                <span className="num shrink-0 text-muted">
                  {result.rows.length}/{result.totalRows} rows valid
                </span>
              </div>
              {result.missingColumns.length > 0 && (
                <p className="flex items-start gap-1.5 text-[#ff8080]">
                  <XCircle size={13} className="mt-0.5 shrink-0" aria-hidden /> Missing required column
                  {result.missingColumns.length > 1 ? "s" : ""}: {result.missingColumns.join(", ")}
                </p>
              )}
              {errors.length > 0 && (
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-[#ff8080]">
                    <XCircle size={13} aria-hidden /> {errors.length} row{errors.length > 1 ? "s" : ""} skipped
                  </p>
                  <ul className="max-h-28 space-y-0.5 overflow-y-auto pl-5 text-text-2">
                    {errors.slice(0, 8).map((e, i) => (
                      <li key={i}>
                        Row {e.row}: {e.message}
                      </li>
                    ))}
                    {errors.length > 8 && <li className="text-muted">…and {errors.length - 8} more</li>}
                  </ul>
                </div>
              )}
              {warnings.length > 0 && (
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-warning">
                    <AlertTriangle size={13} aria-hidden /> {warnings.length} warning{warnings.length > 1 ? "s" : ""}
                  </p>
                  <ul className="max-h-20 space-y-0.5 overflow-y-auto pl-5 text-text-2">
                    {warnings.slice(0, 4).map((w, i) => (
                      <li key={i}>{w.row ? `Row ${w.row}: ` : ""}{w.message}</li>
                    ))}
                  </ul>
                </div>
              )}
              {canApply && errors.length === 0 && warnings.length === 0 && (
                <p className="flex items-center gap-1.5 text-[#4ad44a]">
                  <CheckCircle2 size={13} aria-hidden /> All rows valid
                </p>
              )}
              <Button
                className="w-full text-xs"
                disabled={!canApply || applied}
                onClick={() => {
                  onApply(result.rows);
                  setApplied(true);
                }}
              >
                {applied ? (
                  <>
                    <CheckCircle2 size={13} aria-hidden /> Applied. Dashboard updated
                  </>
                ) : (
                  `Apply ${result.rows.length} rows`
                )}
              </Button>
            </div>
          )}
          {extra}
        </div>
      </div>
    </Card>
  );
}
