import type { MODULE_META, SEVERITY_META, VERIFICATION_META } from '@/data/mock-incidents';

interface ExportIncident {
  title: string;
  occurred_at: string | null;
  category?: { module?: string };
  severity: string;
  location?: { town?: string; province?: string };
  verification_state?: string;
  fatality_count_confirmed?: number | null;
  injury_count_confirmed?: number | null;
  police_case_number?: string | null;
}

interface ExportMeta {
  moduleMeta: typeof MODULE_META;
  severityMeta: typeof SEVERITY_META;
  verificationMeta: typeof VERIFICATION_META;
}

interface ExportStats {
  total: number;
  critical: number;
  deceased: number;
  injured: number;
  byModule: Record<string, number>;
  bySeverity: Record<string, number>;
}

type ColKey = 'title' | 'date' | 'module' | 'severity' | 'location' | 'province' | 'verification' | 'casualties' | 'caseRef';

function resolveLabel(key: string, meta: Record<string, { label: string }>) {
  return meta[key]?.label ?? key;
}

function cellValue(row: ExportIncident, col: ColKey, m: ExportMeta): string {
  switch (col) {
    case 'title': return row.title;
    case 'date': return row.occurred_at ?? '';
    case 'module': return resolveLabel(row.category?.module ?? '', m.moduleMeta as Record<string, { label: string }>);
    case 'severity': return resolveLabel(row.severity, m.severityMeta as Record<string, { label: string }>);
    case 'location': return row.location?.town ?? '';
    case 'province': return row.location?.province ?? '';
    case 'verification': return resolveLabel(row.verification_state ?? '', m.verificationMeta as Record<string, { label: string }>);
    case 'casualties': return `${row.fatality_count_confirmed ?? 0}D / ${row.injury_count_confirmed ?? 0}I`;
    case 'caseRef': return row.police_case_number ?? '';
  }
}

const COL_LABELS: Record<ColKey, string> = {
  title: 'Title', date: 'Date', module: 'Module', severity: 'Severity',
  location: 'Location', province: 'Province', verification: 'Verification',
  casualties: 'Casualties', caseRef: 'Case Reference',
};

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

function timestamp() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function exportCsv(
  rows: ExportIncident[],
  cols: ColKey[],
  meta: ExportMeta,
  scope: string,
) {
  const header = cols.map(c => escapeCsv(COL_LABELS[c])).join(',');
  const body = rows.map(r => cols.map(c => escapeCsv(cellValue(r, c, meta))).join(',')).join('\n');
  const csv = `${header}\n${body}`;
  triggerDownload(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `AAIT-Report-${timestamp()}.csv`);
}

// ---------------------------------------------------------------------------
// XLS (HTML table → .xls — Excel opens natively)
// ---------------------------------------------------------------------------

