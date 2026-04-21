/**
 * PersonaSelector — Two-part control for choosing a persona and toggling interest tags.
 * The selected persona drives track-affinity scoring in the recommendation engine.
 * Interest tags provide additional signal for ranking sessions by topic relevance.
 */
import { User, Briefcase, Code, BarChart3, Shield, Database, FlaskConical } from 'lucide-react';

const PERSONA_ICONS = {
  'Data Engineer': Database,
  'Data Scientist': FlaskConical,
  'Architect': Briefcase,
  'Developer': Code,
  'Analyst': BarChart3,
  'Executive': User,
  'Security': Shield,
};

export default function PersonaSelector({ personas, selected, onSelect, interests, availableInterests, onToggleInterest }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Your Persona</h3>
        <div className="flex flex-wrap gap-2">
          {personas.map(p => {
            const Icon = PERSONA_ICONS[p] || User;
            const active = p === selected;
            return (
              <button
                key={p}
                onClick={() => onSelect(p)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${active
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                  }`}
              >
                <Icon size={16} />
                {p}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Your Interests</h3>
        <div className="flex flex-wrap gap-1.5">
          {availableInterests.map(tag => {
            const active = interests.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => onToggleInterest(tag)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all
                  ${active
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                    : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200'
                  }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
