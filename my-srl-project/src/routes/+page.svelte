<!-- +page.svelte -->
<script lang="ts">
  
  import { onMount } from 'svelte';

  type GEvent = {
    id: string;
    summary?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
  };


 type TimeBlock = {
    id: string;
    title: string;
    color: string;
  };

  let timeBlocks: TimeBlock[] = [];
  let newBlockTitle = '';
  let blockColors = ['#667eea', '#48bb78', '#ed8936', '#e53e3e', '#38b2ac'];

  let events: GEvent[] = [];
  let error: string | null = null;

  const buckets = ['morning', 'midday', 'evening'] as const;
  type Bucket = 'morning' | 'midday' | 'evening';

  let weekDays: string[] = [];
  let weekDayNames: string[] = [];

  let byDayAndBucket: Record<string, Record<Bucket, GEvent[]>> = {};
  let allDayEvents: Record<string, GEvent[]> = {};

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
      findEmptySlots();
      try {
      const saved = await (window as any).storage.get('time-blocks');
       if (saved?.value) {
        timeBlocks = JSON.parse(saved.value);
        }
      } catch (e) {
        // No saved blocks yet
      }
    } catch (e) {
      error = 'Failed to load events';
    }
  });

  function navigateWeek(offset: number) {
    const currentMonday = new Date(weekDays[0]);
    currentMonday.setDate(currentMonday.getDate() + offset * 7);
    initWeekView(currentMonday);
    findRealGaps();
    findEmptySlots();
  }


  function initWeekView(reference: Date) {
    const monday = new Date(reference);
    const diff = (monday.getDay() + 6) % 7;
    monday.setDate(monday.getDate() - diff);

    weekDays = [];
    weekDayNames = [];
    byDayAndBucket = {};
    allDayEvents = {};

    const weekdayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      weekDays.push(iso);
      weekDayNames.push(weekdayFmt.format(d));
      byDayAndBucket[iso] = { morning: [], midday: [], evening: [] };
      allDayEvents[iso] = [];
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

      const isAllDay = !ev.start?.dateTime && ev.start?.date;
      
      if (isAllDay) {
        allDayEvents[dateKey].push(ev);
      } else {
        const hour = start.getHours();
        let bucket: Bucket;
        if (hour < 12) bucket = 'morning';
        else if (hour < 17) bucket = 'midday';
        else bucket = 'evening';

        byDayAndBucket[dateKey][bucket].push(ev);
      }
    }
  }

   function addTimeBlock() {
    if (!newBlockTitle.trim()) return;
    
    timeBlocks = [...timeBlocks, {
      id: crypto.randomUUID(),
      title: newBlockTitle.trim(),
      color: blockColors[timeBlocks.length % blockColors.length]
    }];
    
    newBlockTitle = '';
    saveTimeBlocks();
  }

  function removeTimeBlock(id: string) {
    timeBlocks = timeBlocks.filter(b => b.id !== id);
    saveTimeBlocks();
  }

  async function saveTimeBlocks() {
    try {
      await (window as any).storage.set('time-blocks', JSON.stringify(timeBlocks));
    } catch (e) {
      console.error('Failed to save time blocks:', e);
    }
  }

