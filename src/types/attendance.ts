export type AttendanceStatus =
  | '✓'
  | '✔'
  | 'T'
  | 'S'
  | 'I'
  | 'DL'
  | 'C'
  | 'TK'
  | 'LP'
  | 'PS'
  | 'LB'
  | 'H'
  | '-'
  | '';


export interface Employee {
  id: string;
  name: string;
  nip?: string;
  position?: string;
  sectionId: string;
  order: number;
}

export interface Section {
  id: string;
  name: string;
  order: number;
}

export interface AttendanceRecord {
  employeeId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  note?: string;
}

export type PeriodPreset = 'p1' | 'p2' | 'p3' | 'custom';

export interface PeriodConfig {
  preset: PeriodPreset;
  year: number;
  month: number; // 0-11
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface SignatureSettings {
  city: string;
  signDate: string;
  officer1Title: string;
  officer1Name: string;
  officer1Nip?: string;
  officer2Title: string;
  officer2Name: string;
  officer2Nip?: string;
}

export interface ExportSettings {
  title: string;
  subtitle: string;
  institution: string;
  signatures: SignatureSettings;
}

export const ACTIVE_STATUS_CODES: AttendanceStatus[] = ['✓', 'T', 'S', 'I', 'DL', 'C', 'TK', 'LP', 'PS', 'LB'];

export const STATUS_CONFIG: Record<string, {
  label: string;
  shortLabel: string;
  description: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  excelColor: string;
}> = {
  '✓': {
    label: 'Hadir',
    shortLabel: '✓',
    description: 'Hadir Apel / Dinas Tepat Waktu',
    bgClass: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300',
    textClass: 'text-emerald-700 dark:text-emerald-400',
    borderClass: 'border-emerald-300 dark:border-emerald-800',
    excelColor: 'C6EFCE', // soft green
  },
  '✔': {
    label: 'Hadir',
    shortLabel: '✓',
    description: 'Hadir Apel / Dinas Tepat Waktu',
    bgClass: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300',
    textClass: 'text-emerald-700 dark:text-emerald-400',
    borderClass: 'border-emerald-300 dark:border-emerald-800',
    excelColor: 'C6EFCE', // soft green
  },
  'T': {
    label: 'Terlambat',
    shortLabel: 'T',
    description: 'Terlambat Mengikuti Apel',
    bgClass: 'bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-950/60 dark:text-orange-300',
    textClass: 'text-orange-700 dark:text-orange-400',
    borderClass: 'border-orange-300 dark:border-orange-800',
    excelColor: 'FCE4D6', // soft orange
  },
  'S': {
    label: 'Sakit',
    shortLabel: 'S',
    description: 'Sakit (Surat Dokter)',
    bgClass: 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950/60 dark:text-amber-300',
    textClass: 'text-amber-700 dark:text-amber-400',
    borderClass: 'border-amber-300 dark:border-amber-800',
    excelColor: 'FFEB9C', // soft yellow
  },
  'I': {
    label: 'Izin',
    shortLabel: 'I',
    description: 'Izin Resmi',
    bgClass: 'bg-sky-100 text-sky-800 hover:bg-sky-200 dark:bg-sky-950/60 dark:text-sky-300',
    textClass: 'text-sky-700 dark:text-sky-400',
    borderClass: 'border-sky-300 dark:border-sky-800',
    excelColor: 'BDD7EE', // soft blue
  },
  'DL': {
    label: 'Dinas Luar',
    shortLabel: 'DL',
    description: 'Tugas / Dinas Luar',
    bgClass: 'bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-950/60 dark:text-purple-300',
    textClass: 'text-purple-700 dark:text-purple-400',
    borderClass: 'border-purple-300 dark:border-purple-800',
    excelColor: 'E1D5E7', // soft purple
  },
  'C': {
    label: 'Cuti',
    shortLabel: 'C',
    description: 'Cuti Tahunan / Alasan Penting',
    bgClass: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300',
    textClass: 'text-indigo-700 dark:text-indigo-400',
    borderClass: 'border-indigo-300 dark:border-indigo-800',
    excelColor: 'D9D2E9', // soft indigo
  },
  'TK': {
    label: 'Tanpa Keterangan',
    shortLabel: 'TK',
    description: 'Tanpa Keterangan / Alpa',
    bgClass: 'bg-rose-100 text-rose-800 hover:bg-rose-200 dark:bg-rose-950/60 dark:text-rose-300',
    textClass: 'text-rose-700 dark:text-rose-400',
    borderClass: 'border-rose-300 dark:border-rose-800',
    excelColor: 'FFC7CE', // soft red
  },
  'LP': {
    label: 'Lepas Piket',
    shortLabel: 'LP',
    description: 'Lepas Piket / Dinas Malam',
    bgClass: 'bg-teal-100 text-teal-800 hover:bg-teal-200 dark:bg-teal-950/60 dark:text-teal-300',
    textClass: 'text-teal-700 dark:text-teal-400',
    borderClass: 'border-teal-300 dark:border-teal-800',
    excelColor: 'CCF2EC', // soft teal
  },
  'PS': {
    label: 'Piket Siang',
    shortLabel: 'PS',
    description: 'Piket Siang / Regu Siang',
    bgClass: 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-950/60 dark:text-blue-300',
    textClass: 'text-blue-700 dark:text-blue-400',
    borderClass: 'border-blue-300 dark:border-blue-800',
    excelColor: 'D0E1FD', // soft blue
  },
  'LB': {
    label: 'Libur',
    shortLabel: 'LB',
    description: 'Libur / Tidak Ada Jadwal',
    bgClass: 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300',
    textClass: 'text-slate-500 dark:text-slate-400',
    borderClass: 'border-slate-300 dark:border-slate-700',
    excelColor: 'F2F2F2', // light gray
  },
  // Backward compatibility aliases
  'H': {
    label: 'Hadir',
    shortLabel: '✔',
    description: 'Hadir Apel / Dinas',
    bgClass: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300',
    textClass: 'text-emerald-700 dark:text-emerald-400',
    borderClass: 'border-emerald-300 dark:border-emerald-800',
    excelColor: 'C6EFCE',
  },

  '-': {
    label: 'Libur',
    shortLabel: 'LB',
    description: 'Libur / Tidak Ada Jadwal',
    bgClass: 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300',
    textClass: 'text-slate-500 dark:text-slate-400',
    borderClass: 'border-slate-300 dark:border-slate-700',
    excelColor: 'F2F2F2',
  },

  '': {
    label: 'Belum Diisi',
    shortLabel: '-',
    description: 'Belum Diisi / Tidak Ada Input Apel',
    bgClass: 'bg-transparent text-slate-400 dark:text-slate-500',
    textClass: 'text-slate-400 dark:text-slate-500',
    borderClass: 'border-slate-200 dark:border-slate-700 border-dashed',
    excelColor: 'FFFFFF',
  },
};

/**
 * Normalizes any legacy or missing attendance status code.
 * If not inputted yet or empty, returns '' (blank) so it does not affect rekapan.
 */
export function normalizeAttendanceStatus(
  status: AttendanceStatus | string | undefined,
  _isWeekend: boolean = false
): AttendanceStatus {
  if (!status || status === '') return '';
  if ((status as string) === 'H' || (status as string) === '✔') return '✓';
  if ((status as string) === '-') return 'LB';
  return status as AttendanceStatus;
}


/**
 * Centrally retrieves the effective attendance record for any employee and date,
 * ensuring complete 100% synchronization across 10-day matrix, daily dashboard, Excel, and PDF exports.
 */
export function getEffectiveAttendanceRecord(
  attendance: Record<string, AttendanceRecord>,
  employeeId: string,
  dateStr: string,
  isWeekend?: boolean
): AttendanceRecord {
  const key = `${employeeId}_${dateStr}`;
  const rec = attendance[key];

  let weekend = isWeekend;
  if (weekend === undefined) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      const dt = new Date(y, m - 1, d);
      weekend = dt.getDay() === 0 || dt.getDay() === 6;
    } else {
      weekend = false;
    }
  }

  const effectiveStatus = normalizeAttendanceStatus(rec?.status, weekend);

  return {
    employeeId,
    date: dateStr,
    status: effectiveStatus,
    note: rec?.note,
  };
}

