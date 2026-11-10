import React, { useState, useEffect } from 'react';
import {
  Section,
  Employee,
  AttendanceRecord,
  AttendanceStatus,
  PeriodConfig,
  ExportSettings,
  STATUS_CONFIG,
  ACTIVE_STATUS_CODES,
  getEffectiveAttendanceRecord,
  getDailySectionAbsenceDetails,
} from '../types/attendance';
import { getDateColumns } from '../utils/excelExporter';
import { exportDailyAttendanceToPDF } from '../utils/pdfExporter';
import {
  Calendar,
  CheckCircle,
  Sparkles,
  MessageSquare,
  UserCheck,
  FileDown,
  LayoutDashboard,
  ListChecks,
  Users,
  Award,
  Shield,
  Clock,
  AlertCircle,
  ShieldAlert,
  CalendarDays,
  Layers,
  ListFilter,
  Check,
  CloudUpload,
} from 'lucide-react';
import { GoogleDriveUploadModal } from './GoogleDriveUploadModal';

interface DailyApelViewProps {
  sections: Section[];
  employees: Employee[];
  attendance: Record<string, AttendanceRecord>;
  period: PeriodConfig;
  settings?: ExportSettings;
  onUpdateStatus: (employeeId: string, dateStr: string, status: AttendanceStatus, note?: string) => void;
  onBatchSectionStatusForDate: (sectionId: string, dateStr: string, status: AttendanceStatus) => void;
  onDownloadDailyPDF?: (dateStr: string) => void;
  onOpenGoogleDriveUpload?: (dateStr: string) => void;
}

