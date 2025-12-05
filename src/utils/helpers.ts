// Utility functions for text processing

export function highlightWhitespace(text: string): string {
    let result = '';
    for (const c of text) {
        if (c === ' ') {
            result += '<mark class="highlight-space">␣</mark>';
        } else if (c === '\t') {
            result += '<mark class="highlight-space">→(Tab)</mark>';
        } else if (c === '\n') {
            result += '<mark class="highlight-space">↵(NewLine)</mark><br>';
        } else if (c === '\r') {
            continue;
        } else {
            result += c;
        }
    }
    return result;
}

export function hasWhitespaceOrSpecial(s: string): boolean {
    return [' ', '\n', '\r', '\t', '\x0D'].some(c => s.includes(c));
}

export function removeWhitespaceSpecial(s: string): string {
    return s.split('').filter(c => ![' ', '\n', '\r', '\t', '\x0D'].includes(c)).join('');
}

export function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

// LocalStorage helpers for scan history
export interface ScanHistoryItem {
    id: string;
    value: string;
    type: string;
    timestamp: number;
}

const HISTORY_KEY = 'barcode_scan_history';
const MAX_HISTORY_ITEMS = 20;

export function getScanHistory(): ScanHistoryItem[] {
    try {
        const data = localStorage.getItem(HISTORY_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

export function addScanToHistory(value: string, type: string): void {
    const history = getScanHistory();
    const newItem: ScanHistoryItem = {
        id: Date.now().toString(),
        value,
        type,
        timestamp: Date.now()
    };

    // Remove duplicate if exists
    const filtered = history.filter(item => item.value !== value);

    // Add new item at the beginning
    const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);

    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}

export function clearScanHistory(): void {
    localStorage.removeItem(HISTORY_KEY);
}
