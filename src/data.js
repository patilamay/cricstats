import { useEffect, useState } from 'react';

const BASE = `${import.meta.env.BASE_URL}data/`;
const cache = new Map();

export function load(path) {
  if (!cache.has(path)) {
    const p = fetch(BASE + path).then((r) => {
      if (!r.ok) throw new Error(r.status === 404 ? 'not-found' : `HTTP ${r.status}`);
      return r.json();
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return cache.get(path);
}

// useData('meta.json') -> { data, error, loading }. Pass null to skip.
export function useData(path) {
  const [state, setState] = useState({ data: null, error: null, loading: !!path });
  useEffect(() => {
    if (!path) { setState({ data: null, error: null, loading: false }); return undefined; }
    let live = true;
    setState((s) => ({ data: s.path === path ? s.data : null, error: null, loading: true, path }));
    load(path).then(
      (data) => live && setState({ data, error: null, loading: false, path }),
      (error) => live && setState({ data: null, error, loading: false, path }),
    );
    return () => { live = false; };
  }, [path]);
  return state;
}

export const playerShard = (id) => (/^[0-9a-f]{2}/.test(id) ? id.slice(0, 2) : 'xx');
