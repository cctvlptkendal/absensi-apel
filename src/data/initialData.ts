import { Employee, Section, AttendanceRecord, ExportSettings } from '../types/attendance';

export const INITIAL_SECTIONS: Section[] = [
  { id: 'sec-1', name: 'STRUKTURAL', order: 1 },
  { id: 'sec-2', name: 'KESATUAN PENGAMANAN', order: 2 },
  { id: 'sec-3', name: 'SUB BAGIAN TATA USAHA', order: 3 },
  { id: 'sec-4', name: 'SEKSI BINADIK DAN GIATJA', order: 4 },
  { id: 'sec-5', name: 'SEKSI ADM. KAMTIB', order: 5 },
];

export const INITIAL_EMPLOYEES: Employee[] = [
  // STRUKTURAL (12)
  { id: 'emp-101', name: 'NUMAN FAUZI', sectionId: 'sec-1', order: 1, position: 'Pejabat Struktural' },
  { id: 'emp-102', name: 'YOHANES BOSKO AGUNG P', sectionId: 'sec-1', order: 2, position: 'Pejabat Struktural' },
  { id: 'emp-103', name: 'YUDI SUHARTONO', sectionId: 'sec-1', order: 3, position: 'Pejabat Struktural' },
  { id: 'emp-104', name: 'BUDI SRI WIBOWO', sectionId: 'sec-1', order: 4, position: 'Pejabat Struktural' },
  { id: 'emp-105', name: 'IWAN KUSMAWAN', sectionId: 'sec-1', order: 5, position: 'Pejabat Struktural' },
  { id: 'emp-106', name: 'HARIYAWAN EDI HANUM', sectionId: 'sec-1', order: 6, position: 'Pejabat Struktural' },
  { id: 'emp-107', name: 'RUSTAMAJI', sectionId: 'sec-1', order: 7, position: 'Pejabat Struktural' },
  { id: 'emp-108', name: 'YUSRI QURROTU\'AIN', sectionId: 'sec-1', order: 8, position: 'Pejabat Struktural' },
  { id: 'emp-109', name: 'YUGA LESMANA', sectionId: 'sec-1', order: 9, position: 'Pejabat Struktural' },
  { id: 'emp-110', name: 'MURWOTO', sectionId: 'sec-1', order: 10, position: 'Pejabat Struktural' },
  { id: 'emp-111', name: 'PUJI RAHARJO', sectionId: 'sec-1', order: 11, position: 'Pejabat Struktural' },
  { id: 'emp-112', name: 'BUDIYANTO', sectionId: 'sec-1', order: 12, position: 'Pejabat Struktural' },

  // KESATUAN PENGAMANAN (2)
  { id: 'emp-201', name: 'ANASYA FIRDAUS', sectionId: 'sec-2', order: 1, position: 'Staf Pengamanan' },
  { id: 'emp-202', name: 'AGUS NUGROHO', sectionId: 'sec-2', order: 2, position: 'Staf Pengamanan' },

  // SUB BAGIAN TATA USAHA (10)
  { id: 'emp-301', name: 'JOKO SUSANTO', sectionId: 'sec-3', order: 1, position: 'Staf Tata Usaha' },
  { id: 'emp-302', name: 'GIYAN PRIHANDOKO', sectionId: 'sec-3', order: 2, position: 'Staf Kepegawaian' },
  { id: 'emp-303', name: 'NUR IKHSAN', sectionId: 'sec-3', order: 3, position: 'Staf Keuangan' },
  { id: 'emp-304', name: 'ROSYAN ANWAR', sectionId: 'sec-3', order: 4, position: 'Staf Tata Usaha' },
  { id: 'emp-305', name: 'DESI DWI LIANA', sectionId: 'sec-3', order: 5, position: 'Staf Umum' },
  { id: 'emp-306', name: 'AFAN', sectionId: 'sec-3', order: 6, position: 'Staf Rumah Tangga' },
  { id: 'emp-307', name: 'FADHIL HIMAWAN', sectionId: 'sec-3', order: 7, position: 'Staf Tata Usaha' },
  { id: 'emp-308', name: 'DICKY ARDIANSYAH', sectionId: 'sec-3', order: 8, position: 'Staf Tata Usaha' },
  { id: 'emp-309', name: 'DAVIT', sectionId: 'sec-3', order: 9, position: 'Staf Tata Usaha' },
  { id: 'emp-310', name: 'ABIDIN', sectionId: 'sec-3', order: 10, position: 'Staf Tata Usaha' },

  // SEKSI BINADIK DAN GIATJA (17)
  { id: 'emp-401', name: 'AGUS TRIJAYANTO', sectionId: 'sec-4', order: 1, position: 'Staf Binadik' },
  { id: 'emp-402', name: 'AYOM KUSUMO WINAHYU', sectionId: 'sec-4', order: 2, position: 'Staf Binadik' },
  { id: 'emp-403', name: 'CHARANDHI MAHENDRA', sectionId: 'sec-4', order: 3, position: 'Staf Binadik' },
  { id: 'emp-404', name: 'FAJAR ARVIANTO', sectionId: 'sec-4', order: 4, position: 'Staf Giatja' },
  { id: 'emp-405', name: 'GILANG NANDA P.', sectionId: 'sec-4', order: 5, position: 'Staf Giatja' },
  { id: 'emp-406', name: 'RASTRA EKA RIKYANTO', sectionId: 'sec-4', order: 6, position: 'Staf Binadik' },
  { id: 'emp-407', name: 'M. ISNAN NUGROHO', sectionId: 'sec-4', order: 7, position: 'Staf Binadik' },
  { id: 'emp-408', name: 'TYAS NURMALITA E.', sectionId: 'sec-4', order: 8, position: 'Staf Giatja' },
  { id: 'emp-409', name: 'SATRIO AJI GUNAWAN', sectionId: 'sec-4', order: 9, position: 'Staf Binadik' },
  { id: 'emp-410', name: 'IRWINSYAH ASA M.', sectionId: 'sec-4', order: 10, position: 'Staf Giatja' },
  { id: 'emp-411', name: 'ANGGA YOGA P.', sectionId: 'sec-4', order: 11, position: 'Staf Giatja' },
  { id: 'emp-412', name: 'JOKO SUTRISNO', sectionId: 'sec-4', order: 12, position: 'Staf Binadik' },
  { id: 'emp-413', name: 'M. TAUFIK BUDIMAN ZEIN', sectionId: 'sec-4', order: 13, position: 'Staf Binadik' },
  { id: 'emp-414', name: 'F. NUR TAUFIQUL HAKIM', sectionId: 'sec-4', order: 14, position: 'Staf Giatja' },
  { id: 'emp-415', name: 'ROSSI NARENDRA W.', sectionId: 'sec-4', order: 15, position: 'Staf Giatja' },
  { id: 'emp-416', name: 'DIDIN', sectionId: 'sec-4', order: 16, position: 'Staf Giatja' },
  { id: 'emp-417', name: 'M. IRFAN', sectionId: 'sec-4', order: 17, position: 'Staf Binadik' },

  // SEKSI ADM. KAMTIB (7)
  { id: 'emp-501', name: 'MUHAMAD FAIZIN', sectionId: 'sec-5', order: 1, position: 'Staf Kamtib' },
  { id: 'emp-502', name: 'M. DIMAS ALFIAN', sectionId: 'sec-5', order: 2, position: 'Staf Kamtib' },
  { id: 'emp-503', name: 'ARDHI', sectionId: 'sec-5', order: 3, position: 'Staf Kamtib' },
  { id: 'emp-504', name: 'ELIYANTO SARAGE', sectionId: 'sec-5', order: 4, position: 'Staf Kamtib' },
  { id: 'emp-505', name: 'JOKO PURWOKO', sectionId: 'sec-5', order: 5, position: 'Staf Kamtib' },
  { id: 'emp-506', name: 'TODI', sectionId: 'sec-5', order: 6, position: 'Staf Kamtib' },
  { id: 'emp-507', name: 'PRIMADIAN BUDI SATRIYO', sectionId: 'sec-5', order: 7, position: 'Staf Kamtib' },
];

