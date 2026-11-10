import React, { useState } from 'react';
import { PeriodConfig, PeriodPreset } from '../types/attendance';
import { Calendar, ChevronLeft, ChevronRight, CheckCircle2, Search, Filter, Sparkles } from 'lucide-react';

interface PeriodSelectorProps {
  period: PeriodConfig;
  onPeriodChange: (newPeriod: PeriodConfig) => void;
  onSetAllPresent: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedSectionFilter: string;
  onSectionFilterChange: (sectionId: string) => void;
  sections: { id: string; name: string }[];
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  period,
  onPeriodChange,
  onSetAllPresent,
  searchQuery,
  onSearchChange,
  selectedSectionFilter,
  onSectionFilterChange,
  sections,
}) => {
  const [isCustomOpen, setIsCustomOpen] = useState(false);

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const handlePresetSelect = (preset: PeriodPreset) => {
    const daysInMonth = getDaysInMonth(period.year, period.month);
    let startDay = 1;
    let endDay = 10;

    if (preset === 'p1') {
      startDay = 1;
      endDay = 10;
    } else if (preset === 'p2') {
      startDay = 11;
      endDay = 20;
    } else if (preset === 'p3') {
      startDay = 21;
      endDay = daysInMonth;
    }

    const monthStr = String(period.month + 1).padStart(2, '0');
    const startStr = `${period.year}-${monthStr}-${String(startDay).padStart(2, '0')}`;
    const endStr = `${period.year}-${monthStr}-${String(endDay).padStart(2, '0')}`;

    onPeriodChange({
      ...period,
      preset,
      startDate: startStr,
      endDate: endStr,
    });
    setIsCustomOpen(false);
  };

  const handleMonthChange = (direction: number) => {
    let newMonth = period.month + direction;
    let newYear = period.year;

    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }

    const daysInMonth = getDaysInMonth(newYear, newMonth);
    let startDay = 1;
    let endDay = 10;

    if (period.preset === 'p2') {
      startDay = 11;
      endDay = 20;
    } else if (period.preset === 'p3') {
      startDay = 21;
      endDay = daysInMonth;
    }

    const monthStr = String(newMonth + 1).padStart(2, '0');
    const startStr = `${newYear}-${monthStr}-${String(startDay).padStart(2, '0')}`;
    const endStr = `${newYear}-${monthStr}-${String(endDay).padStart(2, '0')}`;

    onPeriodChange({
      ...period,
      year: newYear,
      month: newMonth,
      startDate: startStr,
      endDate: endStr,
    });
  };

  const handleCustomDateChange = (start: string, end: string) => {
    onPeriodChange({
      ...period,
      preset: 'custom',
      startDate: start,
      endDate: end,
    });
  };

  const startDayNum = parseInt(period.startDate.split('-')[2], 10) || 1;
  const endDayNum = parseInt(period.endDate.split('-')[2], 10) || 10;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Month & Year Navigation */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Bulan & Tahun Rekap
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleMonthChange(-1)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-600 dark:text-slate-300 transition-colors"
                title="Bulan Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-slate-800 dark:text-slate-100 min-w-32 text-center text-base">
                {MONTH_NAMES[period.month]} {period.year}
              </span>
              <button
                onClick={() => handleMonthChange(1)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-600 dark:text-slate-300 transition-colors"
                title="Bulan Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 10-Day Period Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1 hidden sm:inline">
            Pilihan Periode 10 Hari:
          </span>
          <button
            onClick={() => handlePresetSelect('p1')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              period.preset === 'p1'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Periode I (Tgl 1 - 10)
          </button>

          <button
            onClick={() => handlePresetSelect('p2')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              period.preset === 'p2'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Periode II (Tgl 11 - 20)
          </button>

          <button
            onClick={() => handlePresetSelect('p3')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              period.preset === 'p3'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Periode III (Tgl 21 - Akhir)
          </button>

          <button
            onClick={() => setIsCustomOpen(!isCustomOpen)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              period.preset === 'custom'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Rentang Kustom...
          </button>
        </div>

        {/* Quick Batch Fill Action */}
        <div className="flex items-center gap-2">
          <button
            onClick={onSetAllPresent}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-semibold transition-all shadow-xs"
            title="Tandai seluruh pegawai Hadir (H) untuk seluruh tanggal aktif ini (hari kerja)"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Isi Semua Hadir (H)</span>
          </button>
        </div>
      </div>

      {/* Custom Date Range Popdown */}
      {isCustomOpen && (
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Tentukan Rentang Tanggal Manual:
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Mulai:</label>
            <input
              type="date"
              value={period.startDate}
              onChange={(e) => handleCustomDateChange(e.target.value, period.endDate)}
              className="text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1 text-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Sampai:</label>
            <input
              type="date"
              value={period.endDate}
              onChange={(e) => handleCustomDateChange(period.startDate, e.target.value)}
              className="text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1 text-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="text-xs text-slate-500 italic">
            Rentang terpilih: Tanggal {startDayNum} s.d. {endDayNum} ({MONTH_NAMES[period.month]} {period.year})
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama pegawai atau jabatan..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500">Filter Bagian:</span>
          <select
            value={selectedSectionFilter}
            onChange={(e) => onSectionFilterChange(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            <option value="ALL">Semua Bagian / Seksi ({sections.length} Seksi)</option>
            {sections.map((sec) => (
              <option key={sec.id} value={sec.id}>
                {sec.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