export interface DailyAbsenceItem {
  employee: Employee;
  status: AttendanceStatus;
  statusLabel: string;
  note?: string;
  formatted: string;
}

export function getDailySectionAbsenceDetails(
  sectionId: string,
  employees: Employee[],
  attendance: Record<string, AttendanceRecord>,
  dateStr: string,
  isWeekend?: boolean
): {
  items: DailyAbsenceItem[];
  summaryText: string;
} {
  const secEmployees = employees.filter((e) => e.sectionId === sectionId);
  const items: DailyAbsenceItem[] = [];

  let recordedCount = 0;

  secEmployees.forEach((emp) => {
    const rec = getEffectiveAttendanceRecord(attendance, emp.id, dateStr, isWeekend);
    const st = rec.status;
    if (st !== '') recordedCount++;

    if (st && st !== '✓' && st !== '✔' && st !== 'H' && st !== 'LB' && st !== '') {
      const label = STATUS_CONFIG[st]?.label || st;
      const formatted = `${emp.name} (${st}${rec.note ? `: ${rec.note}` : ''})`;
      items.push({
        employee: emp,
        status: st,
        statusLabel: label,
        note: rec.note,
        formatted,
      });
    }
  });

  const summaryText =
    items.length > 0
      ? items.map((i) => i.formatted).join(', ')
      : recordedCount === 0
      ? 'Belum Diisi'
      : 'Nihil (Hadir Semua)';
  return { items, summaryText };
}

