import React from 'react';

interface IntenseLogoProps {
  className?: string;
}

export const IntenseLogo: React.FC<IntenseLogoProps> = ({ className = "h-8 sm:h-10" }) => {
  return (
    <svg
      viewBox="0 0 360 70"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="INTENSE"
    >
      <g transform="skewX(-14)">
        {/* Thin outline rectangle frame behind the letter I */}
        <rect
          x="10"
          y="6"
          width="32"
          height="58"
          fill="none"
          stroke="white"
          strokeWidth="2.2"
          opacity="0.9"
        />
        {/* Heavy italicized text INTENSE */}
        <text
          x="26"
          y="56"
          fill="white"
          fontFamily="Poppins, 'Arial Black', Impact, sans-serif"
          fontWeight="900"
          fontSize="62"
          letterSpacing="-1"
        >
          INTENSE
        </text>
      </g>
    </svg>
  );
};
