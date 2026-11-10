/**
 * Google Sheets Realtime Synchronization Service
 * Uses Google Sheets API v4 with OAuth2 Bearer token (via Firebase Auth)
 */

import {
  Section,
  Employee,
  AttendanceRecord,
  AttendanceStatus,
  PeriodConfig,
  ExportSettings,
  ACTIVE_STATUS_CODES,
  STATUS_CONFIG,
  getEffectiveAttendanceRecord,
  getPeriodSectionAbsenceDetails,
} from '../types/attendance';
import { getDateColumns } from '../utils/excelExporter';

export interface GoogleSheetsSyncConfig {
  enabled: boolean;
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  spreadsheetTitle: string | null;
  lastSyncTime: string | null;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  errorMessage?: string;
  autoSyncOnChange: boolean;
}

export const STORAGE_KEY_SHEETS_SYNC = 'rekap_absensi_sheets_sync_v1';

export const loadStoredSyncConfig = (): GoogleSheetsSyncConfig => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SHEETS_SYNC);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        enabled: Boolean(parsed.enabled),
        spreadsheetId: parsed.spreadsheetId || null,
        spreadsheetUrl: parsed.spreadsheetUrl || null,
        spreadsheetTitle: parsed.spreadsheetTitle || null,
        lastSyncTime: parsed.lastSyncTime || null,
        syncStatus: 'idle',
        autoSyncOnChange: parsed.autoSyncOnChange !== false,
      };
    }
  } catch (e) {
    console.warn('Failed to load sheets sync config from storage', e);
  }
  return {
    enabled: false,
    spreadsheetId: null,
    spreadsheetUrl: null,
    spreadsheetTitle: null,
    lastSyncTime: null,
    syncStatus: 'idle',
    autoSyncOnChange: true,
  };
};

export const saveStoredSyncConfig = (config: GoogleSheetsSyncConfig) => {
  try {
    localStorage.setItem(
      STORAGE_KEY_SHEETS_SYNC,
      JSON.stringify({
        enabled: config.enabled,
        spreadsheetId: config.spreadsheetId,
        spreadsheetUrl: config.spreadsheetUrl,
        spreadsheetTitle: config.spreadsheetTitle,
        lastSyncTime: config.lastSyncTime,
        autoSyncOnChange: config.autoSyncOnChange,
      })
    );
  } catch (e) {
    console.warn('Failed to save sheets sync config to storage', e);
  }
};

/**
 * Creates a brand new dedicated Google Spreadsheet for realtime attendance tracking
 */
export async function createSyncSpreadsheet({
  accessToken,
  title,
  sections,
  employees,
  attendance,
  period,
  settings,
}: {
  accessToken: string;
  title?: string;
  sections: Section[];
  employees: Employee[];
  attendance: Record<string, AttendanceRecord>;
  period: PeriodConfig;
  settings: ExportSettings;
}): Promise<{ spreadsheetId: string; spreadsheetUrl: string; title: string }> {
  const dateColumns = getDateColumns(period);
  const startDay = dateColumns[0]?.dayNum ?? 1;
  const endDay = dateColumns[dateColumns.length - 1]?.dayNum ?? 10;
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const currentMonthName = monthNames[period.month] || 'Bulan';

  const docTitle =
    title ||
    `Rekap Absensi Apel (${startDay}-${endDay} ${currentMonthName} ${period.year}) - ${settings.institution}`;

  const createPayload = {
    properties: {
      title: docTitle,
      locale: 'id_ID',
      timeZone: 'Asia/Jakarta',
    },
    sheets: [
      {
        properties: {
          title: 'Rekap Matriks 10 Hari',
          gridProperties: {
            frozenRowCount: 6,
            frozenColumnCount: 2,
          },
        },
      },
      {
        properties: {
          title: 'Statistik & Monitoring',
          gridProperties: {
            frozenRowCount: 5,
          },
        },
      },
    ],
  };

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createPayload),
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    let msg = 'Gagal membuat Google Spreadsheet baru.';
    try {
      const errJson = JSON.parse(errorText);
      if (errJson.error?.message) msg += ` ${errJson.error.message}`;
    } catch {}
    throw new Error(msg);
  }

  const sheetData = await createRes.json();
  const spreadsheetId = sheetData.spreadsheetId;
  const spreadsheetUrl =
    sheetData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Populate data immediately
  await syncAttendanceToSpreadsheet({
    accessToken,
    spreadsheetId,
    sections,
    employees,
    attendance,
    period,
    settings,
  });

  return {
    spreadsheetId,
    spreadsheetUrl,
    title: docTitle,
  };
}