export interface PeriodEmployeeAbsenceItem {
  employee: Employee;
  absenceCount: number;
  summaryText: string;
  details: Array<{ dayNum: number; status: AttendanceStatus; note?: string }>;
}

export function getPeriodSectionAbsenceDetails(
  sectionId: string,
  employees: Employee[],
  attendance: Record<string, AttendanceRecord>,
  dateColumns: Array<{ dateStr: string; dayNum: number; isWeekend: boolean }>
): {
  items: PeriodEmployeeAbsenceItem[];
  summaryText: string;
} {
  const secEmployees = employees.filter((e) => e.sectionId === sectionId);
  const items: PeriodEmployeeAbsenceItem[] = [];

  secEmployees.forEach((emp) => {
    const absentDays: Array<{ dayNum: number; status: AttendanceStatus; note?: string }> = [];

    dateColumns.forEach((d) => {
      const rec = getEffectiveAttendanceRecord(attendance, emp.id, d.dateStr, d.isWeekend);
      const st = rec.status;
      if (st && st !== '✓' && st !== '✔' && st !== 'H' && st !== 'LB' && st !== '') {
        absentDays.push({
          dayNum: d.dayNum,
          status: st,
          note: rec.note,
        });
      }
    });

    if (absentDays.length > 0) {
      const groupedByStatus: Record<string, number[]> = {};
      const notesList: string[] = [];

      absentDays.forEach((ad) => {
        if (!groupedByStatus[ad.status]) {
          groupedByStatus[ad.status] = [];
        }
        groupedByStatus[ad.status].push(ad.dayNum);
        if (ad.note && !notesList.includes(ad.note)) {
          notesList.push(ad.note);
        }
      });

      const statusParts = Object.entries(groupedByStatus).map(([st, days]) => {
        return `${st}: Tgl ${days.join(',')}`;
      });

      let empSummary = statusParts.join('; ');
      if (notesList.length > 0) {
        empSummary += ` [${notesList.join(', ')}]`;
      }

      items.push({
        employee: emp,
        absenceCount: absentDays.length,
        summaryText: empSummary,
        details: absentDays,
      });
    }
  });

  const summaryText =
    items.length === 0
      ? 'Nihil (Hadir Penuh)'
      : items.map((i) => `${i.employee.name} (${i.summaryText})`).join('; ');

  return { items, summaryText };
}


