// Only a single read-only SELECT / WITH query is allowed through.
export function safeSql(sql) {
  if (typeof sql !== 'string') return null;
  const s = sql.trim().replace(/;\s*$/, '');
  if (!/^(select|with)\b/i.test(s)) return null;
  if (s.includes(';')) return null;
  if (/\b(insert|update|delete|drop|create|alter|attach|detach|copy|export|import|install|load|pragma|set|call|checkpoint)\b/i.test(s.replace(/'[^']*'/g, "''"))) return null;
  if (/\b(read_csv\w*|read_json\w*|read_parquet|read_text|read_blob|glob|httpfs)\s*\(/i.test(s)) return null;
  return s;
}