/**
 * Builds table rows for the main 10-day attendance matrix tab
 */
function buildMatrixRows(
  sections: Section[],
  employees: Employee[],
  attendance: Record<string, AttendanceRecord>,
  period: PeriodConfig,
  settings: ExportSettings
): any[][] {
  const dateColumns = getDateColumns(period);
  const startDay = dateColumns[0]?.dayNum ?? 1;
  const endDay = dateColumns[dateColumns.length - 1]?.dayNum ?? 10;
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const currentMonthName = monthNames[period.month] || 'Bulan';

  const rows: any[][] = [];

  // Kop Instansi
  rows.push([settings.title.toUpperCase()]);
  rows.push([settings.institution.toUpperCase()]);
  rows.push([`PERIODE: TANGGAL ${startDay} S.D. ${endDay} ${currentMonthName.toUpperCase()} ${period.year}`]);
  rows.push([`STATUS: TERPANTAU SECARA REALTIME • PEMBARUAN TERAKHIR: ${new Date().toLocaleString('id-ID')} WIB`]);
  rows.push([]); // blank

  // Header columns
  const headerRow: any[] = ['No', 'Nama Pegawai'];
  dateColumns.forEach((d) => {
    headerRow.push(`${d.dayNum} (${d.dayName})`);
  });
  headerRow.push('✓ (Hadir)', 'T (Terlambat)', 'S', 'I', 'DL', 'C', 'TK', 'LP', 'PS', '% Kehadiran', 'Catatan / Alasan');
  rows.push(headerRow);

  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  let grandH = 0, grandT = 0, grandS = 0, grandI = 0, grandDL = 0, grandC = 0, grandTK = 0, grandLP = 0, grandPS = 0;
  let grandSched = 0;

  sortedSections.forEach((sec) => {
    const secEmployees = employees
      .filter((e) => e.sectionId === sec.id)
      .sort((a, b) => a.order - b.order);

    if (secEmployees.length === 0) return;

    // Section title row
    const secTitleRow = [`BAGIAN / SEKSI: ${sec.name.toUpperCase()} (${secEmployees.length} PERSONEL)`];
    rows.push(secTitleRow);

    let secH = 0, secT = 0, secS = 0, secI = 0, secDL = 0, secC = 0, secTK = 0, secLP = 0, secPS = 0;

    secEmployees.forEach((emp, idx) => {
      let h = 0, t = 0, s = 0, i = 0, dl = 0, c = 0, tk = 0, lp = 0, ps = 0;
      const notes: string[] = [];

      const empRow: any[] = [idx + 1, emp.name];

      dateColumns.forEach((d) => {
        const rec = getEffectiveAttendanceRecord(attendance, emp.id, d.dateStr, d.isWeekend);
        const st = rec.status;
        if (st === '✓' || st === '✔' || st === 'H') h++;
        else if (st === 'T') t++;
        else if (st === 'S') s++;
        else if (st === 'I') i++;
        else if (st === 'DL') dl++;
        else if (st === 'C') c++;
        else if (st === 'TK') tk++;
        else if (st === 'LP') lp++;
        else if (st === 'PS') ps++;

        if (rec.note) {
          notes.push(`Tgl ${d.dayNum}: ${rec.note}`);
        }

        // Write clear symbol
        empRow.push(st);
      });

      const sched = h + t + s + i + dl + c + tk + lp + ps;
      const duty = h + t + ps + dl;
      const rate = sched > 0 ? Math.round((duty / sched) * 100) : 100;

      empRow.push(h, t, s, i, dl, c, tk, lp, ps, `${rate}%`, notes.join('; ') || '-');
      rows.push(empRow);

      secH += h;
      secT += t;
      secS += s;
      secI += i;
      secDL += dl;
      secC += c;
      secTK += tk;
      secLP += lp;
      secPS += ps;
    });

    const secSched = secH + secT + secS + secI + secDL + secC + secTK + secLP + secPS;
    const secDuty = secH + secT + secPS + secDL;
    const secRate = secSched > 0 ? Math.round((secDuty / secSched) * 100) : 100;

    const subtotalRow: any[] = [`Subtotal ${sec.name}`];
    // pad with empty strings for date columns
    for (let c = 0; c < dateColumns.length + 1; c++) {
      subtotalRow.push('');
    }
    subtotalRow.push(secH, secT, secS, secI, secDL, secC, secTK, secLP, secPS, `${secRate}%`, '');
    rows.push(subtotalRow);

    grandH += secH;
    grandT += secT;
    grandS += secS;
    grandI += secI;
    grandDL += secDL;
    grandC += secC;
    grandTK += secTK;
    grandLP += secLP;
    grandPS += secPS;
    grandSched += secSched;
  });

  // Grand Total Row
  const grandDuty = grandH + grandT + grandPS + grandDL;
  const grandRate = grandSched > 0 ? Math.round((grandDuty / grandSched) * 100) : 100;

  const totalRow: any[] = ['TOTAL KESELURUHAN SATKER'];
  for (let c = 0; c < dateColumns.length + 1; c++) {
    totalRow.push('');
  }
  totalRow.push(grandH, grandT, grandS, grandI, grandDL, grandC, grandTK, grandLP, grandPS, `${grandRate}%`, 'Lengkap');
  rows.push(totalRow);

  rows.push([]); // blank
  rows.push(['KETERANGAN LEGENDA:']);
  rows.push([
    ACTIVE_STATUS_CODES.map((st) => `${STATUS_CONFIG[st]?.shortLabel} = ${STATUS_CONFIG[st]?.label}`).join('   |   ')
  ]);

  rows.push([]);
  rows.push([]);

  // Tanda Tangan Pengesahan
  rows.push([
    '',
    `Mengetahui,`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    `${settings.signatures.city || 'Kendal'}, ${settings.signatures.signDate || new Date().toLocaleDateString('id-ID')}`
  ]);
  rows.push([
    '',
    settings.signatures.officer1Title,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    settings.signatures.officer2Title
  ]);
  rows.push([]);
  rows.push([]);
  rows.push([
    '',
    settings.signatures.officer1Name,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    settings.signatures.officer2Name
  ]);

  return rows;
}