export const INITIAL_EXPORT_SETTINGS: ExportSettings = {
  title: 'REKAP DAFTAR KEHADIRAN APEL PEGAWAI',
  subtitle: 'REKAPITULASI KEHADIRAN APEL 10 HARI',
  institution: 'LEMBAGA PEMASYARAKATAN TERBUKA KELAS IIB KENDAL',
  signatures: {
    city: 'Kendal',
    signDate: '10 November 2024',
    officer1Title: 'Kepala Lembaga Pemasyarakatan',
    officer1Name: 'Yohanes Bosko Agung',
    officer2Title: 'Kepala Subbagian Tata Usaha',
    officer2Name: 'Budiyanto',
  },
};

// Generate realistic initial attendance for November 2024 (e.g. days 1 to 10)
export function generateInitialAttendance(): Record<string, AttendanceRecord> {
  const records: Record<string, AttendanceRecord> = {};
  const year = 2024;
  const month = 10; // November (0-indexed = 10)

  // Dates 1 to 10
  for (let day = 1; day <= 10; day++) {
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${year}-11-${dayStr}`;
    const dateObj = new Date(year, month, day);
    const dayOfWeek = dateObj.getDay(); // 0 is Sunday, 6 is Saturday

    INITIAL_EMPLOYEES.forEach((emp, index) => {
      const key = `${emp.id}_${dateStr}`;
      
      // If Sunday, marked as 'LB' (Libur)
      if (dayOfWeek === 0) {
        records[key] = {
          employeeId: emp.id,
          date: dateStr,
          status: 'LB',
          note: 'Hari Libur',
        };
        return;
      }

      // Default is '✓' (Hadir), with realistic variation
      let status: AttendanceRecord['status'] = '✓';
      let note: string | undefined = undefined;

      // Realistic occasional permits/leaves/dinas/piket
      if (day === 4 && index === 2) {
        status = 'DL';
        note = 'Koordinasi Kanwil';
      } else if (day === 5 && index === 7) {
        status = 'S';
        note = 'Sakit (Flu/Demam)';
      } else if (day === 6 && index === 14) {
        status = 'I';
        note = 'Keperluan Keluarga';
      } else if (day === 8 && index === 25) {
        status = 'C';
        note = 'Cuti Tahunan';
      } else if (day === 9 && index === 40) {
        status = 'DL';
        note = 'Diklat Teknis';
      } else if (emp.sectionId === 'sec-2' && day === 3 && index === 12) {
        status = 'LP';
        note = 'Lepas Piket Malam';
      } else if (emp.sectionId === 'sec-2' && day === 4 && index === 13) {
        status = 'PS';
        note = 'Piket Siang';
      } else if (emp.sectionId === 'sec-5' && day === 7 && index === 45) {
        status = 'LP';
        note = 'Lepas Piket Pengamanan';
      } else if (emp.sectionId === 'sec-5' && day === 8 && index === 46) {
        status = 'PS';
        note = 'Piket Siang';
      }

      records[key] = {
        employeeId: emp.id,
        date: dateStr,
        status,
        note,
      };
    });
  }

  return records;
}
