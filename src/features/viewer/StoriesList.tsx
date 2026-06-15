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
        <h1>Hello, {fullName || 'friend'}</h1>
        <p className="viewer-subtitle">
          {storytellerName || 'Someone'} shared stories with you on My Life and Adventures.
        </p>
      </div>
      {stories.length === 0 ? (
        <p className="viewer-empty">No stories are available yet. Check back later.</p>
      ) : (
        stories.map((story) => <StoryCard key={story.id} story={story} />)
      )}
    </>
  );
}
