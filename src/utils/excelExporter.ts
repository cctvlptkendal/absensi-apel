import * as XLSX from 'xlsx';
import {
  Employee,
  Section,
  AttendanceRecord,
  PeriodConfig,
  ExportSettings,
  ACTIVE_STATUS_CODES,
  STATUS_CONFIG,
  getEffectiveAttendanceRecord,
  getPeriodSectionAbsenceDetails,
} from '../types/attendance';

export interface DateColumnInfo {
  dateStr: string; // YYYY-MM-DD
  dayNum: number;
  dayName: string;
  isWeekend: boolean;
}

export function getDateColumns(period: PeriodConfig): DateColumnInfo[] {
  const dates: DateColumnInfo[] = [];
  const start = new Date(period.startDate + 'T00:00:00');
  const end = new Date(period.endDate + 'T00:00:00');

  const curr = new Date(start);
  const indonesianDays = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  while (curr <= end) {
    const year = curr.getFullYear();
    const month = String(curr.getMonth() + 1).padStart(2, '0');
    const day = String(curr.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const dayOfWeek = curr.getDay();

    dates.push({
      dateStr,
      dayNum: curr.getDate(),
      dayName: indonesianDays[dayOfWeek],
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    });

    curr.setDate(curr.getDate() + 1);
  }

  return dates;
}

/**
 * Universal browser-safe download helper.
 * Uses Blob URL, fallback data URI, and DOM attachment to guarantee compatibility
 * inside iframes, sandboxed environments, and modern browsers.
 */
export function triggerFileDownload(blob: Blob, fileName: string) {
  try {
    // 1. IE / legacy Edge
    if (typeof (window.navigator as any).msSaveOrOpenBlob !== 'undefined') {
      (window.navigator as any).msSaveOrOpenBlob(blob, fileName);
      return;
    }

    // 2. Standard Blob Object URL
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    document.body.appendChild(link);

    // Dispatch a native click event for maximum iframe compatibility
    const clickEvent = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true,
    });
    link.dispatchEvent(clickEvent);

    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      window.URL.revokeObjectURL(url);
    }, 2000);
  } catch (err) {
    console.error('Blob download dispatch failed, attempting FileReader fallback:', err);
    // 3. Data URI fallback
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => document.body.removeChild(link), 1000);
    };
    reader.readAsDataURL(blob);
  }
}

