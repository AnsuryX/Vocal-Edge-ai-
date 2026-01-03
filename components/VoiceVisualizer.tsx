
import React from 'react';

interface Props {
  color?: string;
}

const VoiceVisualizer: React.FC<Props> = ({ color = 'bg-blue-500' }) => {
  return (
    <div className="flex items-center justify-center gap-1 h-12">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className={`w-1 ${color} rounded-full animate-bounce`}
          style={{
            height: `${Math.random() * 100}%`,
            animationDelay: `${i * 0.1}s`,
            animationDuration: `${0.5 + Math.random()}s`
          }}
        />
      ))}
    </div>
  );
};

export default VoiceVisualizer;
