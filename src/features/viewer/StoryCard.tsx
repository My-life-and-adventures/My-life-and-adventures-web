import type { ViewerStory } from '../../api/types';
import { VideoPlayer } from './VideoPlayer';

interface StoryCardProps {
  story: ViewerStory;
}

function formatStoryDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDuration(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function StoryCard({ story }: StoryCardProps) {
  const dateLabel = formatStoryDate(story.scheduled_date ?? story.created_at);
  const durationLabel = formatDuration(story.duration);

  return (
    <article className="viewer-card">
      {story.video_url ? (
        <VideoPlayer src={story.video_url} />
      ) : (
        <p className="viewer-empty">Video is not available yet.</p>
      )}

      <div className="viewer-story-details">
        <h2>{story.title}</h2>
        {story.about ? <p className="viewer-meta">{story.about}</p> : null}

        {(dateLabel || durationLabel) && (
          <dl className="viewer-story-facts">
            {dateLabel ? (
              <div>
                <dt>Date</dt>
                <dd>{dateLabel}</dd>
              </div>
            ) : null}
            {durationLabel ? (
              <div>
                <dt>Duration</dt>
                <dd>{durationLabel}</dd>
              </div>
            ) : null}
          </dl>
        )}
      </div>
    </article>
  );
}
