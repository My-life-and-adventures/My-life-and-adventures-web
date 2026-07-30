import type { ViewerStory } from '../../api/types';
import { StoryCard } from './StoryCard';

interface StoriesListProps {
  fullName: string;
  storytellerName: string;
  stories: ViewerStory[];
}

export function StoriesList({ fullName, storytellerName, stories }: StoriesListProps) {
  return (
    <>
      <div className="viewer-hero">
        <p className="viewer-eyebrow">Shared with you</p>
        <h1>Hello, {fullName || 'friend'}</h1>
        <p className="viewer-subtitle">
          <strong>{storytellerName || 'Someone'}</strong> shared personal stories with you on My
          Life and Adventures.
        </p>
        {stories.length > 0 ? (
          <span className="viewer-chip">
            {stories.length === 1 ? '1 story' : `${stories.length} stories`}
          </span>
        ) : null}
      </div>
      {stories.length === 0 ? (
        <div className="viewer-card">
          <p className="viewer-empty">No stories are available yet. Check back later.</p>
        </div>
      ) : (
        stories.map((story) => <StoryCard key={story.id} story={story} />)
      )}
    </>
  );
}
