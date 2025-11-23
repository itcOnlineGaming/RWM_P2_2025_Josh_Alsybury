<script lang="ts">
  import { onMount } from 'svelte';

  type GEvent = {
    id: string;
    summary?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
  };

  let events: GEvent[] = [];
  let error: string | null = null;

  const buckets = ['morning', 'midday', 'evening'] as const;
  type Bucket = (typeof buckets)[number];

  let weekDays: string[] = [];
  let weekDayNames: string[] = [];

  let byDayAndBucket: Record<string, Record<Bucket, GEvent[]>> = {};

  onMount(async () => {
    try {
      const res = await fetch('/api/calendar');
      if (!res.ok) {
        error = await res.text();
        return;
      }
      events = await res.json();
      initWeekView(new Date());
      findRealGaps();
    } catch (e) {
      error = 'Failed to load events';
    }
  });

  function initWeekView(reference: Date) {
    const monday = new Date(reference);
    const diff = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - diff);

    weekDays = [];
    weekDayNames = [];
    byDayAndBucket = {};

    const weekdayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      weekDays.push(iso);
      weekDayNames.push(weekdayFmt.format(d));
      byDayAndBucket[iso] = { morning: [], midday: [], evening: [] };
    }

    bucketEvents();
  }

  function bucketEvents() {
    for (const ev of events) {
      const startIso = ev.start?.dateTime ?? ev.start?.date;
      if (!startIso) continue;

      const start = new Date(startIso);
      const dateKey = start.toISOString().slice(0, 10);

      if (!(dateKey in byDayAndBucket)) continue;

      const hour = start.getHours();
      let bucket: Bucket;
      if (hour < 12) bucket = 'morning';
      else if (hour < 17) bucket = 'midday';
      else bucket = 'evening';

      byDayAndBucket[dateKey][bucket].push(ev);
    }
  }

  // --- Bucket time ranges ---
  const bucketTimes: Record<Bucket, { start: string; end: string }> = {
    morning: { start: "08:00", end: "12:00" },
    midday: { start: "12:00", end: "17:00" },
    evening: { start: "17:00", end: "21:00" }
  };

  type BucketGap = {
    day: string;
    bucket: Bucket;
    minutes: number;
    start: string;
    end: string;
  };

  let realGaps: BucketGap[] = [];

  function findRealGaps() {
    const gaps: BucketGap[] = [];

    for (const day of weekDays) {
      const bucketsForDay = byDayAndBucket[day];
      if (!bucketsForDay) continue;

      for (const bucket of buckets) {
        const eventsInBucket = bucketsForDay[bucket];

        if (eventsInBucket.length === 0) {
          const t = bucketTimes[bucket];

          const start = `${day}T${t.start}:00`;
          const end = `${day}T${t.end}:00`;

          const diffMin =
            (new Date(end).getTime() - new Date(start).getTime()) / 60000;

          gaps.push({
            day,
            bucket,
            minutes: diffMin,
            start,
            end
          });
        }
      }
    }

    realGaps = gaps;
  }

  // Free slot helper for table coloring
  type FreeSlot = {
    day: string;
    bucket: Bucket;
  };

  let freeSlots: FreeSlot[] = [];

  function findEmptySlots() {
    const result: FreeSlot[] = [];

    for (const day of weekDays) {
      const bucketsForDay = byDayAndBucket[day];
      if (!bucketsForDay) continue;

      for (const bucket of buckets) {
        const eventsInBucket = bucketsForDay[bucket];
        if (!eventsInBucket || eventsInBucket.length === 0) {
          result.push({ day, bucket });
        }
      }
    }

    freeSlots = result;
  }

  function isFree(day: string, bucket: Bucket) {
    return freeSlots.some((s) => s.day === day && s.bucket === bucket);
  }

  // Helpers for visual bars
  function freeBucketsForDay(day: string): Bucket[] {
    return buckets.filter(
      (b) => !byDayAndBucket[day][b] || byDayAndBucket[day][b].length === 0
    );
  }
</script>

<h1 class="page-title">Smart Time Reclaim</h1>

{#if error}
  <p class="error">{error}</p>

  <div class="connect-wrapper">
    <a class="connect-btn" href="/api/google-auth">
      Connect Google Calendar
    </a>
  </div>
{:else}
  <div class="layout">

    <!-- =============================== -->
    <!--          MAIN CALENDAR          -->
    <!-- =============================== -->

    <div class="calendar-column">
      <div class="calendar-container">
        <table class="week-calendar">
          <thead>
            <tr>
              <th class="time-col">Time</th>
              {#each weekDays as day}
                <th>{day}</th>
              {/each}
            </tr>
            <tr>
              <th class="time-col"></th>
              {#each weekDayNames as name}
                <th class="weekday-label">{name}</th>
              {/each}
            </tr>
          </thead>

          <tbody>
            {#each buckets as bucket}
              <tr>
                <td class="bucket-label">{bucket}</td>

                {#each weekDays as day}
                  <td class="slot {isFree(day, bucket) ? 'free-slot-highlight' : ''}">
                    {#each byDayAndBucket[day][bucket] as ev}
                      <div class="event">
                        <span class="event-title">
                          {ev.summary ?? 'Untitled'}
                        </span>
                      </div>
                    {/each}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- =============================== -->
    <!--            SIDEBAR              -->
    <!-- =============================== -->

    <aside class="sidebar">
      <h2 class="sidebar-title">Weekly Capacity</h2>

      <!-- Capacity Bars -->
      <ul class="capacity-list">
        {#each weekDays as day}
          <li class="cap-item">
            <span class="slot-day">{day}</span>

            <!-- Bar -->
            <span class="cap-bar">
              {#each freeBucketsForDay(day) as b}
                <span class="cap-seg"></span>
              {/each}
            </span>

            <!-- Bucket names -->
            <span class="cap-label">
              {freeBucketsForDay(day).join(", ")}
            </span>
          </li>
        {/each}
      </ul>

      <!-- Time windows -->
      <h3 class="sidebar-title" style="margin-top:1.5rem;">Free time windows</h3>

      {#if realGaps.length === 0}
        <p class="sidebar-hint">No free bucket windows found.</p>
      {:else}
        <ul class="slot-list">
          {#each realGaps as g}
            <li>
              <span class="slot-day">{g.day}</span>
              <span class="slot-bucket">{g.bucket}</span>
              <span>
                {g.start.slice(11,16)} → {g.end.slice(11,16)}
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    </aside>
  </div>

  <div class="connect-wrapper">
    <a class="connect-btn" href="/api/google-auth">
      Reconnect Google Calendar
    </a>
  </div>
{/if}

<style>
  .capacity-list { list-style: none; padding: 0; margin: 0; }
  .cap-item { display: flex; align-items: center; margin-bottom: 6px; }
  .cap-bar { display: flex; gap: 3px; margin: 0 8px; }
  .cap-seg {
    width: 14px;
    height: 14px;
    background: #4caf50;
    border-radius: 3px;
  }
  .cap-label {
    font-size: 0.8rem;
    color: #666;
  }
</style>
