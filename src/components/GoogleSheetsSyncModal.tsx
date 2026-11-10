import React, { useState, useEffect } from 'react';
import {
  Section,
  Employee,
  AttendanceRecord,
  PeriodConfig,
  ExportSettings,
} from '../types/attendance';
import {
  auth,
  initAuth,
  googleSignIn,
  googleLogout,
  getAccessToken,
  openSpreadsheetPicker,
  SelectedSpreadsheet,
} from '../services/googleDriveService';
import {
  GoogleSheetsSyncConfig,
  createSyncSpreadsheet,
  syncAttendanceToSpreadsheet,
  verifySpreadsheetAccess,
  saveStoredSyncConfig,
} from '../services/googleSheetsService';
import {
  FileSpreadsheet,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  PlusCircle,
  Radio,
  Unlink,
  LogOut,
  X,
  ShieldCheck,
  Check,
  Clock,
  Sparkles,
  Layers,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';

interface GoogleSheetsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  sections: Section[];
  employees: Employee[];
  attendance: Record<string, AttendanceRecord>;
  period: PeriodConfig;
  settings: ExportSettings;
  syncConfig: GoogleSheetsSyncConfig;
  onUpdateSyncConfig: (newConfig: GoogleSheetsSyncConfig) => void;
  onTriggerImmediateSync: () => Promise<void>;
  onSuccessNotification?: (message: string) => void;
}

