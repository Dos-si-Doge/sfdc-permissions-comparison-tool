import { CATEGORIES, CATEGORY_LABELS } from '../lib/types';
import type { Category, DiffResult } from '../lib/types';

interface Props {
  diff: DiffResult;
  activeCategory: Category;
  onSelectCategory: (c: Category) => void;
}

export default function SummaryDashboard({ diff, activeCategory, onSelectCategory }: Props) {
  return (
    <nav className="category-nav">
      {CATEGORIES.map((cat) => {
        const s = diff.summary[cat];
        const diffCount = s.different + s.missing;
        return (
          <button
            key={cat}
            className={cat === activeCategory ? 'category-tab active' : 'category-tab'}
            onClick={() => onSelectCategory(cat)}
          >
            {CATEGORY_LABELS[cat]}
            {diffCount > 0 && <span className="diff-count">{diffCount}</span>}
          </button>
        );
      })}
    </nav>
  );
}
