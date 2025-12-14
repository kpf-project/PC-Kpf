import { NextResponse } from "next/server";
import { listEmployeesFromSupabase, listStoresFromSupabase } from "@/lib/supabaseDirectory";
import {
  
  
  
} from "@/lib/supabaseDirectory";
import { getBranding } from "@/lib/supabaseBranding";
import { fetchAttendanceSheetRows } from "@/lib/supabaseData";
import {
  expandRangesToIsoDates,
  formatRangeLabel,
  formatRangeSummary,
  normalizeRangesFromParams,
} from "@/lib/reportRangeUtils";
import { getLeaves } from "@/lib/supabaseLeaves";
import { getApprovedSwaps } from "@/lib/supabaseDayOffSwaps";
import ExcelJS from "exceljs";
import { stringify } from "csv-stringify/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIME_ZONE =
  process.env.GOOGLE_SHEETS_TIMEZONE?.trim() ||
  process.env.APP_TIMEZONE?.trim() ||
  "Asia/Bangkok";

const DAY_FORMATTER = new Intl.DateTimeFormat("th-TH", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
});

const ISO_DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function getCurrentDateParts() {
  const [year, month, day] = ISO_DAY_FORMATTER.format(new Date()).split("-");
  return {
    year: Number.parseInt(year, 10),
    month: Number.parseInt(month, 10),
    day: Number.parseInt(day, 10),
  };
}

function parseInteger(value: string | null, min: number, max: number) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return null;
  }
  return parsed;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function padNumber(value: number) {
  return value.toString().padStart(2, "0");
}

function getZonedDateParts(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00" + getTimeZoneOffset());
  const formatted = ISO_DAY_FORMATTER.format(date);
  const [year, month, day] = formatted.split("-");
  return {
    year: Number.parseInt(year, 10),
    month: Number.parseInt(month, 10),
    day: Number.parseInt(day, 10),
  };
}

function getTimeZoneOffset() {
  // Get timezone offset for Asia/Bangkok (UTC+7)
  return "+07:00";
}

function buildDayLabel(year: number, month: number, day: number) {
  const isoString = `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}T00:00:00`;
  const date = new Date(isoString + "Z");
  return DAY_FORMATTER.format(date);
}

function formatTime(timeStr: string | null) {
  if (!timeStr) return "";
  // Parse time string (HH:mm or HH:mm:ss)
  const parts = timeStr.split(":");
  if (parts.length < 2) return "";
  const hour = parts[0].padStart(2, "0");
  const minute = parts[1].padStart(2, "0");
  return `${hour}:${minute}`;
}

function getDayOfWeek(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayIndex = date.getUTCDay();
  const thaiDays = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
  return thaiDays[dayIndex];
}

function calculateWorkingHours(checkInTime: string, checkOutTime: string): string {
  if (!checkInTime || !checkOutTime) return "";

  try {
    const [inHour, inMinute] = checkInTime.split(":").map(Number);
    const [outHour, outMinute] = checkOutTime.split(":").map(Number);

    if (isNaN(inHour) || isNaN(inMinute) || isNaN(outHour) || isNaN(outMinute)) {
      return "";
    }

    const inMinutes = inHour * 60 + inMinute;
    const outMinutes = outHour * 60 + outMinute;
    const diffMinutes = outMinutes - inMinutes;

    if (diffMinutes <= 0) return "";

    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;

    if (minutes === 0) {
      return `${hours} ชม.`;
    }
    return `${hours}:${minutes.toString().padStart(2, "0")} ชม.`;
  } catch {
    return "";
  }
}

// Parse attendance data from Supabase rows
type SheetRow = {
  date: string;       // Column A: YYYY-MM-DD
  time: string;       // Column B: HH:mm
  status: string;     // Column C: check-in/check-out
  employeeName: string; // Column D
  storeName: string;  // Column E
  note?: string;      // Column F
  latitude?: string;  // Column G
  longitude?: string; // Column H
  accuracy?: string;  // Column I
  location?: string;  // Column J
  imageFormula?: string; // Column K
  photoLink?: string; // Column L
  timestamp?: string; // Column M
};

