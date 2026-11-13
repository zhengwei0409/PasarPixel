// Quote every cell and neutralise formulas when opened in spreadsheet apps.
export function serializeCsv(rows: readonly (readonly string[])[]): string {
    return "\uFEFF" + rows.map((row) => row.map((value) => {
        const safe = /^[\s\uFEFF]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
        return `"${safe.replace(/"/g, '""')}"`;
    }).join(",")).join("\r\n");
}
