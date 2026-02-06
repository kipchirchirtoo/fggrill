import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { staffAPI } from '@/lib/api';
import { Loader2, Calendar, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, eachDayOfInterval, startOfYear, endOfYear, getDay, isSameDay } from 'date-fns';

interface YearlyAttendanceHeatmapProps {
    staffId: string;
    year?: number;
    className?: string;
}

interface AttendanceRecord {
    id: string;
    date: string;
    status: 'present' | 'absent' | 'leave' | 'holiday' | 'rest_day';
    clock_in: string | null;
    clock_out: string | null;
    is_late: boolean;
    is_early_exit: boolean;
    hours_worked: number;
}

interface DayStats {
    date: Date;
    record?: AttendanceRecord;
    level: 0 | 1 | 2 | 3 | 4; // 0: No data/Future, 1: Absent/Issue, 2: Late/Early, 3: Present, 4: Perfect
}

export function YearlyAttendanceHeatmap({ staffId, year = new Date().getFullYear(), className }: YearlyAttendanceHeatmapProps) {
    const [loading, setLoading] = useState(true);
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [stats, setStats] = useState<{
        totalPresent: number;
        totalLate: number;
        attendanceRate: number;
        streak: number;
    }>({ totalPresent: 0, totalLate: 0, attendanceRate: 0, streak: 0 });

    useEffect(() => {
        fetchAttendanceData();
    }, [staffId, year]);

    const fetchAttendanceData = async () => {
        setLoading(true);
        try {
            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;

            // Adjust API call to fit the existing API structure
            const response = await staffAPI.getAttendance({
                staff_id: staffId,
                startDate,
                endDate,
                limit: 366 // Ensure we get all days
            });

            if (response.success) {
                const data = response.data || [];
                setRecords(data);
                calculateStats(data);
            }
        } catch (error) {
            console.error('Failed to fetch attendance heatmap data:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (data: AttendanceRecord[]) => {
        const present = data.filter(r => r.status === 'present').length;
        const total = data.length; // Or total working days relative to today
        const late = data.filter(r => r.is_late).length;

        // Simple streak calculation (backwards from today)
        let currentStreak = 0;
        const today = new Date();
        const sorted = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        for (const record of sorted) {
            if (new Date(record.date) > today) continue;
            if (record.status === 'present') {
                currentStreak++;
            } else {
                break;
            }
        }

        setStats({
            totalPresent: present,
            totalLate: late,
            attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
            streak: currentStreak
        });
    };

    // Generate calendar grid
    const calendarGrid = useMemo(() => {
        const start = startOfYear(new Date(year, 0, 1));
        const end = endOfYear(new Date(year, 0, 1));
        const days = eachDayOfInterval({ start, end });

        return days.map(day => {
            const record = records.find(r => isSameDay(new Date(r.date), day));
            let level: DayStats['level'] = 0;

            if (record) {
                if (record.status === 'absent') level = 1;
                else if (record.is_late || record.is_early_exit) level = 2;
                else if (record.status === 'present') level = 3;

                // Bonus level for "Perfect" days (present, not late, not early, full hours)
                if (record.status === 'present' && !record.is_late && !record.is_early_exit && record.hours_worked >= 8) {
                    level = 4;
                }
            } else if (day > new Date()) {
                level = 0; // Future
            }

            return { date: day, record, level };
        });
    }, [records, year]);

    // Group by weeks for the grid display (GitHub style is columns = weeks)
    // 53 columns (weeks), 7 rows (days)
    const weeks = useMemo(() => {
        const weeksArray: DayStats[][] = [];
        let currentWeek: DayStats[] = [];

        // Pad the first week with nulls if year doesn't start on Sunday
        const firstDay = calendarGrid[0];
        const startPadding = getDay(firstDay.date); // 0 = Sunday

        for (let i = 0; i < startPadding; i++) {
            currentWeek.push({ date: new Date(0), level: 0 }); // Placeholder
        }

        calendarGrid.forEach(day => {
            currentWeek.push(day);
            if (currentWeek.length === 7) {
                weeksArray.push(currentWeek);
                currentWeek = [];
            }
        });

        if (currentWeek.length > 0) {
            weeksArray.push(currentWeek); // Last partial week
        }

        return weeksArray;
    }, [calendarGrid]);

    const getLevelColor = (level: number) => {
        switch (level) {
            case 0: return 'bg-stone-100'; // Empty/Future
            case 1: return 'bg-rose-200'; // Absent/Issue
            case 2: return 'bg-yellow-300'; // Late/Warning
            case 3: return 'bg-emerald-300'; // Present
            case 4: return 'bg-emerald-500'; // Perfect
            default: return 'bg-stone-100';
        }
    };

    const getLevelLabel = (level: number) => {
        switch (level) {
            case 1: return 'Absent / Issue';
            case 2: return 'Late / Early Exit';
            case 3: return 'Present';
            case 4: return 'Perfect Attendance';
            default: return 'No Data';
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-stone-400 animate-pulse">
                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                <p className="text-xs uppercase tracking-widest">Loading Records...</p>
            </div>
        );
    }

    return (
        <div className={cn("bg-white rounded-2xl border border-stone-200 p-6", className)}>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-stone-900 tracking-tight flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-stone-500" />
                        Attendance {year}
                    </h3>
                    <p className="text-xs text-stone-500 font-medium mt-1">
                        {stats.totalPresent} days present • {stats.attendanceRate}% Rate • {stats.streak} Day Streak
                    </p>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-3 text-[10px] text-stone-500 font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-rose-200" /> Absent</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-yellow-300" /> Late</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-emerald-300" /> Good</div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-emerald-500" /> Perfect</div>
                </div>
            </div>

            <div className="overflow-x-auto pb-2">
                <div className="flex gap-1 min-w-max">
                    {weeks.map((week, weekIndex) => (
                        <div key={weekIndex} className="flex flex-col gap-1">
                            {week.map((day, dayIndex) => {
                                if (day.date.getTime() === new Date(0).getTime()) {
                                    return <div key={dayIndex} className="w-3 h-3" />; // Spacer
                                }

                                return (
                                    <TooltipProvider key={dayIndex}>
                                        <Tooltip delayDuration={0}>
                                            <TooltipTrigger>
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.5 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ delay: (weekIndex * 7 + dayIndex) * 0.002 }}
                                                    className={cn(
                                                        "w-3 h-3 rounded-sm transition-all hover:ring-2 hover:ring-stone-400 hover:ring-offset-1",
                                                        getLevelColor(day.level)
                                                    )}
                                                />
                                            </TooltipTrigger>
                                            <TooltipContent className="bg-stone-900 text-white border-stone-800 p-3 shadow-xl">
                                                <div className="space-y-1">
                                                    <p className="font-bold text-xs uppercase tracking-wide opacity-50">
                                                        {format(day.date, 'EEEE, MMM d, yyyy')}
                                                    </p>
                                                    <div className="flex items-center gap-2">
                                                        <div className={cn("w-2 h-2 rounded-full", getLevelColor(day.level))} />
                                                        <p className="font-medium text-sm">
                                                            {day.record
                                                                ? getLevelLabel(day.level)
                                                                : (day.date > new Date() ? 'Future' : 'No Record')
                                                            }
                                                        </p>
                                                    </div>

                                                    {day.record && (
                                                        <div className="mt-2 pt-2 border-t border-white/10 space-y-1 text-xs text-stone-300">
                                                            <div className="flex justify-between gap-4">
                                                                <span>In:</span>
                                                                <span className="font-mono text-white">
                                                                    {day.record.clock_in ? format(new Date(day.record.clock_in), 'HH:mm') : '--:--'}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between gap-4">
                                                                <span>Out:</span>
                                                                <span className="font-mono text-white">
                                                                    {day.record.clock_out ? format(new Date(day.record.clock_out), 'HH:mm') : '--:--'}
                                                                </span>
                                                            </div>
                                                            {day.record.hours_worked > 0 && (
                                                                <div className="flex justify-between gap-4">
                                                                    <span>Hours:</span>
                                                                    <span className="font-mono text-white">{day.record.hours_worked.toFixed(1)}h</span>
                                                                </div>
                                                            )}
                                                            {day.record.is_late && (
                                                                <p className="text-yellow-400 font-bold flex items-center gap-1 mt-1">
                                                                    <Clock className="w-3 h-3" /> Late Entry
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Month Labels */}
            <div className="flex text-[9px] font-bold text-stone-400 uppercase tracking-wider mt-2 justify-between px-1">
                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => (
                    <span key={m}>{m}</span>
                ))}
            </div>
        </div>
    );
}
