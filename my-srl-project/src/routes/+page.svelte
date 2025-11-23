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

  // ISO dates for Mon–Sun of the current week
  let weekDays: string[] = [];

  let weekDayNames: string[] = [];
  // byDayAndBucket["2025-11-19"].morning = [event, ...]
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
    } catch (e) {
      error = 'Failed to load events';
    }
  });

  function initWeekView(reference: Date) {
  // find Monday of this week
  const monday = new Date(reference);
  const diff = (monday.getDay() + 6) % 7; // 0 = Monday
  monday.setDate(monday.getDate() - diff);

  weekDays = [];
  weekDayNames = [];                    // reset
  byDayAndBucket = {};

  const weekdayFmt = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short'
  });

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = d.toISOString().slice(0, 10); // YYYY-MM-DD
    weekDays.push(iso);
    weekDayNames.push(weekdayFmt.format(d));  // e.g. Mon, Tue
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

      if (!(dateKey in byDayAndBucket)) continue; // outside this week

      const hour = start.getHours();
      let bucket: Bucket;
      if (hour < 12) bucket = 'morning';
      else if (hour < 17) bucket = 'midday';
      else bucket = 'evening';

      byDayAndBucket[dateKey][bucket].push(ev);
    }
  }
  type FreeSlot = {
    day: string;      // "2025-11-20"
    bucket: Bucket;   // "morning" | "midday" | "evening"
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
</script>

<h1 class="page-title">Smart Time Reclaim</h1>

{#if error}
  <p class="error">{error}</p>

  <!-- Always-visible connect button when there is an error -->
  <div class="connect-wrapper">
    <a class="connect-btn" href="/api/google-auth">
      Connect Google Calendar
    </a>
  </div>
{:else}
  <div class="layout">
    <!-- LEFT: calendar -->
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
                  <td class="slot">
                    {#if byDayAndBucket[day]}
                      {#each byDayAndBucket[day][bucket] as ev}
                        <div class="event">
                          <span class="event-title">
                            {ev.summary ?? 'Untitled'}
                          </span>
                        </div>
                      {/each}
                    {/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- find empty slots panel -->
    <aside class="sidebar">
      <h2 class="sidebar-title">Find empty slots</h2>
      <button class="primary-btn" on:click={findEmptySlots}>
        Scan this week
      </button>

      {#if freeSlots.length === 0}
        <p class="sidebar-hint">
          Click “Scan this week” to see free slots for recovery blocks.
        </p>
      {:else}
        <ul class="slot-list">
          {#each freeSlots as slot}
            <li>
              <span class="slot-day">{slot.day}</span>
              <span class="slot-bucket">{slot.bucket}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </aside>
  </div>

  <!-- also show the connect button under the calendar even when it works -->
  <div class="connect-wrapper">
    <a class="connect-btn" href="/api/google-auth">
      Reconnect Google Calendar
    </a>
  </div>
{/if}