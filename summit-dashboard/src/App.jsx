/**
 * App — Main entry point for the Snowflake Summit 2026 Agenda Builder.
 *
 * Loads session data from /summit_sessions.csv via PapaParse, then renders:
 *  - PersonaSelector + interest tag picker for recommendation tuning
 *  - TrackFilter for narrowing by track, format, day, level
 *  - Ranked session list (Tim Spann always first)
 *  - AgendaBuilder sidebar with conflict detection and CSV export
 *
 * Tim Spann's sessions are auto-added to the agenda on first load.
 */
import { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { Search, Snowflake, Menu, X } from 'lucide-react';
import SessionCard from './components/SessionCard';
import PersonaSelector from './components/PersonaSelector';
import TrackFilter from './components/TrackFilter';
import AgendaBuilder from './components/AgendaBuilder';
import { exportMarkdown, exportPDF } from './components/ExportAgenda';
import { rankSessions, getAvailableInterests, PERSONAS } from './components/RecommendationEngine';

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [persona, setPersona] = useState('Data Engineer');
  const [interests, setInterests] = useState([]);
  const [filters, setFilters] = useState({ track: 'all', format: 'all', day: 'all', level: 'all' });
  const [searchQuery, setSearchQuery] = useState('');
  const [agendaIds, setAgendaIds] = useState([]);
  const [showAgenda, setShowAgenda] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load CSV data
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}summit_sessions.csv`)
      .then(r => r.text())
      .then(text => {
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        setSessions(result.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Auto-add Tim Spann sessions to agenda
  useEffect(() => {
    if (sessions.length > 0 && agendaIds.length === 0) {
      const tspannIds = sessions
        .filter(s => s.speakers && s.speakers.toLowerCase().includes('tim spann'))
        .map(s => s.session_id);
      if (tspannIds.length > 0) setAgendaIds(tspannIds);
    }
  }, [sessions]);

  const availableInterests = useMemo(() => getAvailableInterests(sessions), [sessions]);

  // Rank and filter sessions
  const displaySessions = useMemo(() => {
    let ranked = rankSessions(sessions, persona, interests);

    // Apply filters
    if (filters.track !== 'all') ranked = ranked.filter(s => s.track === filters.track);
    if (filters.format !== 'all') ranked = ranked.filter(s => s.format === filters.format);
    if (filters.day !== 'all') ranked = ranked.filter(s => s.day === filters.day);
    if (filters.level !== 'all') ranked = ranked.filter(s => s.level === filters.level);

    // Apply search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      ranked = ranked.filter(s =>
        (s.title && s.title.toLowerCase().includes(q)) ||
        (s.speakers && s.speakers.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        (s.tags && s.tags.toLowerCase().includes(q)) ||
        (s.speaker_company && s.speaker_company.toLowerCase().includes(q))
      );
    }

    return ranked;
  }, [sessions, persona, interests, filters, searchQuery]);

  function toggleInterest(tag) {
    setInterests(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  function toggleAgenda(sessionId) {
    setAgendaIds(prev => prev.includes(sessionId) ? prev.filter(id => id !== sessionId) : [...prev, sessionId]);
  }

  function exportCSV() {
    const agendaSessions = sessions.filter(s => agendaIds.includes(s.session_id));
    const csv = Papa.unparse(agendaSessions);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my_summit_agenda.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportMarkdown() {
    const agendaSessions = sessions.filter(s => agendaIds.includes(s.session_id));
    exportMarkdown(agendaSessions);
  }

  function handleExportPDF() {
    const agendaSessions = sessions.filter(s => agendaIds.includes(s.session_id));
    exportPDF(agendaSessions);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="flex items-center gap-3 text-blue-600">
          <Snowflake size={32} className="animate-spin" />
          <span className="text-lg font-medium">Loading Summit sessions...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Snowflake size={28} className="text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Snowflake Summit 2026</h1>
                <p className="text-xs text-gray-500">June 1-4 | Moscone Center, San Francisco</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search sessions, speakers, topics..."
                  className="pl-9 pr-4 py-2 w-64 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <button
                onClick={() => setShowAgenda(!showAgenda)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  showAgenda
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-blue-50'
                }`}
              >
                {showAgenda ? <X size={16} /> : <Menu size={16} />}
                My Agenda
                {agendaIds.length > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                    showAgenda ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {agendaIds.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Main content */}
          <div className={`flex-1 min-w-0 space-y-6 ${showAgenda ? 'lg:max-w-[60%]' : ''}`}>
            {/* Persona & Interests */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <PersonaSelector
                personas={PERSONAS}
                selected={persona}
                onSelect={setPersona}
                interests={interests}
                availableInterests={availableInterests}
                onToggleInterest={toggleInterest}
              />
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <TrackFilter
                sessions={sessions}
                filters={filters}
                onFilterChange={setFilters}
              />
            </div>

            {/* Results header */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing <span className="font-medium text-gray-900">{displaySessions.length}</span> sessions
                {persona && <> for <span className="font-medium text-blue-600">{persona}</span></>}
              </p>
            </div>

            {/* Session list */}
            <div className="space-y-3">
              {displaySessions.map(s => (
                <SessionCard
                  key={s.session_id}
                  session={s}
                  isInAgenda={agendaIds.includes(s.session_id)}
                  onToggleAgenda={toggleAgenda}
                  isTimSpann={s.speakers && s.speakers.toLowerCase().includes('tim spann')}
                />
              ))}
              {displaySessions.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <p>No sessions match your current filters.</p>
                </div>
              )}
            </div>
          </div>

          {/* Agenda sidebar */}
          {showAgenda && (
            <div className="hidden lg:block w-[40%] shrink-0">
              <div className="sticky top-24 bg-white rounded-xl border border-gray-200 p-5 max-h-[calc(100vh-120px)] overflow-y-auto">
                <AgendaBuilder
                  sessions={sessions}
                  agendaIds={agendaIds}
                  onRemove={id => toggleAgenda(id)}
                  onExportCSV={exportCSV}
                  onExportMarkdown={handleExportMarkdown}
                  onExportPDF={handleExportPDF}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
