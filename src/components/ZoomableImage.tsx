import React from 'react';
import Zoom from 'react-medium-image-zoom';
import 'react-medium-image-zoom/dist/styles.css';

interface ZoomableImageProps {
  src: string;
  alt?: string;
  maxWidth?: string;
}

const ZoomableImage: React.FC<ZoomableImageProps> = ({
  src,
  alt = '',
  maxWidth = '800px',
}) => {
  return (
    <Zoom>
      <img
        alt={alt}
        src={src}
        style={{
        maxWidth: 'none',
        width: '100%',
        height: 'auto',
        cursor: 'zoom-in',
        }}
      />
    </Zoom>
  );
};

export default ZoomableImage;
