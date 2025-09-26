import React from 'react';
import Zoom from 'react-medium-image-zoom';
import 'react-medium-image-zoom/dist/styles.css';

interface ZoomableImageProps {
  src: string;
  alt?: string;
  maxWidth?: string;
  maxHeight?: string;
}

const ZoomableImage: React.FC<ZoomableImageProps> = ({
  src,
  alt = '',
  maxWidth = '800px',
  maxHeight = '600px',
}) => {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      width: '100%'
    }}>
      <Zoom>
        <img
          alt={alt}
          src={src}
          style={{
            maxWidth: maxWidth,
            maxHeight: maxHeight,
            width: 'auto',
            height: 'auto',
            cursor: 'zoom-in',
            objectFit: 'contain',
          }}
        />
      </Zoom>
    </div>
  );
};

export default ZoomableImage;