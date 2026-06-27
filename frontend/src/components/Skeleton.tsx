import React from 'react';
import './Skeleton.css'; // Assuming a CSS file for basic skeleton styles

interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
}

const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  borderRadius,
  className,
}) => {
  return (
    <div
      className={`skeleton-block ${className || ''}`}
      style={{ width, height, borderRadius }}
      role="presentation"
    />
  );
};

export default Skeleton;
