import React from 'react';
import { Connection } from '@/app/types';

interface ConnectionLineProps {
  connection: Connection;
  sourcePosition: { x: number, y: number };
  targetPosition: { x: number, y: number };
  onDelete?: () => void;
}

export default function ConnectionLine({ 
  connection, 
  sourcePosition, 
  targetPosition,
  onDelete
}: ConnectionLineProps) {
  // Calculate the midpoint for the delete button
  const midX = (sourcePosition.x + targetPosition.x) / 2;
  const midY = (sourcePosition.y + targetPosition.y) / 2;
  
  // Calculate the angle of the line for arrow markers
  const angle = Math.atan2(targetPosition.y - sourcePosition.y, targetPosition.x - sourcePosition.x);
  
  // Calculate the distance between points
  const distance = Math.sqrt(
    Math.pow(targetPosition.x - sourcePosition.x, 2) + 
    Math.pow(targetPosition.y - sourcePosition.y, 2)
  );
  
  // Create connected greater-than signs along the path
  const arrowSize = 12;
  const arrowSpacing = arrowSize * 1.1;
  const numArrows = Math.floor(distance / arrowSpacing) - 1;
  
  // Generate greater-than signs
  const arrows = [];
  for (let i = 1; i <= numArrows; i++) {
    const ratio = i * arrowSpacing / distance;
    const x = sourcePosition.x + (targetPosition.x - sourcePosition.x) * ratio;
    const y = sourcePosition.y + (targetPosition.y - sourcePosition.y) * ratio;
    
    arrows.push(
      <text 
        key={i}
        x="0"
        y="0"
        fontSize={arrowSize * 1.5}
        fontFamily="monospace"
        fontWeight="bold"
        fill="black"
        textAnchor="middle"
        dominantBaseline="middle"
        transform={`translate(${x}, ${y}) rotate(${angle * 180 / Math.PI})`}
      >
        &gt;
      </text>
    );
  }
  
  return (
    <g className="connection-line group">
      {/* Greater-than signs */}
      {arrows}
      
      {/* Source endpoint */}
      <circle 
        cx={sourcePosition.x} 
        cy={sourcePosition.y} 
        r="4" 
        fill="black" 
      />
      
      {/* Target endpoint */}
      <circle 
        cx={targetPosition.x} 
        cy={targetPosition.y} 
        r="4" 
        fill="black" 
      />
      
      {/* Delete button at midpoint */}
      {onDelete && (
        <g 
          transform={`translate(${midX}, ${midY})`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        >
          <circle cx="0" cy="0" r="10" fill="white" stroke="black" strokeWidth="2" />
          <line x1="-5" y1="-5" x2="5" y2="5" stroke="black" strokeWidth="2" />
          <line x1="5" y1="-5" x2="-5" y2="5" stroke="black" strokeWidth="2" />
        </g>
      )}
    </g>
  );
} 