export function buildAttendanceWorkbook({
  sections,
  employees,
  attendance,
  period,
  settings,
}: {
  sections: Section[];
  employees: Employee[];
  attendance: Record<string, AttendanceRecord>;
  period: PeriodConfig;
  settings: ExportSettings;
}) {
  const dateColumns = getDateColumns(period);
  const monthNames = [
    'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
    'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
  ];

  const currentMonthName = monthNames[period.month] || 'NOVEMBER';
  const startDayNum = dateColumns[0]?.dayNum ?? 1;
  const endDayNum = dateColumns[dateColumns.length - 1]?.dayNum ?? 10;

  // Build Sheet 1: REKAP KEHADIRAN 10 HARI
  const aoa: (string | number | null)[][] = [];

  // Header Titles
  aoa.push([settings.title.toUpperCase()]);
  aoa.push([settings.institution.toUpperCase()]);
  aoa.push([`BULAN ${currentMonthName} ${period.year} (TANGGAL ${startDayNum} S.D. ${endDayNum})`]);
  aoa.push([]); // blank row

  // Table Header
  const headerRow: (string | number)[] = ['No', 'Seksi / Nama Pegawai'];
  dateColumns.forEach(d => {
    headerRow.push(`${d.dayNum}\n(${d.dayName})`);
  });
  headerRow.push('✓', 'S', 'I', 'DL', 'C', 'TK', 'LP', 'PS', '% Hadir', 'KETERANGAN');
  aoa.push(headerRow);

  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: headerRow.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: headerRow.length - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: headerRow.length - 1 } },
  ];

  let grandTotalH = 0;
  let grandTotalS = 0;
  let grandTotalI = 0;
  let grandTotalDL = 0;
  let grandTotalC = 0;
  let grandTotalTK = 0;
  let grandTotalLP = 0;
  let grandTotalPS = 0;
  let grandTotalWorkingDays = 0;

  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  sortedSections.forEach((section) => {
    const secEmployees = employees
      .filter(e => e.sectionId === section.id)
      .sort((a, b) => a.order - b.order);

    if (secEmployees.length === 0) return;

    // Section header row
    const secRowIndex = aoa.length;
    const secRow: (string | number | null)[] = ['', section.name.toUpperCase()];
    for (let i = 2; i < headerRow.length; i++) {
      secRow.push('');
    }
    aoa.push(secRow);

    merges.push({
      s: { r: secRowIndex, c: 1 },
      e: { r: secRowIndex, c: headerRow.length - 1 }
    });

    let secTotalH = 0;
    let secTotalS = 0;
    let secTotalI = 0;
    let secTotalDL = 0;
    let secTotalC = 0;
    let secTotalTK = 0;
    let secTotalLP = 0;
    let secTotalPS = 0;
    let secPossibleDays = 0;

    secEmployees.forEach((emp, empIdx) => {
      let hCount = 0;
      let sCount = 0;
      let iCount = 0;
      let dlCount = 0;
      let cCount = 0;
      let tkCount = 0;
      let lpCount = 0;
      let psCount = 0;
      const notes: string[] = [];

      const empRow: (string | number | null)[] = [empIdx + 1, emp.name];

      dateColumns.forEach(d => {
        const record = getEffectiveAttendanceRecord(attendance, emp.id, d.dateStr, d.isWeekend);
        const status = record.status;

        empRow.push(status);

        if (status === '✓') hCount++;
        else if (status === 'S') sCount++;
        else if (status === 'I') iCount++;
        else if (status === 'DL') dlCount++;
        else if (status === 'C') cCount++;
        else if (status === 'TK') tkCount++;
        else if (status === 'LP') lpCount++;
        else if (status === 'PS') psCount++;

        if (record.note) {
          notes.push(`${d.dayNum}: ${record.note}`);
        }
      });


      // Scheduled duty days (excluding Libur 'LB')
      const scheduledDays = hCount + sCount + iCount + dlCount + cCount + tkCount + lpCount + psCount;
      const totalDutyPresent = hCount + psCount + dlCount;
      const rate = scheduledDays > 0 ? Math.round((totalDutyPresent / scheduledDays) * 100) : 100;

      empRow.push(hCount, sCount, iCount, dlCount, cCount, tkCount, lpCount, psCount, `${rate}%`, notes.join('; '));
      aoa.push(empRow);

      secTotalH += hCount;
      secTotalS += sCount;
      secTotalI += iCount;
      secTotalDL += dlCount;
      secTotalC += cCount;
      secTotalTK += tkCount;
      secTotalLP += lpCount;
      secTotalPS += psCount;
      secPossibleDays += scheduledDays;
    });

    // Subtotal section row
    const secDutyPresent = secTotalH + secTotalPS + secTotalDL;
    const secRate = secPossibleDays > 0 ? Math.round((secDutyPresent / secPossibleDays) * 100) : 100;
    const subtotalRow: (string | number | null)[] = [
      '',
      `SUBTOTAL ${section.name}`,
      ...Array(dateColumns.length).fill(''),
      secTotalH,
      secTotalS,
      secTotalI,
      secTotalDL,
      secTotalC,
      secTotalTK,
      secTotalLP,
      secTotalPS,
      `${secRate}%`,
      `Jumlah Personel: ${secEmployees.length} Org`
    ];
    aoa.push(subtotalRow);

    grandTotalH += secTotalH;
    grandTotalS += secTotalS;
    grandTotalI += secTotalI;
    grandTotalDL += secTotalDL;
    grandTotalC += secTotalC;
    grandTotalTK += secTotalTK;
    grandTotalLP += secTotalLP;
    grandTotalPS += secTotalPS;
    grandTotalWorkingDays += secPossibleDays;
  });

  // Grand Total Row
  aoa.push([]);
  const grandDutyPresent = grandTotalH + grandTotalPS + grandTotalDL;
  const grandRate = grandTotalWorkingDays > 0 ? Math.round((grandDutyPresent / grandTotalWorkingDays) * 100) : 100;
  const totalRow: (string | number | null)[] = [
    '',
    'TOTAL KESELURUHAN PEGAWAI',
    ...Array(dateColumns.length).fill(''),
    grandTotalH,
    grandTotalS,
    grandTotalI,
    grandTotalDL,
    grandTotalC,
    grandTotalTK,
    grandTotalLP,
    grandTotalPS,
    `${grandRate}%`,
    `Total: ${employees.length} Personel`
  ];
  aoa.push(totalRow);

  // Legend rows (matches filling application legend exactly)
  aoa.push([]);
  aoa.push(['KETERANGAN STATUS:']);
  ACTIVE_STATUS_CODES.forEach((st) => {
    const conf = STATUS_CONFIG[st];
    aoa.push([conf.shortLabel, `${conf.shortLabel} = ${conf.label}`]);
  });

  // Signatures Row
  aoa.push([]);
  aoa.push([]);
  const colLeft = 1;
  const colRight = Math.max(headerRow.length - 4, 6);

  const sig1: (string | null)[] = Array(headerRow.length).fill(null);
  sig1[colLeft] = 'Mengetahui,';
  sig1[colRight] = `${settings.signatures.city}, ${settings.signatures.signDate}`;
  aoa.push(sig1);

  const sig2: (string | null)[] = Array(headerRow.length).fill(null);
  sig2[colLeft] = settings.signatures.officer1Title;
  sig2[colRight] = settings.signatures.officer2Title;
  aoa.push(sig2);

  aoa.push(Array(headerRow.length).fill(null));
  aoa.push(Array(headerRow.length).fill(null));
  aoa.push(Array(headerRow.length).fill(null));

  const sigName: (string | null)[] = Array(headerRow.length).fill(null);
  sigName[colLeft] = settings.signatures.officer1Name;
  sigName[colRight] = settings.signatures.officer2Name;
  aoa.push(sigName);

  // Create worksheet 1
  const ws1 = XLSX.utils.aoa_to_sheet(aoa);
  ws1['!merges'] = merges;
  ws1['!cols'] = [
    { wch: 6 },  // No
    { wch: 32 }, // Nama Pegawai
    ...dateColumns.map(() => ({ wch: 7 })), // Date columns
    { wch: 6 },  // ✓
    { wch: 6 },  // S
    { wch: 6 },  // I
    { wch: 6 },  // DL
    { wch: 6 },  // C
    { wch: 6 },  // TK
    { wch: 6 },  // LP
    { wch: 6 },  // PS
    { wch: 10 }, // % Hadir
    { wch: 35 }, // Keterangan
  ];

  // Build Sheet 2: RINGKASAN & STATISTIK
  const summaryAoa: (string | number | null)[][] = [
    ['RINGKASAN REKAPITULASI KEHADIRAN PER SEKSI'],
    [settings.institution.toUpperCase()],
    [`PERIODE TANGGAL ${startDayNum} S.D. ${endDayNum} ${currentMonthName} ${period.year}`],
    [],
    ['No', 'Nama Seksi / Unit', 'Jumlah Personel', 'Hadir (✓)', 'Sakit (S)', 'Izin (I)', 'Dinas Luar (DL)', 'Cuti (C)', 'Tanpa Keterangan (TK)', 'Lepas Piket (LP)', 'Piket Siang (PS)', '% Kehadiran', 'Pegawai Tidak Hadir (Nama & Keterangan)'],
  ];

  sortedSections.forEach((sec, idx) => {
    const secEmployees = employees.filter(e => e.sectionId === sec.id);
    let sH = 0, sS = 0, sI = 0, sDL = 0, sC = 0, sTK = 0, sLP = 0, sPS = 0;
    
    secEmployees.forEach(emp => {
      dateColumns.forEach(d => {
        const key = `${emp.id}_${d.dateStr}`;
        const st = attendance[key]?.status || (d.isWeekend ? 'LB' : '✓');
        if (st === '✓' || st === 'H') sH++;
        else if (st === 'S') sS++;
        else if (st === 'I') sI++;
        else if (st === 'DL') sDL++;
        else if (st === 'C') sC++;
        else if (st === 'TK') sTK++;
        else if (st === 'LP') sLP++;
        else if (st === 'PS') sPS++;
      });
    });

    const activeDays = sH + sS + sI + sDL + sC + sTK + sLP + sPS;
    const dutyPresent = sH + sPS + sDL;
    const rate = activeDays > 0 ? Math.round((dutyPresent / activeDays) * 100) : 100;

    const absenceInfo = getPeriodSectionAbsenceDetails(sec.id, employees, attendance, dateColumns);
    const absenceCellText = absenceInfo.items.length === 0
      ? 'Nihil (Hadir Penuh)'
      : absenceInfo.items.map(it => `${it.employee.name} (${it.summaryText})`).join('; ');

    summaryAoa.push([
      idx + 1,
      sec.name,
      secEmployees.length,
      sH,
      sS,
      sI,
      sDL,
      sC,
      sTK,
      sLP,
      sPS,
      `${rate}%`,
      absenceCellText,
    ]);
  });

  const grandTotalAbsence = grandTotalS + grandTotalI + grandTotalDL + grandTotalC + grandTotalTK;
  summaryAoa.push([
    '',
    'TOTAL PERSONEL',
    employees.length,
    grandTotalH,
    grandTotalS,
    grandTotalI,
    grandTotalDL,
    grandTotalC,
    grandTotalTK,
    grandTotalLP,
    grandTotalPS,
    `${grandRate}%`,
    grandTotalAbsence === 0 ? 'Nihil (Hadir Penuh)' : `Total ${grandTotalAbsence} Slot Keterangan Khusus`,
  ]);

  // Legend rows for Sheet 2
  summaryAoa.push([]);
  summaryAoa.push(['KETERANGAN STATUS:']);
  ACTIVE_STATUS_CODES.forEach((st) => {
    const conf = STATUS_CONFIG[st];
    summaryAoa.push([conf.shortLabel, `${conf.shortLabel} = ${conf.label}`]);
  });

  const ws2 = XLSX.utils.aoa_to_sheet(summaryAoa);
  ws2['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 12 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 12 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 12 } },
  ];
  ws2['!cols'] = [
    { wch: 6 },
    { wch: 32 },
    { wch: 18 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 14 },
    { wch: 10 },
    { wch: 12 },
    { wch: 16 },
    { wch: 16 },
    { wch: 15 },
    { wch: 50 },
  ];

  const wb = XLSX.utils.book_new();
  const sheet1Name = `Rekap 10 Hari (Tgl ${startDayNum}-${endDayNum})`;
  XLSX.utils.book_append_sheet(wb, ws1, sheet1Name.substring(0, 31)); // Max 31 chars in Excel
  XLSX.utils.book_append_sheet(wb, ws2, 'Ringkasan & Statistik');

  return { wb, ws1, ws2, currentMonthName, startDayNum, endDayNum };
}

