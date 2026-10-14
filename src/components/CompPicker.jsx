import { useMeta } from '../App.jsx';

export function groupedComps(meta) {
  const groups = new Map();
  for (const c of meta.competitions) {
    if (!groups.has(c.group)) groups.set(c.group, []);
    groups.get(c.group).push(c);
  }
  return [...groups.entries()];
}

export default function CompPicker({ value, onChange, label = 'Competition', id = 'comp-picker' }) {
  const meta = useMeta();
  return (
    <div className="comp-picker">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {groupedComps(meta).map(([group, comps]) => (
          <optgroup key={group} label={group}>
            {comps.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
