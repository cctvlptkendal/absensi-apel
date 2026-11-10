import React, { useState } from 'react';
import { Employee, Section } from '../types/attendance';
import { UserPlus, Trash2, Edit2, MoveRight, Users, PlusCircle, Check, X, AlertTriangle } from 'lucide-react';

interface EmployeeManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  sections: Section[];
  employees: Employee[];
  initialSectionId?: string;
  onAddEmployee: (employee: Omit<Employee, 'id'>) => void;
  onUpdateEmployee: (employee: Employee) => void;
  onDeleteEmployee: (employeeId: string) => void;
  onAddSection: (name: string) => void;
  onUpdateSection: (sectionId: string, newName: string) => void;
  onDeleteSection: (sectionId: string) => void;
}

export const EmployeeManagerModal: React.FC<EmployeeManagerModalProps> = ({
  isOpen,
  onClose,
  sections,
  employees,
  initialSectionId,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  onAddSection,
  onUpdateSection,
  onDeleteSection,
}) => {
  const [activeTab, setActiveTab] = useState<'employees' | 'sections'>('employees');
  const [selectedSection, setSelectedSection] = useState<string>(initialSectionId || sections[0]?.id || '');
  
  // New employee form
  const [newName, setNewName] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [targetSection, setTargetSection] = useState(selectedSection || sections[0]?.id || '');

  // Editing state
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [deleteConfirmEmp, setDeleteConfirmEmp] = useState<Employee | null>(null);

  // New Section form
  const [newSectionName, setNewSectionName] = useState('');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editSectionName, setEditSectionName] = useState('');

  const handleCreateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !targetSection) return;

    const countInSec = employees.filter(e => e.sectionId === targetSection).length;
    onAddEmployee({
      name: newName.trim().toUpperCase(),
      sectionId: targetSection,
      position: newPosition.trim() || undefined,
      order: countInSec + 1,
    });

    setNewName('');
    setNewPosition('');
  };

  const handleSaveEditEmployee = () => {
    if (!editingEmp || !editingEmp.name.trim()) return;
    onUpdateEmployee({
      ...editingEmp,
      name: editingEmp.name.trim().toUpperCase(),
    });
    setEditingEmp(null);
  };

  const handleCreateSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;
    onAddSection(newSectionName.trim().toUpperCase());
    setNewSectionName('');
  };

  const handleSaveEditSection = (secId: string) => {
    if (!editSectionName.trim()) return;
    onUpdateSection(secId, editSectionName.trim().toUpperCase());
    setEditingSectionId(null);
    setEditSectionName('');
  };

  const currentSectionEmployees = employees
    .filter(e => e.sectionId === selectedSection)
    .sort((a, b) => a.order - b.order);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Kelola Personel & Bagian / Seksi
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tambah, kurangi (hapus), ubah nama, dan atur seksi pegawai
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab switch */}
        <div className="px-6 border-b border-slate-200 dark:border-slate-800 flex gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('employees')}
            className={`py-3 border-b-2 transition-all ${
              activeTab === 'employees'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Daftar Pegawai per Bagian ({employees.length} Orang)
          </button>
          <button
            onClick={() => setActiveTab('sections')}
            className={`py-3 border-b-2 transition-all ${
              activeTab === 'sections'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Kelola Daftar Seksi / Unit ({sections.length} Seksi)
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'employees' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Form Tambah Orang */}
              <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-3">
                  <UserPlus className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Tambah Orang Baru
                  </h3>
                </div>

                <form onSubmit={handleCreateEmployee} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Pilih Bagian / Seksi *
                    </label>
                    <select
                      value={targetSection}
                      onChange={(e) => setTargetSection(e.target.value)}
                      required
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {sections.map((sec) => (
                        <option key={sec.id} value={sec.id}>
                          {sec.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Nama Lengkap Pegawai *
                    </label>
                    <input
                      type="text"
                      placeholder="CONTOH: BUDI SANTOSO"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      required
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Jabatan / Peran (Opsional)
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Staf Pelaksana, Petugas Pengamanan..."
                      value={newPosition}
                      onChange={(e) => setNewPosition(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>



                  <button
                    type="submit"
                    className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-1.5 mt-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Tambahkan ke Bagian</span>
                  </button>
                </form>
              </div>

              {/* Right Column: Daftar Orang per Seksi & Opsi Kurangi/Ubah */}
              <div className="lg:col-span-7 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      Lihat Bagian:
                    </span>
                    <select
                      value={selectedSection}
                      onChange={(e) => setSelectedSection(e.target.value)}
                      className="text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-800 dark:text-slate-200 focus:outline-none"
                    >
                      {sections.map(s => {
                        const count = employees.filter(e => e.sectionId === s.id).length;
                        return (
                          <option key={s.id} value={s.id}>
                            {s.name} ({count} Orang)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <span className="text-xs font-medium text-slate-500">
                    Total di bagian ini: <strong>{currentSectionEmployees.length} Orang</strong>
                  </span>
                </div>

                {/* Employee List */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-800 max-h-96 overflow-y-auto">
                  {currentSectionEmployees.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs italic">
                      Tidak ada pegawai di bagian ini. Gunakan formulir di sebelah kiri untuk menambahkan.
                    </div>
                  ) : (
                    currentSectionEmployees.map((emp, index) => (
                      <div
                        key={emp.id}
                        className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between gap-3 text-xs transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 text-center text-slate-400 font-bold">
                            {index + 1}
                          </span>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-slate-100">
                              {emp.name}
                            </div>
                            {emp.position && (
                              <div className="text-[11px] text-slate-500">
                                {emp.position}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingEmp(emp)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-md transition-colors"
                            title="Edit nama / pindah bagian"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmEmp(emp)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-md transition-colors"
                            title="Kurangi / Hapus orang ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Tab: Sections Manager */
            <div className="space-y-6">
              {/* Form Tambah Seksi */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-indigo-600" />
                  Tambah Seksi / Bagian Baru
                </h3>
                <form onSubmit={handleCreateSection} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="CONTOH: SEKSI BIMKEMAS / KAMTIB / REGISTRASI"
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    required
                    className="flex-1 text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                  >
                    Tambah Seksi
                  </button>
                </form>
              </div>

              {/* List of Sections */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-200 dark:divide-slate-800">
                {sections.map((sec, idx) => {
                  const empCount = employees.filter(e => e.sectionId === sec.id).length;
                  const isEditing = editingSectionId === sec.id;

                  return (
                    <div
                      key={sec.id}
                      className="p-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-between text-xs transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <span className="font-bold text-slate-400 w-5">{idx + 1}</span>
                        {isEditing ? (
                          <div className="flex items-center gap-2 flex-1 max-w-md">
                            <input
                              type="text"
                              value={editSectionName}
                              onChange={(e) => setEditSectionName(e.target.value)}
                              className="w-full text-xs px-2.5 py-1 border border-indigo-400 rounded-md uppercase"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveEditSection(sec.id)}
                              className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                              title="Simpan"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingSectionId(null)}
                              className="p-1 bg-slate-300 text-slate-700 rounded hover:bg-slate-400"
                              title="Batal"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div>
                            <span className="font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                              {sec.name}
                            </span>
                            <span className="ml-3 text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full font-semibold">
                              {empCount} Orang
                            </span>
                          </div>
                        )}
                      </div>

                      {!isEditing && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingSectionId(sec.id);
                              setEditSectionName(sec.name);
                            }}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 rounded transition-colors"
                            title="Ubah nama seksi"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (empCount > 0) {
                                alert(`Seksi ini masih memiliki ${empCount} orang pegawai. Pindahkan atau hapus pegawainya terlebih dahulu.`);
                                return;
                              }
                              onDeleteSection(sec.id);
                            }}
                            className="p-1.5 text-slate-500 hover:text-rose-600 rounded transition-colors"
                            title="Hapus seksi"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Total Seluruh Personel: <strong>{employees.length} Pegawai</strong> di <strong>{sections.length} Seksi</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white rounded-lg font-semibold transition-colors"
          >
            Selesai
          </button>
        </div>

      </div>

      {/* Edit Employee Submodal */}
      {editingEmp && (
        <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-4">
              Ubah Data Pegawai
            </h3>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">
                  Nama Lengkap:
                </label>
                <input
                  type="text"
                  value={editingEmp.name}
                  onChange={(e) => setEditingEmp({ ...editingEmp, name: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg uppercase"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">
                  Pindah Bagian / Seksi:
                </label>
                <select
                  value={editingEmp.sectionId}
                  onChange={(e) => setEditingEmp({ ...editingEmp, sectionId: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  {sections.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">
                  Jabatan:
                </label>
                <input
                  type="text"
                  value={editingEmp.position || ''}
                  onChange={(e) => setEditingEmp({ ...editingEmp, position: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setEditingEmp(null)}
                className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={handleSaveEditEmployee}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Employee Confirmation Modal */}
      {deleteConfirmEmp && (
        <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-3 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-sm">Hapus / Kurangi Pegawai</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mb-4">
              Apakah Anda yakin ingin menghapus <strong>{deleteConfirmEmp.name}</strong> dari daftar absensi bagian ini?
            </p>
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setDeleteConfirmEmp(null)}
                className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  onDeleteEmployee(deleteConfirmEmp.id);
                  setDeleteConfirmEmp(null);
                }}
                className="px-4 py-1.5 bg-rose-600 text-white rounded-lg font-semibold hover:bg-rose-700"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
