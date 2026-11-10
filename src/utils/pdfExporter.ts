import jsPDF from 'jspdf';
import autoTable, { UserOptions } from 'jspdf-autotable';
import {
  Section,
  Employee,
  AttendanceRecord,
  PeriodConfig,
  ExportSettings,
  ACTIVE_STATUS_CODES,
  STATUS_CONFIG,
  getEffectiveAttendanceRecord,
  getDailySectionAbsenceDetails,
  getPeriodSectionAbsenceDetails,
} from '../types/attendance';
import { getDateColumns, triggerFileDownload } from './excelExporter';
import { LOGO_KEMENIMIPAS_BASE64 } from './logoData';

/**
 * Draws a sharp, clean vector checkmark (✓) at specified coordinates.
 * Using vector path prevents font-encoding corruption in PDF viewers (which renders unicode checkmarks as apostrophe "'").
 */
export function drawVectorCheckmark(
  doc: jsPDF,
  cx: number,
  cy: number,
  size: number = 2.4,
  color: [number, number, number] = [22, 101, 52]
) {
  doc.saveGraphicsState();
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(size * 0.18);
  doc.setLineCap('round');
  doc.setLineJoin('round');
  doc.line(cx - size * 0.45, cy - size * 0.05, cx - size * 0.1, cy + size * 0.35);
  doc.line(cx - size * 0.1, cy + size * 0.35, cx + size * 0.5, cy - size * 0.45);
  doc.restoreGraphicsState();
}

/**
 * Draws the official Indonesian Ministry Kop Surat according to "kop surat.md" and logo:
 * KEMENTERIAN IMIGRASI DAN PEMASYARAKATAN REPUBLIK INDONESIA
 * DIREKTORAT JENDERAL PEMASYARAKATAN
 * KANTOR WILAYAH JAWA TENGAH
 * LEMBAGA PEMASYARAKATAN TERBUKA KELAS IIB KENDAL
 * Jalan Raya Bleder – Kendal Kilometer 10 Kode Pos 51351
 * laman : www.kemenimipas.go.id Pos-el : lpt.kendal@gmail.com
 */
export function drawOfficialKopSurat(
  doc: jsPDF,
  pageWidth: number,
  options?: {
    institutionName?: string;
    isLandscape?: boolean;
    startY?: number;
  }
): number {
  const isLandscape = options?.isLandscape ?? false;
  const institution = options?.institutionName || 'LEMBAGA PEMASYARAKATAN TERBUKA KELAS IIB KENDAL';
  const marginX = isLandscape ? 12 : 14;
  let y = options?.startY ?? (isLandscape ? 8.5 : 9.5);

  // Logo Kemenimipas di samping kiri Kop Surat secara proporsional
  const logoSize = isLandscape ? 21.0 : 20.0;
  const logoX = isLandscape ? marginX + 2.5 : marginX + 1.0;
  const logoY = y - (isLandscape ? 1.0 : 1.5);

  try {
    if (LOGO_KEMENIMIPAS_BASE64) {
      doc.addImage(LOGO_KEMENIMIPAS_BASE64, 'PNG', logoX, logoY, logoSize, logoSize);
    }
  } catch (err) {
    console.error('Failed to render kop surat logo in PDF', err);
  }

  // Calculate centered X position for the text block between logo right edge and right margin
  const textLeftBound = logoX + logoSize + 3;
  const textRightBound = pageWidth - marginX;
  const textCenterX = (textLeftBound + textRightBound) / 2;

  // 4 Baris Kepala Surat Resmi Kementerian: Ukuran Sama & Seluruhnya Bold
  const headerFontSize = isLandscape ? 10.0 : 9.0;
  const lineGap = isLandscape ? 4.1 : 3.8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(headerFontSize);
  doc.setTextColor(15, 23, 42);

  // Baris 1: KEMENTERIAN IMIGRASI DAN PEMASYARAKATAN REPUBLIK INDONESIA
  doc.text('KEMENTERIAN IMIGRASI DAN PEMASYARAKATAN REPUBLIK INDONESIA', textCenterX, y, { align: 'center' });

  // Baris 2: DIREKTORAT JENDERAL PEMASYARAKATAN
  y += lineGap;
  doc.text('DIREKTORAT JENDERAL PEMASYARAKATAN', textCenterX, y, { align: 'center' });

  // Baris 3: KANTOR WILAYAH JAWA TENGAH
  y += lineGap;
  doc.text('KANTOR WILAYAH JAWA TENGAH', textCenterX, y, { align: 'center' });

  // Baris 4: LEMBAGA PEMASYARAKATAN TERBUKA KELAS IIB KENDAL
  y += lineGap;
  doc.text(institution.toUpperCase(), textCenterX, y, { align: 'center' });

  // Baris 5: Jalan Raya Bleder – Kendal Kilometer 10 Kode Pos 51351
  y += isLandscape ? 3.8 : 3.6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(isLandscape ? 7.5 : 7.2);
  doc.setTextColor(71, 85, 105);
  doc.text('Jalan Raya Bleder – Kendal Kilometer 10 Kode Pos 51351', textCenterX, y, { align: 'center' });

  // Baris 6: laman : www.kemenimipas.go.id Pos-el : lpt.kendal@gmail.com
  y += isLandscape ? 3.5 : 3.3;
  doc.setFontSize(isLandscape ? 7.2 : 7.0);
  doc.text('laman : www.kemenimipas.go.id   Pos-el : lpt.kendal@gmail.com', textCenterX, y, { align: 'center' });

  // Garis ganda pembatas resmi kop surat (Double line rule)
  y += isLandscape ? 2.6 : 2.4;
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.65);
  doc.line(marginX, y, pageWidth - marginX, y);
  doc.setLineWidth(0.2);
  doc.line(marginX, y + 0.8, pageWidth - marginX, y + 0.8);

  return y + 1.8;
}

