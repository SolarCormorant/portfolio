import React, { useEffect, useRef } from 'react';

interface VideoPlayerProps {
  src: string;
  width?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  width = '100%',
  autoPlay = true,
  loop = true,
  muted = true,
  controls = true,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video && autoPlay) {
      video.play().catch((e) => {
        console.warn('Autoplay blocked:', e);
      });
    }
  }, [autoPlay]);

  return (
    <video
      ref={videoRef}
      src={src}
      controls={controls}
      autoPlay={autoPlay}
      muted={muted}
      loop={loop}
      playsInline
      style={{ width }}
    />
  );
};

export default VideoPlayer;
