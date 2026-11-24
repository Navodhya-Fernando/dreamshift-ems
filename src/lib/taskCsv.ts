/** Small, dependency-free CSV reader with quoted fields, CRLF and escaped quotes. */
export function parseTaskCsv(input: string): Record<string, string>[] {
  if (input.length > 250000) throw new Error('CSV exceeds 250 KB.');
  const text = input.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false, closed = false;
  const finishCell = () => { row.push(cell); cell = ''; closed = false; };
  const finishRow = () => { finishCell(); if (row.some(v => v.trim())) rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i+1] === '"') { cell += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else cell += ch;
    } else if (ch === ',') finishCell();
    else if (ch === '\r' || ch === '\n') { if (ch === '\r' && text[i+1] === '\n') i++; finishRow(); }
    else if (ch === '"' && !cell && !closed) quoted = true;
    else if (ch === '"' || closed) throw new Error('Invalid quoted CSV field.');
    else cell += ch;
    if (rows.length > 201) throw new Error('Maximum 200 tasks per import.');
  }
  if (quoted) throw new Error('CSV contains an unclosed quote.');
  finishRow();
  const headers = rows.shift()?.map(h => h.trim().toLowerCase()) || [];
  if (!headers.includes('title')) throw new Error('The CSV needs a title column.');
  if (headers.some(h => !h) || new Set(headers).size !== headers.length) throw new Error('CSV headers must be unique and non-empty.');
  const allowed = new Set(['title','description','due_date','priority','status','assignee_email']);
  if (headers.some(h => !allowed.has(h))) throw new Error('Unsupported column. Use title, description, due_date, priority, status, assignee_email.');
  if (!rows.length || rows.length > 200) throw new Error('Provide between 1 and 200 task rows.');
  return rows.map((values, i) => {
    if (values.length !== headers.length) throw new Error(`Data row ${i+1}: expected ${headers.length} fields.`);
    return Object.fromEntries(headers.map((header,j) => [header, values[j].trim()]));
  });
}
export function parseTaskDate(value: string): Date | undefined {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Use YYYY-MM-DD for the date.');
  const date = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== value) throw new Error('Invalid calendar date.');
  return date;
}
