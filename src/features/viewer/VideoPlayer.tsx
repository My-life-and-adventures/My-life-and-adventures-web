import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

interface VideoPlayerProps {
  src: string;
  poster?: string;
}

function isHlsSource(src: string): boolean {
  return /\.m3u8(\?|#|$)/i.test(src);
}

export function VideoPlayer({ src, poster }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!isHlsSource(src)) {
      video.src = src;
      return;
    }

    const canPlayNativeHls = video.canPlayType('application/vnd.apple.mpegurl') !== '';
    if (canPlayNativeHls) {
      video.src = src;
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(video);
      return () => {
        hls.destroy();
      };
    }

    video.src = src;
  }, [src]);

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      preload="metadata"
      poster={poster}
      controlsList="nodownload noplaybackrate"
      disablePictureInPicture
      disableRemotePlayback
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