/**
 * Builds table rows for the Statistics & Monitoring tab
 */
function buildStatsRows(
  sections: Section[],
  employees: Employee[],
  attendance: Record<string, AttendanceRecord>,
  period: PeriodConfig,
  settings: ExportSettings
): any[][] {
  const dateColumns = getDateColumns(period);
  const rows: any[][] = [];

  rows.push(['DASHBOARD MONITORING & STATISTIK KEHADIRAN APEL (REALTIME)']);
  rows.push([settings.institution.toUpperCase()]);
  rows.push([`Sinkronisasi Otomatis: Aktif • Diperbarui pada: ${new Date().toLocaleString('id-ID')} WIB`]);
  rows.push([]); // blank

  rows.push([
    'No',
    'Nama Seksi / Unit Kerja',
    'Jumlah Personel',
    'Hadir (✓)',
    'Terlambat (T)',
    'Sakit (S)',
    'Izin (I)',
    'Dinas Luar (DL)',
    'Cuti (C)',
    'Tanpa Keterangan (TK)',
    'Lepas Piket (LP)',
    'Piket Siang (PS)',
    '% Kehadiran',
    'Pegawai Tidak Hadir (Nama & Keterangan)'
  ]);

  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  let totH = 0, totT = 0, totS = 0, totI = 0, totDL = 0, totC = 0, totTK = 0, totLP = 0, totPS = 0;

  sortedSections.forEach((sec, idx) => {
    const secEmployees = employees.filter((e) => e.sectionId === sec.id);
    let sH = 0, sT = 0, sS = 0, sI = 0, sDL = 0, sC = 0, sTK = 0, sLP = 0, sPS = 0;

    secEmployees.forEach((emp) => {
      dateColumns.forEach((d) => {
        const rec = getEffectiveAttendanceRecord(attendance, emp.id, d.dateStr, d.isWeekend);
        const st = rec.status;
        if (st === '✓' || st === '✔' || st === 'H') sH++;
        else if (st === 'T') sT++;
        else if (st === 'S') sS++;
        else if (st === 'I') sI++;
        else if (st === 'DL') sDL++;
        else if (st === 'C') sC++;
        else if (st === 'TK') sTK++;
        else if (st === 'LP') sLP++;
        else if (st === 'PS') sPS++;
      });
    });

    const activeSched = sH + sT + sS + sI + sDL + sC + sTK + sLP + sPS;
    const duty = sH + sT + sPS + sDL;
    const rate = activeSched > 0 ? Math.round((duty / activeSched) * 100) : 100;

    const absenceInfo = getPeriodSectionAbsenceDetails(sec.id, employees, attendance, dateColumns);
    const absenceCellText = absenceInfo.items.length === 0
      ? 'Nihil (Hadir Penuh)'
      : absenceInfo.items.map(it => `${it.employee.name} (${it.summaryText})`).join('; ');

    rows.push([
      idx + 1,
      sec.name,
      secEmployees.length,
      sH,
      sT,
      sS,
      sI,
      sDL,
      sC,
      sTK,
      sLP,
      sPS,
      `${rate}%`,
      absenceCellText
    ]);

    totH += sH;
    totT += sT;
    totS += sS;
    totI += sI;
    totDL += sDL;
    totC += sC;
    totTK += sTK;
    totLP += sLP;
    totPS += sPS;
  });

  const allSched = totH + totT + totS + totI + totDL + totC + totTK + totLP + totPS;
  const allDuty = totH + totT + totPS + totDL;
  const allRate = allSched > 0 ? Math.round((allDuty / allSched) * 100) : 100;
  const totalAbsentSlots = totT + totS + totI + totDL + totC + totTK;

  rows.push([
    'TOTAL',
    'SELURUH SATUAN KERJA',
    employees.length,
    totH,
    totT,
    totS,
    totI,
    totDL,
    totC,
    totTK,
    totLP,
    totPS,
    `${allRate}%`,
    totalAbsentSlots === 0 ? 'Nihil (Hadir Penuh)' : `Total ${totalAbsentSlots} Slot Keterangan Khusus`
  ]);

  rows.push([]);
  rows.push(['DETAIL KETERANGAN STATUS KEHADIRAN:']);
  ACTIVE_STATUS_CODES.forEach((st) => {
    const c = STATUS_CONFIG[st];
    rows.push([c.shortLabel, c.label, c.description]);
  });

  return rows;
}

