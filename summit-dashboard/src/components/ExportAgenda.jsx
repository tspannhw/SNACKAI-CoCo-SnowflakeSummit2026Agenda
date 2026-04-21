/**
 * ExportAgenda — Markdown and PDF export functions for the user's agenda.
 * Markdown: downloads a .md file. PDF: opens browser print dialog via hidden iframe.
 *
 * Pure generators (generateMarkdown, generatePDFHTML, esc) are exported for testing.
 */

export function groupByDay(sessions) {
  const byDay = {};
  sessions.forEach(s => {
    const day = s.day || 'Unscheduled';
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(s);
  });
  Object.values(byDay).forEach(arr =>
    arr.sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  );
  return Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b));
}

function sessionToMarkdown(s) {
  const lines = [];
  const speakerInfo = s.speakers
    ? s.speaker_company
      ? `${s.speakers} (${s.speaker_company})`
      : s.speakers
    : '';

  lines.push(`### ${s.session_id} — ${s.title}`);
  lines.push('');
  if (speakerInfo) lines.push(`**Speaker:** ${speakerInfo}`);

  const meta = [];
  if (s.time) meta.push(s.time);
  if (s.duration_min) meta.push(`${s.duration_min} min`);
  if (s.format) meta.push(s.format);
  if (s.track) meta.push(s.track);
  if (s.level) meta.push(s.level);
  if (meta.length) lines.push(`**Details:** ${meta.join(' | ')}`);

  if (s.catalog_url) lines.push(`**Catalog:** ${s.catalog_url}`);
  if (s.description) {
    lines.push('');
    lines.push(s.description);
  }
  lines.push('');
  return lines.join('\n');
}

export function generateMarkdown(agendaSessions) {
  const days = groupByDay(agendaSessions);
  const parts = [
    '# My Snowflake Summit 2026 Agenda',
    '',
    `> ${agendaSessions.length} sessions | June 1–4, Moscone Center, San Francisco`,
    '',
  ];

  for (const [day, sessions] of days) {
    parts.push(`## ${day}`);
    parts.push('');
    for (const s of sessions) {
      parts.push(sessionToMarkdown(s));
    }
  }

  parts.push('---');
  parts.push(`*Exported ${new Date().toLocaleDateString()}*`);

  return parts.join('\n');
}

export function exportMarkdown(agendaSessions) {
  const md = generateMarkdown(agendaSessions);
  downloadFile(md, 'my_summit_agenda.md', 'text/markdown;charset=utf-8;');
}

export function generatePDFHTML(agendaSessions) {
  const days = groupByDay(agendaSessions);

  let sessionsHtml = '';
  for (const [day, sessions] of days) {
    sessionsHtml += `<h2 style="color:#1e40af;border-bottom:2px solid #3b82f6;padding-bottom:4px;margin-top:24px;">${day}</h2>`;
    for (const s of sessions) {
      const speakerInfo = s.speakers
        ? s.speaker_company
          ? `${esc(s.speakers)} (${esc(s.speaker_company)})`
          : esc(s.speakers)
        : '';

      const meta = [];
      if (s.time) meta.push(s.time);
      if (s.duration_min) meta.push(`${s.duration_min} min`);
      if (s.format) meta.push(s.format);
      if (s.track) meta.push(s.track);
      if (s.level) meta.push(s.level);

      sessionsHtml += `
        <div style="margin-bottom:16px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;page-break-inside:avoid;">
          <div style="font-size:14px;font-weight:600;color:#111827;">${esc(s.session_id)} — ${esc(s.title)}</div>
          ${speakerInfo ? `<div style="font-size:12px;color:#374151;margin-top:2px;">${speakerInfo}</div>` : ''}
          <div style="font-size:11px;color:#6b7280;margin-top:4px;">${meta.map(m => esc(m)).join(' &middot; ')}</div>
          ${s.catalog_url ? `<div style="font-size:11px;margin-top:4px;"><a href="${esc(s.catalog_url)}" style="color:#2563eb;">${esc(s.catalog_url)}</a></div>` : ''}
          ${s.description ? `<div style="font-size:12px;color:#4b5563;margin-top:6px;line-height:1.4;">${esc(s.description)}</div>` : ''}
        </div>`;
    }
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>My Summit 2026 Agenda</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; color: #111827; }
  h1 { font-size: 22px; color: #1e3a5f; margin-bottom: 4px; }
  .subtitle { font-size: 13px; color: #6b7280; margin-bottom: 20px; }
  @media print { body { padding: 0; } }
</style>
</head><body>
<h1>My Snowflake Summit 2026 Agenda</h1>
<div class="subtitle">${agendaSessions.length} sessions &middot; June 1–4, Moscone Center, San Francisco &middot; Exported ${new Date().toLocaleDateString()}</div>
${sessionsHtml}
</body></html>`;
}

export function exportPDF(agendaSessions) {
  const html = generatePDFHTML(agendaSessions);

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);

  iframe.contentDocument.open();
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();

  iframe.contentWindow.onafterprint = () => {
    document.body.removeChild(iframe);
  };

  setTimeout(() => {
    iframe.contentWindow.print();
  }, 250);
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