async function assignBlockToCalendar(block: TimeBlock, day: string, bucket: Bucket) {
  const times = bucketTimes[bucket];
  // Add timezone to the datetime strings
  const startDateTime = `${day}T${times.start}:00+00:00`; // or use your local timezone like +01:00
  const endDateTime = `${day}T${times.end}:00+00:00`;
  
  try {
    const res = await fetch('/api/calendar/create-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: block.title,
        start: { 
          dateTime: startDateTime,
          timeZone: 'Europe/Dublin' // Use your timezone
        },
        end: { 
          dateTime: endDateTime,
          timeZone: 'Europe/Dublin'
        }
      })
    });
    
    if (res.ok) {
      // Refresh calendar
      const calRes = await fetch('/api/calendar');
      events = await calRes.json();
      initWeekView(new Date());
      findRealGaps();
      findEmptySlots();
      alert(`✓ Added "${block.title}" to ${formatDate(day)} ${bucket}`);
    } else {
      const errorText = await res.text();
      console.error('Server error:', errorText);
      alert(`Failed to create event: ${errorText}`);
    }
  } catch (e) {
    console.error('Error details:', e);
    alert(`Error creating event: ${e}`);
  }
}

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
          const diffMin = (new Date(end).getTime() - new Date(start).getTime()) / 60000;

          gaps.push({ day, bucket, minutes: diffMin, start, end });
        }
      }
    }

    realGaps = gaps.sort((a, b) => a.day.localeCompare(b.day));
  }

  type FreeSlot = { day: string; bucket: Bucket };
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

  function freeBucketsForDay(day: string): Bucket[] {
    return buckets.filter(
      (b) => !byDayAndBucket[day][b] || byDayAndBucket[day][b].length === 0
    );
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
  }

</script>

<div class="page-header">
  <h1 class="page-title">Smart Time Reclaim</h1>
  <p class="page-subtitle">Find and optimize your free time slots</p>
</div>