/**
 * Synchronizes attendance records into an existing Google Spreadsheet
 */
export async function syncAttendanceToSpreadsheet({
  accessToken,
  spreadsheetId,
  sections,
  employees,
  attendance,
  period,
  settings,
}: {
  accessToken: string;
  spreadsheetId: string;
  sections: Section[];
  employees: Employee[];
  attendance: Record<string, AttendanceRecord>;
  period: PeriodConfig;
  settings: ExportSettings;
}): Promise<{ success: boolean; updatedTime: string }> {
  // 1. Inspect existing sheet tabs
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!metaRes.ok) {
    const errText = await metaRes.text();
    let msg = 'Gagal mengakses Google Spreadsheet.';
    try {
      const errJson = JSON.parse(errText);
      if (errJson.error?.message) msg += ` ${errJson.error.message}`;
    } catch {}
    throw new Error(msg);
  }

  const metaData = await metaRes.json();
  const existingSheetTitles: string[] = (metaData.sheets || []).map(
    (s: any) => s.properties?.title
  );

  // If needed sheets don't exist, create them
  const neededSheets = ['Rekap Matriks 10 Hari', 'Statistik & Monitoring'];
  const missingSheets = neededSheets.filter((t) => !existingSheetTitles.includes(t));

  if (missingSheets.length > 0) {
    const addSheetRequests = missingSheets.map((title) => ({
      addSheet: {
        properties: { title },
      },
    }));

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests: addSheetRequests }),
    });
  }

  // 2. Build rows for both sheets
  const matrixRows = buildMatrixRows(sections, employees, attendance, period, settings);
  const statsRows = buildStatsRows(sections, employees, attendance, period, settings);

  // 3. Clear existing ranges to avoid ghost rows
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ranges: ["'Rekap Matriks 10 Hari'!A1:Z500", "'Statistik & Monitoring'!A1:Z500"],
      }),
    }
  );

  // 4. Batch update values
  const updatePayload = {
    valueInputOption: 'USER_ENTERED',
    data: [
      {
        range: "'Rekap Matriks 10 Hari'!A1",
        values: matrixRows,
      },
      {
        range: "'Statistik & Monitoring'!A1",
        values: statsRows,
      },
    ],
  };

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    }
  );

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    let msg = 'Gagal memperbarui data di Google Sheets.';
    try {
      const errJson = JSON.parse(errText);
      if (errJson.error?.message) msg += ` ${errJson.error.message}`;
    } catch {}
    throw new Error(msg);
  }

  const updatedTime = new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return { success: true, updatedTime };
}

