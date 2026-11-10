import React, { useState, useEffect, useRef } from 'react';
import {
  INITIAL_SECTIONS,
  INITIAL_EMPLOYEES,
  INITIAL_EXPORT_SETTINGS,
  generateInitialAttendance,
} from './data/initialData';
import {
  Section,
  Employee,
  AttendanceRecord,
  AttendanceStatus,
  PeriodConfig,
  ExportSettings,
} from './types/attendance';
import { PeriodSelector } from './components/PeriodSelector';
import { AttendanceMatrix } from './components/AttendanceMatrix';
import { DailyApelView } from './components/DailyApelView';
import { SummaryStatsView } from './components/SummaryStatsView';
import { EmployeeManagerModal } from './components/EmployeeManagerModal';
import { ExportModal } from './components/ExportModal';
import { GoogleDriveUploadModal } from './components/GoogleDriveUploadModal';
import { GoogleSheetsSyncModal } from './components/GoogleSheetsSyncModal';
import {
  GoogleSheetsSyncConfig,
  loadStoredSyncConfig,
  saveStoredSyncConfig,
  syncAttendanceToSpreadsheet,
  fetchAttendanceFromSpreadsheet,
} from './services/googleSheetsService';
import { getAccessToken } from './services/googleDriveService';
import {
  exportAttendanceToExcel,
  exportAttendanceToCSV,
  copyAttendanceToClipboard,
  getDateColumns,
} from './utils/excelExporter';
import { exportAttendanceToPDF, exportDailyAttendanceToPDF } from './utils/pdfExporter';
import {
  Table2,
  CalendarCheck,
  BarChart3,
  UserPlus,
  FileSpreadsheet,
  Download,
  Upload,
  RotateCcw,
  Printer,
  Shield,
  Layers,
  Sparkles,
  ChevronDown,
  FileText,
  Copy,
  Settings,
  Check,
  X,
  ExternalLink,
  FileDown,
  CloudUpload,
  RefreshCw,
  Radio,
} from 'lucide-react';

const STORAGE_KEY_SECTIONS = 'rekap_absensi_sections_v1';
const STORAGE_KEY_EMPLOYEES = 'rekap_absensi_employees_v1';
const STORAGE_KEY_ATTENDANCE = 'rekap_absensi_records_v1';
const STORAGE_KEY_SETTINGS = 'rekap_absensi_settings_v1';

