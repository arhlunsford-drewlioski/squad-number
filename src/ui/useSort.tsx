import { useMemo, useState, type ReactNode } from 'react';

/** Sorting for a table: click a header to sort, click again to reverse. Text columns start ascending, numbers descending. */
export function useSort<T>(rows: T[], cols: Record<string, (r: T) => number | string>, initial: string, ascending = false) {
  const [key, setKey] = useState(initial);
  const [asc, setAsc] = useState(ascending);
  const sorted = useMemo(() => {
    const get = cols[key];
    if (!get) return rows;
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b);
      const c = typeof x === 'string' || typeof y === 'string' ? String(x).localeCompare(String(y)) : x - y;
      return asc ? c : -c;
    });
    // cols is rebuilt each render by the caller; the key and direction are what change the order.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, key, asc]);
  const sortBy = (k: string, text?: boolean) => { if (k === key) setAsc(!asc); else { setKey(k); setAsc(!!text); } };
  const th = (k: string, label: ReactNode, left?: boolean, title?: string, hideOnPhone?: boolean) => (
    <th className={'sort' + (left ? ' l' : '') + (hideOnPhone ? ' hide-m' : '')} title={title} onClick={() => sortBy(k, left)} aria-sort={key === k ? (asc ? 'ascending' : 'descending') : 'none'}>
      {label}{key === k ? (asc ? ' ▴' : ' ▾') : ''}
    </th>
  );
  return { rows: sorted, th, key, asc };
}
