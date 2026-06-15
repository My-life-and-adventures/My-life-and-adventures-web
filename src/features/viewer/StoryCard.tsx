import type { ViewerStory } from '../../api/types';
import './viewer.css';

interface StoryCardProps {
  story: ViewerStory;
}

export function StoryCard({ story }: StoryCardProps) {
  return (
    <article className="viewer-card">
      <h2>{story.title}</h2>
      {story.about ? <p className="viewer-meta">{story.about}</p> : null}
      {story.video_url ? (
        <video controls playsInline preload="metadata">
          <source src={story.video_url} type="video/mp4" />
        </video>
      ) : (
        <p className="viewer-empty">Video is not available yet.</p>
      )}
    </article>
  );
}
