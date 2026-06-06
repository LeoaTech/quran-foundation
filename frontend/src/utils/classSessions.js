const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DAY_ALIASES = {
  sun: 'Sunday', sunday: 'Sunday',
  mon: 'Monday', monday: 'Monday',
  tue: 'Tuesday', tuesday: 'Tuesday',
  wed: 'Wednesday', wednesday: 'Wednesday',
  thu: 'Thursday', thursday: 'Thursday',
  fri: 'Friday', friday: 'Friday',
  sat: 'Saturday', saturday: 'Saturday',
};

export function normalizeDayName(day) {
  if (!day) return '';
  const key = day.trim().toLowerCase();
  if (DAY_ALIASES[key]) return DAY_ALIASES[key];
  const match = DAY_NAMES.find((d) => d.toLowerCase() === key);
  return match || day;
}

function toLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function resolveSchedules(apiSchedules, cls) {
  let raw = [];

  if (Array.isArray(apiSchedules) && apiSchedules.length) {
    raw = apiSchedules;
  } else if (cls?.schedules) {
    const embedded = typeof cls.schedules === 'string'
      ? JSON.parse(cls.schedules)
      : cls.schedules;
    if (Array.isArray(embedded) && embedded.length) raw = embedded;
  }

  if (!raw.length && cls?.schedule_days && cls?.start_time) {
    const days = cls.schedule_days.split(',').map((d) => d.trim()).filter(Boolean);
    raw = days.map((day, i) => ({
      id: `legacy-${i}-${day}`,
      day_of_week: day,
      start_time: cls.start_time,
      end_time: null,
    }));
  }

  return raw.map((s, i) => ({
    ...s,
    id: s.id || `resolved-${i}`,
    day_of_week: normalizeDayName(s.day_of_week),
  }));
}

export function formatTimeShort(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  let hours = parseInt(h, 10);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  if (hours === 0) hours = 12;
  else if (hours > 12) hours -= 12;
  return `${hours}:${m} ${suffix}`;
}

export function formatClassroomWithSchedules(classroom) {
  const schedules = resolveSchedules([], classroom);
  const cap = classroom.max_capacity ? ` (cap: ${classroom.max_capacity})` : '';

  if (schedules.length === 0) {
    if (classroom.schedule_days) {
      return `${classroom.name} — ${classroom.schedule_days}${cap}`;
    }
    return `${classroom.name}${cap}`;
  }

  const slotLabels = [...schedules]
    .sort((a, b) => DAY_NAMES.indexOf(a.day_of_week) - DAY_NAMES.indexOf(b.day_of_week))
    .map((s) => {
      const time = formatTimeShort(s.start_time);
      const end = s.end_time ? `–${formatTimeShort(s.end_time)}` : '';
      return `${s.day_of_week.slice(0, 3)} ${time}${end}`;
    })
    .join(', ');

  return `${classroom.name} — ${slotLabels}${cap}`;
}

export function getClassStartDate(cls) {
  if (cls?.start_date) return cls.start_date.split('T')[0];
  if (cls?.created_at) return cls.created_at.split('T')[0];
  return new Date().toISOString().split('T')[0];
}

export function getDurationMonths(cls) {
  return cls?.course_duration_months ?? cls?.course?.duration_months ?? 4;
}

export function projectClassSessions(cls, schedules) {
  const resolved = resolveSchedules(schedules, cls);
  if (!resolved.length) return [];

  const durationMonths = getDurationMonths(cls);
  const startDateStr = getClassStartDate(cls);
  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(start);
  end.setMonth(end.getMonth() + durationMonths);

  const projectedSessions = [];
  const curr = new Date(start);

  while (curr <= end) {
    const dayName = DAY_NAMES[curr.getDay()];
    const dateStr = toLocalDateStr(curr);
    const dayScheds = resolved.filter(
      (s) => normalizeDayName(s.day_of_week) === dayName,
    );

    for (const ds of dayScheds) {
      projectedSessions.push({
        date: dateStr,
        day_of_week: dayName,
        schedule_id: ds.id,
        start_time: ds.start_time,
        end_time: ds.end_time,
      });
    }
    curr.setDate(curr.getDate() + 1);
  }

  projectedSessions.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.start_time || '').localeCompare(b.start_time || ''),
  );

  return projectedSessions;
}

export function countExpectedSessionsPerSlot(cls, schedules) {
  const projected = projectClassSessions(cls, schedules);
  const counts = {};
  for (const s of projected) {
    counts[s.schedule_id] = (counts[s.schedule_id] || 0) + 1;
  }
  return counts;
}

export function getScheduledSessionOptions(cls, schedules) {
  const projected = projectClassSessions(cls, schedules);

  return projected.map((s) => ({
    key: `${s.date}-${s.schedule_id}`,
    date: s.date,
    day_of_week: s.day_of_week,
    schedule_id: s.schedule_id,
    start_time: s.start_time,
    end_time: s.end_time,
    label: `${s.day_of_week}, ${fmtDateShort(s.date)} — ${formatTimeShort(s.start_time)}${
      s.end_time ? ` – ${formatTimeShort(s.end_time)}` : ''
    }`,
  }));
}

function fmtDateShort(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function getSessionStatus(session, todayStr = new Date().toISOString().split('T')[0]) {
  const total = session.cnt_total ?? 0;
  if (total > 0) return 'completed';
  if (session.date > todayStr) return 'upcoming';
  return 'scheduled';
}

export function buildScheduleSummary(schedules, cls) {
  const resolved = resolveSchedules(schedules, cls);
  if (!resolved.length) return '';
  const days = [...new Set(resolved.map((s) => s.day_of_week.slice(0, 3)))].join(' + ');
  return days;
}

export function sessionPlanKey(date, scheduleId) {
  return `${date}-${scheduleId ?? 'none'}`;
}
