import React, { useState, useRef, useEffect, useId } from 'react';
import { HelpCircle, X } from 'lucide-react';

export interface InfoTooltipProps {
  /** Short guidance title or term label */
  title?: string;
  /** Main guidance body or explanation */
  content: React.ReactNode;
  /** Positioning of tooltip popover relative to the trigger */
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  /** Accessible label for screen readers */
  ariaLabel?: string;
  /** Additional styling for the trigger button */
  className?: string;
  /** Icon size: sm (13px) or md (15px) */
  size?: 'sm' | 'md';
  /** Optional badge text or example to display inside tooltip */
  detail?: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
  title,
  content,
  position = 'top',
  ariaLabel,
  className = '',
  size = 'sm',
  detail,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);
  const tooltipId = useId();

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setIsOpen(true);
    }, 120);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  const handleToggle = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Avoid triggering parent button or row click handlers
    setIsOpen((prev) => !prev);
  };

  // Determine tooltip placement classes
  const getPlacementClass = () => {
    switch (position) {
      case 'bottom':
        return 'top-full left-1/2 -translate-x-1/2 mt-1.5';
      case 'left':
        return 'right-full top-1/2 -translate-y-1/2 mr-1.5';
      case 'right':
        return 'left-full top-1/2 -translate-y-1/2 ml-1.5';
      case 'top':
      case 'auto':
      default:
        return 'bottom-full left-1/2 -translate-x-1/2 mb-1.5';
    }
  };

  const iconDim = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <span
      ref={containerRef}
      className="relative inline-flex items-center align-middle"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={handleToggle}
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-label={ariaLabel || (title ? `Help: ${title}` : 'Contextual guidance')}
        className={`inline-flex items-center justify-center p-0.5 rounded text-slate-400 hover:text-teal-700 hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-600 transition-colors ${className}`}
      >
        <HelpCircle className={iconDim} aria-hidden="true" />
      </button>

      {isOpen && (
        <span
          id={tooltipId}
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          className={`absolute ${getPlacementClass()} z-50 w-64 sm:w-72 p-2.5 rounded-lg bg-slate-900/95 text-slate-100 text-xs shadow-xl border border-slate-700 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-100 text-left cursor-default pointer-events-auto`}
        >
          <span className="flex items-start justify-between gap-1.5 pb-1 border-b border-slate-800">
            <span className="font-semibold text-teal-300 text-[11px] uppercase tracking-wider">
              {title || 'Guidance'}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-800 transition-colors"
              aria-label="Close tooltip"
            >
              <X className="w-3 h-3" />
            </button>
          </span>

          <span className="block text-slate-200 mt-1.5 leading-relaxed font-normal normal-case">
            {content}
          </span>

          {detail && (
            <span className="block mt-2 pt-1.5 border-t border-slate-800/80 text-[10px] text-teal-200/90 font-mono">
              {detail}
            </span>
          )}
        </span>
      )}
    </span>
  );
};
