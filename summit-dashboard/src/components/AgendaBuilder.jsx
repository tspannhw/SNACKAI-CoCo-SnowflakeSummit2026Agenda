/**
 * AgendaBuilder — Sidebar panel showing the user's selected sessions grouped by day.
 * Features: time-conflict detection (same day + same time slot), CSV export of the
 * personal agenda, and per-session remove buttons. Tim Spann sessions are auto-added
 * on first load (handled in App.jsx).
 */
import { useState } from 'react';
import { CalendarDays, Download, Trash2, Clock, AlertTriangle, ExternalLink, ChevronDown, FileText, FileDown } from 'lucide-react';

export default function AgendaBuilder({ sessions, agendaIds, onRemove, onExportCSV, onExportMarkdown, onExportPDF }) {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const agendaSessions = sessions.filter(s => agendaIds.includes(s.session_id));

  // Group by day
  const byDay = {};
  agendaSessions.forEach(s => {
    const day = s.day || 'Unscheduled';
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(s);
  });
  // Sort sessions within each day by time
  Object.values(byDay).forEach(arr => arr.sort((a, b) => (a.time || '').localeCompare(b.time || '')));

  // Detect time conflicts (same day + overlapping time)
  const conflicts = detectConflicts(agendaSessions);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-blue-600" />
          <h2 className="text-lg font-bold text-gray-900">My Agenda</h2>
          <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 font-medium">
            {agendaSessions.length} sessions
          </span>
        </div>
        {agendaSessions.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <Download size={14} /> Export <ChevronDown size={12} />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-1 w-44 bg-white rounded-lg border border-gray-200 shadow-lg z-10">
                <button
                  onClick={() => { onExportCSV(); setShowExportMenu(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg"
                >
                  <FileDown size={14} /> CSV
                </button>
                <button
                  onClick={() => { onExportMarkdown(); setShowExportMenu(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <FileText size={14} /> Markdown
                </button>
                <button
                  onClick={() => { onExportPDF(); setShowExportMenu(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-b-lg"
                >
                  <FileDown size={14} /> PDF
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {conflicts.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <span className="font-medium">Time conflicts detected: </span>
            {conflicts.map((c, i) => (
              <span key={i}>
                {c[0]} vs {c[1]}{i < conflicts.length - 1 ? '; ' : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {agendaSessions.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <CalendarDays size={40} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">Click the + button on sessions to build your agenda</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([day, daySessions]) => (
            <div key={day}>
              <h3 className="text-sm font-semibold text-gray-500 mb-2">{day}</h3>
              <div className="space-y-2">
                {daySessions.map(s => (
                  <div key={s.session_id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{s.title}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        <span>{s.speakers}</span>
                        {s.time && (
                          <span className="flex items-center gap-1">
                            <Clock size={10} /> {s.time}
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{s.format}</span>
                      </div>
                      {s.catalog_url && (
                        <a
                          href={s.catalog_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-1 text-[10px] font-medium text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          <ExternalLink size={9} />
                          Catalog
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => onRemove(s.session_id)}
                      className="shrink-0 p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function detectConflicts(sessions) {
  const conflicts = [];
  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const a = sessions[i];
      const b = sessions[j];
      if (a.day && b.day && a.day === b.day && a.time && b.time && a.time === b.time) {
        conflicts.push([a.title, b.title]);
      }
    }
  }
  return conflicts;
}