function parseSheetRow(values: unknown[]): SheetRow | null {
  if (!values || values.length < 5) return null;

  const stringValues = values.map(v => String(v || ""));

  return {
    date: stringValues[0] || "",
    time: stringValues[1] || "",
    status: stringValues[2] || "",
    employeeName: stringValues[3] || "",
    storeName: stringValues[4] || "",
    note: stringValues[5] || "",
    latitude: stringValues[6] || "",
    longitude: stringValues[7] || "",
    accuracy: stringValues[8] || "",
    location: stringValues[9] || "",
    imageFormula: stringValues[10] || "",
    photoLink: stringValues[11] || "",
    timestamp: stringValues[12] || "",
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get("format");
    const employeeId = url.searchParams.get("employeeId");
    if (!employeeId) {
      return NextResponse.json(
        { ok: false, message: "กรุณาเลือกพนักงานที่ต้องการออกรายงาน" },
        { status: 400 },
      );
    }

    // Validate format if provided
    if (format && format !== "csv" && format !== "excel") {
      return NextResponse.json(
        { ok: false, message: "รูปแบบไฟล์ไม่ถูกต้อง (รองรับ csv และ excel เท่านั้น)" },
        { status: 400 },
      );
    }

    const current = getCurrentDateParts();
    const monthParam = parseInteger(url.searchParams.get("month"), 1, 12);
    const yearParam = parseInteger(url.searchParams.get("year"), 2000, 3000);
    const dayParam = url.searchParams.has("day")
      ? parseInteger(url.searchParams.get("day"), 1, 31)
      : null;

    const page = parseInteger(url.searchParams.get("page"), 1, 1000) ?? 1;
    // pageSize is not used in month-based pagination, but kept for backward compatibility
    // const pageSize = parseInteger(url.searchParams.get("pageSize"), 10, 100) ?? 50;

    const rangeValues = url.searchParams.getAll("range");
    let ranges = normalizeRangesFromParams(rangeValues, TIME_ZONE);
    if (ranges.length === 0) {
      const year = yearParam ?? current.year;
      const month = monthParam ?? current.month;
      const dayCount = getDaysInMonth(year, month);
      if (dayParam && (dayParam < 1 || dayParam > dayCount)) {
        return NextResponse.json(
          { ok: false, message: "วันที่ที่เลือกไม่อยู่ในช่วงที่กำหนด" },
          { status: 400 },
        );
      }
      let startDay = 1;
      let endDay = dayCount;
      if (dayParam && dayParam >= 1 && dayParam <= dayCount) {
        startDay = dayParam;
        endDay = dayParam;
      }
      const startIso = `${year.toString().padStart(4, "0")}-${padNumber(month)}-${padNumber(startDay)}`;
      const endIso = `${year.toString().padStart(4, "0")}-${padNumber(month)}-${padNumber(endDay)}`;
      const startDate = new Date(Date.UTC(year, month - 1, startDay));
      const endDate = new Date(Date.UTC(year, month - 1, endDay));
      ranges = [
        {
          startIso,
          endIso,
          label: formatRangeLabel(startDate, endDate, TIME_ZONE),
          startDate,
          endDate,
        },
      ];
    }

    const rangeSummary = formatRangeSummary(ranges);
    const isoDates = expandRangesToIsoDates(ranges);
    const isoDateSet = new Set(isoDates);
    const sortedIsoDates = Array.from(isoDateSet).sort();
    const rangeStartIso = sortedIsoDates[0];
    const rangeEndIso = sortedIsoDates[sortedIsoDates.length - 1];
    if (!rangeStartIso || !rangeEndIso) {
      return NextResponse.json(
        { ok: false, message: "��ǧ�ѹ������١��ͧ" },
        { status: 400 },
      );
    }

    const [employees, stores, branding] = await Promise.all([
      listEmployeesFromSupabase(),
      listStoresFromSupabase(),
      getBranding(),
    ]);

    const employee = employees?.find((item) => item.id === employeeId);
    if (!employee) {
      return NextResponse.json(
        { ok: false, message: "ไม่พบพนักงานที่ต้องการออกรายงาน" },
        { status: 404 },
      );
    }

    const defaultStoreId = employee.defaultStoreId ?? null;
    const storeMapByName = new Map(stores?.map((store) => [store.name, store]));

    // No store filtering - always fetch all stores for the employee
    const storeNameFilter = null;

    // Fetch attendance data from Supabase once for the requested range
    const dataRows = await fetchAttendanceSheetRows({
      startDate: rangeStartIso,
      endDate: rangeEndIso,
      employeeName: employee.name,
      storeName: storeNameFilter, // Always null - show all stores
    });

    // Fetch approved/scheduled leave requests for this employee in the date range
    const leaveRequests = await getLeaves({
      employeeId: employee.id,
      startDate: rangeStartIso,
      endDate: rangeEndIso,
    });

    console.log(`[Attendance Report] Employee: ${employee.name} (${employee.id})`);
    console.log(`[Attendance Report] Date range: ${rangeStartIso} to ${rangeEndIso}`);
    console.log(`[Attendance Report] Found ${leaveRequests.length} leave requests:`, leaveRequests);

    // Create a map of dates to leave types (for approved/scheduled leaves)
    const leaveDateTypes = new Map<string, string>();
    for (const leave of leaveRequests) {
      if (leave.status === "approved" || leave.status === "scheduled") {
        const start = new Date(leave.startDate + "T00:00:00Z");
        const end = new Date(leave.endDate + "T00:00:00Z");
        const current = new Date(start);
        while (current <= end) {
          const isoDate = current.toISOString().split("T")[0];
          leaveDateTypes.set(isoDate, leave.type); // Store leave type
          current.setUTCDate(current.getUTCDate() + 1);
        }
      }
    }

    console.log(`[Attendance Report] Leave dates with types:`, Array.from(leaveDateTypes.entries()));

    // Fetch approved day-off swaps for this employee in the date range
    const { workDates, offDates } = await getApprovedSwaps(
      employee.id,
      rangeStartIso,
      rangeEndIso
    );

    console.log(`[Attendance Report] Found ${workDates.size} work dates from swaps:`, Array.from(workDates));
    console.log(`[Attendance Report] Found ${offDates.size} off dates from swaps:`, Array.from(offDates.entries()));

    // Parse employee's regular day off (e.g., "Sunday", "Monday", etc.)
    const regularDayOff = employee.regularDayOff?.trim().toLowerCase() || null;
    const dayNameMap: { [key: string]: number } = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
      อาทิตย์: 0,
      จันทร์: 1,
      อังคาร: 2,
      พุธ: 3,
      พฤหัสบดี: 4,
      ศุกร์: 5,
      เสาร์: 6,
    };
    const regularDayOffIndex = regularDayOff ? dayNameMap[regularDayOff] : null;

    type AttendanceEvent = {
      timestamp: number;
      type: "check-in" | "check-out";
      time: string;
      storeName: string;
    };

    type SessionRecord = {
      storeName: string;
      storeProvince: string | null;
      checkInTime: string;
      checkOutTime: string;
      checkInTimestamp: number;
      checkOutTimestamp: number;
    };

    // Step 1: Collect all check-in/check-out events per day
    const dayEvents = new Map<string, AttendanceEvent[]>();

    for (const row of dataRows) {
      const sheetRow = parseSheetRow(row);
      if (!sheetRow) continue;

      // Filter by employee name
      if (sheetRow.employeeName.trim() !== employee.name.trim()) continue;

      // Parse date
      if (!sheetRow.date) continue;
      const parts = getZonedDateParts(sheetRow.date);
      const isoKey = `${parts.year.toString().padStart(4, "0")}-${padNumber(parts.month)}-${padNumber(parts.day)}`;
      if (!isoDateSet.has(isoKey)) continue;

      // Filter by selected store if specified
      if (storeNameFilter && sheetRow.storeName !== storeNameFilter) {
        continue;
      }

      // Create timestamp for comparison
      const timeStr = sheetRow.time || "00:00";
      const [hour, minute] = timeStr.split(":").map(n => parseInt(n) || 0);
      const timestamp = new Date(parts.year, parts.month - 1, parts.day, hour, minute).getTime();

      const statusLower = sheetRow.status.toLowerCase();
      if (statusLower !== "check-in" && statusLower !== "check-out") continue;

      const events = dayEvents.get(isoKey) || [];
      events.push({
        timestamp,
        type: statusLower as "check-in" | "check-out",
        time: sheetRow.time || "00:00",
        storeName: sheetRow.storeName || "-",
      });
      dayEvents.set(isoKey, events);
    }

    // Step 2: Group events into sessions per day
    const dayRecords = new Map<string, SessionRecord[]>();

    for (const [date, events] of dayEvents) {
      // Sort events by timestamp
      events.sort((a, b) => a.timestamp - b.timestamp);

      const sessions: SessionRecord[] = [];
      let currentSession: Partial<SessionRecord> | null = null;

      for (const event of events) {
        if (event.type === "check-in") {
          // If there's an unclosed session, close it first
          if (currentSession && currentSession.checkInTime) {
            currentSession.checkOutTime = currentSession.checkOutTime || "";
            currentSession.checkOutTimestamp = currentSession.checkOutTimestamp || 0;
            const matchedStore = storeMapByName.get(currentSession.storeName || "");
            currentSession.storeProvince = matchedStore?.province ?? null;
            sessions.push(currentSession as SessionRecord);
          }

          // Start new session
          currentSession = {
            storeName: event.storeName,
            checkInTime: event.time,
            checkInTimestamp: event.timestamp,
            checkOutTime: "",
            checkOutTimestamp: 0,
          };
        } else if (event.type === "check-out" && currentSession) {
          // Close current session
          currentSession.checkOutTime = event.time;
          currentSession.checkOutTimestamp = event.timestamp;
          const matchedStore = storeMapByName.get(currentSession.storeName || "");
          currentSession.storeProvince = matchedStore?.province ?? null;
          sessions.push(currentSession as SessionRecord);
          currentSession = null;
        }
      }

      // Handle unclosed session (check-in without check-out)
      if (currentSession && currentSession.checkInTime) {
        currentSession.checkOutTime = currentSession.checkOutTime || "";
        currentSession.checkOutTimestamp = currentSession.checkOutTimestamp || 0;
        const matchedStore = storeMapByName.get(currentSession.storeName || "");
        currentSession.storeProvince = matchedStore?.province ?? null;
        sessions.push(currentSession as SessionRecord);
      }

      if (sessions.length > 0) {
        dayRecords.set(date, sessions);
      }
    }

    // Get today's date in ISO format (Asia/Bangkok timezone)
    const todayIso = ISO_DAY_FORMATTER.format(new Date());

    // Generate report rows for requested days
    const allRows = isoDates.map((iso) => {
      // Check if this date is in the future
      const isFutureDate = iso > todayIso;
      const sessions = dayRecords.get(iso) || [];
      const [yearStr, monthStr, dayStr] = iso.split("-");
      const yearNum = Number.parseInt(yearStr, 10);
      const monthNum = Number.parseInt(monthStr, 10);
      const dayNum = Number.parseInt(dayStr, 10);
      const dayOfWeek = getDayOfWeek(yearNum, monthNum, dayNum);
      const hasAttendance = sessions.length > 0;

      // Determine status based on attendance, leave, swaps, and regular day off
      let status: "present" | "leave" | "day-off" | "absent" | "future" = "absent";
      let leaveType: string | null = null;

      // For future dates, mark as "future" (will be rendered as empty)
      if (isFutureDate) {
        status = "future";
      } else if (hasAttendance) {
        // Has check-in or check-out record
        status = "present";
      } else if (offDates.has(iso)) {
        // Has approved swap: employee is off on this date (normally a work day)
        status = "day-off";
        leaveType = offDates.get(iso) || "สลับวันหยุด";
      } else if (leaveDateTypes.has(iso)) {
        // Has approved/scheduled leave request
        status = "leave";
        leaveType = leaveDateTypes.get(iso) || null;
      } else if (regularDayOffIndex !== null) {
        // Check if this date matches employee's regular day off
        const date = new Date(Date.UTC(yearNum, monthNum - 1, dayNum));
        const dayIndex = date.getUTCDay();
        // Only mark as day-off if NOT swapped to work on this date
        if (dayIndex === regularDayOffIndex && !workDates.has(iso)) {
          status = "day-off";
        }
      }

      // Calculate summary fields for multi-session days
      let firstCheckInTime = "";
      let lastCheckOutTime = "";
      let totalWorkingMinutes = 0;
      const storeCount = sessions.length;

      if (sessions.length > 0) {
        firstCheckInTime = formatTime(sessions[0].checkInTime);
        lastCheckOutTime = formatTime(sessions[sessions.length - 1].checkOutTime);

        // Calculate total working hours across all sessions
        for (const session of sessions) {
          const sessionHours = calculateWorkingHours(
            formatTime(session.checkInTime),
            formatTime(session.checkOutTime)
          );
          // Parse hours from string like "4 ชม." or "4:30 ชม."
          const match = sessionHours.match(/(\d+)(?::(\d+))?/);
          if (match) {
            const hours = parseInt(match[1]) || 0;
            const minutes = parseInt(match[2]) || 0;
            totalWorkingMinutes += hours * 60 + minutes;
          }
        }
      }

      // Format total working hours
      const totalHours = Math.floor(totalWorkingMinutes / 60);
      const totalMinutes = totalWorkingMinutes % 60;
      const totalWorkingHours =
        totalMinutes === 0
          ? `${totalHours} ชม.`
          : `${totalHours}:${totalMinutes.toString().padStart(2, "0")} ชม.`;

      // Format sessions for frontend
      const formattedSessions = sessions.map((session) => ({
        storeName: session.storeName,
        storeProvince: session.storeProvince,
        checkInTime: formatTime(session.checkInTime),
        checkOutTime: formatTime(session.checkOutTime),
        workingHours: calculateWorkingHours(
          formatTime(session.checkInTime),
          formatTime(session.checkOutTime)
        ),
      }));

      return {
        dateIso: iso,
        day: dayNum,
        month: monthNum,
        year: yearNum,
        dayLabel: buildDayLabel(yearNum, monthNum, dayNum),
        dayOfWeek,
        status,
        leaveType,
        sessions: formattedSessions,
        storeCount,
        firstCheckInTime,
        lastCheckOutTime,
        totalWorkingHours,
        // Legacy fields for backward compatibility (single session case)
        storeName: sessions.length === 1 ? sessions[0].storeName : null,
        storeProvince: sessions.length === 1 ? sessions[0].storeProvince : null,
        checkInTime: firstCheckInTime,
        checkOutTime: lastCheckOutTime,
        workingHours: totalWorkingHours,
      };
    });

    // Group rows by month (YYYY-MM)
    const rowsByMonth = new Map<string, typeof allRows>();
    for (const row of allRows) {
      const monthKey = `${row.year.toString().padStart(4, "0")}-${padNumber(row.month)}`;
      if (!rowsByMonth.has(monthKey)) {
        rowsByMonth.set(monthKey, []);
      }
      rowsByMonth.get(monthKey)!.push(row);
    }

    // Create array of months with metadata
    const months = Array.from(rowsByMonth.entries()).map(([monthKey, rows]) => {
      const [yearStr, monthStr] = monthKey.split("-");
      const monthLabel = new Intl.DateTimeFormat("th-TH", {
        timeZone: TIME_ZONE,
        year: "numeric",
        month: "long",
      }).format(new Date(`${monthKey}-01T00:00:00Z`));

      return {
        monthKey,
        year: Number.parseInt(yearStr, 10),
        month: Number.parseInt(monthStr, 10),
        monthLabel,
        rows,
      };
    });

    // Sort months chronologically
    months.sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    // Apply month-based pagination
    const totalMonths = months.length;
    const totalPages = totalMonths > 0 ? totalMonths : 1;
    const monthIndex = page - 1;
    const currentMonth = months[monthIndex] ?? null;
    const paginatedRows = currentMonth?.rows ?? [];

    // Handle export formats
    if (format === "csv" || format === "excel") {
      // Use all rows for export (not paginated)
      const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0];
      const fileBaseName = `attendance-report-${employee.name}-${timestamp}`;

      if (format === "excel") {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("รายงานการเข้างาน");

        // Define columns
        worksheet.columns = [
          { header: "วันที่", key: "date", width: 15 },
          { header: "สถานะ", key: "status", width: 12 },
          { header: "ร้าน", key: "store", width: 25 },
          { header: "จังหวัด", key: "province", width: 20 },
          { header: "เวลาเข้างาน", key: "checkInTime", width: 12 },
          { header: "เวลาออกงาน", key: "checkOutTime", width: 12 },
        ];

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0E0E0" },
        };

        // Add data rows
        for (const row of allRows) {
          let statusText = "มาทำงาน";
          if (row.status === "leave") {
            statusText = "ลา";
          } else if (row.status === "day-off") {
            statusText = "OFF";
          } else if (row.status === "absent") {
            statusText = "ขาดงาน";
          }

          worksheet.addRow({
            date: row.dayLabel,
            status: statusText,
            store: row.storeName || "",
            province: row.storeProvince || "",
            checkInTime: row.checkInTime,
            checkOutTime: row.checkOutTime,
          });
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const filename = `${fileBaseName}.xlsx`;

        return new Response(buffer, {
          status: 200,
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        });
      } else {
        // CSV format
        const csvRows = allRows.map((row) => {
          let statusText = "มาทำงาน";
          if (row.status === "leave") {
            statusText = "ลา";
          } else if (row.status === "day-off") {
            statusText = "OFF";
          } else if (row.status === "absent") {
            statusText = "ขาดงาน";
          }

          return {
            "วันที่": row.dayLabel,
            "สถานะ": statusText,
            "ร้าน": row.storeName || "",
            "จังหวัด": row.storeProvince || "",
            "เวลาเข้างาน": row.checkInTime,
            "เวลาออกงาน": row.checkOutTime,
          };
        });

        const csv = stringify(csvRows, {
          header: true,
          bom: true,
        });

        const csvWithBom = "\uFEFF" + csv;
        const filename = `${fileBaseName}.csv`;

        return new Response(csvWithBom, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        employee: {
          id: employee.id,
          name: employee.name,
          phone: employee.phone ?? null,
          province: employee.province ?? null,
          region: employee.region ?? null,
          defaultStoreId,
        },
        store: null, // Always null - show all stores
        branding: {
          logoPath: branding.logoPath,
          updatedAt: branding.updatedAt,
        },
        filters: {
          storeId: null, // Always null - show all stores
          ranges: ranges.map((range) => ({
            startIso: range.startIso,
            endIso: range.endIso,
            label: range.label,
          })),
          rangeSummary,
        },
        rows: paginatedRows,
        currentMonth: currentMonth ? {
          monthKey: currentMonth.monthKey,
          monthLabel: currentMonth.monthLabel,
          year: currentMonth.year,
          month: currentMonth.month,
        } : null,
        allMonths: months.map(m => ({
          monthKey: m.monthKey,
          monthLabel: m.monthLabel,
          year: m.year,
          month: m.month,
          rowCount: m.rows.length,
        })),
        pagination: {
          page,
          pageSize: 1, // 1 month per page
          totalRows: totalMonths,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("[reports] attendance report error", error);
    return NextResponse.json(
      { ok: false, message: "ไม่สามารถสร้างรายงานได้ กรุณาลองใหม่อีกครั้ง" },
      { status: 500 },
    );
  }
}

