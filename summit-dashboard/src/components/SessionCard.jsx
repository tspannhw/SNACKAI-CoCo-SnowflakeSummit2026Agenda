/**
 * SessionCard — Displays a single session with metadata, tags, and an add-to-agenda button.
 * Tim Spann sessions get a special "Featured Speaker" banner with cyan gradient styling.
 * Props: session (object), isInAgenda (bool), onToggleAgenda (fn), isTimSpann (bool)
 */
import { Clock, MapPin, Users, Star, Plus, Check, ExternalLink } from 'lucide-react';

const FORMAT_COLORS = {
  'Keynote': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Breakout Session': 'bg-blue-100 text-blue-800 border-blue-300',
  'Hands-on Lab': 'bg-green-100 text-green-800 border-green-300',
  'Theater Session': 'bg-purple-100 text-purple-800 border-purple-300',
  'Snowflake Training': 'bg-orange-100 text-orange-800 border-orange-300',
  'Executive Content': 'bg-rose-100 text-rose-800 border-rose-300',
  'Dev Day Luminary Talk': 'bg-teal-100 text-teal-800 border-teal-300',
  'Activation': 'bg-amber-100 text-amber-800 border-amber-300',
};

const LEVEL_COLORS = {
  'Beginner': 'text-green-600',
  'Intermediate': 'text-blue-600',
  'Advanced': 'text-red-600',
  'All': 'text-gray-600',
};

export default function SessionCard({ session, isInAgenda, onToggleAgenda, isTimSpann }) {
  const formatClass = FORMAT_COLORS[session.format] || 'bg-gray-100 text-gray-800 border-gray-300';
  const levelClass = LEVEL_COLORS[session.level] || 'text-gray-600';

  return (
    <div className={`rounded-xl border p-5 transition-all hover:shadow-lg ${
      isTimSpann
        ? 'border-cyan-400 bg-gradient-to-br from-cyan-50 to-blue-50 ring-2 ring-cyan-300'
        : 'border-gray-200 bg-white'
    }`}>
      {isTimSpann && (
        <div className="flex items-center gap-1.5 mb-2">
          <Star size={14} className="text-cyan-500 fill-cyan-500" />
          <span className="text-xs font-bold text-cyan-700 uppercase tracking-wider">Featured Speaker</span>
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${formatClass}`}>
              {session.format}
            </span>
            <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-600">
              {session.track}
            </span>
            {session.score != null && (
              <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-100 text-indigo-700">
                Score: {session.score}
              </span>
            )}
          </div>

          <h3 className="text-base font-semibold text-gray-900 mb-1">{session.title}</h3>

          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{session.description}</p>

          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Users size={12} />
              <span className="font-medium text-gray-700">{session.speakers}</span>
              {session.speaker_company && (
                <span>({session.speaker_company})</span>
              )}
            </div>
            {session.day && (
              <div className="flex items-center gap-1">
                <Clock size={12} />
                <span>{session.day} {session.time && `| ${session.time}`}</span>
                {session.duration_min && <span>({session.duration_min} min)</span>}
              </div>
            )}
            {session.room && (
              <div className="flex items-center gap-1">
                <MapPin size={12} />
                <span>{session.room}</span>
              </div>
            )}
            <span className={`font-medium ${levelClass}`}>{session.level}</span>
          </div>

          {session.tags && (
            <div className="flex flex-wrap gap-1 mt-2">
              {session.tags.split(',').slice(0, 6).map(tag => (
                <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] bg-gray-50 text-gray-500 border border-gray-100">
                  {tag.trim()}
                </span>
              ))}
            </div>
          )}

          {session.catalog_url && (
            <a
              href={session.catalog_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
            >
              <ExternalLink size={11} />
              View in Session Catalog
            </a>
          )}
        </div>

        <button
          onClick={() => onToggleAgenda(session.session_id)}
          className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
            isInAgenda
              ? 'bg-green-100 text-green-700 border border-green-300'
              : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300'
          }`}
          title={isInAgenda ? 'Remove from agenda' : 'Add to agenda'}
        >
          {isInAgenda ? <Check size={18} /> : <Plus size={18} />}
        </button>
      </div>
    </div>
  );
}
