import React from 'react';
import {
  Section,
  Employee,
  AttendanceRecord,
  PeriodConfig,
  ACTIVE_STATUS_CODES,
  STATUS_CONFIG,
  getEffectiveAttendanceRecord,
  getPeriodSectionAbsenceDetails,
} from '../types/attendance';
import { getDateColumns } from '../utils/excelExporter';
import { Users, CheckCircle2, AlertCircle, Clock, Award, ShieldAlert, FileDown, Check, Layers } from 'lucide-react';

interface SummaryStatsViewProps {
  sections: Section[];
  employees: Employee[];
  attendance: Record<string, AttendanceRecord>;
  period: PeriodConfig;
  onOpenExportModal: () => void;
  onDownloadPDF?: () => void;
  onDownloadDailyPDF?: (dateStr: string) => void;
}

export const SummaryStatsView: React.FC<SummaryStatsViewProps> = ({
  sections,
  employees,
  attendance,
  period,
  onOpenExportModal,
  onDownloadPDF,
  onDownloadDailyPDF,
}) => {
  const dateColumns = getDateColumns(period);
  const [selectedDailyDate, setSelectedDailyDate] = React.useState<string>(
    dateColumns[0]?.dateStr || period.startDate
  );
  const startDay = dateColumns[0]?.dayNum ?? 1;
  const endDay = dateColumns[dateColumns.length - 1]?.dayNum ?? 10;

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  let totalH = 0;
  let totalS = 0;
  let totalI = 0;
  let totalDL = 0;
  let totalC = 0;
  let totalTK = 0;
  let totalLP = 0;
  let totalPS = 0;

  const sectionSummaries = sections.map((sec, idx) => {
    const secEmployees = employees.filter(e => e.sectionId === sec.id);
    let sH = 0, sS = 0, sI = 0, sDL = 0, sC = 0, sTK = 0, sLP = 0, sPS = 0;

    secEmployees.forEach(emp => {
      dateColumns.forEach(d => {
        const rec = getEffectiveAttendanceRecord(attendance, emp.id, d.dateStr, d.isWeekend);
        const st = rec.status;
        if (st === '✓') sH++;
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

    totalH += sH;
    totalS += sS;
    totalI += sI;
    totalDL += sDL;
    totalC += sC;
    totalTK += sTK;
    totalLP += sLP;
    totalPS += sPS;

    const absenceInfo = getPeriodSectionAbsenceDetails(
      sec.id,
      employees,
      attendance,
      dateColumns
    );

    return {
      order: idx + 1,
      id: sec.id,
      name: sec.name,
      employeeCount: secEmployees.length,
      hadir: sH,
      sakit: sS,
      izin: sI,
      dinasLuar: sDL,
      cuti: sC,
      tanpaKeterangan: sTK,
      lepasPiket: sLP,
      piketSiang: sPS,
      presenceRate: rate,
      absenceInfo,
    };
  });

  const totalActiveSlots = totalH + totalS + totalI + totalDL + totalC + totalTK + totalLP + totalPS;
  const totalDutyPresent = totalH + totalPS + totalDL;
  const overallRate = totalActiveSlots > 0 ? Math.round((totalDutyPresent / totalActiveSlots) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase">Total Personel</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
            {employees.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Dalam {sections.length} Seksi/Unit
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase">Tingkat Hadir</span>
            <Award className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {overallRate}%
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Total {totalH} Kehadiran
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase">Sakit (S)</span>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
            {totalS}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Surat Keterangan Dokter
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase">Izin / DL</span>
            <Clock className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-sky-600 dark:text-sky-400">
            {totalI + totalDL}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {totalI} Izin + {totalDL} Dinas
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase">Cuti (C)</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
            {totalC}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Cuti Tahunan / Alasan
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-semibold uppercase">Alpa / TK</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
            {totalTK}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Tanpa Keterangan
          </div>
        </div>
      </div>

      {/* Main Table: Matches User's Document */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60">
          <div>
            <h3 className="font-extrabold text-sm uppercase tracking-wide text-slate-900 dark:text-slate-100">
              Ringkasan Rekapitulasi Kehadiran Per Seksi
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Jumlah Personel dan Rekap Statistik Kehadiran (Periode Tanggal {startDay} s.d. {endDay} {monthNames[period.month]} {period.year})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {onDownloadDailyPDF && (
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-2 py-1 rounded-lg shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">Harian:</span>
                <select
                  value={selectedDailyDate}
                  onChange={(e) => setSelectedDailyDate(e.target.value)}
                  className="bg-transparent text-slate-800 dark:text-slate-100 text-xs font-semibold py-0.5 px-1 rounded border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  title="Pilih tanggal apel harian untuk diunduh"
                >
                  {dateColumns.map((col) => (
                    <option key={col.dateStr} value={col.dateStr} className="text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900">
                      Tgl {col.dayNum} ({col.dayName})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => onDownloadDailyPDF(selectedDailyDate)}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold transition-all shadow-2xs flex items-center gap-1"
                  title="Unduh laporan apel harian PDF dengan Rincian Keterangan Selain Hadir (✓) Per Seksi / Bagian"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>PDF Harian</span>
                </button>
              </div>
            )}
            {onDownloadPDF && (
              <button
                onClick={onDownloadPDF}
                className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
                title="Unduh laporan ringkasan 10 hari dalam format PDF resmi (jsPDF)"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Unduh PDF 10 Hari</span>
              </button>
            )}
            <button
              onClick={onOpenExportModal}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
            >
              <span>Ekspor Excel & Lainnya</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                <th className="py-3 px-3 w-12 text-center font-bold">No</th>
                <th className="py-3 px-4 font-bold min-w-48">Nama Seksi / Unit</th>
                <th className="py-3 px-3 text-center font-bold">Jumlah Personel</th>
                <th className="py-3 px-3 text-center font-bold text-emerald-700 dark:text-emerald-400">Hadir (✓)</th>
                <th className="py-3 px-3 text-center font-bold text-amber-700 dark:text-amber-400">Sakit (S)</th>
                <th className="py-3 px-3 text-center font-bold text-sky-700 dark:text-sky-400">Izin (I)</th>
                <th className="py-3 px-3 text-center font-bold text-purple-700 dark:text-purple-400">Dinas Luar (DL)</th>
                <th className="py-3 px-3 text-center font-bold text-indigo-700 dark:text-indigo-400">Cuti (C)</th>
                <th className="py-3 px-3 text-center font-bold text-rose-700 dark:text-rose-400">Tanpa Keterangan (TK)</th>
                <th className="py-3 px-3 text-center font-bold text-teal-700 dark:text-teal-400">Lepas Piket (LP)</th>
                <th className="py-3 px-3 text-center font-bold text-blue-700 dark:text-blue-400">Piket Siang (PS)</th>
                <th className="py-3 px-4 text-center font-bold min-w-32">% Kehadiran</th>
                <th className="py-3 px-4 font-bold min-w-64 text-left">Pegawai Tidak Hadir (Nama & Keterangan)</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {sectionSummaries.map((sec) => (
                <tr key={sec.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-2.5 px-3 text-center font-semibold text-slate-500">
                    {sec.order}
                  </td>
                  <td className="py-2.5 px-4 font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                    {sec.name}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-slate-100">
                    <span className="inline-block px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md">
                      {sec.employeeCount}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-semibold text-emerald-700 dark:text-emerald-400">
                    {sec.hadir}
                  </td>
                  <td className="py-2.5 px-3 text-center font-semibold text-amber-700 dark:text-amber-400">
                    {sec.sakit}
                  </td>
                  <td className="py-2.5 px-3 text-center font-semibold text-sky-700 dark:text-sky-400">
                    {sec.izin}
                  </td>
                  <td className="py-2.5 px-3 text-center font-semibold text-purple-700 dark:text-purple-400">
                    {sec.dinasLuar}
                  </td>
                  <td className="py-2.5 px-3 text-center font-semibold text-indigo-700 dark:text-indigo-400">
                    {sec.cuti}
                  </td>
                  <td className="py-2.5 px-3 text-center font-semibold text-rose-700 dark:text-rose-400">
                    {sec.tanpaKeterangan}
                  </td>
                  <td className="py-2.5 px-3 text-center font-semibold text-teal-700 dark:text-teal-400">
                    {sec.lepasPiket}
                  </td>
                  <td className="py-2.5 px-3 text-center font-semibold text-blue-700 dark:text-blue-400">
                    {sec.piketSiang}
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            sec.presenceRate >= 90
                              ? 'bg-emerald-500'
                              : sec.presenceRate >= 75
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${sec.presenceRate}%` }}
                        />
                      </div>
                      <span className="font-bold text-slate-700 dark:text-slate-300 w-10 text-right">
                        {sec.presenceRate}%
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-xs">
                    {sec.absenceInfo.items.length === 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60">
                        <Check className="w-3 h-3" />
                        Nihil (Hadir Penuh)
                      </span>
                    ) : (
                      <div className="flex flex-col gap-1 py-0.5">
                        {sec.absenceInfo.items.map((item, aIdx) => (
                          <div key={aIdx} className="flex items-start gap-1.5 text-[11px] leading-tight">
                            <span className="font-bold text-slate-800 dark:text-slate-100 shrink-0">
                              {item.employee.name}:
                            </span>
                            <span className="text-slate-600 dark:text-slate-300 font-medium">
                              {item.summaryText}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}

              {/* Total Row */}
              <tr className="bg-slate-100/90 dark:bg-slate-800/90 font-extrabold text-slate-900 dark:text-slate-100 border-t-2 border-slate-300 dark:border-slate-600">
                <td className="py-3 px-3 text-center"></td>
                <td className="py-3 px-4 uppercase tracking-wider">
                  TOTAL PERSONEL
                </td>
                <td className="py-3 px-3 text-center text-sm font-black text-indigo-600 dark:text-indigo-400">
                  {employees.length}
                </td>
                <td className="py-3 px-3 text-center text-emerald-700 dark:text-emerald-400">
                  {totalH}
                </td>
                <td className="py-3 px-3 text-center text-amber-700 dark:text-amber-400">
                  {totalS}
                </td>
                <td className="py-3 px-3 text-center text-sky-700 dark:text-sky-400">
                  {totalI}
                </td>
                <td className="py-3 px-3 text-center text-purple-700 dark:text-purple-400">
                  {totalDL}
                </td>
                <td className="py-3 px-3 text-center text-indigo-700 dark:text-indigo-400">
                  {totalC}
                </td>
                <td className="py-3 px-3 text-center text-rose-700 dark:text-rose-400">
                  {totalTK}
                </td>
                <td className="py-3 px-3 text-center text-teal-700 dark:text-teal-400">
                  {totalLP}
                </td>
                <td className="py-3 px-3 text-center text-blue-700 dark:text-blue-400">
                  {totalPS}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="inline-block px-2.5 py-1 bg-emerald-600 text-white rounded-md text-xs font-black">
                    {overallRate}% Kehadiran
                  </span>
                </td>
                <td className="py-3 px-4 text-left">
                  {totalActiveSlots === totalDutyPresent ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      <Check className="w-3.5 h-3.5" />
                      Nihil (Seluruh Personel Hadir Penuh)
                    </span>
                  ) : (
                    <span className="font-bold text-rose-700 dark:text-rose-400 text-xs">
                      Total {totalS + totalI + totalDL + totalC + totalTK} Slot Keterangan Khusus
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Legend matching filling application */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Keterangan Status:</span>
          {ACTIVE_STATUS_CODES.map((st) => {
            const conf = STATUS_CONFIG[st];
            return (
              <span
                key={st}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold border ${conf.bgClass} ${conf.borderClass}`}
                title={conf.description}
              >
                <span>{conf.shortLabel}</span>
                <span className="text-[10px] opacity-80">= {conf.label}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Detailed Breakdown Card: Rincian Pegawai Tidak Hadir Per Seksi */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-sm uppercase tracking-wide text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Rincian Personel Tidak Hadir / Berstatus Khusus Per Seksi</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Daftar nama pegawai dan catatan dokumen alasan ketidakhadiran selama periode 10 hari
            </p>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sectionSummaries.map((sec) => (
            <div
              key={sec.id}
              className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 dark:border-slate-700">
                  <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 uppercase">
                    {sec.name}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    {sec.employeeCount} Personel
                  </span>
                </div>

                {sec.absenceInfo.items.length === 0 ? (
                  <div className="py-3 flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <Check className="w-4 h-4" />
                    <span>Seluruh personel hadir penuh 100% (Nihil)</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sec.absenceInfo.items.map((item, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 text-xs shadow-2xs"
                      >
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {item.employee.name}
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                          {item.summaryText}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-500">
                <span>Tingkat Kehadiran:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{sec.presenceRate}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