export function exportXls(
  rows: ExportIncident[],
  cols: ColKey[],
  meta: ExportMeta,
  stats: ExportStats,
  scope: string,
) {
  const severityColor = (s: string) => {
    const map: Record<string, string> = { critical: '#c53030', high: '#dd6b20', medium: '#d69e2e', low: '#38a169', informational: '#3182ce' };
    return map[s] ?? '#4a5568';
  };

  let html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
  .brand { font-size: 18pt; font-weight: bold; color: #1a365d; }
  .subtitle { font-size: 14pt; color: #2d3748; margin-top: 4px; }
  .meta { font-size: 9pt; color: #718096; }
  .stat-label { font-size: 9pt; color: #718096; }
  .stat-value { font-size: 16pt; font-weight: bold; color: #1a365d; }
  table { border-collapse: collapse; width: 100%; margin-top: 16px; }
  th { background: #1a365d; color: #fff; padding: 8px 12px; text-align: left; font-size: 10pt; border: 1px solid #1a365d; }
  td { padding: 6px 12px; border: 1px solid #e2e8f0; font-size: 10pt; }
  tr:nth-child(even) td { background: #f7fafc; }
  .sev { display: inline-block; padding: 2px 8px; border-radius: 4px; color: #fff; font-size: 9pt; font-weight: bold; }
</style></head><body>

<div class="brand">AAIT Incident Tracker</div>
<div class="subtitle">Incident Report</div>
<div class="meta">Generated: ${new Date().toLocaleString('en-ZA', { dateStyle: 'long', timeStyle: 'short' })} &bull; Scope: ${scope} &bull; Records: ${stats.total}</div>

<br>
<table style="width:auto; border:none;">
<tr>
  <td style="border:none; padding:8px 24px 8px 0;"><span class="stat-value">${stats.total}</span><br><span class="stat-label">Total incidents</span></td>
  <td style="border:none; padding:8px 24px 8px 0;"><span class="stat-value">${stats.critical}</span><br><span class="stat-label">Critical</span></td>
  <td style="border:none; padding:8px 24px 8px 0;"><span class="stat-value">${stats.deceased}</span><br><span class="stat-label">Deceased</span></td>
  <td style="border:none; padding:8px 24px 8px 0;"><span class="stat-value">${stats.injured}</span><br><span class="stat-label">Injured</span></td>
</tr>
</table>
<br>

<table>
<thead><tr>${cols.map(c => `<th>${COL_LABELS[c]}</th>`).join('')}</tr></thead>
<tbody>`;

  for (const r of rows) {
    html += '<tr>';
    for (const c of cols) {
      const val = cellValue(r, c, meta);
      if (c === 'severity') {
        html += `<td><span class="sev" style="background:${severityColor(r.severity)}">${val}</span></td>`;
      } else {
        html += `<td>${val}</td>`;
      }
    }
    html += '</tr>';
  }

  html += `</tbody></table>
<br><div class="meta">AAIT Incident Tracker &middot; Mapped. Sourced. Reviewed. &middot; This report may contain synthetic test data.</div>
</body></html>`;

  triggerDownload(new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' }), `AAIT-Report-${timestamp()}.xls`);
}

// ---------------------------------------------------------------------------
// DOCX (MHTML → .doc — Word opens natively with full formatting)
// ---------------------------------------------------------------------------

export function exportDocx(
  rows: ExportIncident[],
  cols: ColKey[],
  meta: ExportMeta,
  stats: ExportStats,
  scope: string,
) {
  const severityColor = (s: string) => {
    const map: Record<string, string> = { critical: '#c53030', high: '#dd6b20', medium: '#d69e2e', low: '#38a169', informational: '#3182ce' };
    return map[s] ?? '#4a5568';
  };

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  @page { size: A4 landscape; margin: 1.5cm; }
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1a202c; }
  .header { border-bottom: 3px solid #1a365d; padding-bottom: 12px; margin-bottom: 20px; }
  .brand { font-size: 22pt; font-weight: bold; color: #1a365d; }
  .subtitle { font-size: 16pt; color: #2d3748; margin-top: 4px; }
  .meta { font-size: 9pt; color: #718096; margin-top: 8px; }
  .stats { display: flex; gap: 32px; margin: 20px 0; }
  .stat { text-align: center; }
  .stat-value { font-size: 24pt; font-weight: bold; color: #1a365d; display: block; }
  .stat-label { font-size: 9pt; color: #718096; text-transform: uppercase; letter-spacing: 0.5px; }
  .breakdown { margin: 16px 0 24px; }
  .breakdown h3 { font-size: 11pt; color: #1a365d; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  .breakdown-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 10pt; border-bottom: 1px solid #f7fafc; }
  table { border-collapse: collapse; width: 100%; margin-top: 16px; page-break-inside: auto; }
  th { background: #1a365d; color: #fff; padding: 8px 10px; text-align: left; font-size: 10pt; border: 1px solid #1a365d; }
  td { padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 10pt; vertical-align: top; }
  tr:nth-child(even) td { background: #f7fafc; }
  tr { page-break-inside: avoid; }
  .sev { display: inline-block; padding: 2px 8px; border-radius: 4px; color: #fff; font-size: 9pt; font-weight: bold; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 2px solid #1a365d; font-size: 9pt; color: #718096; text-align: center; }
</style></head><body>

<div class="header">
  <div class="brand">AAIT Incident Tracker</div>
  <div class="subtitle">Incident Report</div>
  <div class="meta">
    Generated: ${new Date().toLocaleString('en-ZA', { dateStyle: 'long', timeStyle: 'short' })}<br>
    Scope: ${scope}<br>
    Records: ${stats.total}
  </div>
</div>

<table style="width:auto; border:none; margin-bottom:16px;">
<tr>
  <td style="border:none; padding:8px 32px 8px 0; text-align:center;"><span class="stat-value">${stats.total}</span><span class="stat-label">Total incidents</span></td>
  <td style="border:none; padding:8px 32px 8px 0; text-align:center;"><span class="stat-value" style="color:#c53030">${stats.critical}</span><span class="stat-label">Critical</span></td>
  <td style="border:none; padding:8px 32px 8px 0; text-align:center;"><span class="stat-value">${stats.deceased}</span><span class="stat-label">Deceased</span></td>
  <td style="border:none; padding:8px 32px 8px 0; text-align:center;"><span class="stat-value">${stats.injured}</span><span class="stat-label">Injured</span></td>
</tr>
</table>

<table style="width:auto; border:none; margin-bottom:20px;">
<tr><td style="border:none; vertical-align:top; padding-right:48px;">
<h3 style="font-size:11pt; color:#1a365d; margin:0 0 6px;">By module</h3>
${Object.entries(stats.byModule).map(([m, n]) => `<div style="display:flex;justify-content:space-between;gap:24px;padding:2px 0;font-size:10pt;"><span>${meta.moduleMeta[m as keyof typeof meta.moduleMeta]?.label ?? m}</span><span style="font-weight:bold">${n}</span></div>`).join('')}
</td><td style="border:none; vertical-align:top;">
<h3 style="font-size:11pt; color:#1a365d; margin:0 0 6px;">By severity</h3>
${Object.entries(stats.bySeverity).map(([s, n]) => `<div style="display:flex;justify-content:space-between;gap:24px;padding:2px 0;font-size:10pt;"><span style="text-transform:capitalize">${s}</span><span style="font-weight:bold">${n}</span></div>`).join('')}
</td></tr>
</table>

<h3 style="font-size:12pt; color:#1a365d;">Incident Detail</h3>
<table>
<thead><tr>${cols.map(c => `<th>${COL_LABELS[c]}</th>`).join('')}</tr></thead>
<tbody>`;

  for (const r of rows) {
    html += '<tr>';
    for (const c of cols) {
      const val = cellValue(r, c, meta);
      if (c === 'severity') {
        html += `<td><span class="sev" style="background:${severityColor(r.severity)}">${val}</span></td>`;
      } else if (c === 'casualties') {
        const d = r.fatality_count_confirmed ?? 0;
        const i = r.injury_count_confirmed ?? 0;
        html += `<td style="${d > 0 ? 'color:#c53030;font-weight:bold;' : ''}">${val}</td>`;
      } else {
        html += `<td>${val}</td>`;
      }
    }
    html += '</tr>';
  }

  html += `</tbody></table>

<div class="footer">
  AAIT Incident Tracker &middot; Mapped. Sourced. Reviewed.<br>
  This report may contain synthetic test data unless stated otherwise. Not for distribution.
</div>

</body></html>`;

  triggerDownload(new Blob([html], { type: 'application/msword;charset=utf-8' }), `AAIT-Report-${timestamp()}.doc`);
}
