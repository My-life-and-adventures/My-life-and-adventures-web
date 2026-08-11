/**
 * Plain English for everything the apps record.
 *
 * The dashboard is read by people who run this product, not by people who wrote
 * it. `upload_failed` and `presign` are the app's vocabulary, not theirs — so
 * nothing raw reaches the screen unless someone opens the technical detail.
 *
 * This is the single source of truth for both dashboard tabs. When a new event
 * is added to the mobile app's `AnalyticsEvent` union, add it here too; anything
 * missing falls back to a readable de-slugged version of its own name rather
 * than breaking, so a forgotten entry degrades instead of blocking a release.
 */

export interface EventCopy {
  /** Sentence-case label, e.g. "Finished recording". */
  label: string;
  /** One line on why this matters, shown on the technical breakdown. */
  meaning?: string;
}

const EVENTS: Record<string, EventCopy> = {
  // ─── App lifecycle ─────────────────────────────────────────────────────────
  app_opened: { label: 'Opened the app' },
  app_backgrounded: { label: 'Left the app' },

  // ─── Recording ─────────────────────────────────────────────────────────────
  record_started: {
    label: 'Started recording',
    meaning: 'Tapped Record and the camera began rolling.',
  },
  record_completed: {
    label: 'Finished recording',
    meaning: 'Stopped recording and kept the video.',
  },
  record_discarded: {
    label: 'Threw a recording away',
    meaning: 'Recorded something and then chose not to keep it.',
  },
  story_submitted: {
    label: 'Sent the story',
    meaning: 'Chose who should receive it and pressed send.',
  },

  // ─── Getting it to us ──────────────────────────────────────────────────────
  compression_finished: {
    label: 'Video prepared',
    meaning: 'The phone finished shrinking the video before sending it.',
  },
  upload_started: { label: 'Started sending', meaning: 'The upload began.' },
  upload_succeeded: {
    label: 'Finished sending',
    meaning: 'The whole video reached our servers.',
  },
  upload_failed: {
    label: "Sending didn't work",
    meaning: 'The upload stopped before it finished.',
  },
  upload_auto_resumed: {
    label: 'Sending picked back up on its own',
    meaning: 'An interrupted upload restarted without the person doing anything.',
  },
  upload_retried_manually: {
    label: 'Tried sending again',
    meaning: 'The person tapped retry themselves — they noticed something was wrong.',
  },
  upload_stalled_recovered: {
    label: 'A stuck upload was rescued',
    meaning: 'An upload that appeared frozen was recovered.',
  },

  // ─── Our side ──────────────────────────────────────────────────────────────
  processing_started: {
    label: 'We started making the story',
    meaning: 'Our servers began stitching the video together.',
  },
  processing_succeeded: {
    label: 'Story ready to watch',
    meaning: 'The finished story is available to the family. This is the goal.',
  },
  processing_failed: {
    label: 'We failed to make the story',
    meaning: 'The person did everything right and still got nothing. The worst failure we have.',
  },

  // ─── Money ─────────────────────────────────────────────────────────────────
  paywall_viewed: { label: 'Saw the plans screen' },
  subscription_purchase_started: { label: 'Started subscribing' },
  subscription_purchase_finished: { label: 'Finished subscribing' },
  subscription_restored: { label: 'Restored a past purchase' },
  download_purchase_finished: { label: 'Bought a download' },

  // ─── Account ───────────────────────────────────────────────────────────────
  account_deleted: { label: 'Deleted their account' },

  // ─── Errors ────────────────────────────────────────────────────────────────
  error: { label: 'Something went wrong' },
  error_recording: { label: 'The camera failed' },
  error_upload: { label: 'Sending broke' },
  error_render: { label: 'A screen crashed' },
  error_background_upload: { label: 'Background sending broke' },
};

/** Why an upload died, in words. Mirrors `FailureReason` in the mobile app. */
const REASONS: Record<string, string> = {
  network: 'Lost their internet connection',
  auth: 'Got signed out mid-upload',
  quota: 'Hit the limit of their plan',
  storage_conflict: 'A file clash on our servers',
  server: 'Our servers had a problem',
  timeout: 'It took too long and gave up',
  unknown: 'Cause unknown',
};

/** Where it died. Mirrors `UploadStage` in the mobile app. */
const STAGES: Record<string, string> = {
  quota_check: 'while checking their plan',
  presign: 'while getting ready to send',
  asset_upload: 'while sending the video',
  finalize: 'right at the finish line',
  unknown: 'at an unknown point',
};

/** Turns `upload_failed` into "Upload failed" when we have no entry for it. */
function deslug(name: string): string {
  const words = name.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function eventCopy(name: string): EventCopy {
  return EVENTS[name] ?? { label: deslug(name) };
}

export function eventLabel(name: string): string {
  return eventCopy(name).label;
}

export function failureReason(reason: string): string {
  return REASONS[reason] ?? REASONS.unknown;
}

export function failureStage(stage: string): string {
  return STAGES[stage] ?? STAGES.unknown;
}

/** "Lost their internet connection, while sending the video" */
export function describeUploadFailure(reason: string, stage: string): string {
  return `${failureReason(reason)}, ${failureStage(stage)}`;
}

// ─── Number and unit formatting ──────────────────────────────────────────────

/** "3 people" / "1 person" — pluralisation without a library. */
export function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`;
}

export function people(count: number): string {
  return plural(count, 'person', 'people');
}

export function times(count: number): string {
  return plural(count, 'time', 'times');
}

/** "7 min", "45 sec", "1 hr 10 min" — never raw milliseconds. */
export function duration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} sec`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr ${minutes % 60} min`;
}

export function durationFromSeconds(seconds: number | null | undefined): string {
  return seconds == null ? '—' : duration(seconds * 1000);
}

/** "210 MB", "1.4 GB". */
export function bytes(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return '—';
  const mb = value / (1024 * 1024);
  if (mb < 1) return `${Math.round(value / 1024)} KB`;
  if (mb < 1024) return `${Math.round(mb)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

/** The window select's label, reused in prose so both always agree. */
export function windowLabel(hours: number): string {
  if (hours <= 24) return '24 hours';
  if (hours <= 24 * 7) return '7 days';
  if (hours <= 24 * 30) return '30 days';
  return `${Math.round(hours / 24)} days`;
}