export const DailyApelView: React.FC<DailyApelViewProps> = ({
  sections,
  employees,
  attendance,
  period,
  settings,
  onUpdateStatus,
  onBatchSectionStatusForDate,
  onDownloadDailyPDF,
  onOpenGoogleDriveUpload,
}) => {
  const dateColumns = getDateColumns(period);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(dateColumns[0]?.dateStr || period.startDate);
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'rollcall'>('dashboard');
  const [exceptionViewMode, setExceptionViewMode] = useState<'bySection' | 'flat'>('bySection');
  const [notePopup, setNotePopup] = useState<{ emp: Employee; note: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isLocalDriveModalOpen, setIsLocalDriveModalOpen] = useState(false);

  // Keep selectedDateStr strictly synchronized with current period date columns
  useEffect(() => {
    if (dateColumns.length > 0 && !dateColumns.some((d) => d.dateStr === selectedDateStr)) {
      setSelectedDateStr(dateColumns[0].dateStr);
    }
  }, [dateColumns, selectedDateStr, period.startDate]);

  const selectedCol = dateColumns.find((d) => d.dateStr === selectedDateStr) || dateColumns[0];

  const getRecord = (empId: string): AttendanceRecord => {
    return getEffectiveAttendanceRecord(attendance, empId, selectedDateStr, selectedCol?.isWeekend);
  };

  // Day counts
  let dayH = 0,
    dayT = 0,
    dayS = 0,
    dayI = 0,
    dayDL = 0,
    dayC = 0,
    dayTK = 0,
    dayLP = 0,
    dayPS = 0,
    dayLB = 0;

  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  // Exceptions list for daily dashboard
  const exceptions: Array<{
    emp: Employee;
    sectionId: string;
    sectionName: string;
    status: AttendanceStatus;
    note?: string;
  }> = [];

  employees.forEach((e) => {
    const rec = getRecord(e.id);
    const st = rec.status;
    if (st === '✓') dayH++;
    else if (st === 'T') dayT++;
    else if (st === 'S') dayS++;
    else if (st === 'I') dayI++;
    else if (st === 'DL') dayDL++;
    else if (st === 'C') dayC++;
    else if (st === 'TK') dayTK++;
    else if (st === 'LP') dayLP++;
    else if (st === 'PS') dayPS++;
    else if (st === 'LB') dayLB++;

    if ((st !== '✓' && st !== 'LB') || rec.note) {
      const sec = sections.find((s) => s.id === e.sectionId);
      exceptions.push({
        emp: e,
        sectionId: e.sectionId,
        sectionName: sec?.name || '-',
        status: st,
        note: rec.note,
      });
    }
  });

  const scheduled = dayH + dayT + dayS + dayI + dayDL + dayC + dayTK + dayLP + dayPS;
  const dutyPresent = dayH + dayT + dayPS + dayDL;
  const dailyRate = scheduled > 0 ? Math.round((dutyPresent / scheduled) * 100) : 100;

  // Handler to download daily PDF
  const handleDownloadPDF = () => {
    if (onDownloadDailyPDF) {
      onDownloadDailyPDF(selectedDateStr);
      return;
    }

    if (!settings) return;
    setIsExporting(true);
    try {
      exportDailyAttendanceToPDF({
        dateStr: selectedDateStr,
        sections,
        employees,
        attendance,
        period,
        settings,
      });
    } catch (err) {
      console.error('Failed to export daily PDF', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Section breakdown for dashboard
  const sectionBreakdown = sortedSections.map((sec, idx) => {
    const secEmployees = employees.filter((e) => e.sectionId === sec.id);
    let sH = 0,
      sT = 0,
      sS = 0,
      sI = 0,
      sDL = 0,
      sC = 0,
      sTK = 0,
      sLP = 0,
      sPS = 0,
      sLB = 0;

    secEmployees.forEach((emp) => {
      const st = getRecord(emp.id).status;
      if (st === '✓') sH++;
      else if (st === 'T') sT++;
      else if (st === 'S') sS++;
      else if (st === 'I') sI++;
      else if (st === 'DL') sDL++;
      else if (st === 'C') sC++;
      else if (st === 'TK') sTK++;
      else if (st === 'LP') sLP++;
      else if (st === 'PS') sPS++;
      else if (st === 'LB') sLB++;
    });

    const secSched = sH + sT + sS + sI + sDL + sC + sTK + sLP + sPS;
    const secDuty = sH + sT + sPS + sDL;
    const secRate = secSched > 0 ? Math.round((secDuty / secSched) * 100) : 100;

    const absenceInfo = getDailySectionAbsenceDetails(
      sec.id,
      employees,
      attendance,
      selectedDateStr,
      selectedCol?.isWeekend
    );

    return {
      order: idx + 1,
      id: sec.id,
      name: sec.name,
      total: secEmployees.length,
      h: sH,
      t: sT,
      s: sS,
      i: sI,
      dl: sDL,
      c: sC,
      tk: sTK,
      lp: sLP,
      ps: sPS,
      lb: sLB,
      rate: secRate,
      absenceInfo,
    };
  });

  return (
    <div className="space-y-6">
      {/* Top Date Switcher Bar & Mode Navigation */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>Pilih Tanggal Apel Dalam Periode 10 Hari:</span>
          </div>

          {/* Sub-tab view toggle: Dashboard vs Roll Call */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start sm:self-auto">
            <button
              onClick={() => setActiveSubTab('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'dashboard'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard Rekap Harian</span>
            </button>

            <button
              onClick={() => setActiveSubTab('rollcall')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeSubTab === 'rollcall'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" />
              <span>Input Apel Pegawai</span>
            </button>
          </div>
        </div>

        {/* Date Selector Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {dateColumns.map((d) => {
            const isSelected = d.dateStr === selectedDateStr;
            return (
              <button
                key={d.dateStr}
                onClick={() => setSelectedDateStr(d.dateStr)}
                className={`flex-shrink-0 px-3 py-2 rounded-xl text-center min-w-16 transition-all border ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md font-bold scale-102'
                    : d.isWeekend
                    ? 'bg-rose-50/60 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/40 hover:bg-rose-100'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="text-[11px] font-medium opacity-80">{d.dayName}</div>
                <div className="text-base font-extrabold">{d.dayNum}</div>
              </button>
            );
          })}
        </div>

        {/* Selected Date Summary & Direct Download Action */}
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>
              Laporan Tanggal: {selectedCol?.dayNum} ({selectedCol?.dayName}) {selectedCol?.isWeekend && '• (Hari Libur)'}
            </span>
            <span className="text-slate-400 font-normal">| {employees.length} Total Personel</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                if (onOpenGoogleDriveUpload) {
                  onOpenGoogleDriveUpload(selectedDateStr);
                } else {
                  setIsLocalDriveModalOpen(true);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 font-bold rounded-lg text-xs shadow-xs transition-all active:scale-95"
              title="Unggah laporan rekap harian tanggal ini langsung ke Google Drive"
            >
              <CloudUpload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Simpan ke Google Drive</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shadow-xs transition-all active:scale-95 disabled:opacity-50"
              title="Unduh laporan rekapitulasi apel tanggal ini dalam format PDF resmi (jsPDF)"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Membuat PDF...' : 'Unduh Laporan Harian PDF (.pdf)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: DASHBOARD REKAPAN HARIAN */}
      {activeSubTab === 'dashboard' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Top KPI Cards for the Day */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1.5 text-[11px] font-semibold uppercase">
                <span>Total Personel</span>
                <Users className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
                {employees.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Dalam {sections.length} Seksi / Unit
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1.5 text-[11px] font-semibold uppercase">
                <span>Tingkat Hadir</span>
                <Award className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {dailyRate}%
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {dayH + dayPS + dayDL} dari {scheduled} Personel Dinas
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1.5 text-[11px] font-semibold uppercase">
                <span>Hadir Apel (✓)</span>
                <CheckCircle className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {dayH}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Tercatat Hadir Lengkap
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1.5 text-[11px] font-semibold uppercase">
                <span>Piket Jaga</span>
                <Shield className="w-4 h-4 text-teal-600" />
              </div>
              <div className="text-2xl font-black text-slate-800 dark:text-slate-200">
                {dayLP + dayPS}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                <span className="text-teal-600 font-semibold">{dayLP} LP</span> •{' '}
                <span className="text-blue-600 font-semibold">{dayPS} PS</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1.5 text-[11px] font-semibold uppercase">
                <span>Sakit & Izin</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {dayS + dayI}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {dayS} Sakit • {dayI} Izin Resmi
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-1.5 text-[11px] font-semibold uppercase">
                <span>Cuti, DL, TK</span>
                <ShieldAlert className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
                {dayC + dayDL + dayTK}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {dayDL} DL • {dayC} Cuti • {dayTK} TK
              </div>
            </div>
          </div>

          {/* Legend matching filling application */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 shadow-xs flex flex-wrap items-center gap-2 text-xs">
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

          {/* Table 1: Section Breakdown for Today */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-extrabold text-xs uppercase tracking-wide text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>I. Rekapitulasi Apel Per Seksi / Bagian</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Distribusi kehadiran pegawai pada tanggal {selectedCol?.dayNum} ({selectedCol?.dayName})
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (onOpenGoogleDriveUpload) {
                      onOpenGoogleDriveUpload(selectedDateStr);
                    } else {
                      setIsLocalDriveModalOpen(true);
                    }
                  }}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                  title="Simpan rekap harian ke Google Drive"
                >
                  <CloudUpload className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Drive</span>
                </button>
                <button
                  onClick={handleDownloadPDF}
                  disabled={isExporting}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Cetak PDF Tabel Ini</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2.5 px-3 w-10 text-center font-bold">No</th>
                    <th className="py-2.5 px-4 font-bold min-w-44">Nama Seksi / Unit</th>
                    <th className="py-2.5 px-3 text-center font-bold">Jumlah</th>
                    <th className="py-2.5 px-2.5 text-center font-bold text-emerald-700 dark:text-emerald-400">Hadir (✓)</th>
                    <th className="py-2.5 px-2.5 text-center font-bold text-orange-700 dark:text-orange-400">T</th>
                    <th className="py-2.5 px-2.5 text-center font-bold text-teal-700 dark:text-teal-400">LP</th>
                    <th className="py-2.5 px-2.5 text-center font-bold text-blue-700 dark:text-blue-400">PS</th>
                    <th className="py-2.5 px-2.5 text-center font-bold text-purple-700 dark:text-purple-400">DL</th>
                    <th className="py-2.5 px-2.5 text-center font-bold text-amber-700 dark:text-amber-400">S</th>
                    <th className="py-2.5 px-2.5 text-center font-bold text-sky-700 dark:text-sky-400">I</th>
                    <th className="py-2.5 px-2.5 text-center font-bold text-indigo-700 dark:text-indigo-400">C</th>
                    <th className="py-2.5 px-2.5 text-center font-bold text-rose-700 dark:text-rose-400">TK</th>
                    <th className="py-2.5 px-2.5 text-center font-bold text-slate-500">LB</th>
                    <th className="py-2.5 px-3 text-center font-bold min-w-28">% Kehadiran</th>
                    <th className="py-2.5 px-3 font-bold min-w-60 text-left">Pegawai Tidak Hadir (Nama & Keterangan)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {sectionBreakdown.map((sec) => (
                    <tr key={sec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 text-center font-semibold text-slate-400">
                        {sec.order}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200 uppercase">
                        {sec.name}
                      </td>
                      <td className="py-2.5 px-3 text-center font-semibold">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                          {sec.total}
                        </span>
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-bold text-emerald-700 dark:text-emerald-400">
                        {sec.h}
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-semibold text-orange-700 dark:text-orange-400">
                        {sec.t}
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-semibold text-teal-700 dark:text-teal-400">
                        {sec.lp}
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-semibold text-blue-700 dark:text-blue-400">
                        {sec.ps}
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-semibold text-purple-700 dark:text-purple-400">
                        {sec.dl}
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-semibold text-amber-700 dark:text-amber-400">
                        {sec.s}
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-semibold text-sky-700 dark:text-sky-400">
                        {sec.i}
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-semibold text-indigo-700 dark:text-indigo-400">
                        {sec.c}
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-semibold text-rose-700 dark:text-rose-400">
                        {sec.tk}
                      </td>
                      <td className="py-2.5 px-2.5 text-center font-semibold text-slate-400">
                        {sec.lb}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                sec.rate >= 90
                                  ? 'bg-emerald-500'
                                  : sec.rate >= 75
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${sec.rate}%` }}
                            />
                          </div>
                          <span className="font-bold text-[11px] w-9 text-right text-slate-700 dark:text-slate-300">
                            {sec.rate}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        {sec.absenceInfo.items.length === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60">
                            <Check className="w-3 h-3" />
                            Nihil (Hadir Semua)
                          </span>
                        ) : (
                          <div className="flex flex-col gap-1 py-0.5">
                            {sec.absenceInfo.items.map((item, aIdx) => {
                              const conf = STATUS_CONFIG[item.status];
                              return (
                                <div key={aIdx} className="flex items-center gap-1.5 flex-wrap text-[11px] leading-tight">
                                  <span className="font-bold text-slate-800 dark:text-slate-100">{item.employee.name}</span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded font-bold text-[10px] border ${conf?.bgClass || 'bg-slate-100 text-slate-700'} ${conf?.borderClass || 'border-slate-300'}`}
                                    title={conf?.description}
                                  >
                                    {item.status} - {item.statusLabel}
                                  </span>
                                  {item.note && (
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 italic bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                                      "{item.note}"
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}

                  {/* Grand Total Row */}
                  <tr className="bg-slate-100/90 dark:bg-slate-800/90 font-extrabold text-slate-900 dark:text-slate-100 border-t-2 border-slate-300 dark:border-slate-600">
                    <td className="py-3 px-3 text-center"></td>
                    <td className="py-3 px-4 uppercase tracking-wider">TOTAL KESELURUHAN</td>
                    <td className="py-3 px-3 text-center font-black text-indigo-600 dark:text-indigo-400">
                      {employees.length}
                    </td>
                    <td className="py-3 px-2.5 text-center text-emerald-700 dark:text-emerald-400">{dayH}</td>
                    <td className="py-3 px-2.5 text-center text-orange-700 dark:text-orange-400">{dayT}</td>
                    <td className="py-3 px-2.5 text-center text-teal-700 dark:text-teal-400">{dayLP}</td>
                    <td className="py-3 px-2.5 text-center text-blue-700 dark:text-blue-400">{dayPS}</td>
                    <td className="py-3 px-2.5 text-center text-purple-700 dark:text-purple-400">{dayDL}</td>
                    <td className="py-3 px-2.5 text-center text-amber-700 dark:text-amber-400">{dayS}</td>
                    <td className="py-3 px-2.5 text-center text-sky-700 dark:text-sky-400">{dayI}</td>
                    <td className="py-3 px-2.5 text-center text-indigo-700 dark:text-indigo-400">{dayC}</td>
                    <td className="py-3 px-2.5 text-center text-rose-700 dark:text-rose-400">{dayTK}</td>
                    <td className="py-3 px-2.5 text-center text-slate-500">{dayLB}</td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-block px-2.5 py-1 bg-emerald-600 text-white rounded-md text-xs font-black">
                        {dailyRate}% Hadir
                      </span>
                    </td>
                    <td className="py-3 px-3 text-left">
                      {exceptions.length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                          <Check className="w-3.5 h-3.5" />
                          Nihil (Seluruh Personel Hadir)
                        </span>
                      ) : (
                        <span className="font-bold text-rose-700 dark:text-rose-400 text-xs">
                          Total {exceptions.length} Personel Tidak Hadir / Khusus
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 2: Details of Employees with Special Status / Notes - GROUPED PER SEKSI */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-xs uppercase tracking-wide text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>II. Rincian Keterangan Selain Hadir (✓) Per Seksi / Bagian</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                    {exceptions.length} Personel
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Daftar personel dengan keterangan dinas/khusus (LP, PS, DL, Sakit, Izin, Cuti, TK) dikelompokkan menurut seksi kerja
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800 text-[11px]">
                  <button
                    onClick={() => setExceptionViewMode('bySection')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                      exceptionViewMode === 'bySection'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Per Seksi
                  </button>
                  <button
                    onClick={() => setExceptionViewMode('flat')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                      exceptionViewMode === 'flat'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Tabel Lengkap
                  </button>
                </div>

                <button
                  onClick={() => setActiveSubTab('rollcall')}
                  className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                  + Isi / Ubah Keterangan
                </button>
              </div>
            </div>

            {exceptions.length === 0 ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="font-bold text-slate-700 dark:text-slate-300">
                  Seluruh Personel Hadir Apel Lengkap
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Tidak ada pegawai yang tercatat izin, sakit, cuti, dinas luar, atau dispensasi pada tanggal ini.
                </p>
              </div>
            ) : exceptionViewMode === 'bySection' ? (
              /* Grouped Per Seksi View */
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {sortedSections.map((sec) => {
                  const secExceptions = exceptions.filter((e) => e.sectionId === sec.id);
                  const secTotal = employees.filter((e) => e.sectionId === sec.id).length;

                  if (secExceptions.length === 0) {
                    return (
                      <div
                        key={sec.id}
                        className="px-5 py-2.5 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700 dark:text-slate-300 uppercase">
                            {sec.name}
                          </span>
                          <span className="text-[11px] text-slate-400">({secTotal} Personel)</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                          <Check className="w-3.5 h-3.5" />
                          <span>100% Hadir Lengkap (0 Keterangan Khusus)</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={sec.id} className="p-4 sm:p-5">
                      {/* Section Card Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2.5">
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                          <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100">
                            SEKSI: {sec.name}
                          </h4>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            {secExceptions.length} Pegawai Selain Hadir
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500">
                          Total {secTotal} Personel dalam Seksi ini
                        </div>
                      </div>

                      {/* Section Exceptions Table */}
                      <div className="overflow-x-auto mt-2.5">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                              <th className="py-2 px-3 w-10 text-center font-bold">No</th>
                              <th className="py-2 px-4 font-bold min-w-48">Nama Pegawai</th>
                              <th className="py-2 px-4 font-bold min-w-36">Jabatan</th>
                              <th className="py-2 px-3 text-center font-bold min-w-28">Status Kehadiran</th>
                              <th className="py-2 px-4 font-bold">Alasan / Catatan Dokumen</th>
                              <th className="py-2 px-3 text-center font-bold w-16">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                            {secExceptions.map((item, idx) => {
                              const conf = STATUS_CONFIG[item.status] || STATUS_CONFIG['✓'];
                              return (
                                <tr
                                  key={item.emp.id}
                                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                                >
                                  <td className="py-2.5 px-3 text-center font-semibold text-slate-400">
                                    {idx + 1}
                                  </td>
                                  <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                                    {item.emp.name}
                                  </td>
                                  <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                                    {item.emp.position || '-'}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span
                                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-bold text-xs border shadow-2xs ${conf.bgClass} ${conf.borderClass}`}
                                      title={conf.description}
                                    >
                                      <span>{conf.shortLabel}</span>
                                      <span className="text-[10px] font-normal">({conf.label})</span>
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                                    {item.note ? (
                                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                                        {item.note}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 italic">
                                        {conf.description}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <button
                                      onClick={() => setNotePopup({ emp: item.emp, note: item.note || '' })}
                                      className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                      title="Ubah catatan / keterangan"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Flat Table View */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                      <th className="py-2.5 px-3 w-10 text-center font-bold">No</th>
                      <th className="py-2.5 px-4 font-bold min-w-44">Nama Pegawai</th>
                      <th className="py-2.5 px-4 font-bold">Bagian / Seksi</th>
                      <th className="py-2.5 px-3 text-center font-bold">Status</th>
                      <th className="py-2.5 px-4 font-bold">Alasan / Catatan Dokumen</th>
                      <th className="py-2.5 px-3 text-center font-bold w-14">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {exceptions.map((item, idx) => {
                      const conf = STATUS_CONFIG[item.status] || STATUS_CONFIG['✓'];
                      return (
                        <tr key={item.emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3 text-center font-semibold text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                              {item.emp.name}
                            </div>
                            {item.emp.position && (
                              <div className="text-[10px] text-slate-500">
                                {item.emp.position}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-slate-700 dark:text-slate-300 uppercase">
                            {item.sectionName}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-md font-bold text-xs border ${conf.bgClass} ${conf.borderClass}`}
                            >
                              {conf.shortLabel} - {conf.label}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 font-medium">
                            {item.note || <span className="text-slate-400 italic">Sesuai penugasan / jadwal</span>}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              onClick={() => setNotePopup({ emp: item.emp, note: item.note || '' })}
                              className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                              title="Ubah catatan"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: INTERACTIVE ROLL CALL LIST */}
      {activeSubTab === 'rollcall' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {sections.map((sec) => {
            const secEmployees = employees.filter((e) => e.sectionId === sec.id);

            return (
              <div
                key={sec.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs"
              >
                {/* Section Header */}
                <div className="px-5 py-3 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-xs uppercase tracking-wide text-slate-800 dark:text-slate-100">
                      {sec.name}
                    </span>
                    <span className="text-[11px] bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-semibold">
                      {secEmployees.length} Orang
                    </span>
                  </div>

                  <button
                    onClick={() => onBatchSectionStatusForDate(sec.id, selectedDateStr, '✓')}
                    className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-700 hover:bg-emerald-50 text-slate-700 dark:text-slate-200 hover:text-emerald-700 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-600 shadow-2xs transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Set Semua Hadir (✓)</span>
                  </button>
                </div>

                {/* Employee Rows */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {secEmployees.map((emp, idx) => {
                    const rec = getRecord(emp.id);
                    const currStatus = rec.status;

                    return (
                      <div
                        key={emp.id}
                        className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 text-center text-xs font-bold text-slate-400">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                              {emp.name}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {emp.position || 'Pegawai'}{' '}
                              {rec.note && <span className="text-indigo-600 font-semibold">• {rec.note}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Status Selector Buttons */}
                        <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-auto">
                          {ACTIVE_STATUS_CODES.map((st) => {
                            const conf = STATUS_CONFIG[st];
                            const isActive = currStatus === st;

                            return (
                              <button
                                key={st}
                                onClick={() => onUpdateStatus(emp.id, selectedDateStr, st, rec.note)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                                  isActive
                                    ? `${conf.bgClass} ${conf.borderClass} ring-2 ring-indigo-500 shadow-xs scale-105`
                                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                }`}
                                title={conf.description}
                              >
                                {conf.shortLabel}
                              </button>
                            );
                          })}

                          {/* Note Button */}
                          <button
                            onClick={() => setNotePopup({ emp, note: rec.note || '' })}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              rec.note
                                ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                                : 'text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-600'
                            }`}
                            title="Tambah / Ubah Catatan"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Note modal */}
      {notePopup && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-sm w-full shadow-xl">
            <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 mb-1">
              Catatan Apel: {notePopup.emp.name}
            </h4>
            <p className="text-[11px] text-slate-500 mb-3">Tanggal {selectedDateStr}</p>
            <input
              type="text"
              value={notePopup.note}
              onChange={(e) => setNotePopup({ ...notePopup, note: e.target.value })}
              placeholder="Keterangan dinas luar / surat dokter..."
              className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setNotePopup(null)}
                className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  const rec = getRecord(notePopup.emp.id);
                  onUpdateStatus(notePopup.emp.id, selectedDateStr, rec.status, notePopup.note);
                  setNotePopup(null);
                }}
                className="px-4 py-1.5 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standalone Google Drive Upload Modal if settings provided and not handled by parent */}
      {settings && (
        <GoogleDriveUploadModal
          isOpen={isLocalDriveModalOpen}
          onClose={() => setIsLocalDriveModalOpen(false)}
          sections={sections}
          employees={employees}
          attendance={attendance}
          period={period}
          settings={settings}
          defaultFileType="dailyPdf"
          initialDailyDate={selectedDateStr}
        />
      )}
    </div>
  );
};
