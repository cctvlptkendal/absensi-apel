import React, { useState } from 'react';
import {
  Employee,
  Section,
  AttendanceRecord,
  AttendanceStatus,
  PeriodConfig,
  STATUS_CONFIG,
  ACTIVE_STATUS_CODES,
  getEffectiveAttendanceRecord,
} from '../types/attendance';

import { getDateColumns } from '../utils/excelExporter';
import { UserPlus, Trash2, Edit3, MessageSquare, Check, Sparkles, AlertCircle } from 'lucide-react';

interface AttendanceMatrixProps {
  sections: Section[];
  employees: Employee[];
  attendance: Record<string, AttendanceRecord>;
  period: PeriodConfig;
  searchQuery: string;
  selectedSectionFilter: string;
  onUpdateStatus: (employeeId: string, dateStr: string, status: AttendanceStatus, note?: string) => void;
  onBatchSectionStatus: (sectionId: string, status: AttendanceStatus) => void;
  onBatchColumnStatus: (dateStr: string, status: AttendanceStatus) => void;
  onOpenAddEmployee: (sectionId?: string) => void;
  onOpenEditEmployee: (employee: Employee) => void;
  onDeleteEmployee: (employee: Employee) => void;
}

export const AttendanceMatrix: React.FC<AttendanceMatrixProps> = ({
  sections,
  employees,
  attendance,
  period,
  searchQuery,
  selectedSectionFilter,
  onUpdateStatus,
  onBatchSectionStatus,
  onBatchColumnStatus,
  onOpenAddEmployee,
  onOpenEditEmployee,
  onDeleteEmployee,
}) => {
  const dateColumns = getDateColumns(period);
  const [activeCell, setActiveCell] = useState<{ empId: string; dateStr: string } | null>(null);
  const [noteModal, setNoteModal] = useState<{ emp: Employee; dateStr: string; note: string; status: AttendanceStatus } | null>(null);

  const statusCycle: AttendanceStatus[] = ['✓', 'S', 'I', 'DL', 'C', 'TK', 'LP', 'PS', 'LB'];

  const getRecord = (empId: string, dateStr: string, isWeekend: boolean): AttendanceRecord => {
    return getEffectiveAttendanceRecord(attendance, empId, dateStr, isWeekend);
  };


  const handleCellClick = (empId: string, dateStr: string, isWeekend: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    const curr = getRecord(empId, dateStr, isWeekend);
    const currIdx = statusCycle.indexOf(curr.status);
    const nextStatus = statusCycle[(currIdx + 1) % statusCycle.length];
    onUpdateStatus(empId, dateStr, nextStatus, curr.note);
  };

  const handleCellRightClick = (empId: string, dateStr: string, isWeekend: boolean, e: React.MouseEvent) => {
    e.preventDefault();
    setActiveCell({ empId, dateStr });
  };

  const handleSaveNote = () => {
    if (noteModal) {
      onUpdateStatus(noteModal.emp.id, noteModal.dateStr, noteModal.status, noteModal.note);
      setNoteModal(null);
    }
  };

  const filteredSections = sections
    .filter(s => selectedSectionFilter === 'ALL' || s.id === selectedSectionFilter)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
      {/* Legend & Guide Bar */}
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
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

        <div className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-3">
          <span>💡 <strong>Klik sel</strong> untuk mengganti status | <strong>Klik kanan / Ikon Catatan</strong> untuk isi alasan</span>
        </div>
      </div>

      {/* Main Table Scroll Area */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
              <th className="py-2.5 px-3 w-12 text-center font-bold sticky left-0 z-20 bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
                No
              </th>
              <th className="py-2.5 px-4 min-w-56 font-bold sticky left-12 z-20 bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
                Seksi / Nama Pegawai
              </th>

              {/* 10 Date Columns */}
              {dateColumns.map((d) => (
                <th
                  key={d.dateStr}
                  className={`py-2 px-2 text-center min-w-11 border-r border-slate-200 dark:border-slate-700 font-semibold group relative ${
                    d.isWeekend ? 'bg-rose-50/70 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400' : ''
                  }`}
                >
                  <div className="text-sm font-bold">{d.dayNum}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">{d.dayName}</div>
                  {/* Quick button to set entire column Hadir */}
                  <button
                    onClick={() => onBatchColumnStatus(d.dateStr, '✓')}
                    title={`Set semua tanggal ${d.dayNum} jadi Hadir (✓)`}
                    className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-1 right-0 text-[9px] bg-emerald-600 text-white rounded px-1 shadow-xs"
                  >
                    All ✓
                  </button>
                </th>
              ))}

              {/* Summary Columns */}
              <th className="py-2.5 px-2 text-center w-9 font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-r border-slate-200 dark:border-slate-700" title="Total Hadir (✓)">
                ✓
              </th>
              <th className="py-2.5 px-2 text-center w-9 font-bold bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-r border-slate-200 dark:border-slate-700" title="Total Sakit (S)">
                S
              </th>
              <th className="py-2.5 px-2 text-center w-9 font-bold bg-sky-50 dark:bg-sky-950/30 text-sky-800 dark:text-sky-300 border-r border-slate-200 dark:border-slate-700" title="Total Izin (I)">
                I
              </th>
              <th className="py-2.5 px-2 text-center w-9 font-bold bg-purple-50 dark:bg-purple-950/30 text-purple-800 dark:text-purple-300 border-r border-slate-200 dark:border-slate-700" title="Total Dinas Luar (DL)">
                DL
              </th>
              <th className="py-2.5 px-2 text-center w-9 font-bold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-300 border-r border-slate-200 dark:border-slate-700" title="Total Cuti (C)">
                C
              </th>
              <th className="py-2.5 px-2 text-center w-9 font-bold bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border-r border-slate-200 dark:border-slate-700" title="Total Tanpa Keterangan (TK)">
                TK
              </th>
              <th className="py-2.5 px-2 text-center w-9 font-bold bg-teal-50 dark:bg-teal-950/30 text-teal-800 dark:text-teal-300 border-r border-slate-200 dark:border-slate-700" title="Total Lepas Piket (LP)">
                LP
              </th>
              <th className="py-2.5 px-2 text-center w-9 font-bold bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 border-r border-slate-200 dark:border-slate-700" title="Total Piket Siang (PS)">
                PS
              </th>
              <th className="py-2.5 px-2 text-center w-14 font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700">
                %
              </th>
              <th className="py-2.5 px-3 min-w-44 font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                Keterangan
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredSections.map((section) => {
              const secEmployees = employees
                .filter(e => e.sectionId === section.id)
                .filter(e => {
                  if (!searchQuery) return true;
                  const q = searchQuery.toLowerCase();
                  return e.name.toLowerCase().includes(q) || (e.position && e.position.toLowerCase().includes(q));
                })
                .sort((a, b) => a.order - b.order);

              return (
                <React.Fragment key={section.id}>
                  {/* Section Divider Header */}
                  <tr className="bg-slate-200/80 dark:bg-slate-800/90 border-y border-slate-300 dark:border-slate-700">
                    <td colSpan={2 + dateColumns.length + 10} className="py-2 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-extrabold tracking-wider text-slate-800 dark:text-slate-100 text-xs uppercase">
                            {section.name}
                          </span>
                          <span className="bg-white/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] px-2 py-0.5 rounded-full font-semibold border border-slate-300 dark:border-slate-600">
                            {secEmployees.length} Personel
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onBatchSectionStatus(section.id, '✓')}
                            className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-md text-[11px] font-medium transition-colors shadow-2xs"
                            title="Tandai semua anggota di seksi ini Hadir (✓)"
                          >
                            <Sparkles className="w-3 h-3 text-emerald-600" />
                            <span>Set Seksi Ini Hadir</span>
                          </button>
                          <button
                            onClick={() => onOpenAddEmployee(section.id)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[11px] font-medium transition-colors shadow-2xs"
                          >
                            <UserPlus className="w-3 h-3" />
                            <span>+ Tambah Orang</span>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* Employees in this section */}
                  {secEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={2 + dateColumns.length + 10} className="py-4 text-center text-slate-400 italic">
                        Belum ada pegawai di bagian ini. Klik "+ Tambah Orang" untuk menambahkan.
                      </td>
                    </tr>
                  ) : (
                    secEmployees.map((emp, index) => {
                      let hCount = 0;
                      let sCount = 0;
                      let iCount = 0;
                      let dlCount = 0;
                      let cCount = 0;
                      let tkCount = 0;
                      let lpCount = 0;
                      let psCount = 0;
                      const empNotes: string[] = [];

                      return (
                        <tr
                          key={emp.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 border-b border-slate-200/70 dark:border-slate-800 transition-colors group"
                        >
                          {/* Number */}
                          <td className="py-2 px-2 text-center text-slate-500 font-medium sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/40 border-r border-slate-200 dark:border-slate-700">
                            {index + 1}
                          </td>

                          {/* Name & Actions */}
                          <td className="py-2 px-3 sticky left-12 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/40 border-r border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                                  {emp.name}
                                </div>
                                {emp.position && (
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                    {emp.position}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => onOpenEditEmployee(emp)}
                                  className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                                  title="Ubah data pegawai"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => onDeleteEmployee(emp)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                  title="Kurangi / Hapus orang dari bagian ini"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </td>

                          {/* 10 Date Attendance Cells */}
                          {dateColumns.map((d) => {
                            const rec = getRecord(emp.id, d.dateStr, d.isWeekend);
                            const st = rec.status;
                            if (st === '✓' || st === 'H') hCount++;
                            else if (st === 'S') sCount++;
                            else if (st === 'I') iCount++;
                            else if (st === 'DL') dlCount++;
                            else if (st === 'C') cCount++;
                            else if (st === 'TK') tkCount++;
                            else if (st === 'LP') lpCount++;
                            else if (st === 'PS') psCount++;

                            if (rec.note) {
                              empNotes.push(`${d.dayNum}: ${rec.note}`);
                            }

                            const conf = STATUS_CONFIG[st];

                            return (
                              <td
                                key={d.dateStr}
                                onClick={(e) => handleCellClick(emp.id, d.dateStr, d.isWeekend, e)}
                                onContextMenu={(e) => handleCellRightClick(emp.id, d.dateStr, d.isWeekend, e)}
                                className={`p-1 text-center border-r border-slate-200/80 dark:border-slate-700/80 cursor-pointer select-none transition-transform active:scale-90 relative ${
                                  d.isWeekend ? 'bg-slate-50/50 dark:bg-slate-900/40' : ''
                                }`}
                                title={`Tgl ${d.dayNum} ${d.dayName}: ${conf.label}${rec.note ? ` (${rec.note})` : ''} - Klik untuk ubah`}
                              >
                                <div
                                  className={`h-7 w-full flex items-center justify-center rounded-md font-bold text-xs border ${conf.bgClass} ${conf.borderClass} relative`}
                                >
                                  <span>{conf.shortLabel}</span>
                                  {rec.note && (
                                    <span
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setNoteModal({ emp, dateStr: d.dateStr, note: rec.note || '', status: st });
                                      }}
                                      className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-600 rounded-full border border-white"
                                      title={`Catatan: ${rec.note}`}
                                    />
                                  )}
                                </div>
                              </td>
                            );
                          })}

                          {/* Summary counts */}
                          <td className="py-2 px-1 text-center font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20 border-r border-slate-200 dark:border-slate-700">
                            {hCount}
                          </td>
                          <td className="py-2 px-1 text-center font-bold text-amber-700 dark:text-amber-400 bg-amber-50/40 dark:bg-amber-950/20 border-r border-slate-200 dark:border-slate-700">
                            {sCount}
                          </td>
                          <td className="py-2 px-1 text-center font-bold text-sky-700 dark:text-sky-400 bg-sky-50/40 dark:bg-sky-950/20 border-r border-slate-200 dark:border-slate-700">
                            {iCount}
                          </td>
                          <td className="py-2 px-1 text-center font-bold text-purple-700 dark:text-purple-400 bg-purple-50/40 dark:bg-purple-950/20 border-r border-slate-200 dark:border-slate-700">
                            {dlCount}
                          </td>
                          <td className="py-2 px-1 text-center font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20 border-r border-slate-200 dark:border-slate-700">
                            {cCount}
                          </td>
                          <td className="py-2 px-1 text-center font-bold text-rose-700 dark:text-rose-400 bg-rose-50/40 dark:bg-rose-950/20 border-r border-slate-200 dark:border-slate-700">
                            {tkCount}
                          </td>
                          <td className="py-2 px-1 text-center font-bold text-teal-700 dark:text-teal-400 bg-teal-50/40 dark:bg-teal-950/20 border-r border-slate-200 dark:border-slate-700">
                            {lpCount}
                          </td>
                          <td className="py-2 px-1 text-center font-bold text-blue-700 dark:text-blue-400 bg-blue-50/40 dark:bg-blue-950/20 border-r border-slate-200 dark:border-slate-700">
                            {psCount}
                          </td>

                          {/* % Rate */}
                          {(() => {
                            const scheduledDays = hCount + sCount + iCount + dlCount + cCount + tkCount + lpCount + psCount;
                            const dutyPresent = hCount + psCount + dlCount;
                            const rate = scheduledDays > 0 ? Math.round((dutyPresent / scheduledDays) * 100) : 100;
                            return (
                              <td className="py-2 px-1 text-center font-bold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[11px] ${
                                    rate >= 90
                                      ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60'
                                      : rate >= 75
                                      ? 'text-amber-700 bg-amber-100 dark:bg-amber-950/60'
                                      : 'text-rose-700 bg-rose-100 dark:bg-rose-950/60'
                                  }`}
                                >
                                  {rate}%
                                </span>
                              </td>
                            );
                          })()}

                          {/* Keterangan Column */}
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-400 text-[11px]">
                            {empNotes.length > 0 ? (
                              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                                <MessageSquare className="w-3 h-3 text-indigo-500 shrink-0" />
                                <span className="truncate max-w-xs">{empNotes.join('; ')}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/90 font-bold text-xs">
            {/* Daily Hadir Total Row */}
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <td colSpan={2} className="py-2.5 px-4 text-slate-800 dark:text-slate-100 uppercase tracking-wide font-extrabold sticky left-0 z-10 bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
                Total Hadir (✓) Harian
              </td>
              {dateColumns.map((d) => {
                const dayH = employees.filter((e) => {
                  const rec = getRecord(e.id, d.dateStr, d.isWeekend);
                  return rec.status === '✓';
                }).length;

                return (
                  <td
                    key={d.dateStr}
                    className="py-2 px-1 text-center font-black text-emerald-700 dark:text-emerald-400 border-r border-slate-200 dark:border-slate-700"
                    title={`Total Hadir Apel tanggal ${d.dayNum}: ${dayH} orang`}
                  >
                    {dayH}
                  </td>
                );
              })}
              {/* Overall Sums for each status */}
              {(() => {
                let gH = 0, gS = 0, gI = 0, gDL = 0, gC = 0, gTK = 0, gLP = 0, gPS = 0;
                employees.forEach((e) => {
                  dateColumns.forEach((d) => {
                    const rec = getRecord(e.id, d.dateStr, d.isWeekend);
                    const st = rec.status;
                    if (st === '✓') gH++;
                    else if (st === 'S') gS++;
                    else if (st === 'I') gI++;
                    else if (st === 'DL') gDL++;
                    else if (st === 'C') gC++;
                    else if (st === 'TK') gTK++;
                    else if (st === 'LP') gLP++;
                    else if (st === 'PS') gPS++;
                  });
                });
                const totalActive = gH + gS + gI + gDL + gC + gTK + gLP + gPS;
                const dutyPresent = gH + gPS + gDL;
                const totalRate = totalActive > 0 ? Math.round((dutyPresent / totalActive) * 100) : 100;

                return (
                  <>
                    <td className="py-2 px-1 text-center text-emerald-700 dark:text-emerald-400 border-r border-slate-200 dark:border-slate-700 font-black">{gH}</td>
                    <td className="py-2 px-1 text-center text-amber-700 dark:text-amber-400 border-r border-slate-200 dark:border-slate-700 font-bold">{gS}</td>
                    <td className="py-2 px-1 text-center text-sky-700 dark:text-sky-400 border-r border-slate-200 dark:border-slate-700 font-bold">{gI}</td>
                    <td className="py-2 px-1 text-center text-purple-700 dark:text-purple-400 border-r border-slate-200 dark:border-slate-700 font-bold">{gDL}</td>
                    <td className="py-2 px-1 text-center text-indigo-700 dark:text-indigo-400 border-r border-slate-200 dark:border-slate-700 font-bold">{gC}</td>
                    <td className="py-2 px-1 text-center text-rose-700 dark:text-rose-400 border-r border-slate-200 dark:border-slate-700 font-bold">{gTK}</td>
                    <td className="py-2 px-1 text-center text-teal-700 dark:text-teal-400 border-r border-slate-200 dark:border-slate-700 font-bold">{gLP}</td>
                    <td className="py-2 px-1 text-center text-blue-700 dark:text-blue-400 border-r border-slate-200 dark:border-slate-700 font-bold">{gPS}</td>
                    <td className="py-2 px-1 text-center font-black text-indigo-700 dark:text-indigo-400 border-r border-slate-200 dark:border-slate-700">{totalRate}%</td>
                    <td className="py-2 px-3 text-slate-500 text-[11px] font-normal">Sinkron dengan Rekap Harian</td>
                  </>
                );
              })()}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Note Edit Modal */}
      {noteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full shadow-xl">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-1">
              Catatan Absensi: {noteModal.emp.name}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Tanggal: {noteModal.dateStr}
            </p>

            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                Status Kehadiran:
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {ACTIVE_STATUS_CODES.map((st) => {
                  const conf = STATUS_CONFIG[st];
                  const isSelected = noteModal.status === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setNoteModal({ ...noteModal, status: st })}
                      className={`px-2 py-1.5 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1 ${
                        isSelected ? `${conf.bgClass} ring-2 ring-indigo-500` : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {conf.shortLabel} - {conf.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                Alasan / Catatan (opsional):
              </label>
              <input
                type="text"
                value={noteModal.note}
                onChange={(e) => setNoteModal({ ...noteModal, note: e.target.value })}
                placeholder="Contoh: Sakit flu, Izin urusan keluarga, Dinas luar Kanwil..."
                className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setNoteModal(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={handleSaveNote}
                className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
