import React from 'react';
import { parseStoryText } from '../utils/textParser';

interface FormattedTextProps {
  text: string;
  className?: string;
}

const joinClassNames = (...classNames: Array<string | undefined>) =>
  classNames.filter(Boolean).join(' ');

export function FormattedText({ text, className }: FormattedTextProps) {
  const segments = parseStoryText(text);

  if (segments.length === 0) {
    return null;
  }

  return (
    <div className={joinClassNames('whitespace-pre-wrap break-words', className)}>
      {segments.map((segment, index) => (
        <span key={`${index}-${segment.text.length}`} className={segment.className}>
          {segment.text}
        </span>
      ))}
    </div>
  );
}
