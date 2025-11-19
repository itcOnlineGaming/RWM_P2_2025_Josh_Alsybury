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
    byDayAndBucket = {};

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = d.toISOString().slice(0, 10); // YYYY-MM-DD
      weekDays.push(iso);
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
</script>

<h1 class="page-title">Smart Time Reclaim</h1>

{#if error}
  <p class="error">{error}</p>
{:else}
  <div class="calendar-container">
    <table class="week-calendar">
      <thead>
        <tr>
          <th class="time-col">Time</th>
          {#each weekDays as day}
            <th>{day}</th>
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
{/if}