export const GoogleSheetsSyncModal: React.FC<GoogleSheetsSyncModalProps> = ({
  isOpen,
  onClose,
  sections,
  employees,
  attendance,
  period,
  settings,
  syncConfig,
  onUpdateSyncConfig,
  onTriggerImmediateSync,
  onSuccessNotification,
}) => {
  // All hooks must be called unconditionally at the very top (React 19 Rule)
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(auth.currentUser);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Confirmation Modal State (Required by Google Workspace Integration Guidelines)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setCurrentUser(user);
        setAccessToken(token);
      },
      () => {
        setCurrentUser(null);
        setAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setErrorMessage(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setCurrentUser(res.user);
        setAccessToken(res.accessToken);
        setSuccessMessage('Berhasil masuk dengan akun Google.');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Gagal masuk dengan Google.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    await googleLogout();
    setCurrentUser(null);
    setAccessToken(null);
    const updated: GoogleSheetsSyncConfig = {
      ...syncConfig,
      enabled: false,
    };
    onUpdateSyncConfig(updated);
    saveStoredSyncConfig(updated);
  };

  // 1. Create a brand new synced spreadsheet
  const promptCreateNewSheet = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Buat Spreadsheet Baru untuk Sinkronisasi Realtime',
      description: `Aplikasi akan membuat berkas Google Spreadsheet baru di Google Drive Anda ("${settings.institution}") yang berisi 2 sheet (Rekap Matriks 10 Hari & Statistik) dan mengaktifkan pemantauan sinkronisasi otomatis. Lanjutkan?`,
      action: async () => {
        await executeCreateNewSheet();
      },
    });
  };

  const executeCreateNewSheet = async () => {
    if (!accessToken) {
      setErrorMessage('Silakan masuk dengan akun Google terlebih dahulu.');
      return;
    }
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const res = await createSyncSpreadsheet({
        accessToken,
        sections,
        employees,
        attendance,
        period,
        settings,
      });

      const updated: GoogleSheetsSyncConfig = {
        ...syncConfig,
        enabled: true,
        spreadsheetId: res.spreadsheetId,
        spreadsheetUrl: res.spreadsheetUrl,
        spreadsheetTitle: res.title,
        lastSyncTime: new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        syncStatus: 'synced',
      };

      onUpdateSyncConfig(updated);
      saveStoredSyncConfig(updated);

      if (onSuccessNotification) {
        onSuccessNotification('Google Spreadsheet berhasil dibuat dan terhubung secara realtime!');
      }
      setSuccessMessage('Spreadsheet berhasil dibuat dan sinkronisasi realtime aktif!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Create sheet failed:', err);
      setErrorMessage(err.message || 'Gagal membuat Google Spreadsheet.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Pick existing spreadsheet via Google Picker
  const handlePickSpreadsheet = async () => {
    if (!accessToken) {
      setErrorMessage('Silakan masuk dengan akun Google terlebih dahulu.');
      return;
    }

    try {
      await openSpreadsheetPicker(accessToken, (picked: SelectedSpreadsheet) => {
        setConfirmDialog({
          isOpen: true,
          title: 'Hubungkan ke Spreadsheet Terpilih',
          description: `Aplikasi akan menghubungkan dan memperbarui data absensi secara realtime ke dalam berkas "${picked.name}". Lanjutkan?`,
          action: async () => {
            await executeLinkPickedSpreadsheet(picked);
          },
        });
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Gagal membuka pemilih Google Spreadsheet.');
    }
  };

  const executeLinkPickedSpreadsheet = async (picked: SelectedSpreadsheet) => {
    if (!accessToken) return;
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const verified = await verifySpreadsheetAccess(accessToken, picked.id);

      await syncAttendanceToSpreadsheet({
        accessToken,
        spreadsheetId: picked.id,
        sections,
        employees,
        attendance,
        period,
        settings,
      });

      const updated: GoogleSheetsSyncConfig = {
        ...syncConfig,
        enabled: true,
        spreadsheetId: picked.id,
        spreadsheetUrl: verified.url || picked.url || `https://docs.google.com/spreadsheets/d/${picked.id}/edit`,
        spreadsheetTitle: verified.title || picked.name,
        lastSyncTime: new Date().toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        syncStatus: 'synced',
      };

      onUpdateSyncConfig(updated);
      saveStoredSyncConfig(updated);

      if (onSuccessNotification) {
        onSuccessNotification(`Spreadsheet "${picked.name}" berhasil dihubungkan!`);
      }
      setSuccessMessage('Spreadsheet berhasil dihubungkan dan disinkronkan!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Link sheet failed:', err);
      setErrorMessage(err.message || 'Gagal menghubungkan spreadsheet.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Manual Sync Now
  const handleManualSync = async () => {
    if (!syncConfig.spreadsheetId || !accessToken) return;
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      await onTriggerImmediateSync();
      setSuccessMessage('Data absensi berhasil disinkronkan ke Google Sheets!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyinkronkan data.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Disconnect sync
  const handleDisconnect = () => {
    const updated: GoogleSheetsSyncConfig = {
      ...syncConfig,
      enabled: false,
      spreadsheetId: null,
      spreadsheetUrl: null,
      spreadsheetTitle: null,
      lastSyncTime: null,
      syncStatus: 'idle',
    };
    onUpdateSyncConfig(updated);
    saveStoredSyncConfig(updated);
    setSuccessMessage('Sinkronisasi Google Sheets telah dinonaktifkan.');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Early return is placed AFTER all hooks have run (React 19 Rule)
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 bg-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl shadow-xs">
              <FileSpreadsheet className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Sinkronisasi Realtime Google Sheets
                </h3>
                <span className="px-2 py-0.5 bg-emerald-500/40 text-emerald-100 text-[10px] font-extrabold rounded-md uppercase tracking-wider">
                  Live Monitoring
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-0.5">
                Pantau kehadiran pegawai secara langsung dan otomatis di spreadsheet Google
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-emerald-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 dark:text-slate-300">
          
          {/* Notification Messages */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-2.5 text-rose-800 dark:text-rose-200 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="flex-1">{errorMessage}</div>
              <button onClick={() => setErrorMessage(null)} className="p-0.5 text-rose-500 hover:text-rose-700">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-start gap-2.5 text-emerald-800 dark:text-emerald-200 text-xs animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <div className="flex-1 font-semibold">{successMessage}</div>
              <button onClick={() => setSuccessMessage(null)} className="p-0.5 text-emerald-500 hover:text-emerald-700">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 1. Google Account Connection Card */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Akun Google Pengguna
                </span>
                {currentUser ? (
                  <div className="flex items-center gap-2.5">
                    {currentUser.photoURL ? (
                      <img
                        src={currentUser.photoURL}
                        alt={currentUser.displayName || ''}
                        className="w-7 h-7 rounded-full border border-slate-300 dark:border-slate-700"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
                        {currentUser.displayName ? currentUser.displayName[0] : 'G'}
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {currentUser.displayName || 'Akun Google Terhubung'}
                      </div>
                      <div className="text-[11px] text-slate-500">{currentUser.email}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-600 dark:text-slate-400">
                    Masuk dengan akun Google untuk mengaktifkan sinkronisasi otomatis ke Google Sheets.
                  </div>
                )}
              </div>

              <div>
                {currentUser ? (
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 rounded-lg text-xs font-semibold transition-all"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Ganti Akun</span>
                  </button>
                ) : (
                  <button
                    onClick={handleSignIn}
                    disabled={isSigningIn}
                    className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>{isSigningIn ? 'Menghubungkan...' : 'Masuk dengan Google'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 2. Sync Status Banner */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-emerald-50/60 to-teal-50/60 dark:from-emerald-950/20 dark:to-teal-950/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-3.5 h-3.5 rounded-full animate-pulse ${
                    syncConfig.enabled && syncConfig.spreadsheetId
                      ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                      : 'bg-slate-400'
                  }`}
                />
                <div>
                  <div className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>
                      {syncConfig.enabled && syncConfig.spreadsheetId
                        ? 'Monitoring Realtime Aktif'
                        : 'Sinkronisasi Belum Terhubung'}
                    </span>
                    {syncConfig.enabled && (
                      <span className="px-2 py-0.5 bg-emerald-600 text-white text-[9px] font-bold rounded-full">
                        LIVE
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {syncConfig.lastSyncTime
                        ? `Pembaruan terakhir: ${syncConfig.lastSyncTime} WIB`
                        : 'Belum ada data yang disinkronkan'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Action Buttons */}
              {syncConfig.enabled && syncConfig.spreadsheetId && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleManualSync}
                    disabled={isProcessing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs transition-all active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                    <span>{isProcessing ? 'Sinkronisasi...' : 'Sinkronkan Sekarang'}</span>
                  </button>

                  <a
                    href={syncConfig.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${syncConfig.spreadsheetId}/edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 font-bold rounded-lg text-xs hover:bg-slate-50 transition-all shadow-2xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Buka Sheets ↗</span>
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* 3. Connected Spreadsheet Info or Connection Options */}
          {syncConfig.enabled && syncConfig.spreadsheetId ? (
            <div className="p-4 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2.5">
                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Spreadsheet Aktif:
                </span>
                <span className="text-[10px] text-slate-400">ID: {syncConfig.spreadsheetId.slice(0, 16)}...</span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    {syncConfig.spreadsheetTitle || 'Rekap Absensi Pegawai'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Berisi 2 sheet: "Rekap Matriks 10 Hari" & "Statistik & Monitoring"
                  </div>
                </div>
                <a
                  href={syncConfig.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${syncConfig.spreadsheetId}/edit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                  title="Buka dokumen di tab baru"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              {/* Automatic sync toggle checkbox */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={syncConfig.autoSyncOnChange}
                  onChange={(e) => {
                    const updated = { ...syncConfig, autoSyncOnChange: e.target.checked };
                    onUpdateSyncConfig(updated);
                    saveStoredSyncConfig(updated);
                  }}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Otomatis kirim pembaruan ke Google Sheets saat ada absensi yang ditandai (Real-time Auto-Sync)
                </span>
              </label>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleDisconnect}
                  className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 font-semibold text-xs"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>Putuskan Sambungan Spreadsheet Ini</span>
                </button>
              </div>
            </div>
          ) : (
            /* Option Cards to Connect */
            <div className="space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Pilih Metode Menghubungkan Google Spreadsheet:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                
                {/* Method 1: Create New Spreadsheet */}
                <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border-2 border-emerald-500/80 rounded-xl flex flex-col justify-between hover:shadow-md transition-all">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-emerald-600 text-white rounded-lg">
                        <PlusCircle className="w-5 h-5" />
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-extrabold rounded">
                        DIREKOMENDASIKAN
                      </span>
                    </div>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                      Buat Spreadsheet Baru
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-1">
                      Sistem akan membuat berkas Google Spreadsheet baru di akun Anda dengan template 2 sheet lengkap, rumus otomatis, & kop instansi.
                    </p>
                  </div>

                  <button
                    onClick={promptCreateNewSheet}
                    disabled={isProcessing || !currentUser}
                    className="mt-4 w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold rounded-lg transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>{isProcessing ? 'Membuat Spreadsheet...' : 'Buat Spreadsheet Baru'}</span>
                  </button>
                </div>

                {/* Method 2: Pick Existing Spreadsheet via Picker */}
                <div className="p-4 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col justify-between hover:shadow-md transition-all">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-slate-700 text-white rounded-lg">
                        <FolderOpen className="w-5 h-5" />
                      </div>
                      <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded">
                        GOOGLE PICKER
                      </span>
                    </div>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                      Pilih dari Google Drive
                    </h4>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-1">
                      Gunakan berkas Google Spreadsheet yang sudah ada di Google Drive Anda untuk disinkronkan secara realtime.
                    </p>
                  </div>

                  <button
                    onClick={handlePickSpreadsheet}
                    disabled={isProcessing || !currentUser}
                    className="mt-4 w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span>Pilih Berkas Spreadsheet</span>
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* 4. Realtime Sync Feature Explanation */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
            <h5 className="font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5 text-xs">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Bagaimana Sinkronisasi Realtime Bekerja?
            </h5>
            <ul className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400 list-disc list-inside">
              <li>
                <strong>Otomatis & Berkala:</strong> Setiap status apel diubah akan otomatis disinkronkan, serta aplikasi melakukan fetch data berkala setiap 20 detik secara realtime.
              </li>
              <li>
                <strong>Dua Lembar Kerja (Sheets):</strong> Lembar pertama berisi tabel matriks 10 hari lengkap, lembar kedua berisi ringkasan statistik per seksi dan status apel.
              </li>
              <li>
                <strong>Bisa Diakses Bersama:</strong> Pimpinan atau rekan kerja dapat membuka tautan Google Spreadsheet untuk memantau kehadiran secara langsung tanpa perlu mengekspor berkas manual berulang kali.
              </li>
            </ul>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            {syncConfig.enabled && syncConfig.spreadsheetId ? (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                <Check className="w-3.5 h-3.5" />
                Terhubung dan terpantau secara realtime
              </span>
            ) : (
              <span>Hubungkan spreadsheet untuk mengaktifkan pemantauan realtime</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all"
          >
            Tutup
          </button>
        </div>

      </div>

      {/* Confirmation Modal (MANDATORY per Google Workspace Guidelines) */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-xl">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {confirmDialog.title}
                </h4>
                <span className="text-[11px] text-slate-400">Konfirmasi Izin Integrasi</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {confirmDialog.description}
            </p>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setConfirmDialog(null)}
                disabled={isProcessing}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs transition-all"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  const action = confirmDialog.action;
                  setConfirmDialog(null);
                  await action();
                }}
                disabled={isProcessing}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5"
              >
                {isProcessing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Lanjutkan Sinkronisasi</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