export function generateAttendanceExcelBlob({
  sections,
  employees,
  attendance,
  period,
  settings,
}: {
  sections: Section[];
  employees: Employee[];
  attendance: Record<string, AttendanceRecord>;
  period: PeriodConfig;
  settings: ExportSettings;
}): { blob: Blob; fileName: string } {
  const { wb, currentMonthName, startDayNum, endDayNum } = buildAttendanceWorkbook({
    sections,
    employees,
    attendance,
    period,
    settings,
  });

  const fileName = `Rekap_Absensi_10Hari_${currentMonthName}_Tgl_${startDayNum}-${endDayNum}_${period.year}.xlsx`;

  const wbout = XLSX.write(wb, {
    bookType: 'xlsx',
    type: 'array',
    bookSST: false,
  });

  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
  });

  return { blob, fileName };
}

/**
 * Exports to Excel (.xlsx) using universal Blob download
 */
export function exportAttendanceToExcel(params: {
  sections: Section[];
  employees: Employee[];
  attendance: Record<string, AttendanceRecord>;
  period: PeriodConfig;
  settings: ExportSettings;
}): { fileName: string; success: boolean } {
  const { blob, fileName } = generateAttendanceExcelBlob(params);
  triggerFileDownload(blob, fileName);
  return { fileName, success: true };
}