export default function App() {
  // Load data from localStorage or fallback to initial data
  const [sections, setSections] = useState<Section[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SECTIONS);
      return saved ? JSON.parse(saved) : INITIAL_SECTIONS;
    } catch {
      return INITIAL_SECTIONS;
    }
  });

  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_EMPLOYEES);
      return saved ? JSON.parse(saved) : INITIAL_EMPLOYEES;
    } catch {
      return INITIAL_EMPLOYEES;
    }
  });

  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ATTENDANCE);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, AttendanceRecord>;
        const normalized: Record<string, AttendanceRecord> = {};
        for (const [key, rec] of Object.entries(parsed)) {
          let st = rec.status;
          if ((st as string) === 'H') st = '✓';
          else if ((st as string) === '-') st = 'LB';
          normalized[key] = { ...rec, status: st };
        }
        return normalized;
      }
      return generateInitialAttendance();
    } catch {
      return generateInitialAttendance();
    }
  });

  const [exportSettings, setExportSettings] = useState<ExportSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed.signatures?.officer1Name === 'H. AHMAD FAUZI, S.H., M.H.' ||
          parsed.institution === 'LEMBAGA PEMASYARAKATAN KELAS IIA'
        ) {
          return {
            ...INITIAL_EXPORT_SETTINGS,
            ...parsed,
            institution: 'LEMBAGA PEMASYARAKATAN TERBUKA KELAS IIB KENDAL',
            signatures: {
              ...INITIAL_EXPORT_SETTINGS.signatures,
              ...parsed.signatures,
              officer1Title: parsed.signatures?.officer1Title || 'Kepala Lembaga Pemasyarakatan',
              officer1Name: parsed.signatures?.officer1Name === 'H. AHMAD FAUZI, S.H., M.H.' ? 'Yohanes Bosko Agung' : parsed.signatures?.officer1Name,
              officer2Title: parsed.signatures?.officer2Title || 'Kepala Subbagian Tata Usaha',
              officer2Name: parsed.signatures?.officer2Name === 'JOKO SUSANTO, S.Sos.' ? 'Budiyanto' : parsed.signatures?.officer2Name,
            },
          };
        }
        return parsed;
      }
      return INITIAL_EXPORT_SETTINGS;
    } catch {
      return INITIAL_EXPORT_SETTINGS;
    }
  });

  // Save to localStorage whenever data changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SECTIONS, JSON.stringify(sections));
    } catch (e) {
      console.warn('Storage failed for sections', e);
    }
  }, [sections]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_EMPLOYEES, JSON.stringify(employees));
    } catch (e) {
      console.warn('Storage failed for employees', e);
    }
  }, [employees]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(attendance));
    } catch (e) {
      console.warn('Storage failed for attendance', e);
    }
  }, [attendance]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(exportSettings));
    } catch (e) {
      console.warn('Storage failed for settings', e);
    }
  }, [exportSettings]);

  // Current active period (defaults to November 2024 Periode I: Tgl 1-10 as in user file)
  const [period, setPeriod] = useState<PeriodConfig>({
    preset: 'p1',
    year: 2024,
    month: 10, // November (0-indexed)
    startDate: '2024-11-01',
    endDate: '2024-11-10',
  });

  // UI state
  const [activeTab, setActiveTab] = useState<'matrix' | 'daily' | 'stats'>('matrix');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState('ALL');

  // Modals & Menus
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [selectedSectionForAdd, setSelectedSectionForAdd] = useState<string | undefined>(undefined);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [driveModalFileType, setDriveModalFileType] = useState<'excel' | 'pdf' | 'dailyPdf' | 'csv'>('pdf');
  const [driveInitialDailyDate, setDriveInitialDailyDate] = useState<string | undefined>(undefined);

  // Google Sheets Realtime Sync State
  const [syncConfig, setSyncConfig] = useState<GoogleSheetsSyncConfig>(loadStoredSyncConfig);
  const [isSheetsSyncModalOpen, setIsSheetsSyncModalOpen] = useState(false);

  const handleUpdateSyncConfig = (newConfig: GoogleSheetsSyncConfig) => {
    setSyncConfig(newConfig);
    saveStoredSyncConfig(newConfig);
  };

  const handleTriggerImmediateSync = async () => {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Silakan masuk ke akun Google terlebih dahulu.');
    }
    if (!syncConfig.spreadsheetId) {
      throw new Error('Belum ada Spreadsheet yang ditautkan.');
    }

    setSyncConfig((prev) => ({ ...prev, syncStatus: 'syncing' }));
    try {
      await syncAttendanceToSpreadsheet({
        accessToken: token,
        spreadsheetId: syncConfig.spreadsheetId,
        sections,
        employees,
        attendance,
        period,
        settings: exportSettings,
      });
      const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const updated: GoogleSheetsSyncConfig = {
        ...syncConfig,
        syncStatus: 'synced',
        lastSyncTime: now,
        errorMessage: undefined,
      };
      setSyncConfig(updated);
      saveStoredSyncConfig(updated);
      showToast('Sinkronisasi Sukses', 'Data absensi berhasil diperbarui ke Google Sheets.');
    } catch (err: any) {
      const updated: GoogleSheetsSyncConfig = {
        ...syncConfig,
        syncStatus: 'error',
        errorMessage: err.message || 'Gagal sinkronisasi data',
      };
      setSyncConfig(updated);
      saveStoredSyncConfig(updated);
      throw err;
    }
  };

  // Debounced Realtime Auto-Sync to Google Sheets
  const isInitialMount = useRef(true);
  const autoSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!syncConfig.enabled || !syncConfig.spreadsheetId || !syncConfig.autoSyncOnChange) {
      return;
    }

    if (autoSyncTimeoutRef.current) {
      clearTimeout(autoSyncTimeoutRef.current);
    }

    autoSyncTimeoutRef.current = setTimeout(async () => {
      const token = await getAccessToken();
      if (!token) return;

      try {
        setSyncConfig((prev) => ({ ...prev, syncStatus: 'syncing' }));
        await syncAttendanceToSpreadsheet({
          accessToken: token,
          spreadsheetId: syncConfig.spreadsheetId!,
          sections,
          employees,
          attendance,
          period,
          settings: exportSettings,
        });
        const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setSyncConfig((prev) => {
          const updated: GoogleSheetsSyncConfig = {
            ...prev,
            syncStatus: 'synced',
            lastSyncTime: now,
            errorMessage: undefined,
          };
          saveStoredSyncConfig(updated);
          return updated;
        });
      } catch (err: any) {
        console.warn('Realtime auto-sync to Sheets failed:', err);
        setSyncConfig((prev) => {
          const updated: GoogleSheetsSyncConfig = {
            ...prev,
            syncStatus: 'error',
            errorMessage: err.message || 'Gagal menyinkronkan otomatis',
          };
          saveStoredSyncConfig(updated);
          return updated;
        });
      }
    }, 1500);

    return () => {
      if (autoSyncTimeoutRef.current) {
        clearTimeout(autoSyncTimeoutRef.current);
      }
    };
  }, [attendance, employees, sections, period, exportSettings, syncConfig.enabled, syncConfig.spreadsheetId, syncConfig.autoSyncOnChange]);

  // State untuk pemantauan realtime & fetch berkala 20 detik
  const [lastPeriodicFetchTime, setLastPeriodicFetchTime] = useState<string>('');
  const [isPeriodicFetching, setIsPeriodicFetching] = useState<boolean>(false);
  const [fetchCountdown, setFetchCountdown] = useState<number>(20);

  // useEffect dan setInterval untuk melakukan fetch data secara berkala setiap 20 detik
  useEffect(() => {
    let isCancelled = false;

    const fetchData = async () => {
      if (syncConfig.enabled && syncConfig.spreadsheetId) {
        try {
          const token = await getAccessToken();
          if (!token || isCancelled) return;

          setIsPeriodicFetching(true);
          const result = await fetchAttendanceFromSpreadsheet({
            accessToken: token,
            spreadsheetId: syncConfig.spreadsheetId,
            employees,
            period,
          });

          if (isCancelled) return;

          if (result && result.records && Object.keys(result.records).length > 0) {
            setAttendance((prev) => {
              let hasChange = false;
              const merged = { ...prev };
              for (const [key, rec] of Object.entries(result.records)) {
                if (!prev[key] || prev[key].status !== rec.status) {
                  merged[key] = { ...prev[key], ...rec };
                  hasChange = true;
                }
              }
              if (hasChange) {
                try {
                  localStorage.setItem(STORAGE_KEY_ATTENDANCE, JSON.stringify(merged));
                } catch {
                  // Abaikan kesalahan quota localStorage
                }
                return merged;
              }
              return prev;
            });
          }

          const nowStr = new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          setLastPeriodicFetchTime(nowStr);
        } catch (err) {
          console.warn('Periodic fetch 20s warning:', err);
        } finally {
          if (!isCancelled) {
            setIsPeriodicFetching(false);
          }
        }
      } else {
        const nowStr = new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        setLastPeriodicFetchTime(nowStr);
      }
    };

    // Jalankan fetch pertama saat inisialisasi
    fetchData();

    // setInterval untuk fetch data secara berkala setiap 20 detik (20000 ms)
    const intervalId = setInterval(() => {
      fetchData();
      setFetchCountdown(20);
    }, 20000);

    // Countdown visual setiap detik
    const countdownId = setInterval(() => {
      setFetchCountdown((prev) => (prev <= 1 ? 20 : prev - 1));
    }, 1000);

    // Bersihkan timer saat unmount atau dependensi berubah
    return () => {
      isCancelled = true;
      clearInterval(intervalId);
      clearInterval(countdownId);
    };
  }, [syncConfig.enabled, syncConfig.spreadsheetId, employees, period]);

  // Global Toast Notification
  const [toastNotification, setToastNotification] = useState<{
    title: string;
    description: string;
    type: 'success' | 'info';
  } | null>(null);

  const exportDropdownRef = useRef<HTMLDivElement>(null);

  const showToast = (title: string, description: string, type: 'success' | 'info' = 'success') => {
    setToastNotification({ title, description, type });
    setTimeout(() => {
      setToastNotification(null);
    }, 4500);
  };

  // Close export dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setIsExportDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Status Handlers
  const handleUpdateStatus = (employeeId: string, dateStr: string, status: AttendanceStatus, note?: string) => {
    const key = `${employeeId}_${dateStr}`;
    setAttendance((prev) => ({
      ...prev,
      [key]: {
        employeeId,
        date: dateStr,
        status,
        note,
      },
    }));
  };

  // Batch mark whole section as Hadir for all days in current period
  const handleBatchSectionStatus = (sectionId: string, status: AttendanceStatus) => {
    const secEmployees = employees.filter((e) => e.sectionId === sectionId);
    const dateColumns = getDateColumns(period);

    setAttendance((prev) => {
      const next = { ...prev };
      secEmployees.forEach((emp) => {
        dateColumns.forEach((d) => {
          if (!d.isWeekend) {
            const key = `${emp.id}_${d.dateStr}`;
            next[key] = {
              employeeId: emp.id,
              date: d.dateStr,
              status,
              note: prev[key]?.note,
            };
          }
        });
      });
      return next;
    });
  };

  // Batch mark single date column as Hadir for all employees
  const handleBatchColumnStatus = (dateStr: string, status: AttendanceStatus) => {
    setAttendance((prev) => {
      const next = { ...prev };
      employees.forEach((emp) => {
        const key = `${emp.id}_${dateStr}`;
        next[key] = {
          employeeId: emp.id,
          date: dateStr,
          status,
          note: prev[key]?.note,
        };
      });
      return next;
    });
  };

  // Batch mark section for specific single date (used in DailyApelView)
  const handleBatchSectionStatusForDate = (sectionId: string, dateStr: string, status: AttendanceStatus) => {
    const secEmployees = employees.filter((e) => e.sectionId === sectionId);
    setAttendance((prev) => {
      const next = { ...prev };
      secEmployees.forEach((emp) => {
        const key = `${emp.id}_${dateStr}`;
        next[key] = {
          employeeId: emp.id,
          date: dateStr,
          status,
          note: prev[key]?.note,
        };
      });
      return next;
    });
  };

  // Batch mark ALL employees for entire 10-day period (excluding weekends)
  const handleSetAllPresent = () => {
    const dateColumns = getDateColumns(period);
    setAttendance((prev) => {
      const next = { ...prev };
      employees.forEach((emp) => {
        dateColumns.forEach((d) => {
          const key = `${emp.id}_${d.dateStr}`;
          next[key] = {
            employeeId: emp.id,
            date: d.dateStr,
            status: d.isWeekend ? 'LB' : '✓',
            note: undefined,
          };
        });
      });
      return next;
    });
    showToast('Tandai Hadir Berhasil', 'Seluruh pegawai telah ditandai Hadir (✓) untuk seluruh tanggal aktif.');
  };

  // Employee CRUD
  const handleAddEmployee = (newEmpData: Omit<Employee, 'id'>) => {
    const newEmp: Employee = {
      ...newEmpData,
      id: `emp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    setEmployees((prev) => [...prev, newEmp]);
    showToast('Pegawai Ditambahkan', `${newEmp.name} berhasil ditambahkan ke daftar.`);
  };

  const handleUpdateEmployee = (updatedEmp: Employee) => {
    setEmployees((prev) => prev.map((e) => (e.id === updatedEmp.id ? updatedEmp : e)));
    showToast('Data Diperbarui', `Data ${updatedEmp.name} berhasil diubah.`);
  };

  const handleDeleteEmployee = (empId: string) => {
    const target = employees.find(e => e.id === empId);
    setEmployees((prev) => prev.filter((e) => e.id !== empId));
    // Clean up attendance
    setAttendance((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (key.startsWith(`${empId}_`)) {
          delete next[key];
        }
      });
      return next;
    });
    showToast('Pegawai Dihapus', `${target?.name || 'Pegawai'} telah dihapus dari daftar absensi.`, 'info');
  };

  // Section CRUD
  const handleAddSection = (name: string) => {
    const newSec: Section = {
      id: `sec-${Date.now()}`,
      name,
      order: sections.length + 1,
    };
    setSections((prev) => [...prev, newSec]);
    showToast('Seksi Ditambahkan', `Bagian / Seksi ${name} berhasil dibuat.`);
  };

  const handleUpdateSection = (sectionId: string, newName: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, name: newName } : s))
    );
    showToast('Seksi Diperbarui', `Nama seksi berhasil diubah.`);
  };

  const handleDeleteSection = (sectionId: string) => {
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
    showToast('Seksi Dihapus', 'Seksi telah dihapus.', 'info');
  };

  // Export Action Handlers
  const handleDirectExcelDownload = () => {
    setIsExportDropdownOpen(false);
    try {
      const result = exportAttendanceToExcel({
        sections,
        employees,
        attendance,
        period,
        settings: exportSettings,
      });
      showToast('Unduhan Excel Dimulai', `Berkas "${result.fileName}" berhasil dibuat dan diunduh.`);
    } catch (err) {
      console.error(err);
      showToast('Gagal Mengunduh Excel', 'Silakan buka Menu Ekspor untuk opsi alternatif.', 'info');
    }
  };

  const handleDirectPDFDownload = () => {
    setIsExportDropdownOpen(false);
    try {
      const result = exportAttendanceToPDF({
        sections,
        employees,
        attendance,
        period,
        settings: exportSettings,
      });
      showToast('Unduhan PDF Dimulai', `Dokumen PDF "${result.fileName}" berhasil dibuat dan diunduh.`);
    } catch (err) {
      console.error(err);
      showToast('Gagal Mengunduh PDF', 'Terjadi kesalahan saat memproses dokumen PDF.', 'info');
    }
  };

  const handleDirectDailyPDFDownload = (targetDateStr?: string) => {
    setIsExportDropdownOpen(false);
    const dateColumns = getDateColumns(period);
    const dateToUse = targetDateStr || dateColumns[0]?.dateStr || period.startDate;
    try {
      const result = exportDailyAttendanceToPDF({
        dateStr: dateToUse,
        sections,
        employees,
        attendance,
        period,
        settings: exportSettings,
      });
      showToast('Unduhan PDF Harian Dimulai', `Dokumen PDF "${result.fileName}" berhasil dibuat dan diunduh.`);
    } catch (err) {
      console.error(err);
      showToast('Gagal Mengunduh PDF Harian', 'Terjadi kesalahan saat memproses laporan harian.', 'info');
    }
  };

  const handleDirectCSVDownload = () => {
    setIsExportDropdownOpen(false);
    try {
      const result = exportAttendanceToCSV({
        sections,
        employees,
        attendance,
        period,
        settings: exportSettings,
      });
      showToast('Unduhan CSV Dimulai', `Berkas "${result.fileName}" berhasil diunduh.`);
    } catch (err) {
      console.error(err);
      showToast('Gagal Mengunduh CSV', 'Terjadi kesalahan saat memproses file CSV.', 'info');
    }
  };

  const handleDirectCopyClipboard = async () => {
    setIsExportDropdownOpen(false);
    const success = await copyAttendanceToClipboard({
      sections,
      employees,
      attendance,
      period,
      settings: exportSettings,
    });
    if (success) {
      showToast('Data Berhasil Disalin!', 'Buka Excel atau Google Sheets lalu tekan Ctrl+V (Paste).');
    } else {
      showToast('Gagal Menyalin', 'Izin clipboard ditolak oleh peramban.', 'info');
    }
  };

  const handleDirectPrint = () => {
    setIsExportDropdownOpen(false);
    window.print();
  };

  // Backup & Restore
  const handleExportBackup = () => {
    const backupData = {
      sections,
      employees,
      attendance,
      exportSettings,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Backup_Data_Absensi_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Cadangan Berhasil', 'Berkas JSON cadangan telah disimpan.');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.sections && parsed.employees) {
          setSections(parsed.sections);
          setEmployees(parsed.employees);
          if (parsed.attendance) setAttendance(parsed.attendance);
          if (parsed.exportSettings) setExportSettings(parsed.exportSettings);
          showToast('Data Dipulihkan', 'Semua data pegawai dan absensi berhasil dipulihkan.');
        } else {
          alert('Format berkas tidak valid.');
        }
      } catch (err) {
        alert('Gagal membaca berkas cadangan.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetToDefault = () => {
    if (confirm('Apakah Anda yakin ingin mereset data ke daftar awal (50 pegawai & 5 seksi)?')) {
      setSections(INITIAL_SECTIONS);
      setEmployees(INITIAL_EMPLOYEES);
      setAttendance(generateInitialAttendance());
      setExportSettings(INITIAL_EXPORT_SETTINGS);
      localStorage.clear();
      showToast('Reset Berhasil', 'Data telah dikembalikan ke daftar awal (50 pegawai).');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased">
      
      {/* Global Toast Alert */}
      {toastNotification && (
        <div className="fixed top-20 right-4 sm:right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="bg-slate-900 text-white dark:bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-2xl flex items-start gap-3 max-w-sm">
            <div className={`p-1.5 rounded-lg ${
              toastNotification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white'
            }`}>
              <Check className="w-4 h-4" />
            </div>
            <div className="flex-1 text-xs">
              <div className="font-bold text-slate-100">{toastNotification.title}</div>
              <div className="text-slate-300 mt-0.5">{toastNotification.description}</div>
            </div>
            <button
              onClick={() => setToastNotification(null)}
              className="text-slate-400 hover:text-slate-200 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Top Application Bar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo & Satker Info */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-800/80 p-0.5 border border-slate-700/80 flex items-center justify-center shadow-md overflow-hidden shrink-0">
              <img
                src="/assets/aistudio/FA_Logo_Kementrian_Imigrasi_dan_Pemasyarakatan__3__4454c952.png"
                alt="Logo Kementerian Imigrasi dan Pemasyarakatan"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-extrabold tracking-tight">
                  REKAP ABSENSI APEL PEGAWAI
                </h1>
                <span className="hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                  10 HARI • EXCEL READY
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {exportSettings.institution} • {employees.length} Personel ({sections.length} Seksi)
              </p>
            </div>
          </div>

          {/* Action Bar Right */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Manage Employees Button */}
            <button
              onClick={() => {
                setSelectedSectionForAdd(undefined);
                setIsEmployeeModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
              title="Tambah atau kurangi orang di setiap bagian"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kelola Orang / Bagian</span>
              <span className="bg-indigo-800 text-[10px] px-1.5 py-0.2 rounded-full">
                {employees.length}
              </span>
            </button>

            {/* Google Drive Direct Button */}
            <button
              onClick={() => {
                setDriveModalFileType('pdf');
                setIsDriveModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
              title="Unggah berkas rekapitulasi langsung ke Google Drive via Google Picker"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Google Drive</span>
            </button>

            {/* Google Sheets Realtime Live Sync Pill Button with 20s Periodic Fetch */}
            <button
              onClick={() => setIsSheetsSyncModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 border ${
                syncConfig.enabled && syncConfig.spreadsheetId
                  ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-600/30'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
              title={`Sinkronisasi Realtime Google Sheets (Auto Fetch tiap 20 detik)${
                lastPeriodicFetchTime ? ` • Terakhir diperbarui: ${lastPeriodicFetchTime}` : ''
              }`}
            >
              {syncConfig.enabled && syncConfig.spreadsheetId ? (
                isPeriodicFetching || syncConfig.syncStatus === 'syncing' ? (
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                ) : (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )
              ) : (
                <Radio className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span className="hidden sm:inline">
                {syncConfig.enabled && syncConfig.spreadsheetId
                  ? isPeriodicFetching
                    ? 'Fetching...'
                    : syncConfig.syncStatus === 'syncing'
                    ? 'Menyinkronkan...'
                    : 'Sheets Live'
                  : 'Sheets Sync'}
              </span>
              {syncConfig.enabled && syncConfig.spreadsheetId ? (
                <span
                  className="text-[10px] bg-emerald-500/30 text-emerald-200 px-1.5 py-0.5 rounded-full font-mono flex items-center gap-1"
                  title={`Fetch berkala berikutnya dalam ${fetchCountdown} detik`}
                >
                  <span className="hidden md:inline">20s</span>
                  <span>{fetchCountdown}s</span>
                </span>
              ) : (
                <span
                  className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full font-mono"
                  title="Auto fetch tiap 20 detik saat sinkronisasi aktif"
                >
                  20s
                </span>
              )}
            </button>

            {/* Robust Export Dropdown Menu */}
            <div className="relative" ref={exportDropdownRef}>
              <button
                onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                title="Pilihan menu ekspor ke Excel, CSV, Clipboard, atau Cetak"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Menu Ekspor</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-80" />
              </button>

              {/* Dropdown Popover */}
              {isExportDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl py-2 z-50 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 mb-1">
                    Format Ekspor 10 Hari
                  </div>

                  {/* 1. Excel Direct Download */}
                  <button
                    onClick={handleDirectExcelDownload}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700 flex items-center gap-2.5 transition-colors"
                  >
                    <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-md">
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold">Unduh Excel (.xlsx)</div>
                      <div className="text-[10px] text-slate-500 font-normal">2 Sheet lengkap dengan statistik</div>
                    </div>
                  </button>

                  {/* 2. PDF Direct Download (jsPDF) */}
                  <button
                    onClick={handleDirectPDFDownload}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-700 flex items-center gap-2.5 transition-colors"
                  >
                    <div className="p-1.5 bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 rounded-md">
                      <FileDown className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold">Unduh PDF Rekap 10 Hari</div>
                      <div className="text-[10px] text-slate-500 font-normal">A4 Landscape rapi dengan kop & pengesahan</div>
                    </div>
                  </button>

                  {/* 2b. Daily PDF Direct Download */}
                  <button
                    onClick={() => handleDirectDailyPDFDownload()}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-700 flex items-center gap-2.5 transition-colors"
                  >
                    <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-md">
                      <FileDown className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold">Unduh Rekap Harian (.pdf)</div>
                      <div className="text-[10px] text-slate-500 font-normal">A4 Portrait laporan apel tanggal aktif</div>
                    </div>
                  </button>

                  {/* 3. CSV Direct Download */}
                  <button
                    onClick={handleDirectCSVDownload}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                  >
                    <div className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold">Unduh File CSV (.csv)</div>
                      <div className="text-[10px] text-slate-500 font-normal">Tabel universal untuk spreadsheet</div>
                    </div>
                  </button>

                  {/* 3. Copy to Clipboard */}
                  <button
                    onClick={handleDirectCopyClipboard}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-700 flex items-center gap-2.5 transition-colors"
                  >
                    <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-md">
                      <Copy className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold">Salin ke Clipboard (Copy)</div>
                      <div className="text-[10px] text-slate-500 font-normal">Tinggal tekan Ctrl+V di Excel / Sheets</div>
                    </div>
                  </button>

                  <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>

                  {/* Google Drive Upload with Picker */}
                  <button
                    onClick={() => {
                      setIsExportDropdownOpen(false);
                      setDriveModalFileType('pdf');
                      setIsDriveModalOpen(true);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-700 flex items-center gap-2.5 transition-colors"
                  >
                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-md">
                      <CloudUpload className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold text-blue-700 dark:text-blue-400">Simpan ke Google Drive</div>
                      <div className="text-[10px] text-slate-500 font-normal">Pilih folder tujuan via Google Picker</div>
                    </div>
                  </button>

                  {/* Google Sheets Realtime Sync Item */}
                  <button
                    onClick={() => {
                      setIsExportDropdownOpen(false);
                      setIsSheetsSyncModalOpen(true);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700 flex items-center gap-2.5 transition-colors"
                  >
                    <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-md">
                      <Radio className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                        <span>Sinkronisasi Google Sheets</span>
                        {syncConfig.enabled && syncConfig.spreadsheetId && (
                          <span className="px-1.5 py-0.2 bg-emerald-500 text-white rounded text-[9px] font-bold">
                            AKTIF
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        Pantau absensi online realtime otomatis
                      </div>
                    </div>
                  </button>

                  {/* 4. Full Modal with Settings & Preview */}
                  <button
                    onClick={() => {
                      setIsExportDropdownOpen(false);
                      setIsExportModalOpen(true);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                  >
                    <div className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md">
                      <Settings className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold">Pengaturan & Pratinjau...</div>
                      <div className="text-[10px] text-slate-500 font-normal">Ubah kop surat, jabatan, & penandatangan</div>
                    </div>
                  </button>

                  {/* 5. Print Preview */}
                  <button
                    onClick={handleDirectPrint}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
                  >
                    <div className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md">
                      <Printer className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold">Cetak / Simpan PDF</div>
                      <div className="text-[10px] text-slate-500 font-normal">Tampilan siap print dokumen fisik</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* Subheader / Tabs & Backup Utility */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          
          {/* Main Navigation Tabs */}
          <nav className="flex space-x-1 sm:space-x-4">
            <button
              onClick={() => setActiveTab('matrix')}
              className={`flex items-center gap-2 py-3 px-3 border-b-2 text-xs font-bold transition-colors ${
                activeTab === 'matrix'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Table2 className="w-4 h-4" />
              <span>Matriks Rekap 10 Hari</span>
            </button>

            <button
              onClick={() => setActiveTab('daily')}
              className={`flex items-center gap-2 py-3 px-3 border-b-2 text-xs font-bold transition-colors ${
                activeTab === 'daily'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Dashboard & Rekap Harian</span>
            </button>

            <button
              onClick={() => setActiveTab('stats')}
              className={`flex items-center gap-2 py-3 px-3 border-b-2 text-xs font-bold transition-colors ${
                activeTab === 'stats'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Ringkasan & Statistik</span>
            </button>
          </nav>

          {/* Backup & Quick Utilities */}
          <div className="flex items-center gap-2 pb-2 sm:pb-0 text-slate-500 text-xs">
            <button
              onClick={handleDirectExcelDownload}
              className="flex items-center gap-1 hover:text-emerald-600 px-2 py-1 rounded transition-colors font-semibold"
              title="Unduh langsung file Excel rekap 10 hari (.xlsx)"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Unduh Excel</span>
            </button>

            <button
              onClick={handleDirectPDFDownload}
              className="flex items-center gap-1 hover:text-rose-600 px-2 py-1 rounded transition-colors font-semibold"
              title="Unduh langsung laporan rekapitulasi dalam format PDF resmi (jsPDF)"
            >
              <FileDown className="w-3.5 h-3.5 text-rose-600" />
              <span>Unduh PDF</span>
            </button>

            <span className="text-slate-300 dark:text-slate-700">|</span>

            <button
              onClick={handleExportBackup}
              className="flex items-center gap-1 hover:text-indigo-600 px-2 py-1 rounded transition-colors"
              title="Cadangkan semua data (pegawai & absensi) ke file JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Cadangkan</span>
            </button>

            <label className="flex items-center gap-1 hover:text-indigo-600 px-2 py-1 rounded cursor-pointer transition-colors" title="Pulihkan data dari file JSON">
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Pulihkan</span>
              <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
            </label>

            <span className="text-slate-300 dark:text-slate-700">|</span>

            <button
              onClick={handleResetToDefault}
              className="flex items-center gap-1 hover:text-rose-600 px-2 py-1 rounded transition-colors"
              title="Kembalikan data ke awal (50 pegawai)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Reset Awal</span>
            </button>
          </div>

        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        {/* Period, Date Range & Search Controls */}
        <PeriodSelector
          period={period}
          onPeriodChange={setPeriod}
          onSetAllPresent={handleSetAllPresent}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedSectionFilter={selectedSectionFilter}
          onSectionFilterChange={setSelectedSectionFilter}
          sections={sections}
        />

        {/* Tab 1: 10-Day Attendance Matrix */}
        {activeTab === 'matrix' && (
          <AttendanceMatrix
            sections={sections}
            employees={employees}
            attendance={attendance}
            period={period}
            searchQuery={searchQuery}
            selectedSectionFilter={selectedSectionFilter}
            onUpdateStatus={handleUpdateStatus}
            onBatchSectionStatus={handleBatchSectionStatus}
            onBatchColumnStatus={handleBatchColumnStatus}
            onOpenAddEmployee={(secId) => {
              setSelectedSectionForAdd(secId);
              setIsEmployeeModalOpen(true);
            }}
            onOpenEditEmployee={() => {
              setIsEmployeeModalOpen(true);
            }}
            onDeleteEmployee={(emp) => {
              if (confirm(`Hapus pegawai ${emp.name} dari bagian ini?`)) {
                handleDeleteEmployee(emp.id);
              }
            }}
          />
        )}

        {/* Tab 2: Daily Apel Check-in & Dashboard */}
        {activeTab === 'daily' && (
          <DailyApelView
            sections={sections}
            employees={employees}
            attendance={attendance}
            period={period}
            settings={exportSettings}
            onUpdateStatus={handleUpdateStatus}
            onBatchSectionStatusForDate={handleBatchSectionStatusForDate}
            onDownloadDailyPDF={handleDirectDailyPDFDownload}
            onOpenGoogleDriveUpload={(dateStr) => {
              setDriveInitialDailyDate(dateStr);
              setDriveModalFileType('dailyPdf');
              setIsDriveModalOpen(true);
            }}
          />
        )}

        {/* Tab 3: Summary & Statistics View */}
        {activeTab === 'stats' && (
          <SummaryStatsView
            sections={sections}
            employees={employees}
            attendance={attendance}
            period={period}
            onOpenExportModal={() => setIsExportModalOpen(true)}
            onDownloadPDF={handleDirectPDFDownload}
            onDownloadDailyPDF={handleDirectDailyPDFDownload}
          />
        )}
      </main>

      {/* Employee Manager Modal (Add/Remove Person in each section) */}
      <EmployeeManagerModal
        isOpen={isEmployeeModalOpen}
        onClose={() => setIsEmployeeModalOpen(false)}
        sections={sections}
        employees={employees}
        initialSectionId={selectedSectionForAdd}
        onAddEmployee={handleAddEmployee}
        onUpdateEmployee={handleUpdateEmployee}
        onDeleteEmployee={handleDeleteEmployee}
        onAddSection={handleAddSection}
        onUpdateSection={handleUpdateSection}
        onDeleteSection={handleDeleteSection}
      />

      {/* Export to Excel Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        sections={sections}
        employees={employees}
        attendance={attendance}
        period={period}
        settings={exportSettings}
        onUpdateSettings={setExportSettings}
        onOpenGoogleDriveUpload={(fileType) => {
          if (fileType) setDriveModalFileType(fileType);
          setIsDriveModalOpen(true);
        }}
        onOpenGoogleSheetsSync={() => setIsSheetsSyncModalOpen(true)}
      />

      {/* Google Drive Upload Modal (Picker API & Drive v3) */}
      <GoogleDriveUploadModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        sections={sections}
        employees={employees}
        attendance={attendance}
        period={period}
        settings={exportSettings}
        defaultFileType={driveModalFileType}
        initialDailyDate={driveInitialDailyDate}
        onSuccessNotification={(msg) => showToast('Google Drive Berhasil', msg)}
      />

      {/* Google Sheets Realtime Synchronization Modal */}
      <GoogleSheetsSyncModal
        isOpen={isSheetsSyncModalOpen}
        onClose={() => setIsSheetsSyncModalOpen(false)}
        sections={sections}
        employees={employees}
        attendance={attendance}
        period={period}
        settings={exportSettings}
        syncConfig={syncConfig}
        onUpdateSyncConfig={handleUpdateSyncConfig}
        onTriggerImmediateSync={handleTriggerImmediateSync}
        onSuccessNotification={(msg) => showToast('Google Sheets Live', msg)}
      />

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500">
          Aplikasi Rekapitulasi Daftar Kehadiran Apel Pegawai Per 10 Hari • Output File Excel (.xlsx) Standar Satuan Kerja
        </div>
      </footer>
    </div>
  );
}