{#if error}
  <div class="empty-state">
    <div class="empty-icon">📅</div>
    <h2>Connect Your Calendar</h2>
    <p class="error-msg">{error}</p>
    <a class="btn-primary" href="/api/google-auth">
      <span class="btn-icon">🔗</span>
      Connect Google Calendar
    </a>
  </div>
{:else}
  <div class="content-grid">
    <!-- Calendar Section -->
    <div class="calendar-section">
      <div class="card">
        <div class="card-header">
          <button class="week-nav-btn" on:click={() => navigateWeek(-1)} aria-label="Previous week">
            ← Prev
          </button>
          <h2 class="card-title">Week Overview</h2>
          <button class="week-nav-btn" on:click={() => navigateWeek(1)} aria-label="Next week">
            Next →
          </button>
        </div>
        
        <div class="calendar-scroll">
          <table class="calendar-table">
            <thead>
              <tr>
                <th class="time-header"></th>
                {#each weekDays as day, i}
                  <th class="day-header">
                    <div class="day-info">
                      <span class="day-name">{weekDayNames[i]}</span>
                      <span class="day-date">{formatDate(day)}</span>
                    </div>
                  </th>
                {/each}
              </tr>
            </thead>

            <tbody>
              <!-- All-day events row -->
              {#if Object.values(allDayEvents).some(events => events.length > 0)}
                <tr class="all-day-row">
                  <td class="time-cell">
                    <div class="time-label">
                      <span class="bucket-name">All Day</span>
                    </div>
                  </td>
                  {#each weekDays as day}
                    <td class="event-cell all-day-cell">
                      {#each allDayEvents[day] as ev}
                        <div class="event-tag all-day-tag">
                          {ev.summary ?? 'Untitled'}
                        </div>
                      {/each}
                    </td>
                  {/each}
                </tr>
              {/if}

              <!-- Time-based buckets -->
              {#each buckets as bucket}
                <tr>
                  <td class="time-cell">
                    <div class="time-label">
                      <span class="bucket-name">{bucket}</span>
                      <span class="bucket-time">{bucketTimes[bucket].start}</span>
                    </div>
                  </td>

                  {#each weekDays as day}
                    <td class="event-cell {isFree(day, bucket) ? 'free' : 'busy'}">
                      {#if byDayAndBucket[day][bucket].length === 0}
                        <div class="free-indicator">
                          <span class="free-icon">✓</span>
                          <span class="free-text">Available</span>
                        </div>
                      {:else}
                        <div class="events-container">
                          {#each byDayAndBucket[day][bucket] as ev}
                            <div class="event-tag" class:compact={byDayAndBucket[day][bucket].length > 2}>
                              {ev.summary ?? 'Untitled'}
                            </div>
                          {/each}
                        </div>
                      {/if}
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>

<!-- RIGHT SIDEBAR -->
<div class="sidebar">

  <!-- Weekly Capacity -->
  <section class="card capacity-card">
    <h3>Weekly Capacity</h3>

    <ul class="capacity-list">
      {#each weekDays as day, i}
        {#key day}
          {@const freeBuckets = freeBucketsForDay(day)}
          {@const freeCount = freeBuckets.length}

          <li class="capacity-row">
            <div class="capacity-label">
              <span class="day">{weekDayNames[i]} {formatDate(day)}</span>
              <span class="count">{freeCount}/3</span>
            </div>

            <div class="capacity-bar">
              {#each buckets as b}
                <div class="segment {freeBuckets.includes(b) ? 'free' : 'busy'}"></div>
              {/each}
            </div>
          </li>
        {/key}
      {/each}
    </ul>
  </section>

  <!-- Time Blocks -->
<section class="card slots-card">
  <div class="slots-header">
    <h3>Time Blocks</h3>
    <span class="slot-count">{timeBlocks.length}</span>
  </div>

  <div class="add-block-form">
    <input 
      type="text" 
      bind:value={newBlockTitle}
      on:keypress={(e) => e.key === 'Enter' && addTimeBlock()}
      placeholder="Study, Gym, Project..."
      class="block-input"
    />
    <button on:click={addTimeBlock} class="add-block-btn">+ Add</button>
  </div>

  <div class="slots-list">
    {#each timeBlocks as block (block.id)}
      <div class="time-block-item" style="border-left-color: {block.color}">
        <div class="block-header">
          <span class="block-title">{block.title}</span>
          <button on:click={() => removeTimeBlock(block.id)} class="remove-btn">×</button>
        </div>
        <div class="block-actions">
          <select 
            class="slot-select"
            on:change={(e) => {
              const value = e.currentTarget.value;
              if (value) {
                const [day, bucket] = value.split('|');
                assignBlockToCalendar(block, day, bucket as Bucket);
                e.currentTarget.value = '';
              }
            }}
          >
            <option value="">Assign to slot...</option>
            {#each freeSlots as slot}
              <option value="{slot.day}|{slot.bucket}">
                {formatDate(slot.day)} - {slot.bucket}
              </option>
            {/each}
          </select>
        </div>
      </div>
    {/each}
    
    {#if timeBlocks.length === 0}
      <div class="empty-message">
        <span class="empty-icon-small">📋</span>
        <p>Add time blocks to schedule</p>
      </div>
    {/if}
  </div>
</section>



</div>
      <a class="btn-secondary" href="/api/google-auth">
        <span class="btn-icon">🔄</span>
        Reconnect Calendar
      </a>
  </div>
{/if}

<style>
  /* Page Header */
  .page-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .page-title {
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
    color: #ffffff;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .page-subtitle {
    font-size: 1rem;
    color: rgba(255, 255, 255, 0.9);
    margin: 0;
  }

  /* Empty State */
  .empty-state {
    max-width: 500px;
    margin: 4rem auto;
    background: white;
    border-radius: 16px;
    padding: 3rem 2rem;
    text-align: center;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .empty-state h2 {
    margin: 0 0 0.5rem 0;
    color: #2d3748;
  }

  .error-msg {
    color: #e53e3e;
    margin-bottom: 2rem;
  }

  /* Content Grid */
  .content-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  @media (min-width: 1024px) {
    .content-grid {
      grid-template-columns: 1fr 350px;
    }
  }

  /* Card Component */
  .card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    overflow: hidden;
  }

  .card-header {
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    gap: 1rem;
    align-items: center;
    background: #f7fafc;
  }

  .slot-select {
  width: 100%;
  padding: 8px 12px;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #4a5568;
  cursor: pointer;
  transition: all 0.2s;
}

.slot-select:hover {
  border-color: #667eea;
}

.slot-select:focus {
  outline: none;
  border-color: #667eea;
  background: #f7fafc;
}

  .sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .week-nav-btn {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #4a5568;
    cursor: pointer;
    transition: all 0.2s;
  }

  .week-nav-btn:hover {
    background: #f7fafc;
    border-color: #cbd5e0;
    color: #2d3748;
  }

  .week-nav-btn:active {
    transform: scale(0.95);
  }

  .card-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0;
    color: #2d3748;
  }

  .card-content {
    padding: 1.5rem;
  }

  .week-stats {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.813rem;
    color: #4a5568;
    font-weight: 500;
  }

  .stat-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .stat-dot.free {
    background: #48bb78;
  }

  .stat-dot.busy {
    background: #cbd5e0;
  }

  /* Calendar Table */
  .calendar-scroll {
    overflow-x: auto;
  }

  .calendar-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 700px;
  }

  .time-header {
    width: 100px;
    background: #f7fafc;
  }

  .day-header {
    background: #f7fafc;
    padding: 1rem 0.75rem;
    text-align: center;
    border-left: 1px solid #e2e8f0;
  }

  .day-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .day-name {
    font-weight: 600;
    color: #2d3748;
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .day-date {
    font-size: 0.75rem;
    color: #718096;
  }

  .time-cell {
    background: #f7fafc;
    padding: 1rem;
    border-top: 1px solid #e2e8f0;
    vertical-align: top;
    width: 100px;
  }

  .time-label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .bucket-name {
    font-weight: 600;
    color: #2d3748;
    font-size: 0.875rem;
    text-transform: capitalize;
  }

  .bucket-time {
    font-size: 0.75rem;
    color: #718096;
  }

  .event-cell {
    padding: 0.75rem;
    border-top: 1px solid #e2e8f0;
    border-left: 1px solid #e2e8f0;
    vertical-align: top;
    min-height: 70px;
  }

  .event-cell.free {
    background: linear-gradient(135deg, #f0fff4 0%, #c6f6d5 100%);
  }

  .event-cell.busy {
    background: #fafafa;
  }

  .all-day-row .event-cell {
    background: #fff9e6;
    min-height: 50px;
    padding: 0.5rem 0.75rem;
  }

  .all-day-cell {
    background: #fff9e6 !important;
  }

  .free-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    padding: 0.5rem 0;
  }

  .free-icon {
    color: #38a169;
    font-size: 1.25rem;
    font-weight: bold;
  }

  .free-text {
    color: #38a169;
    font-weight: 500;
    font-size: 0.813rem;
  }

  .events-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .event-tag {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.813rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .event-tag.compact {
    padding: 0.375rem 0.625rem;
    font-size: 0.75rem;
  }

  .all-day-tag {
    background: linear-gradient(135deg, #f6ad55 0%, #ed8936 100%);
  }

  /* Capacity List */
  .capacity-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .capacity-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .capacity-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .capacity-day {
    font-weight: 500;
    color: #2d3748;
    font-size: 0.875rem;
  }

  .capacity-count {
    font-size: 0.75rem;
    color: #718096;
    background: #edf2f7;
    padding: 0.25rem 0.5rem;
    border-radius: 9999px;
    font-weight: 600;
  }

  .capacity-count.full {
    background: #c6f6d5;
    color: #22543d;
  }

  .capacity-count.none {
    background: #fed7d7;
    color: #742a2a;
  }

  .capacity-bar {
    display: flex;
    gap: 4px;
    height: 8px;
  }

  .capacity-segment {
    flex: 1;
    border-radius: 4px;
    transition: all 0.2s;
    cursor: pointer;
  }

  .capacity-segment:hover {
    transform: translateY(-2px);
  }

  .capacity-segment.free {
    background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
  }

  .capacity-segment.busy {
    background: #e2e8f0;
  }

  /* TIME BLOCKS STYLING */
.add-block-form {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.block-input {
  flex: 1;
  padding: 10px 12px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.block-input:focus {
  outline: none;
  border-color: #667eea;
}

.add-block-btn {
  padding: 10px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
}

.add-block-btn:hover {
  transform: translateY(-2px);
}

.time-block-item {
  background: #f7fafc;
  padding: 12px;
  border-radius: 10px;
  border-left: 4px solid #667eea;
  margin-bottom: 10px;
}

.block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.block-title {
  font-weight: 600;
  color: #2d3748;
  font-size: 14px;
}

.remove-btn {
  background: none;
  border: none;
  color: #718096;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
  line-height: 1;
}

.remove-btn:hover {
  background: #e2e8f0;
  color: #e53e3e;
}

.block-actions {
  display: flex;
  gap: 8px;
}

  /* Slot List */
  .slot-badge {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .empty-message {
    text-align: center;
    padding: 2rem 1rem;
    color: #718096;
  }

  .empty-icon-small {
    font-size: 2rem;
    display: block;
    margin-bottom: 0.5rem;
  }

  .slot-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-height: 400px;
    overflow-y: auto;
  }

  .slot-item {
    padding: 0.875rem;
    background: #f7fafc;
    border-radius: 8px;
    border-left: 3px solid #667eea;
    transition: all 0.2s;
  }

  .slot-item:hover {
    background: #edf2f7;
    border-left-width: 4px;
  }

  .slot-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .slot-date {
    font-weight: 600;
    color: #2d3748;
    font-size: 0.875rem;
  }

  .slot-bucket-badge {
    font-size: 0.688rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .slot-bucket-badge.morning {
    background: #fef3c7;
    color: #92400e;
  }

  .slot-bucket-badge.midday {
    background: #dbeafe;
    color: #1e40af;
  }

  .slot-bucket-badge.evening {
    background: #e9d5ff;
    color: #6b21a8;
  }

  .slot-time {
    font-size: 0.813rem;
    color: #4a5568;
    font-weight: 500;
  }

  .slot-duration {
    color: #718096;
    font-size: 0.75rem;
    font-weight: 400;
  }

  /* Buttons */
  .btn-primary, .btn-secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.875rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s;
    cursor: pointer;
    border: none;
    font-size: 1rem;
  }

  .btn-primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
  }

  .btn-secondary {
    width: 100%;
    background: white;
    color: #667eea;
    border: 2px solid #e2e8f0;
    margin-top: 1rem;
  }

  .btn-secondary:hover {
    background: #f7fafc;
    border-color: #cbd5e0;
  }

  .btn-icon {
    font-size: 1.125rem;
  }

/* SIDEBAR */
.sidebar {
  width: 320px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  color: #1f2933; /* new: darker base text */
}

/* Available slots card */
.card.slots-card {
  color: #1f2933; /* ensure card text is dark */
}

/* Individual items */
.slot-date {
  font-size: 13px;
  color: #4a5568; /* slightly muted but readable */
}

.slot-info {
  font-size: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  color: #2d3748; /* main info text */
}

/* Optional: header in sidebar */
.slots-header h3 {
  color: #111827;
}


/* CARD STYLE */
.card {
  background: #ffffff;
  border-radius: 14px;
  padding: 18px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
}

/* WEEKLY CAPACITY */
.capacity-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.capacity-row {
  margin-bottom: 16px;
}

.capacity-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}

.capacity-bar {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  height: 8px;
  border-radius: 8px;
  overflow: hidden;
  background: #e6e6e6;
}

.capacity-bar .segment.free {
  background: #40d26b;
}

.capacity-bar .segment.busy {
  background: #c8c8c8;
}

/* AVAILABLE SLOTS */
.slots-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.slots-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 320px;
  overflow-y: auto;
  padding-right: 6px;
}

.slot-item {
  background: #fafafa;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid #eee;
}

.slot-date {
  font-size: 13px;
  color: #777;
  margin-bottom: 4px;
}

.slot-info {
  font-size: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.slot-bucket.morning {
  color: #f4a700;
}
.slot-bucket.midday {
  color: #4a90e2;
}
.slot-bucket.evening {
  color: #9b59b6;
}

/* BUTTON */
.reconnect {
  background: white;
  border: none;
  padding: 12px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
}
</style>