import type { AppEvent } from '../../api/admin';
import { bytes, describeUploadFailure, duration, durationFromSeconds } from './catalogue';

/**
 * Turns one recorded event into a sentence.
 *
 * The activity log is the tab someone opens with a support ticket in the other
 * window, so a row has to be readable at a glance: "Sending failed — lost their
 * internet connection, while sending the video (760 MB)" rather than a label and
 * a fold-out blob of JSON. The blob is still there for whoever wants it.
 *
 * Returns null when the payload adds nothing worth a sentence, so the row stays
 * quiet rather than padding itself out.
 */
export function describeEvent(event: AppEvent): string | null {
  const p = (event.props ?? {}) as Record<string, unknown>;
  const num = (key: string): number | null => {
    const v = p[key];
    return typeof v === 'number' ? v : null;
  };
  const str = (key: string): string | null => {
    const v = p[key];
    return typeof v === 'string' ? v : null;
  };

  switch (event.name) {
    case 'record_completed':
    case 'record_discarded':
      return durationLine('Recording', num('durationSeconds'));

    case 'story_submitted': {
      const parts = [durationFromSeconds(num('durationSeconds'))];
      const images = num('imageCount');
      const receivers = num('receiverCount');
      if (images != null) parts.push(`${images} photo${images === 1 ? '' : 's'}`);
      if (receivers != null) parts.push(`${receivers} recipient${receivers === 1 ? '' : 's'}`);
      return parts.join(' · ');
    }

    case 'upload_started':
      return sizeLine(num('bytes'), p.resumed === true ? 'resuming an earlier attempt' : null);

    case 'upload_succeeded': {
      const parts: string[] = [];
      const ms = num('durationMs');
      const size = num('bytes');
      if (size != null) parts.push(bytes(size));
      if (ms != null) parts.push(`took ${duration(ms)}`);
      if (ms != null && size != null && ms > 0) {
        // Throughput is what distinguishes "big file" from "bad connection",
        // which is the first question asked about any slow upload.
        const mbps = size / 1024 / 1024 / (ms / 1000);
        parts.push(`${mbps.toFixed(1)} MB/s`);
      }
      return parts.length ? parts.join(' · ') : null;
    }

    case 'upload_failed': {
      const reason = str('reason') ?? 'unknown';
      const stage = str('stage') ?? 'unknown';
      const size = num('bytes');
      const tail = size != null ? ` (${bytes(size)})` : '';
      return `${describeUploadFailure(reason, stage)}${tail}`;
    }

    case 'upload_auto_resumed': {
      const attempt = num('attempt');
      return attempt != null ? `Attempt ${attempt}` : null;
    }

    case 'upload_stalled_recovered':
      return p.linkedToServer === true
        ? 'The story had actually reached us — it was only the app that was stuck'
        : 'The story had not reached us; the upload was restarted';

    case 'compression_finished': {
      const ms = num('durationMs');
      if (p.skipped === true) return 'Skipped — the video was already small enough';
      return ms != null ? `Took ${duration(ms)}` : null;
    }

    case 'processing_failed': {
      const reason = str('reason');
      return reason === 'timeout'
        ? 'Our servers took too long and gave up'
        : reason === 'server_failed'
          ? 'Our servers failed while building the story'
          : reason;
    }

    case 'paywall_viewed':
      return `${p.locked === true ? 'Locked out' : 'Just browsing'} · on the ${str('currentTier') ?? 'unknown'} plan`;

    case 'subscription_purchase_started':
      return str('tier');

    case 'subscription_purchase_finished':
      return [str('tier'), str('status')].filter(Boolean).join(' · ') || null;

    case 'subscription_restored':
      return p.found === true ? 'Found a previous purchase' : 'Nothing to restore';

    case 'download_purchase_finished':
      return str('status');

    default:
      // Errors carry their message in a dedicated column already.
      return null;
  }
}

function durationLine(prefix: string, seconds: number | null): string | null {
  return seconds == null ? null : `${prefix} ran ${durationFromSeconds(seconds)}`;
}

function sizeLine(size: number | null, extra: string | null): string | null {
  const parts = [size != null ? bytes(size) : null, extra].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