export function generateAttendanceCSVBlob({
  sections,
  employees,
  attendance,
  period,
  settings,
}: {
  sections: Section[];
  employees: Employee[];
  attendance: Record<string, AttendanceRecord>;
  period: PeriodConfig;
  settings: ExportSettings;
}): { blob: Blob; fileName: string } {
  const { ws1, currentMonthName, startDayNum, endDayNum } = buildAttendanceWorkbook({
    sections,
    employees,
    attendance,
    period,
    settings,
  });

  const csvContent = XLSX.utils.sheet_to_csv(ws1);
  const fileName = `Rekap_Absensi_10Hari_${currentMonthName}_Tgl_${startDayNum}-${endDayNum}_${period.year}.csv`;
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  return { blob, fileName };
}

/**
 * Exports to CSV format
 */
export function exportAttendanceToCSV(params: {
  sections: Section[];
  employees: Employee[];
  attendance: Record<string, AttendanceRecord>;
  period: PeriodConfig;
  settings: ExportSettings;
}): { fileName: string; success: boolean } {
  const { blob, fileName } = generateAttendanceCSVBlob(params);
  triggerFileDownload(blob, fileName);
  return { fileName, success: true };
}


/**
 * Copies the attendance matrix to clipboard in tab-separated format
 * so users can paste directly into Microsoft Excel or Google Sheets (Ctrl+V)
 */
export async function copyAttendanceToClipboard({
  sections,
  employees,
  attendance,
  period,
  settings,
}: {
  sections: Section[];
  employees: Employee[];
  attendance: Record<string, AttendanceRecord>;
  period: PeriodConfig;
  settings: ExportSettings;
}): Promise<boolean> {
  const { ws1 } = buildAttendanceWorkbook({
    sections,
    employees,
    attendance,
    period,
    settings,
  });

  const tsv = XLSX.utils.sheet_to_txt(ws1);
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(tsv);
      return true;
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = tsv;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    }
  } catch (err) {
    console.error('Failed to copy to clipboard', err);
    return false;
  }
}