export function generateAttendancePDFBlob({
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
  const dateColumns = getDateColumns(period);
  const monthNames = [
    'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
    'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
  ];

  const currentMonthName = monthNames[period.month] || 'NOVEMBER';
  const startDayNum = dateColumns[0]?.dayNum ?? 1;
  const endDayNum = dateColumns[dateColumns.length - 1]?.dayNum ?? 10;

  // Initialize jsPDF in landscape A4 format
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // ~297mm
  const pageHeight = doc.internal.pageSize.getHeight(); // ~210mm

  // --- KOP SURAT RESMI (KEMENTERIAN IMIGRASI DAN PEMASYARAKATAN) ---
  const kopEndY = drawOfficialKopSurat(doc, pageWidth, {
    institutionName: settings.institution,
    isLandscape: true,
  });

  // Judul Dokumen
  const titleY = kopEndY + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(settings.title.toUpperCase(), pageWidth / 2, titleY, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(79, 70, 229);
  doc.text(
    `BULAN ${currentMonthName} ${period.year} (PERIODE TANGGAL ${startDayNum} S.D. ${endDayNum})`,
    pageWidth / 2,
    titleY + 4.5,
    { align: 'center' }
  );

  const mainTableStartY = titleY + 7.5;

  // --- BUILD TABLE DATA ---
  // Table Header Row
  const tableHeaders: any[] = ['No', 'Nama Pegawai'];
  dateColumns.forEach((d) => {
    tableHeaders.push(`${d.dayNum}\n${d.dayName}`);
  });
  tableHeaders.push(
    { content: '', isCheckmarkHeader: true, styles: { halign: 'center' } },
    'T',
    'S',
    'I',
    'DL',
    'C',
    'TK',
    'LP',
    'PS',
    '%',
    'Keterangan'
  );

  const tableBody: any[][] = [];
  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  let grandTotalH = 0;
  let grandTotalT = 0;
  let grandTotalS = 0;
  let grandTotalI = 0;
  let grandTotalDL = 0;
  let grandTotalC = 0;
  let grandTotalTK = 0;
  let grandTotalLP = 0;
  let grandTotalPS = 0;
  let grandTotalWorkingDays = 0;

  sortedSections.forEach((section) => {
    const secEmployees = employees
      .filter((e) => e.sectionId === section.id)
      .sort((a, b) => a.order - b.order);

    if (secEmployees.length === 0) return;

    // Section title row
    tableBody.push([
      {
        content: `BAGIAN / SEKSI: ${section.name.toUpperCase()} (${secEmployees.length} PERSONEL)`,
        colSpan: tableHeaders.length,
        styles: {
          fillColor: [241, 245, 249], // slate-100
          textColor: [30, 41, 59], // slate-800
          fontStyle: 'bold',
          halign: 'left',
          fontSize: 7.5,
        },
      },
    ]);

    let secTotalH = 0;
    let secTotalT = 0;
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
      let tCount = 0;
      let sCount = 0;
      let iCount = 0;
      let dlCount = 0;
      let cCount = 0;
      let tkCount = 0;
      let lpCount = 0;
      let psCount = 0;
      const notes: string[] = [];

      const row: any[] = [
        { content: String(empIdx + 1), styles: { halign: 'center' } },
        { content: emp.name, styles: { fontStyle: 'bold' } },
      ];

      dateColumns.forEach((d) => {
        const record = getEffectiveAttendanceRecord(attendance, emp.id, d.dateStr, d.isWeekend);
        const displayStatus = record.status;

        if (displayStatus === '✓') hCount++;
        else if (displayStatus === 'T') tCount++;
        else if (displayStatus === 'S') sCount++;
        else if (displayStatus === 'I') iCount++;
        else if (displayStatus === 'DL') dlCount++;
        else if (displayStatus === 'C') cCount++;
        else if (displayStatus === 'TK') tkCount++;
        else if (displayStatus === 'LP') lpCount++;
        else if (displayStatus === 'PS') psCount++;

        if (record.note) {
          notes.push(`${d.dayNum}: ${record.note}`);
        }

        // Custom styling cell for status code
        let cellBg: [number, number, number] = [255, 255, 255];
        let cellColor: [number, number, number] = [51, 65, 85];

        if (displayStatus === '✓') {
          cellBg = [220, 252, 231]; // emerald-100
          cellColor = [22, 101, 52];
        } else if (displayStatus === 'T') {
          cellBg = [255, 237, 213]; // orange-100
          cellColor = [154, 52, 18]; // orange-800
        } else if (displayStatus === 'S') {
          cellBg = [254, 243, 199]; // amber-100
          cellColor = [146, 64, 14];
        } else if (displayStatus === 'I') {
          cellBg = [224, 242, 254]; // sky-100
          cellColor = [7, 89, 133];
        } else if (displayStatus === 'DL') {
          cellBg = [243, 232, 255]; // purple-100
          cellColor = [107, 33, 168];
        } else if (displayStatus === 'C') {
          cellBg = [238, 242, 255]; // indigo-100
          cellColor = [55, 48, 163];
        } else if (displayStatus === 'TK') {
          cellBg = [255, 228, 230]; // rose-100
          cellColor = [159, 18, 57];
        } else if (displayStatus === 'LP') {
          cellBg = [204, 251, 241]; // teal-100
          cellColor = [15, 118, 110];
        } else if (displayStatus === 'PS') {
          cellBg = [219, 234, 254]; // blue-100
          cellColor = [29, 78, 216];
        } else if (displayStatus === 'LB') {
          cellBg = [241, 245, 249]; // slate-100
          cellColor = [100, 116, 139];
        }

        if (displayStatus === '✓' || displayStatus === '✔' || displayStatus === 'H') {
          row.push({
            content: '',
            isCheckmark: true,
            styles: {
              fillColor: cellBg,
              textColor: cellColor,
              fontStyle: 'bold',
              halign: 'center',
            },
          });
        } else {
          row.push({
            content: displayStatus,
            styles: {
              fillColor: cellBg,
              textColor: cellColor,
              fontStyle: 'bold',
              halign: 'center',
            },
          });
        }
      });

      const scheduledDays = hCount + tCount + sCount + iCount + dlCount + cCount + tkCount + lpCount + psCount;
      const dutyPresent = hCount + tCount + psCount + dlCount;
      const rate = scheduledDays > 0 ? Math.round((dutyPresent / scheduledDays) * 100) : null;

      row.push(
        { content: String(hCount), styles: { halign: 'center', fontStyle: 'bold', textColor: [22, 101, 52] } },
        { content: String(tCount), styles: { halign: 'center', textColor: [154, 52, 18] } },
        { content: String(sCount), styles: { halign: 'center', textColor: [146, 64, 14] } },
        { content: String(iCount), styles: { halign: 'center', textColor: [7, 89, 133] } },
        { content: String(dlCount), styles: { halign: 'center', textColor: [107, 33, 168] } },
        { content: String(cCount), styles: { halign: 'center', textColor: [55, 48, 163] } },
        { content: String(tkCount), styles: { halign: 'center', textColor: [159, 18, 57] } },
        { content: String(lpCount), styles: { halign: 'center', textColor: [15, 118, 110] } },
        { content: String(psCount), styles: { halign: 'center', textColor: [29, 78, 216] } },
        { content: rate !== null ? `${rate}%` : '-', styles: { halign: 'center', fontStyle: 'bold' } },
        { content: notes.join('; ') || '-', styles: { fontSize: 5.5, textColor: [100, 116, 139] } }
      );

      tableBody.push(row);

      secTotalH += hCount;
      secTotalT += tCount;
      secTotalS += sCount;
      secTotalI += iCount;
      secTotalDL += dlCount;
      secTotalC += cCount;
      secTotalTK += tkCount;
      secTotalLP += lpCount;
      secTotalPS += psCount;
      secPossibleDays += scheduledDays;
    });

    const secDutyPresent = secTotalH + secTotalT + secTotalPS + secTotalDL;
    const secRate = secPossibleDays > 0 ? Math.round((secDutyPresent / secPossibleDays) * 100) : null;
    tableBody.push([
      {
        content: `Subtotal ${section.name}`,
        colSpan: 2 + dateColumns.length,
        styles: {
          fillColor: [248, 250, 252],
          fontStyle: 'bold',
          halign: 'right',
          fontSize: 6,
        },
      },
      { content: String(secTotalH), styles: { halign: 'center', fontStyle: 'bold', fillColor: [248, 250, 252] } },
      { content: String(secTotalT), styles: { halign: 'center', fontStyle: 'bold', fillColor: [248, 250, 252] } },
      { content: String(secTotalS), styles: { halign: 'center', fontStyle: 'bold', fillColor: [248, 250, 252] } },
      { content: String(secTotalI), styles: { halign: 'center', fontStyle: 'bold', fillColor: [248, 250, 252] } },
      { content: String(secTotalDL), styles: { halign: 'center', fontStyle: 'bold', fillColor: [248, 250, 252] } },
      { content: String(secTotalC), styles: { halign: 'center', fontStyle: 'bold', fillColor: [248, 250, 252] } },
      { content: String(secTotalTK), styles: { halign: 'center', fontStyle: 'bold', fillColor: [248, 250, 252] } },
      { content: String(secTotalLP), styles: { halign: 'center', fontStyle: 'bold', fillColor: [248, 250, 252] } },
      { content: String(secTotalPS), styles: { halign: 'center', fontStyle: 'bold', fillColor: [248, 250, 252] } },
      { content: secRate !== null ? `${secRate}%` : '-', styles: { halign: 'center', fontStyle: 'bold', fillColor: [248, 250, 252] } },
      { content: `${secEmployees.length} Pegawai`, styles: { fillColor: [248, 250, 252], fontSize: 6 } },
    ]);

    grandTotalH += secTotalH;
    grandTotalT += secTotalT;
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
  const grandDutyPresent = grandTotalH + grandTotalT + grandTotalPS + grandTotalDL;
  const grandRate = grandTotalWorkingDays > 0 ? Math.round((grandDutyPresent / grandTotalWorkingDays) * 100) : null;
  tableBody.push([
    {
      content: 'TOTAL KESELURUHAN PEGAWAI',
      colSpan: 2 + dateColumns.length,
      styles: {
        fillColor: [226, 232, 240], // slate-200
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        halign: 'right',
        fontSize: 7,
      },
    },
    { content: String(grandTotalH), styles: { halign: 'center', fontStyle: 'bold', fillColor: [226, 232, 240] } },
    { content: String(grandTotalT), styles: { halign: 'center', fontStyle: 'bold', fillColor: [226, 232, 240] } },
    { content: String(grandTotalS), styles: { halign: 'center', fontStyle: 'bold', fillColor: [226, 232, 240] } },
    { content: String(grandTotalI), styles: { halign: 'center', fontStyle: 'bold', fillColor: [226, 232, 240] } },
    { content: String(grandTotalDL), styles: { halign: 'center', fontStyle: 'bold', fillColor: [226, 232, 240] } },
    { content: String(grandTotalC), styles: { halign: 'center', fontStyle: 'bold', fillColor: [226, 232, 240] } },
    { content: String(grandTotalTK), styles: { halign: 'center', fontStyle: 'bold', fillColor: [226, 232, 240] } },
    { content: String(grandTotalLP), styles: { halign: 'center', fontStyle: 'bold', fillColor: [226, 232, 240] } },
    { content: String(grandTotalPS), styles: { halign: 'center', fontStyle: 'bold', fillColor: [226, 232, 240] } },
    { content: grandRate !== null ? `${grandRate}%` : '-', styles: { halign: 'center', fontStyle: 'bold', fillColor: [226, 232, 240] } },
    { content: `Total: ${employees.length} Pegawai`, styles: { fillColor: [226, 232, 240], fontStyle: 'bold', fontSize: 6 } },
  ]);

  const columnStyles: Record<number, any> = {
    0: { cellWidth: 6, halign: 'center' },
    1: { cellWidth: 46 },
  };

  let colIdx = 2;
  dateColumns.forEach(() => {
    columnStyles[colIdx] = { cellWidth: 8, halign: 'center' };
    colIdx++;
  });

  // ✓, T, S, I, DL, C, TK, LP, PS (9 columns)
  for (let i = 0; i < 9; i++) {
    columnStyles[colIdx] = { cellWidth: 5.2, halign: 'center' };
    colIdx++;
  }
  // %
  columnStyles[colIdx] = { cellWidth: 9, halign: 'center' };
  colIdx++;
  // Keterangan
  columnStyles[colIdx] = { cellWidth: 'auto' };

  autoTable(doc, {
    startY: mainTableStartY,
    head: [tableHeaders],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 6.5,
      cellPadding: 1.2,
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      textColor: [30, 41, 59],
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontSize: 6.5,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
    },
    columnStyles,
    margin: { left: 12, right: 12, top: 12, bottom: 15 },
    didDrawCell: (data) => {
      if (data.cell.raw && (data.cell.raw as any).isCheckmarkHeader) {
        const cx = data.cell.x + data.cell.width / 2;
        const cy = data.cell.y + data.cell.height / 2;
        drawVectorCheckmark(doc, cx, cy, 2.5, [255, 255, 255]);
      } else if (data.cell.raw && (data.cell.raw as any).isCheckmark) {
        const cx = data.cell.x + data.cell.width / 2;
        const cy = data.cell.y + data.cell.height / 2;
        drawVectorCheckmark(doc, cx, cy, 2.4, [22, 101, 52]);
      }
    },
    didDrawPage: (data) => {
      // Footer page numbering
      const pageNumber = (doc.internal as any).getNumberOfPages();
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Halaman ${data.pageNumber} • Dokumen Absensi Apel 10 Hari • Dicetak pada ${new Date().toLocaleDateString('id-ID')}`,
        pageWidth / 2,
        pageHeight - 7,
        { align: 'center' }
      );
    },
  });

  // --- SIGNATURES & RECAP SHEET ---
  // Add a new page for Ringkasan Statistik & Tanda Tangan
  doc.addPage();
  const page2KopEndY = drawOfficialKopSurat(doc, pageWidth, {
    institutionName: settings.institution,
    isLandscape: true,
  });

  const p2TitleY = page2KopEndY + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('RINGKASAN & STATISTIK REKAPITULASI KEHADIRAN PER SEKSI', pageWidth / 2, p2TitleY, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Periode Tanggal ${startDayNum} s.d. ${endDayNum} ${currentMonthName} ${period.year}`, pageWidth / 2, p2TitleY + 4.5, { align: 'center' });

  const summaryTableStartY = p2TitleY + 7.5;

  // Summary Table Data (Matches second table)
  const summaryHeaders: any[] = [
    'No',
    'Nama Seksi / Unit',
    'Jumlah',
    { content: 'Hadir (   )', isHadirSummaryHeader: true, styles: { halign: 'center' } },
    'Terlambat (T)',
    'Sakit (S)',
    'Izin (I)',
    'Dinas Luar (DL)',
    'Cuti (C)',
    'Tanpa Keterangan (TK)',
    'Lepas Piket (LP)',
    'Piket Siang (PS)',
    '% Kehadiran',
    'Pegawai Tidak Hadir (Nama & Keterangan)',
  ];

  const summaryRows: any[][] = [];

  sortedSections.forEach((sec, idx) => {
    const secEmployees = employees.filter((e) => e.sectionId === sec.id);
    let sH = 0, sT = 0, sS = 0, sI = 0, sDL = 0, sC = 0, sTK = 0, sLP = 0, sPS = 0;

    secEmployees.forEach((emp) => {
      dateColumns.forEach((d) => {
        const key = `${emp.id}_${d.dateStr}`;
        const st = attendance[key]?.status || (d.isWeekend ? 'LB' : '✓');
        if (st === '✓' || st === 'H') sH++;
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

    const activeDays = sH + sT + sS + sI + sDL + sC + sTK + sLP + sPS;
    const dutyPresent = sH + sT + sPS + sDL;
    const rate = activeDays > 0 ? Math.round((dutyPresent / activeDays) * 100) : 100;

    const absenceInfo = getPeriodSectionAbsenceDetails(sec.id, employees, attendance, dateColumns);
    const absenceCellText = absenceInfo.items.length === 0
      ? 'Nihil (Hadir Penuh)'
      : absenceInfo.items.map((it) => `${it.employee.name} (${it.summaryText})`).join('\n');

    summaryRows.push([
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
      { content: absenceCellText, styles: { fontSize: 6.5, halign: 'left' } },
    ]);
  });

  // Total summary row
  const totalAbsentSlots = grandTotalT + grandTotalS + grandTotalI + grandTotalDL + grandTotalC + grandTotalTK;
  summaryRows.push([
    { content: '', styles: { fillColor: [226, 232, 240] } },
    { content: 'TOTAL PERSONEL', styles: { fontStyle: 'bold', fillColor: [226, 232, 240] } },
    { content: String(employees.length), styles: { fontStyle: 'bold', halign: 'center', fillColor: [226, 232, 240] } },
    { content: String(grandTotalH), styles: { fontStyle: 'bold', halign: 'center', fillColor: [226, 232, 240] } },
    { content: String(grandTotalT), styles: { fontStyle: 'bold', halign: 'center', fillColor: [226, 232, 240] } },
    { content: String(grandTotalS), styles: { fontStyle: 'bold', halign: 'center', fillColor: [226, 232, 240] } },
    { content: String(grandTotalI), styles: { fontStyle: 'bold', halign: 'center', fillColor: [226, 232, 240] } },
    { content: String(grandTotalDL), styles: { fontStyle: 'bold', halign: 'center', fillColor: [226, 232, 240] } },
    { content: String(grandTotalC), styles: { fontStyle: 'bold', halign: 'center', fillColor: [226, 232, 240] } },
    { content: String(grandTotalTK), styles: { fontStyle: 'bold', halign: 'center', fillColor: [226, 232, 240] } },
    { content: String(grandTotalLP), styles: { fontStyle: 'bold', halign: 'center', fillColor: [226, 232, 240] } },
    { content: String(grandTotalPS), styles: { fontStyle: 'bold', halign: 'center', fillColor: [226, 232, 240] } },
    { content: `${grandRate}%`, styles: { fontStyle: 'bold', halign: 'center', fillColor: [226, 232, 240] } },
    { content: totalAbsentSlots === 0 ? 'Nihil (Hadir Penuh)' : `Total ${totalAbsentSlots} Slot Keterangan Khusus`, styles: { fontStyle: 'bold', fillColor: [226, 232, 240], fontSize: 6.5 } },
  ]);

  autoTable(doc, {
    startY: summaryTableStartY,
    head: [summaryHeaders],
    body: summaryRows,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      font: 'helvetica',
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 6, halign: 'center' },
      1: { cellWidth: 38, fontStyle: 'bold' },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 11, halign: 'center' },
      4: { cellWidth: 12, halign: 'center' },
      5: { cellWidth: 10, halign: 'center' },
      6: { cellWidth: 10, halign: 'center' },
      7: { cellWidth: 11, halign: 'center' },
      8: { cellWidth: 10, halign: 'center' },
      9: { cellWidth: 12, halign: 'center' },
      10: { cellWidth: 12, halign: 'center' },
      11: { cellWidth: 12, halign: 'center' },
      12: { cellWidth: 14, halign: 'center' },
      13: { cellWidth: 'auto', fontSize: 6.5 },
    },
    margin: { left: 12, right: 12 },
    didDrawCell: (data) => {
      if (data.cell.raw && (data.cell.raw as any).isHadirSummaryHeader) {
        const cx = data.cell.x + data.cell.width / 2;
        const cy = data.cell.y + data.cell.height / 2;
        drawVectorCheckmark(doc, cx + 3.2, cy, 2.0, [255, 255, 255]);
      }
    },
  });

  // --- LEGENDA STATUS KEHADIRAN (Matches filling application) ---
  const legendY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 4 : 95;
  const legendCells: any[] = ACTIVE_STATUS_CODES.map((st) => {
    const conf = STATUS_CONFIG[st];
    let cellBg: [number, number, number] = [241, 245, 249];
    let cellTextColor: [number, number, number] = [30, 41, 59];
    if (st === '✓' || st === '✔') { cellBg = [220, 252, 231]; cellTextColor = [22, 101, 52]; }
    else if (st === 'T') { cellBg = [255, 237, 213]; cellTextColor = [154, 52, 18]; }
    else if (st === 'S') { cellBg = [254, 243, 199]; cellTextColor = [146, 64, 14]; }
    else if (st === 'I') { cellBg = [224, 242, 254]; cellTextColor = [7, 89, 133]; }
    else if (st === 'DL') { cellBg = [243, 232, 255]; cellTextColor = [107, 33, 168]; }
    else if (st === 'C') { cellBg = [238, 242, 255]; cellTextColor = [55, 48, 163]; }
    else if (st === 'TK') { cellBg = [255, 228, 230]; cellTextColor = [159, 18, 57]; }
    else if (st === 'LP') { cellBg = [204, 251, 241]; cellTextColor = [15, 118, 110]; }
    else if (st === 'PS') { cellBg = [219, 234, 254]; cellTextColor = [29, 78, 216]; }
    else if (st === 'LB') { cellBg = [241, 245, 249]; cellTextColor = [100, 116, 139]; }

    if (st === '✓' || st === '✔') {
      return {
        content: '     = Hadir',
        isHadirLegend: true,
        styles: {
          fillColor: cellBg,
          textColor: cellTextColor,
          fontStyle: 'bold' as const,
          halign: 'center' as const,
          fontSize: 6.5,
        },
      };
    }

    return {
      content: `${conf.shortLabel} = ${conf.label}`,
      styles: {
        fillColor: cellBg,
        textColor: cellTextColor,
        fontStyle: 'bold' as const,
        halign: 'center' as const,
        fontSize: 6.5,
      },
    };
  });

  autoTable(doc, {
    startY: legendY,
    head: [[{ content: 'KETERANGAN STATUS KEHADIRAN (LEGENDA):', colSpan: 10, styles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.5, halign: 'left' } }]],
    body: [legendCells],
    theme: 'grid',
    styles: {
      cellPadding: 1.5,
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
    },
    margin: { left: 12, right: 12 },
    didDrawCell: (data) => {
      if (data.cell.raw && (data.cell.raw as any).isHadirLegend) {
        const cx = data.cell.x + data.cell.width / 2;
        const cy = data.cell.y + data.cell.height / 2;
        drawVectorCheckmark(doc, cx - 4.0, cy, 2.2, [22, 101, 52]);
      }
    },
  });

  // --- SIGNATURE BLOCK ---
  const finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 120;
  
  // Left side signature: Mengetahui
  const sigLeftX = 40;
  // Right side signature: Pembuat daftar
  const sigRightX = pageWidth - 75;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  // Left
  doc.text('Mengetahui,', sigLeftX, finalY, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text(settings.signatures.officer1Title, sigLeftX, finalY + 5, { align: 'center' });

  // Right
  doc.setFont('helvetica', 'normal');
  doc.text(`${settings.signatures.city}, ${settings.signatures.signDate}`, sigRightX, finalY, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text(settings.signatures.officer2Title, sigRightX, finalY + 5, { align: 'center' });

  // Signature names (after space for physical signature - TANPA GARIS BAWAH)
  const nameY = finalY + 28;

  // Left officer
  doc.setFont('helvetica', 'bold');
  doc.text(settings.signatures.officer1Name, sigLeftX, nameY, { align: 'center' });

  // Right officer
  doc.setFont('helvetica', 'bold');
  doc.text(settings.signatures.officer2Name, sigRightX, nameY, { align: 'center' });

  // Footer for page 2
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Halaman 2 • Ringkasan Rekapitulasi & Pengesahan • Dicetak pada ${new Date().toLocaleDateString('id-ID')}`,
    pageWidth / 2,
    pageHeight - 7,
    { align: 'center' }
  );

  const fileName = `Rekap_Absensi_10Hari_${currentMonthName}_Tgl_${startDayNum}-${endDayNum}_${period.year}.pdf`;
  const pdfBlob = doc.output('blob');
  return { blob: pdfBlob, fileName };
}

export function exportAttendanceToPDF(params: {
  sections: Section[];
  employees: Employee[];
  attendance: Record<string, AttendanceRecord>;
  period: PeriodConfig;
  settings: ExportSettings;
}): { fileName: string; success: boolean } {
  const { blob, fileName } = generateAttendancePDFBlob(params);
  triggerFileDownload(blob, fileName);
  return { fileName, success: true };
}


/**
 * Generates an official Daily Recap PDF Report (A4 Portrait) for a specific date
 */
export function generateDailyAttendancePDFBlob({
  dateStr,
  sections,
  employees,
  attendance,
  period,
  settings,
}: {
  dateStr: string;
  sections: Section[];
  employees: Employee[];
  attendance: Record<string, AttendanceRecord>;
  period: PeriodConfig;
  settings: ExportSettings;
}): { blob: Blob; fileName: string } {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm

  // Date Parsing
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const daysIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const dayName = daysIndo[dateObj.getDay()];
  const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const monthName = monthNames[m - 1];
  const formattedFullDate = `${dayName}, ${d} ${monthName} ${y}`;

  // Calculate day counts
  let dayH = 0, dayT = 0, dayS = 0, dayI = 0, dayDL = 0, dayC = 0, dayTK = 0, dayLP = 0, dayPS = 0, dayLB = 0;
  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  // Employee details with exceptions/notes
  const exceptionEmployees: Array<{
    empId: string;
    sectionId: string;
    name: string;
    position: string;
    section: string;
    status: string;
    label: string;
    note: string;
  }> = [];

  employees.forEach((emp) => {
    const rec = getEffectiveAttendanceRecord(attendance, emp.id, dateStr, isWeekend);
    const status = rec.status;

    if (status === '✓') dayH++;
    else if (status === 'T') dayT++;
    else if (status === 'S') dayS++;
    else if (status === 'I') dayI++;
    else if (status === 'DL') dayDL++;
    else if (status === 'C') dayC++;
    else if (status === 'TK') dayTK++;
    else if (status === 'LP') dayLP++;
    else if (status === 'PS') dayPS++;
    else if (status === 'LB') dayLB++;

    // Track if not standard Hadir or has specific note (ignore empty/unrecorded status '')
    if ((status && status !== '✓' && status !== 'LB' && status !== '') || (status !== '' && rec.note)) {
      const secName = sections.find((s) => s.id === emp.sectionId)?.name || '-';
      const statusLabel = STATUS_CONFIG[status]?.label || status;
      exceptionEmployees.push({
        empId: emp.id,
        sectionId: emp.sectionId,
        name: emp.name,
        position: emp.position || '-',
        section: secName,
        status,
        label: statusLabel,
        note: rec.note || statusLabel,
      });
    }
  });

  const scheduled = dayH + dayT + dayS + dayI + dayDL + dayC + dayTK + dayLP + dayPS;
  const dutyPresent = dayH + dayT + dayPS + dayDL;
  const dailyRate = scheduled > 0 ? Math.round((dutyPresent / scheduled) * 100) : null;

  // --- KOP SURAT RESMI (KEMENTERIAN IMIGRASI DAN PEMASYARAKATAN) ---
  const kopEndY = drawOfficialKopSurat(doc, pageWidth, {
    institutionName: settings.institution,
    isLandscape: false,
  });

  // Document Title
  const titleY = kopEndY + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('LAPORAN REKAPITULASI KEHADIRAN APEL HARIAN PEGAWAI', pageWidth / 2, titleY, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(79, 70, 229); // indigo
  doc.text(`Hari / Tanggal: ${formattedFullDate}${isWeekend ? ' (Hari Libur)' : ''}`, pageWidth / 2, titleY + 4.5, { align: 'center' });

  // --- SECTION 1: RINGKASAN EKSEKUTIF KEHADIRAN HARIAN ---
  autoTable(doc, {
    startY: titleY + 7.5,
    head: [[
      'Total Pegawai',
      { content: 'Hadir (   )', isHadirSummaryHeader: true, styles: { halign: 'center' } } as any,
      'Terlambat (T)',
      'Lepas Piket (LP)',
      'Piket Siang (PS)',
      'Dinas Luar (DL)',
      'Sakit (S)',
      'Izin (I)',
      'Cuti (C)',
      'Tanpa Keterangan (TK)',
      '% Kehadiran'
    ]],
    body: [[
      { content: `${employees.length} Orang`, styles: { fontStyle: 'bold', halign: 'center' } },
      { content: String(dayH), styles: { fontStyle: 'bold', halign: 'center', textColor: [22, 101, 52] } },
      { content: String(dayT), styles: { fontStyle: 'bold', halign: 'center', textColor: [154, 52, 18] } },
      { content: String(dayLP), styles: { fontStyle: 'bold', halign: 'center', textColor: [15, 118, 110] } },
      { content: String(dayPS), styles: { fontStyle: 'bold', halign: 'center', textColor: [29, 78, 216] } },
      { content: String(dayDL), styles: { fontStyle: 'bold', halign: 'center', textColor: [107, 33, 168] } },
      { content: String(dayS), styles: { fontStyle: 'bold', halign: 'center', textColor: [146, 64, 14] } },
      { content: String(dayI), styles: { fontStyle: 'bold', halign: 'center', textColor: [7, 89, 133] } },
      { content: String(dayC), styles: { fontStyle: 'bold', halign: 'center', textColor: [55, 48, 163] } },
      { content: String(dayTK), styles: { fontStyle: 'bold', halign: 'center', textColor: [159, 18, 57] } },
      { content: `${dailyRate}%`, styles: { fontStyle: 'bold', halign: 'center', fillColor: [240, 253, 244], textColor: [22, 101, 52] } },
    ]],
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      halign: 'center',
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
    },
    margin: { left: 14, right: 14 },
    didDrawCell: (data) => {
      if (data.cell.raw && (data.cell.raw as any).isHadirSummaryHeader) {
        const cx = data.cell.x + data.cell.width / 2;
        const cy = data.cell.y + data.cell.height / 2;
        drawVectorCheckmark(doc, cx + 3.2, cy, 2.0, [255, 255, 255]);
      }
    },
  });

  // --- LEGENDA STATUS ABSENSI (Matches filling application) ---
  const dailyLegendCells: any[] = ACTIVE_STATUS_CODES.map((st) => {
    const conf = STATUS_CONFIG[st];
    let cellBg: [number, number, number] = [241, 245, 249];
    let cellTextColor: [number, number, number] = [30, 41, 59];
    if (st === '✓' || st === '✔') { cellBg = [220, 252, 231]; cellTextColor = [22, 101, 52]; }
    else if (st === 'T') { cellBg = [255, 237, 213]; cellTextColor = [154, 52, 18]; }
    else if (st === 'S') { cellBg = [254, 243, 199]; cellTextColor = [146, 64, 14]; }
    else if (st === 'I') { cellBg = [224, 242, 254]; cellTextColor = [7, 89, 133]; }
    else if (st === 'DL') { cellBg = [243, 232, 255]; cellTextColor = [107, 33, 168]; }
    else if (st === 'C') { cellBg = [238, 242, 255]; cellTextColor = [55, 48, 163]; }
    else if (st === 'TK') { cellBg = [255, 228, 230]; cellTextColor = [159, 18, 57]; }
    else if (st === 'LP') { cellBg = [204, 251, 241]; cellTextColor = [15, 118, 110]; }
    else if (st === 'PS') { cellBg = [219, 234, 254]; cellTextColor = [29, 78, 216]; }
    else if (st === 'LB') { cellBg = [241, 245, 249]; cellTextColor = [100, 116, 139]; }

    if (st === '✓' || st === '✔') {
      return {
        content: '     = Hadir',
        isHadirLegend: true,
        styles: {
          fillColor: cellBg,
          textColor: cellTextColor,
          fontStyle: 'bold' as const,
          halign: 'center' as const,
          fontSize: 5.5,
        },
      };
    }

    return {
      content: `${conf.shortLabel} = ${conf.label}`,
      styles: {
        fillColor: cellBg,
        textColor: cellTextColor,
        fontStyle: 'bold' as const,
        halign: 'center' as const,
        fontSize: 5.5,
      },
    };
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 2,
    body: [dailyLegendCells],
    theme: 'grid',
    styles: {
      cellPadding: 1,
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
    },
    margin: { left: 14, right: 14 },
    didDrawCell: (data) => {
      if (data.cell.raw && (data.cell.raw as any).isHadirLegend) {
        const cx = data.cell.x + data.cell.width / 2;
        const cy = data.cell.y + data.cell.height / 2;
        drawVectorCheckmark(doc, cx - 3.8, cy, 1.8, [22, 101, 52]);
      }
    },
  });

  let currentY = (doc as any).lastAutoTable.finalY + 5;

  // --- SECTION 2: TABEL REKAPITULASI PER SEKSI / BAGIAN ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('I. REKAPITULASI KEHADIRAN APEL PER SEKSI / UNIT KERJA', 14, currentY);

  const sectionTableHeaders: any[] = [
    'No',
    'Nama Seksi / Unit',
    'Jumlah',
    { content: 'Hadir (   )', isHadirSummaryHeader: true, styles: { halign: 'center' } },
    'T',
    'LP',
    'PS',
    'DL',
    'S',
    'I',
    'C',
    'TK',
    '% Hadir',
    'Pegawai Tidak Hadir (Nama & Keterangan)'
  ];

  const sectionTableBody: any[][] = [];

  sortedSections.forEach((sec, idx) => {
    const secEmployees = employees.filter((e) => e.sectionId === sec.id);
    let sH = 0, sT = 0, sS = 0, sI = 0, sDL = 0, sC = 0, sTK = 0, sLP = 0, sPS = 0;

    secEmployees.forEach((emp) => {
      const rec = getEffectiveAttendanceRecord(attendance, emp.id, dateStr, isWeekend);
      const st = rec.status;
      if (st === '✓') sH++;
      else if (st === 'T') sT++;
      else if (st === 'S') sS++;
      else if (st === 'I') sI++;
      else if (st === 'DL') sDL++;
      else if (st === 'C') sC++;
      else if (st === 'TK') sTK++;
      else if (st === 'LP') sLP++;
      else if (st === 'PS') sPS++;
    });

    const secScheduled = sH + sT + sS + sI + sDL + sC + sTK + sLP + sPS;
    const secDuty = sH + sT + sPS + sDL;
    const secRate = secScheduled > 0 ? Math.round((secDuty / secScheduled) * 100) : 100;

    const dailyAbsence = getDailySectionAbsenceDetails(sec.id, employees, attendance, dateStr, isWeekend);
    const absenceCellText = dailyAbsence.items.length === 0
      ? 'Nihil (Hadir Semua)'
      : dailyAbsence.items.map((it) => `${it.employee.name} (${it.status}${it.note ? `: ${it.note}` : ''})`).join('\n');

    sectionTableBody.push([
      { content: String(idx + 1), styles: { halign: 'center' } },
      { content: sec.name, styles: { fontStyle: 'bold' } },
      { content: String(secEmployees.length), styles: { halign: 'center' } },
      { content: String(sH), styles: { halign: 'center', fontStyle: 'bold', textColor: [22, 101, 52] } },
      { content: String(sT), styles: { halign: 'center', textColor: [154, 52, 18] } },
      { content: String(sLP), styles: { halign: 'center', textColor: [15, 118, 110] } },
      { content: String(sPS), styles: { halign: 'center', textColor: [29, 78, 216] } },
      { content: String(sDL), styles: { halign: 'center', textColor: [107, 33, 168] } },
      { content: String(sS), styles: { halign: 'center', textColor: [146, 64, 14] } },
      { content: String(sI), styles: { halign: 'center', textColor: [7, 89, 133] } },
      { content: String(sC), styles: { halign: 'center', textColor: [55, 48, 163] } },
      { content: String(sTK), styles: { halign: 'center', textColor: [159, 18, 57] } },
      { content: `${secRate}%`, styles: { halign: 'center', fontStyle: 'bold' } },
      { content: absenceCellText, styles: { halign: 'left', fontSize: 6.5 } },
    ]);
  });

  // Total Row
  sectionTableBody.push([
    { content: '', styles: { fillColor: [241, 245, 249] } },
    { content: 'TOTAL KESELURUHAN', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
    { content: String(employees.length), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249] } },
    { content: String(dayH), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [22, 101, 52] } },
    { content: String(dayT), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [154, 52, 18] } },
    { content: String(dayLP), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [15, 118, 110] } },
    { content: String(dayPS), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [29, 78, 216] } },
    { content: String(dayDL), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [107, 33, 168] } },
    { content: String(dayS), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [146, 64, 14] } },
    { content: String(dayI), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [7, 89, 133] } },
    { content: String(dayC), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [55, 48, 163] } },
    { content: String(dayTK), styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [159, 18, 57] } },
    { content: `${dailyRate}%`, styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249] } },
    { content: exceptionEmployees.length === 0 ? 'Nihil (Hadir Semua)' : `${exceptionEmployees.length} Personel Tidak Hadir`, styles: { halign: 'left', fontStyle: 'bold', fillColor: [241, 245, 249], fontSize: 6.5 } },
  ]);

  autoTable(doc, {
    startY: currentY + 2.5,
    head: [sectionTableHeaders],
    body: sectionTableBody,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [51, 65, 85],
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 36 },
      2: { cellWidth: 10, halign: 'center' },
      3: { cellWidth: 11, halign: 'center' },
      4: { cellWidth: 7.5, halign: 'center' },
      5: { cellWidth: 7.5, halign: 'center' },
      6: { cellWidth: 7.5, halign: 'center' },
      7: { cellWidth: 7.5, halign: 'center' },
      8: { cellWidth: 7.5, halign: 'center' },
      9: { cellWidth: 7.5, halign: 'center' },
      10: { cellWidth: 7.5, halign: 'center' },
      11: { cellWidth: 7.5, halign: 'center' },
      12: { cellWidth: 12, halign: 'center' },
      13: { cellWidth: 'auto', halign: 'left', fontSize: 6 },
    },
    margin: { left: 14, right: 14 },
    didDrawCell: (data) => {
      if (data.cell.raw && (data.cell.raw as any).isHadirSummaryHeader) {
        const cx = data.cell.x + data.cell.width / 2;
        const cy = data.cell.y + data.cell.height / 2;
        drawVectorCheckmark(doc, cx + 3.2, cy, 2.0, [255, 255, 255]);
      }
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // --- SECTION 3: RINCIAN KETERANGAN SELAIN HADIR (✓) PER SEKSI / BAGIAN ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('II. RINCIAN KETERANGAN SELAIN HADIR (✓) PER SEKSI / BAGIAN', 14, currentY);

  const excHeaders = ['No', 'Nama Pegawai', 'Jabatan', 'Status', 'Alasan / Keterangan Dokumen'];
  const excBody: any[][] = [];

  sortedSections.forEach((sec) => {
    const secExc = exceptionEmployees.filter((e) => e.sectionId === sec.id);

    // Section Header Banner Row
    excBody.push([
      {
        content: `BAGIAN / SEKSI: ${sec.name.toUpperCase()} (${
          secExc.length > 0 ? `${secExc.length} PERSONEL DENGAN KETERANGAN SELAIN HADIR` : 'NIHIL / SELURUH PERSONEL HADIR LENGKAP'
        })`,
        colSpan: 5,
        styles: {
          fillColor: secExc.length > 0 ? [241, 245, 249] : [240, 253, 244],
          textColor: secExc.length > 0 ? [30, 41, 59] : [22, 101, 52],
          fontStyle: 'bold',
          halign: 'left',
          fontSize: 7.5,
        },
      },
    ]);

    if (secExc.length > 0) {
      secExc.forEach((e, itemIdx) => {
        let cellBg: [number, number, number] = [255, 255, 255];
        let cellText: [number, number, number] = [30, 41, 59];
        if (e.status === 'T') { cellBg = [255, 237, 213]; cellText = [154, 52, 18]; }
        else if (e.status === 'S') { cellBg = [254, 243, 199]; cellText = [146, 64, 14]; }
        else if (e.status === 'I') { cellBg = [224, 242, 254]; cellText = [7, 89, 133]; }
        else if (e.status === 'DL') { cellBg = [243, 232, 255]; cellText = [107, 33, 168]; }
        else if (e.status === 'C') { cellBg = [238, 242, 255]; cellText = [55, 48, 163]; }
        else if (e.status === 'TK') { cellBg = [255, 228, 230]; cellText = [159, 18, 57]; }
        else if (e.status === 'LP') { cellBg = [204, 251, 241]; cellText = [15, 118, 110]; }
        else if (e.status === 'PS') { cellBg = [219, 234, 254]; cellText = [29, 78, 216]; }

        excBody.push([
          { content: String(itemIdx + 1), styles: { halign: 'center' } },
          { content: e.name, styles: { fontStyle: 'bold' } },
          { content: e.position },
          { content: `${e.status} (${e.label})`, styles: { halign: 'center', fontStyle: 'bold', fillColor: cellBg, textColor: cellText } },
          { content: e.note || e.label },
        ]);
      });
    } else {
      excBody.push([
        { content: '-', styles: { halign: 'center', textColor: [100, 116, 139] } },
        { content: '(Seluruh Pegawai Hadir)', styles: { fontStyle: 'italic', textColor: [100, 116, 139] } },
        { content: '-', styles: { halign: 'center', textColor: [100, 116, 139] } },
        { content: 'Hadir (✓)', styles: { halign: 'center', fontStyle: 'bold', fillColor: [220, 252, 231], textColor: [22, 101, 52] } },
        { content: 'Nihil - Seluruh pegawai hadir apel / dinas lengkap tanpa keterangan izin/sakit', styles: { fontStyle: 'italic', textColor: [71, 85, 105] } },
      ]);
    }
  });

  autoTable(doc, {
    startY: currentY + 2.5,
    head: [excHeaders],
    body: excBody,
    theme: 'grid',
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [71, 85, 105],
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 50 },
      2: { cellWidth: 38 },
      3: { cellWidth: 30, halign: 'center' },
      4: { cellWidth: 'auto' },
    },
    margin: { left: 14, right: 14 },
  });
  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Check if signature fits on current page, otherwise add a new page
  if (currentY + 45 > pageHeight - 15) {
    doc.addPage();
    currentY = 25;
  }

  // --- SECTION 4: TANDA TANGAN RESMI (TANPA NIP) ---
  const sigLeftX = 45;
  const sigRightX = pageWidth - 55;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  // Left
  doc.text('Mengetahui,', sigLeftX, currentY, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text(settings.signatures.officer1Title, sigLeftX, currentY + 4.5, { align: 'center' });

  // Right
  doc.setFont('helvetica', 'normal');
  doc.text(`${settings.signatures.city}, ${d} ${monthName} ${y}`, sigRightX, currentY, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text(settings.signatures.officer2Title, sigRightX, currentY + 4.5, { align: 'center' });

  // Officer Names (TANPA GARIS BAWAH, NO NIP)
  const nameY = currentY + 24;

  doc.setFont('helvetica', 'bold');
  doc.text(settings.signatures.officer1Name, sigLeftX, nameY, { align: 'center' });

  doc.text(settings.signatures.officer2Name, sigRightX, nameY, { align: 'center' });

  // Page Footers
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Halaman ${i} dari ${totalPages} • Laporan Apel Harian (${formattedFullDate}) • ${settings.institution}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  const fileName = `Rekap_Harian_Apel_${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}.pdf`;
  const pdfBlob = doc.output('blob');
  return { blob: pdfBlob, fileName };
}

export function exportDailyAttendanceToPDF(params: {
  dateStr: string;
  sections: Section[];
  employees: Employee[];
  attendance: Record<string, AttendanceRecord>;
  period: PeriodConfig;
  settings: ExportSettings;
}): { fileName: string; success: boolean } {
  const { blob, fileName } = generateDailyAttendancePDFBlob(params);
  triggerFileDownload(blob, fileName);
  return { fileName, success: true };
}

