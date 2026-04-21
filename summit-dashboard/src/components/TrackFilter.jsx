/**
 * TrackFilter — Dropdown filters for narrowing sessions by track, format, day, and level.
 * Dynamically derives filter options from the loaded session data.
 * Includes a "Clear all" action when any filter is active.
 */
import { Filter, X } from 'lucide-react';

export default function TrackFilter({ sessions, filters, onFilterChange }) {
  const tracks = [...new Set(sessions.map(s => s.track).filter(Boolean))].sort();
  const formats = [...new Set(sessions.map(s => s.format).filter(Boolean))].sort();
  const days = [...new Set(sessions.map(s => s.day).filter(Boolean))]
    .sort((a, b) => {
      const numA = parseInt((a.match(/\d+/) || ['0'])[0]);
      const numB = parseInt((b.match(/\d+/) || ['0'])[0]);
      return numA - numB;
    });
  const levels = [...new Set(sessions.map(s => s.level).filter(Boolean))].sort();

  const activeCount = Object.values(filters).filter(v => v && v !== 'all').length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Filters</h3>
          {activeCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">{activeCount}</span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            onClick={() => onFilterChange({ track: 'all', format: 'all', day: 'all', level: 'all' })}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600"
          >
            <X size={12} /> Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SelectFilter
          label="Track"
          value={filters.track}
          options={tracks}
          onChange={v => onFilterChange({ ...filters, track: v })}
        />
        <SelectFilter
          label="Format"
          value={filters.format}
          options={formats}
          onChange={v => onFilterChange({ ...filters, format: v })}
        />
        <SelectFilter
          label="Day"
          value={filters.day}
          options={days}
          onChange={v => onFilterChange({ ...filters, day: v })}
        />
        <SelectFilter
          label="Level"
          value={filters.level}
          options={levels}
          onChange={v => onFilterChange({ ...filters, level: v })}
        />
      </div>
    </div>
  );
}

function SelectFilter({ label, value, options, onChange }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <select
        value={value || 'all'}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
      >
        <option value="all">All {label}s</option>
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
