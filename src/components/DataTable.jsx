import { useEffect, useMemo, useState } from 'react';

// columns: { key, label, title?, get(row) -> sortable value, render?(row), text? (left-aligned), desc? (sort high→low first) }
export default function DataTable({ rows, columns, initialSort, pageSize = 50, rowKey = (r) => r.id, rank = true, caption, emptyText = 'Nothing to show.', noun = 'rows' }) {
  const [sort, setSort] = useState(initialSort || { key: columns[0].key, desc: true });
  const [page, setPage] = useState(0);

  useEffect(() => { setPage(0); }, [rows, sort]);
  useEffect(() => { if (initialSort) setSort(initialSort); }, [initialSort && initialSort.key, initialSort && initialSort.desc]); // eslint-disable-line react-hooks/exhaustive-deps

  const col = columns.find((c) => c.key === sort.key) || columns[0];
  const sorted = useMemo(() => {
    const dir = sort.desc ? -1 : 1;
    return [...rows].sort((a, b) => {
      const va = col.get(a);
      const vb = col.get(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1; // blanks always last
      if (vb == null) return -1;
      if (typeof va === 'string') return va.localeCompare(vb) * dir;
      return (va - vb) * dir;
    });
  }, [rows, col, sort.desc]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const view = sorted.slice(page * pageSize, page * pageSize + pageSize);

  const onSort = (c) => {
    if (c.key === sort.key) setSort({ key: c.key, desc: !sort.desc });
    else setSort({ key: c.key, desc: c.desc !== false && !c.text });
  };

  return (
    <div className="table-wrap">
      <table className="data">
        {caption && <caption className="visually-hidden">{caption}</caption>}
        <thead>
          <tr>
            {rank && <th scope="col" className="num rank">#</th>}
            {columns.map((c) => {
              const active = c.key === sort.key;
              return (
                <th
                  key={c.key}
                  scope="col"
                  className={`${c.text ? 'text' : 'num'}${active ? ' sorted' : ''}`}
                  aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : 'none'}
                >
                  <button type="button" onClick={() => onSort(c)} title={c.title || `Sort by ${c.label}`}>
                    {c.label}
                    <span className="sort-mark" aria-hidden="true">{active ? (sort.desc ? '▾' : '▴') : ''}</span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {view.map((r, i) => (
            <tr key={rowKey(r)}>
              {rank && <td className="num rank">{page * pageSize + i + 1}</td>}
              {columns.map((c) => (
                <td key={c.key} className={`${c.text ? 'text' : 'num'}${c.key === sort.key ? ' sorted' : ''}`}>
                  {c.render ? c.render(r) : c.get(r) ?? '–'}
                </td>
              ))}
            </tr>
          ))}
          {!view.length && (
            <tr><td colSpan={columns.length + (rank ? 1 : 0)} className="empty">{emptyText}</td></tr>
          )}
        </tbody>
      </table>
      {pages > 1 && (
        <div className="pager">
          <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page + 1} of {pages} <span className="muted">({sorted.length.toLocaleString('en-GB')} {noun})</span></span>
          <button type="button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
