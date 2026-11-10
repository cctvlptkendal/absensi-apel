import React, { useState } from 'react';
import { Section, Employee, AttendanceRecord, PeriodConfig, ExportSettings, ACTIVE_STATUS_CODES, STATUS_CONFIG } from '../types/attendance';
import {
  exportAttendanceToExcel,
  exportAttendanceToCSV,
  copyAttendanceToClipboard,
  getDateColumns,
} from '../utils/excelExporter';
import { exportAttendanceToPDF, exportDailyAttendanceToPDF } from '../utils/pdfExporter';
import { GoogleDriveUploadModal } from './GoogleDriveUploadModal';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Settings,
  Check,
  X,
  Copy,
  FileText,
  Eye,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  FileDown,
  Cloud,
  CloudUpload,
  Radio,
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sections: Section[];
  employees: Employee[];
  attendance: Record<string, AttendanceRecord>;
  period: PeriodConfig;
  settings: ExportSettings;
  onUpdateSettings: (newSettings: ExportSettings) => void;
  onOpenGoogleDriveUpload?: (fileType?: 'excel' | 'pdf' | 'dailyPdf' | 'csv') => void;
  onOpenGoogleSheetsSync?: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  sections,
  employees,
  attendance,
  period,
  settings,
  onUpdateSettings,
  onOpenGoogleDriveUpload,
  onOpenGoogleSheetsSync,
}) => {
  const [activeTab, setActiveTab] = useState<'options' | 'preview'>('options');
  const [formSettings, setFormSettings] = useState<ExportSettings>(settings);
  const [isExporting, setIsExporting] = useState(false);
  const [exportedFileName, setExportedFileName] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [drivePreselectedType, setDrivePreselectedType] = useState<'excel' | 'pdf' | 'dailyPdf' | 'csv'>('pdf');


  const dateCols = getDateColumns(period);
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>(dateCols[0]?.dateStr || period.startDate);
  const startDay = dateCols[0]?.dayNum ?? 1;
  const endDay = dateCols[dateCols.length - 1]?.dayNum ?? 10;
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const currentMonthName = monthNames[period.month] || 'November';

  const showToast = (text: string, type: 'success' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleDownloadExcel = () => {
    setIsExporting(true);
    onUpdateSettings(formSettings);

    try {
      const result = exportAttendanceToExcel({
        sections,
        employees,
        attendance,
        period,
        settings: formSettings,
      });

      setExportedFileName(result.fileName);
      showToast(`File Excel "${result.fileName}" berhasil dibuat dan diunduh!`);
    } catch (err) {
      console.error('Failed to export excel:', err);
      showToast('Gagal mengunduh Excel. Silakan gunakan tombol CSV atau Salin ke Clipboard.', 'info');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPDF = () => {
    setIsExporting(true);
    onUpdateSettings(formSettings);

    try {
      const result = exportAttendanceToPDF({
        sections,
        employees,
        attendance,
        period,
        settings: formSettings,
      });

      setExportedFileName(result.fileName);
      showToast(`File PDF "${result.fileName}" berhasil dibuat dan diunduh!`);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      showToast('Gagal membuat dokumen PDF.', 'info');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadDailyPDF = (dateStr: string) => {
    setIsExporting(true);
    onUpdateSettings(formSettings);

    try {
      const result = exportDailyAttendanceToPDF({
        dateStr,
        sections,
        employees,
        attendance,
        period,
        settings: formSettings,
      });

      setExportedFileName(result.fileName);
      showToast(`Laporan Rekap Harian PDF "${result.fileName}" berhasil diunduh!`);
    } catch (err) {
      console.error('Failed to export daily PDF:', err);
      showToast('Gagal membuat dokumen PDF harian.', 'info');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadCSV = () => {
    setIsExporting(true);
    onUpdateSettings(formSettings);

    try {
      const result = exportAttendanceToCSV({
        sections,
        employees,
        attendance,
        period,
        settings: formSettings,
      });

      setExportedFileName(result.fileName);
      showToast(`File CSV "${result.fileName}" berhasil diunduh!`);
    } catch (err) {
      console.error('Failed to export CSV:', err);
      showToast('Gagal membuat CSV.', 'info');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyToClipboard = async () => {
    onUpdateSettings(formSettings);
    const ok = await copyAttendanceToClipboard({
      sections,
      employees,
      attendance,
      period,
      settings: formSettings,
    });

    if (ok) {
      showToast('Data berhasil disalin! Anda bisa langsung buka Excel / Spreadsheet dan tekan Ctrl+V');
    } else {
      showToast('Gagal menyalin data ke clipboard.', 'info');
    }
  };

  const handlePrint = () => {
    onUpdateSettings(formSettings);
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Menu Ekspor Rekap Absensi 10 Hari
                </h2>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-bold rounded-md">
                  XLSX & CSV READY
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pilih format keluaran, atur kop instansi & penandatangan, atau pratinjau tabel
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex gap-4 text-xs font-bold">
            <button
              onClick={() => setActiveTab('options')}
              className={`py-3 border-b-2 flex items-center gap-1.5 transition-all ${
                activeTab === 'options'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Opsi & Pengaturan Ekspor</span>
            </button>

            <button
              onClick={() => setActiveTab('preview')}
              className={`py-3 border-b-2 flex items-center gap-1.5 transition-all ${
                activeTab === 'preview'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>Pratinjau Tabel Excel</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500 hidden sm:block">
            Periode: <strong>Tgl {startDay} - {endDay} {currentMonthName} {period.year}</strong>
          </div>
        </div>

        {/* Toast Alert Message */}
        {toastMessage && (
          <div className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200'
              : 'bg-indigo-50 text-indigo-800 border-b border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-200'
          }`}>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{toastMessage.text}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="opacity-70 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 text-xs">
          {activeTab === 'options' ? (
            <div className="space-y-6">
              
              {/* Daily PDF Export Banner */}
              <div className="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-extrabold uppercase">
                      Rekap Harian
                    </span>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                      Laporan Rekapitulasi Apel Harian (.pdf)
                    </h4>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-xs mt-1">
                    Cetak dokumen resmi A4 Portrait harian lengkap dengan ringkasan eksekutif, tabel per seksi, & daftar izin/sakit.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <select
                    value={selectedDailyDate}
                    onChange={(e) => setSelectedDailyDate(e.target.value)}
                    className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none"
                  >
                    {dateCols.map(d => (
                      <option key={d.dateStr} value={d.dateStr}>
                        {d.dayName}, {d.dayNum} {currentMonthName} {d.isWeekend ? '(Libur)' : ''}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => handleDownloadDailyPDF(selectedDailyDate)}
                    disabled={isExporting}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-xs flex items-center gap-1.5 transition-colors active:scale-95 disabled:opacity-50"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>Unduh PDF Harian</span>
                  </button>

                  <button
                    onClick={() => {
                      setDrivePreselectedType('dailyPdf');
                      setIsDriveModalOpen(true);
                    }}
                    className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 font-bold rounded-lg text-xs shadow-2xs flex items-center gap-1.5 transition-colors active:scale-95"
                    title="Unggah laporan harian langsung ke Google Drive"
                  >
                    <CloudUpload className="w-4 h-4 text-blue-600" />
                    <span>Simpan ke Drive</span>
                  </button>
                </div>
              </div>

              {/* Google Drive Integration Banner */}
              <div className="p-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-emerald-50 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-emerald-950/30 border border-blue-200 dark:border-blue-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
                    <CloudUpload className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                        Integrasi Google Drive & Google Picker
                      </h4>
                      <span className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold">
                        ONLINE CLOUD
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-xs mt-1">
                      Simpan dan arsipkan laporan absensi langsung ke folder Google Drive Anda secara instan menggunakan Google Picker API.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setDrivePreselectedType('pdf');
                    setIsDriveModalOpen(true);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-xs flex items-center justify-center gap-2 transition-all shrink-0"
                >
                  <CloudUpload className="w-4 h-4" />
                  <span>Buka Unggah ke Google Drive</span>
                </button>
              </div>

              {/* Google Sheets Realtime Sync Banner */}
              <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-green-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                        Sinkronisasi Realtime Google Sheets
                      </h4>
                      <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold flex items-center gap-1">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                        </span>
                        LIVE MONITOR
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 text-xs mt-1">
                      Pantau perubahan absensi secara realtime dan otomatis sinkron ke Google Spreadsheet tanpa perlu ekspor manual berkali-kali.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (onOpenGoogleSheetsSync) {
                      onOpenGoogleSheetsSync();
                    }
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-xs flex items-center justify-center gap-2 transition-all shrink-0"
                >
                  <Radio className="w-4 h-4" />
                  <span>Kelola Live Sync Sheets</span>
                </button>
              </div>

              {/* Export Action Cards (Primary Options) */}
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] mb-3">
                  Pilih Format Unduhan Rekap 10 Hari:
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Option 1: Excel .xlsx */}
                  <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border-2 border-emerald-500/80 rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-all">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2 bg-emerald-600 text-white rounded-lg">
                          <FileSpreadsheet className="w-5 h-5" />
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-extrabold rounded">
                          EXCEL
                        </span>
                      </div>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                        Microsoft Excel (.xlsx)
                      </h4>
                      <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-1">
                        Lengkap 2 Sheet (Rekap 10 Hari & Ringkasan Statistik Seksi), format rapi siap edit.
                      </p>
                    </div>

                    <div className="mt-4 space-y-2">
                      <button
                        onClick={handleDownloadExcel}
                        disabled={isExporting}
                        className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold rounded-lg transition-all shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <Download className="w-4 h-4" />
                        <span>{isExporting ? 'Memproses...' : 'Unduh Excel (.xlsx)'}</span>
                      </button>

                      <button
                        onClick={() => {
                          setDrivePreselectedType('excel');
                          setIsDriveModalOpen(true);
                        }}
                        className="w-full py-1.5 px-3 bg-white dark:bg-slate-800 hover:bg-emerald-100/60 dark:hover:bg-slate-700 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-bold rounded-lg transition-all text-[11px] flex items-center justify-center gap-1.5"
                      >
                        <CloudUpload className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Simpan ke Google Drive</span>
                      </button>
                    </div>
                  </div>

                  {/* Option 2: PDF Document (jsPDF) */}
                  <div className="bg-rose-50/70 dark:bg-rose-950/30 border-2 border-rose-500/80 rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-all">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2 bg-rose-600 text-white rounded-lg">
                          <FileDown className="w-5 h-5" />
                        </div>
                        <span className="px-2 py-0.5 bg-rose-600 text-white text-[10px] font-extrabold rounded">
                          PDF RESMI (jsPDF)
                        </span>
                      </div>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                        Dokumen PDF (.pdf)
                      </h4>
                      <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-1">
                        A4 Landscape rapi dengan kop instansi, warna badge status, lembar statistik, & pengesahan tanda tangan.
                      </p>
                    </div>

                    <div className="mt-4 space-y-2">
                      <button
                        onClick={handleDownloadPDF}
                        disabled={isExporting}
                        className="w-full py-2.5 px-3 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white font-bold rounded-lg transition-all shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <FileDown className="w-4 h-4" />
                        <span>{isExporting ? 'Memproses...' : 'Unduh PDF (.pdf)'}</span>
                      </button>

                      <button
                        onClick={() => {
                          setDrivePreselectedType('pdf');
                          setIsDriveModalOpen(true);
                        }}
                        className="w-full py-1.5 px-3 bg-white dark:bg-slate-800 hover:bg-rose-100/60 dark:hover:bg-slate-700 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700 font-bold rounded-lg transition-all text-[11px] flex items-center justify-center gap-1.5"
                      >
                        <CloudUpload className="w-3.5 h-3.5 text-rose-600" />
                        <span>Simpan ke Google Drive</span>
                      </button>
                    </div>
                  </div>

                  {/* Option 3: CSV Format */}
                  <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-all">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2 bg-slate-700 text-white rounded-lg">
                          <FileText className="w-5 h-5" />
                        </div>
                        <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded">
                          UNIVERSAL
                        </span>
                      </div>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                        File Tabel CSV (.csv)
                      </h4>
                      <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-1">
                        Format teks tabel sederhana yang bisa dibuka di perangkat atau sistem apapun.
                      </p>
                    </div>

                    <div className="mt-4 space-y-2">
                      <button
                        onClick={handleDownloadCSV}
                        disabled={isExporting}
                        className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-900 active:scale-98 text-white font-bold rounded-lg transition-all shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <Download className="w-4 h-4" />
                        <span>Unduh File CSV (.csv)</span>
                      </button>

                      <button
                        onClick={() => {
                          setDrivePreselectedType('csv');
                          setIsDriveModalOpen(true);
                        }}
                        className="w-full py-1.5 px-3 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-semibold rounded-lg transition-all text-[11px] flex items-center justify-center gap-1.5"
                      >
                        <CloudUpload className="w-3.5 h-3.5 text-blue-600" />
                        <span>Simpan ke Drive</span>
                      </button>
                    </div>
                  </div>

                  {/* Option 4: Copy to Clipboard */}
                  <div className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col justify-between hover:shadow-md transition-all">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2 bg-indigo-600 text-white rounded-lg">
                          <Copy className="w-5 h-5" />
                        </div>
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded">
                          INSTAN
                        </span>
                      </div>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                        Salin ke Clipboard (Copy)
                      </h4>
                      <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-1">
                        Salin seluruh tabel langsung. Buka Excel / Google Sheets lalu tekan Ctrl+V (Paste).
                      </p>
                    </div>

                    <div className="mt-4">
                      <button
                        onClick={handleCopyToClipboard}
                        className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-bold rounded-lg transition-all shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <Copy className="w-4 h-4" />
                        <span>Salin Tabel (Ctrl+V)</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>


              {/* Setting Forms: Kop Surat & Instansi */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5 text-indigo-500" />
                    Kop Laporan & Judul File
                  </h4>
                  <span className="text-[10px] text-slate-500 italic">
                    Teks ini akan otomatis tercetak di header file Excel
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Judul Dokumen:
                    </label>
                    <input
                      type="text"
                      value={formSettings.title}
                      onChange={(e) => setFormSettings({ ...formSettings, title: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Nama Instansi / Satker:
                    </label>
                    <input
                      type="text"
                      value={formSettings.institution}
                      onChange={(e) => setFormSettings({ ...formSettings, institution: e.target.value })}
                      className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Setting Forms: Pengesahan & Tanda Tangan */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Pejabat Penandatangan (Pengesahan Laporan)
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Kota / Tempat:
                    </label>
                    <input
                      type="text"
                      value={formSettings.signatures.city}
                      onChange={(e) => setFormSettings({
                        ...formSettings,
                        signatures: { ...formSettings.signatures, city: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Tanggal Tanda Tangan:
                    </label>
                    <input
                      type="text"
                      value={formSettings.signatures.signDate}
                      onChange={(e) => setFormSettings({
                        ...formSettings,
                        signatures: { ...formSettings.signatures, signDate: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Penandatangan 1 */}
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 text-[11px] block">
                      Penandatangan 1 (Sebelah Kiri / Mengetahui):
                    </span>
                    <input
                      type="text"
                      placeholder="Jabatan (e.g. Kepala Satuan Kerja)"
                      value={formSettings.signatures.officer1Title}
                      onChange={(e) => setFormSettings({
                        ...formSettings,
                        signatures: { ...formSettings.signatures, officer1Title: e.target.value }
                      })}
                      className="w-full px-2.5 py-1 border border-slate-300 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-800 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Nama Lengkap & Gelar"
                      value={formSettings.signatures.officer1Name}
                      onChange={(e) => setFormSettings({
                        ...formSettings,
                        signatures: { ...formSettings.signatures, officer1Name: e.target.value }
                      })}
                      className="w-full px-2.5 py-1 border border-slate-300 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                    />
                  </div>

                  {/* Penandatangan 2 */}
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 text-[11px] block">
                      Penandatangan 2 (Sebelah Kanan / Pembuat Daftar):
                    </span>
                    <input
                      type="text"
                      placeholder="Jabatan (e.g. Kepala Subbagian Tata Usaha)"
                      value={formSettings.signatures.officer2Title}
                      onChange={(e) => setFormSettings({
                        ...formSettings,
                        signatures: { ...formSettings.signatures, officer2Title: e.target.value }
                      })}
                      className="w-full px-2.5 py-1 border border-slate-300 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-800 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Nama Lengkap & Gelar"
                      value={formSettings.signatures.officer2Name}
                      onChange={(e) => setFormSettings({
                        ...formSettings,
                        signatures: { ...formSettings.signatures, officer2Name: e.target.value }
                      })}
                      className="w-full px-2.5 py-1 border border-slate-300 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                    />
                  </div>
                </div>
              </div>

            </div>
          ) : (
            /* Tab: Live Preview */
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs">
                    Pratinjau Data yang Akan Masuk ke File Excel:
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    {formSettings.title} • {formSettings.institution}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadExcel}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh Excel Ini</span>
                  </button>
                </div>
              </div>

              {/* Mini Table Preview */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto max-h-96">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 sticky top-0">
                    <tr>
                      <th className="py-2 px-2 text-center w-8 font-bold">No</th>
                      <th className="py-2 px-3 min-w-40 font-bold">Seksi / Nama Pegawai</th>
                      {dateCols.map(d => (
                        <th key={d.dateStr} className="py-2 px-1 text-center font-bold min-w-8">
                          {d.dayNum}
                        </th>
                      ))}
                      <th className="py-2 px-1 text-center font-bold text-emerald-600">✓</th>
                      <th className="py-2 px-1 text-center font-bold text-amber-600">S</th>
                      <th className="py-2 px-1 text-center font-bold text-sky-600">I</th>
                      <th className="py-2 px-1 text-center font-bold text-purple-600">DL</th>
                      <th className="py-2 px-1 text-center font-bold text-indigo-600">C</th>
                      <th className="py-2 px-1 text-center font-bold text-rose-600">TK</th>
                      <th className="py-2 px-1 text-center font-bold text-teal-600">LP</th>
                      <th className="py-2 px-1 text-center font-bold text-blue-600">PS</th>
                      <th className="py-2 px-1 text-center font-bold">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sections.map(sec => {
                      const secEmps = employees.filter(e => e.sectionId === sec.id);
                      return (
                        <React.Fragment key={sec.id}>
                          <tr className="bg-slate-200/70 dark:bg-slate-800 font-extrabold text-[10px] uppercase">
                            <td colSpan={2 + dateCols.length + 9} className="py-1 px-3">
                              {sec.name} ({secEmps.length} Personel)
                            </td>
                          </tr>
                          {secEmps.map((emp, idx) => {
                            let h = 0, s = 0, i = 0, dl = 0, c = 0, tk = 0, lp = 0, ps = 0;
                            return (
                              <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="py-1.5 px-2 text-center text-slate-400">{idx + 1}</td>
                                <td className="py-1.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                                  {emp.name}
                                </td>
                                {dateCols.map(d => {
                                  const key = `${emp.id}_${d.dateStr}`;
                                  const st = attendance[key]?.status || (d.isWeekend ? 'LB' : '✓');
                                  if (st === '✓' || st === 'H') h++;
                                  else if (st === 'S') s++;
                                  else if (st === 'I') i++;
                                  else if (st === 'DL') dl++;
                                  else if (st === 'C') c++;
                                  else if (st === 'TK') tk++;
                                  else if (st === 'LP') lp++;
                                  else if (st === 'PS') ps++;
                                  return (
                                    <td key={d.dateStr} className="py-1.5 px-1 text-center font-bold text-[10px]">
                                      {st}
                                    </td>
                                  );
                                })}
                                <td className="py-1.5 px-1 text-center text-emerald-600 font-bold">{h}</td>
                                <td className="py-1.5 px-1 text-center text-amber-600 font-bold">{s}</td>
                                <td className="py-1.5 px-1 text-center text-sky-600 font-bold">{i}</td>
                                <td className="py-1.5 px-1 text-center text-purple-600 font-bold">{dl}</td>
                                <td className="py-1.5 px-1 text-center text-indigo-600 font-bold">{c}</td>
                                <td className="py-1.5 px-1 text-center text-rose-600 font-bold">{tk}</td>
                                <td className="py-1.5 px-1 text-center text-teal-600 font-bold">{lp}</td>
                                <td className="py-1.5 px-1 text-center text-blue-600 font-bold">{ps}</td>
                                <td className="py-1.5 px-1 text-center font-bold">
                                  {(() => {
                                    const sched = h + s + i + dl + c + tk + lp + ps;
                                    const duty = h + ps + dl;
                                    return sched > 0 ? Math.round((duty / sched) * 100) : 100;
                                  })()}%
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Legend matching filling application */}
              <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Keterangan Status:</span>
                {ACTIVE_STATUS_CODES.map((st) => {
                  const conf = STATUS_CONFIG[st];
                  return (
                    <span
                      key={st}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold border ${conf.bgClass} ${conf.borderClass}`}
                    >
                      <span>{conf.shortLabel}</span>
                      <span className="text-[10px] opacity-80">= {conf.label}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / Cetak PDF</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-medium"
            >
              Tutup
            </button>
            <button
              onClick={() => {
                setDrivePreselectedType('pdf');
                setIsDriveModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95"
              title="Unggah berkas rekap langsung ke Google Drive menggunakan Google Picker"
            >
              <CloudUpload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Simpan ke Google Drive</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
              title="Unduh laporan lengkap dalam berkas PDF rapi"
            >
              <FileDown className="w-4 h-4" />
              <span>Unduh PDF (.pdf)</span>
            </button>
            <button
              onClick={handleDownloadExcel}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
              title="Unduh laporan lengkap dalam berkas Excel .xlsx"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Excel (.xlsx)</span>
            </button>
          </div>
        </div>

      </div>

      <GoogleDriveUploadModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        sections={sections}
        employees={employees}
        attendance={attendance}
        period={period}
        settings={formSettings}
        defaultFileType={drivePreselectedType}
        initialDailyDate={selectedDailyDate}
        onSuccessNotification={(msg) => showToast(msg, 'success')}
      />
    </div>
  );
};