/**
 * Validates access to an existing spreadsheet and fetches basic info
 */
export async function verifySpreadsheetAccess(
  accessToken: string,
  spreadsheetId: string
): Promise<{ valid: boolean; title: string; url: string }> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId,properties.title,spreadsheetUrl`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error('Spreadsheet tidak ditemukan atau Anda tidak memiliki izin akses.');
  }

  const data = await res.json();
  return {
    valid: true,
    title: data.properties?.title || 'Google Spreadsheet',
    url: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

/**
 * Fetches attendance matrix data from Google Sheets periodically and extracts updated records
 */
export async function fetchAttendanceFromSpreadsheet({
  accessToken,
  spreadsheetId,
  employees,
  period,
}: {
  accessToken: string;
  spreadsheetId: string;
  employees: Employee[];
  period: PeriodConfig;
}): Promise<{
  records: Record<string, AttendanceRecord>;
  updatedTime: string;
}> {
  const dateColumns = getDateColumns(period);
  // Fetch values from Sheet 1 "Rekap Matriks 10 Hari"
  const range = encodeURIComponent("'Rekap Matriks 10 Hari'!A5:Z200");
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueRenderOption=FORMATTED_VALUE`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error('Gagal mengambil data dari Google Spreadsheet.');
  }

  const data = await res.json();
  const rows: any[][] = data.values || [];

  const records: Record<string, AttendanceRecord> = {};

  // Build employee name lookup map (normalized lowercase trim)
  const empNameMap = new Map<string, Employee>();
  employees.forEach((emp) => {
    empNameMap.set(emp.name.trim().toLowerCase(), emp);
  });

  rows.forEach((row) => {
    if (!row || row.length < 2) return;
    const nameCol = String(row[1] || '').trim();
    if (!nameCol) return;

    const matchedEmp = empNameMap.get(nameCol.toLowerCase());
    if (!matchedEmp) return;

    // Date columns start at column index 2
    dateColumns.forEach((d, dIdx) => {
      const colIndex = 2 + dIdx;
      if (colIndex < row.length) {
        const rawStatus = String(row[colIndex] || '').trim().toUpperCase();
        let normalizedStatus: AttendanceStatus | undefined = undefined;

        if (rawStatus === '✓' || rawStatus === '✔' || rawStatus === 'H') {
          normalizedStatus = '✓';
        } else if (rawStatus === 'T') {
          normalizedStatus = 'T';
        } else if (rawStatus === 'S') {
          normalizedStatus = 'S';
        } else if (rawStatus === 'I') {
          normalizedStatus = 'I';
        } else if (rawStatus === 'DL') {
          normalizedStatus = 'DL';
        } else if (rawStatus === 'C') {
          normalizedStatus = 'C';
        } else if (rawStatus === 'TK') {
          normalizedStatus = 'TK';
        } else if (rawStatus === 'LP') {
          normalizedStatus = 'LP';
        } else if (rawStatus === 'PS') {
          normalizedStatus = 'PS';
        } else if (rawStatus === 'LB' || rawStatus === '-') {
          normalizedStatus = 'LB';
        }

        if (normalizedStatus) {
          const key = `${matchedEmp.id}_${d.dateStr}`;
          records[key] = {
            employeeId: matchedEmp.id,
            date: d.dateStr,
            status: normalizedStatus,
          };
        }
      }
    });
  });

  const updatedTime = new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return {
    records,
    updatedTime,
  };
}
