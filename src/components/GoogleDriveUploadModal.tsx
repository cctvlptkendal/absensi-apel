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
  openFolderPicker,
  uploadFileToGoogleDrive,
  SelectedFolder,
  UploadResult,
} from '../services/googleDriveService';
import { generateAttendanceExcelBlob, generateAttendanceCSVBlob, getDateColumns } from '../utils/excelExporter';
import { generateAttendancePDFBlob, generateDailyAttendancePDFBlob } from '../utils/pdfExporter';
import {
  Cloud,
  CloudUpload,
  Folder,
  FolderOpen,
  CheckCircle2,
  ExternalLink,
  Loader2,
  LogOut,
  X,
  FileSpreadsheet,
  FileDown,
  FileText,
  AlertCircle,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';

interface GoogleDriveUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  sections: Section[];
  employees: Employee[];
  attendance: Record<string, AttendanceRecord>;
  period: PeriodConfig;
  settings: ExportSettings;
  defaultFileType?: 'excel' | 'pdf' | 'dailyPdf' | 'csv';
  initialDailyDate?: string;
  onSuccessNotification?: (message: string, fileUrl?: string) => void;
}

export const GoogleDriveUploadModal: React.FC<GoogleDriveUploadModalProps> = ({
  isOpen,
  onClose,
  sections,
  employees,
  attendance,
  period,
  settings,
  defaultFileType = 'pdf',
  initialDailyDate,
  onSuccessNotification,
}) => {
  const dateCols = getDateColumns(period);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(auth.currentUser);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<SelectedFolder>({
    id: 'root',
    name: 'My Drive (Folder Utama)',
  });
  const [isPickingFolder, setIsPickingFolder] = useState(false);

  // File type selection
  const [selectedFileType, setSelectedFileType] = useState<'excel' | 'pdf' | 'dailyPdf' | 'csv'>(defaultFileType);
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>(
    initialDailyDate || dateCols[0]?.dateStr || period.startDate
  );

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<UploadResult | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingFileData, setPendingFileData] = useState<{
    fileName: string;
    mimeType: string;
    blob: Blob;
  } | null>(null);

  // Listen for Auth State
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
    setUploadError(null);
    try {
      const result = await googleSignIn();
      setCurrentUser(result.user);
      setAccessToken(result.accessToken);
    } catch (err: any) {
      console.error('Sign-in failed', err);
      setUploadError(err.message || 'Gagal masuk dengan Google.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await googleLogout();
      setCurrentUser(null);
      setAccessToken(null);
      setSelectedFolder({ id: 'root', name: 'My Drive (Folder Utama)' });
      setUploadSuccess(null);
    } catch (err) {
      console.error('Logout error', err);
    }
  };

  // Open Google Picker
  const handleOpenFolderPicker = async () => {
    if (!accessToken) {
      await handleSignIn();
      return;
    }

    setIsPickingFolder(true);
    setUploadError(null);
    try {
      await openFolderPicker(
        accessToken,
        (folder) => {
          setSelectedFolder(folder);
          setIsPickingFolder(false);
        },
        () => {
          setIsPickingFolder(false);
        }
      );
    } catch (err: any) {
      console.error('Picker error:', err);
      setUploadError(err.message || 'Gagal membuka Google Picker.');
      setIsPickingFolder(false);
    }
  };

  // Generate file blob based on selection
  const generateSelectedFile = (): { fileName: string; mimeType: string; blob: Blob } => {
    if (selectedFileType === 'excel') {
      const { blob, fileName } = generateAttendanceExcelBlob({
        sections,
        employees,
        attendance,
        period,
        settings,
      });
      return {
        fileName,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        blob,
      };
    } else if (selectedFileType === 'pdf') {
      const { blob, fileName } = generateAttendancePDFBlob({
        sections,
        employees,
        attendance,
        period,
        settings,
      });
      return {
        fileName,
        mimeType: 'application/pdf',
        blob,
      };
    } else if (selectedFileType === 'dailyPdf') {
      const { blob, fileName } = generateDailyAttendancePDFBlob({
        dateStr: selectedDailyDate,
        sections,
        employees,
        attendance,
        period,
        settings,
      });
      return {
        fileName,
        mimeType: 'application/pdf',
        blob,
      };
    } else {
      const { blob, fileName } = generateAttendanceCSVBlob({
        sections,
        employees,
        attendance,
        period,
        settings,
      });
      return {
        fileName,
        mimeType: 'text/csv',
        blob,
      };
    }
  };

  // Initiate Upload: Shows MANDATORY Confirmation Dialog
  const handleInitiateUpload = () => {
    setUploadError(null);
    setUploadSuccess(null);

    if (!currentUser || !accessToken) {
      handleSignIn();
      return;
    }

    try {
      const fileData = generateSelectedFile();
      setPendingFileData(fileData);
      setShowConfirmDialog(true);
    } catch (err: any) {
      setUploadError('Gagal menyiapkan berkas laporan: ' + err.message);
    }
  };

  // Confirmed Execution of Upload
  const handleExecuteUpload = async () => {
    if (!pendingFileData || !accessToken) return;

    setShowConfirmDialog(false);
    setIsUploading(true);
    setUploadError(null);

    try {
      const result = await uploadFileToGoogleDrive({
        fileName: pendingFileData.fileName,
        mimeType: pendingFileData.mimeType,
        blob: pendingFileData.blob,
        folderId: selectedFolder.id,
        accessToken,
      });

      setUploadSuccess(result);
      if (onSuccessNotification) {
        onSuccessNotification(
          `Berkas "${result.name}" berhasil diunggah ke Google Drive!`,
          result.webViewLink
        );
      }
    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploadError(err.message || 'Terjadi kesalahan saat mengunggah ke Google Drive.');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
              <CloudUpload className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                  Simpan Laporan ke Google Drive
                </h3>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 text-[10px] font-bold rounded-md">
                  GOOGLE PICKER
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pilih folder Drive dan unggah berkas laporan absensi secara langsung
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* Error Banner */}
          {uploadError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-2.5 text-rose-800 dark:text-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold">Gagal: </span>
                <span>{uploadError}</span>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {uploadSuccess && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl space-y-2.5 text-emerald-900 dark:text-emerald-100">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-extrabold text-sm">Berhasil Diunggah ke Google Drive!</span>
              </div>
              <p className="text-xs text-emerald-800 dark:text-emerald-200">
                Berkas <strong>{uploadSuccess.name}</strong> telah disimpan dengan aman di folder{' '}
                <strong>{selectedFolder.name}</strong>.
              </p>
              {uploadSuccess.webViewLink && (
                <div className="pt-1 flex gap-2">
                  <a
                    href={uploadSuccess.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors"
                  >
                    <span>Buka Berkas di Google Drive</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => setUploadSuccess(null)}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Unggah File Lain
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Google Account Connection */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-extrabold text-[11px] text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>1. Akun Google Terhubung</span>
              </span>

              {currentUser && (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-700 font-semibold hover:underline"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Keluar Akun</span>
                </button>
              )}
            </div>

            {currentUser ? (
              <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                <div className="flex items-center gap-3">
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || 'User'}
                      className="w-9 h-9 rounded-full border border-slate-200"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center text-sm">
                      {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'G'}
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      {currentUser.displayName || 'Pengguna Google'}
                    </div>
                    <div className="text-[11px] text-slate-500">{currentUser.email}</div>
                  </div>
                </div>

                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-bold rounded-md flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Terhubung</span>
                </span>
              </div>
            ) : (
              <div className="text-center py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                <p className="text-slate-600 dark:text-slate-400 mb-3 text-xs">
                  Masuk dengan akun Google Anda untuk mengizinkan penyimpanan berkas laporan ke Google Drive.
                </p>
                <button
                  onClick={handleSignIn}
                  disabled={isSigningIn}
                  className="inline-flex items-center gap-2.5 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold rounded-lg shadow-xs transition-all active:scale-95 disabled:opacity-50"
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
                  <span>{isSigningIn ? 'Menghubungkan...' : 'Masuk dengan Akun Google'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Step 2: Destination Folder (Google Picker) */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <span className="font-extrabold text-[11px] text-slate-700 dark:text-slate-300 uppercase tracking-wide block mb-2.5">
              2. Folder Tujuan di Google Drive
            </span>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded-lg shrink-0">
                  <Folder className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Folder Terpilih:</div>
                  <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                    {selectedFolder.name}
                  </div>
                </div>
              </div>

              <button
                onClick={handleOpenFolderPicker}
                disabled={isPickingFolder || !currentUser}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700 disabled:opacity-50 shrink-0"
              >
                {isPickingFolder ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                ) : (
                  <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
                )}
                <span>{isPickingFolder ? 'Membuka Picker...' : 'Pilih Folder (Google Picker)'}</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              💡 Klik "Pilih Folder (Google Picker)" untuk mencari atau memilih folder arsip di Google Drive Anda.
            </p>
          </div>

          {/* Step 3: Choose Format to Upload */}
          <div className="space-y-2.5">
            <span className="font-extrabold text-[11px] text-slate-700 dark:text-slate-300 uppercase tracking-wide block">
              3. Pilih Dokumen yang Ingin Diunggah:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* PDF Rekap 10 Hari */}
              <button
                type="button"
                onClick={() => setSelectedFileType('pdf')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  selectedFileType === 'pdf'
                    ? 'border-rose-500 bg-rose-50/60 dark:bg-rose-950/30 ring-2 ring-rose-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="p-1.5 bg-rose-600 text-white rounded-md shrink-0 mt-0.5">
                  <FileDown className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    PDF Rekap 10 Hari (.pdf)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    A4 Landscape resmi (Matriks & Pengesahan)
                  </div>
                </div>
              </button>

              {/* Excel Rekap 10 Hari */}
              <button
                type="button"
                onClick={() => setSelectedFileType('excel')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  selectedFileType === 'excel'
                    ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="p-1.5 bg-emerald-600 text-white rounded-md shrink-0 mt-0.5">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    Excel Rekap 10 Hari (.xlsx)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    2 Sheet lengkap (Matriks & Statistik)
                  </div>
                </div>
              </button>

              {/* PDF Rekap Harian */}
              <button
                type="button"
                onClick={() => setSelectedFileType('dailyPdf')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  selectedFileType === 'dailyPdf'
                    ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="p-1.5 bg-indigo-600 text-white rounded-md shrink-0 mt-0.5">
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    PDF Rekap Apel Harian (.pdf)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Laporan tanggal per seksi & izin/sakit
                  </div>
                </div>
              </button>

              {/* CSV */}
              <button
                type="button"
                onClick={() => setSelectedFileType('csv')}
                className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                  selectedFileType === 'csv'
                    ? 'border-slate-700 bg-slate-100 dark:bg-slate-800 ring-2 ring-slate-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="p-1.5 bg-slate-700 text-white rounded-md shrink-0 mt-0.5">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    File Tabel CSV (.csv)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Format tabel universal
                  </div>
                </div>
              </button>
            </div>

            {/* Daily Date Selector if dailyPdf selected */}
            {selectedFileType === 'dailyPdf' && (
              <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center justify-between gap-3 animate-in fade-in">
                <span className="font-semibold text-indigo-950 dark:text-indigo-200">
                  Pilih Tanggal Laporan Harian:
                </span>
                <select
                  value={selectedDailyDate}
                  onChange={(e) => setSelectedDailyDate(e.target.value)}
                  className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-lg text-xs font-bold text-slate-900 dark:text-slate-100"
                >
                  {dateCols.map((d) => (
                    <option key={d.dateStr} value={d.dateStr}>
                      {d.dayName}, {d.dayNum} ({d.dateStr}) {d.isWeekend ? '- Libur' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl font-semibold transition-colors"
          >
            Tutup
          </button>

          <button
            onClick={handleInitiateUpload}
            disabled={isUploading}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-extrabold rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Mengunggah ke Drive...</span>
              </>
            ) : (
              <>
                <CloudUpload className="w-4 h-4" />
                <span>Unggah ke Google Drive</span>
              </>
            )}
          </button>
        </div>

        {/* MANDATORY Confirmation Dialog before mutation/upload */}
        {showConfirmDialog && pendingFileData && (
          <div className="fixed inset-0 z-60 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded-xl">
                  <Cloud className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                    Konfirmasi Unggah ke Google Drive
                  </h4>
                  <p className="text-xs text-slate-500">Izin penyimpanan dokumen laporan</p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1.5 text-xs">
                <div className="text-slate-500">Nama Berkas:</div>
                <div className="font-bold text-slate-900 dark:text-slate-100 break-all">
                  {pendingFileData.fileName}
                </div>
                <div className="text-slate-500 pt-1">Folder Tujuan:</div>
                <div className="font-semibold text-blue-600 dark:text-blue-400">
                  📁 {selectedFolder.name}
                </div>
                <div className="text-slate-500 pt-1">Akun Google:</div>
                <div className="font-medium text-slate-700 dark:text-slate-300">
                  {currentUser?.email}
                </div>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Aplikasi akan mengunggah berkas laporan ini ke Google Drive Anda dengan izin Anda. Apakah Anda ingin melanjutkan?
              </p>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setShowConfirmDialog(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleExecuteUpload}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors"
                >
                  Ya, Unggah Sekarang
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
