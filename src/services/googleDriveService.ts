/**
 * Google Drive & Google Picker Service for AI Studio Applet
 * Implements Firebase Auth (OAuth2), Google Picker API, and Google Drive File Upload
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Ensure singleton Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Configure Google OAuth Provider with least-privilege Drive & Picker scopes
export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
];

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// In-memory token storage (Do NOT store in localStorage/sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // If user is logged into Firebase Auth but memory token expired, wait for user action
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google (MUST be called from user gesture)
export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses dari Google Auth.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const googleLogout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

/**
 * Loads the Google Picker API script (gapi.load)
 */
export const loadGooglePickerScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Window undefined'));

    // Check if gapi is loaded
    const gapi = (window as any).gapi;
    if (gapi) {
      if ((window as any).google?.picker) {
        resolve();
      } else {
        gapi.load('picker', {
          callback: () => resolve(),
          onerror: () => reject(new Error('Gagal memuat Google Picker API.')),
        });
      }
      return;
    }

    // Otherwise load script dynamically
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const g = (window as any).gapi;
      if (g) {
        g.load('picker', {
          callback: () => resolve(),
          onerror: () => reject(new Error('Gagal memuat Google Picker API.')),
        });
      } else {
        reject(new Error('gapi tidak ditemukan setelah script dimuat.'));
      }
    };
    script.onerror = () => reject(new Error('Gagal mengunduh script Google API.'));
    document.body.appendChild(script);
  });
};

export interface SelectedFolder {
  id: string;
  name: string;
  url?: string;
}

/**
 * Opens Google Picker widget to select a destination folder in Google Drive
 */
export const openFolderPicker = async (
  accessToken: string,
  onFolderPicked: (folder: SelectedFolder) => void,
  onCancel?: () => void
): Promise<void> => {
  await loadGooglePickerScript();

  const google = (window as any).google;
  if (!google?.picker) {
    throw new Error('Google Picker API tidak tersedia.');
  }

  // Calculate picker origin according to Google Workspace iframe guidelines
  const pickerOrigin =
    window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0
      ? window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1]
      : window.location.origin;

  // Configure view for Folders
  const folderView = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
    .setMimeTypes('application/vnd.google-apps.folder')
    .setSelectFolderEnabled(true)
    .setIncludeFolders(true);

  // DocsView for general browsing
  const allDocsView = new google.picker.DocsView(google.picker.ViewId.DOCS)
    .setIncludeFolders(true)
    .setSelectFolderEnabled(true);

  const picker = new google.picker.PickerBuilder()
    .setTitle('Pilih Folder Tujuan di Google Drive')
    .addView(folderView)
    .addView(allDocsView)
    .setOAuthToken(accessToken)
    .setOrigin(pickerOrigin)
    .setCallback((data: any) => {
      if (data.action === google.picker.Action.PICKED) {
        const doc = data.docs[0];
        onFolderPicked({
          id: doc.id,
          name: doc.name || 'Folder Google Drive',
          url: doc.url,
        });
      } else if (data.action === google.picker.Action.CANCEL) {
        if (onCancel) onCancel();
      }
    })
    .build();

  picker.setVisible(true);
};

export interface SelectedSpreadsheet {
  id: string;
  name: string;
  url?: string;
}

/**
 * Opens Google Picker widget to select a Google Spreadsheet file
 */
export const openSpreadsheetPicker = async (
  accessToken: string,
  onSpreadsheetPicked: (spreadsheet: SelectedSpreadsheet) => void,
  onCancel?: () => void
): Promise<void> => {
  await loadGooglePickerScript();

  const google = (window as any).google;
  if (!google?.picker) {
    throw new Error('Google Picker API tidak tersedia.');
  }

  const pickerOrigin =
    window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0
      ? window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1]
      : window.location.origin;

  const sheetsView = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS)
    .setMimeTypes('application/vnd.google-apps.spreadsheet')
    .setIncludeFolders(true);

  const picker = new google.picker.PickerBuilder()
    .setTitle('Pilih Berkas Google Spreadsheet untuk Sinkronisasi')
    .addView(sheetsView)
    .setOAuthToken(accessToken)
    .setOrigin(pickerOrigin)
    .setCallback((data: any) => {
      if (data.action === google.picker.Action.PICKED) {
        const doc = data.docs[0];
        onSpreadsheetPicked({
          id: doc.id,
          name: doc.name || 'Google Spreadsheet',
          url: doc.url,
        });
      } else if (data.action === google.picker.Action.CANCEL) {
        if (onCancel) onCancel();
      }
    })
    .build();

  picker.setVisible(true);
};

export interface UploadResult {
  fileId: string;
  name: string;
  webViewLink?: string;
  webContentLink?: string;
}

/**
 * Uploads a file Blob directly to Google Drive via Drive v3 Multipart API
 */
export const uploadFileToGoogleDrive = async ({
  fileName,
  mimeType,
  blob,
  folderId,
  accessToken,
}: {
  fileName: string;
  mimeType: string;
  blob: Blob;
  folderId?: string;
  accessToken: string;
}): Promise<UploadResult> => {
  const metadata: Record<string, any> = {
    name: fileName,
    mimeType: mimeType,
  };

  if (folderId && folderId !== 'root') {
    metadata.parents = [folderId];
  }

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const metadataPart =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n` +
    'Content-Transfer-Encoding: base64\r\n\r\n';

  // Convert binary to base64
  let binaryString = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }
  const base64Data = btoa(binaryString);

  const multipartBody = metadataPart + base64Data + closeDelimiter;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorMsg = 'Gagal mengunggah file ke Google Drive.';
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error?.message) {
        errorMsg += ` ${parsed.error.message}`;
      }
    } catch {
      errorMsg += ` (${response.status} ${response.statusText})`;
    }
    throw new Error(errorMsg);
  }

  const result = await response.json();
  return {
    fileId: result.id,
    name: result.name,
    webViewLink: result.webViewLink,
    webContentLink: result.webContentLink,
  };
};
