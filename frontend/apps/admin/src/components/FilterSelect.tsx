import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export interface FilterOption<T extends string = string> {
  value: T;
  label: string;
  icon: React.ReactNode;
  iconColor?: string;
}

export function FilterSelect<T extends string = string>({
  value,
  onChange,
  options,
  style,
  className = '',
}: {
  value: T;
  onChange: (v: T) => void;
  options: FilterOption<T>[];
  style?: React.CSSProperties;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0]!;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={rootRef} className={`fsel-root ${className}`} style={style}>
      <button type="button" className="fsel-trigger" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="fsel-icon" style={current.iconColor ? { color: current.iconColor } : undefined}>
          {current.icon}
        </span>
        <span className="fsel-label">{current.label}</span>
        <ChevronDown size={12} className={`fsel-chevron${open ? ' fsel-chevron-open' : ''}`} />
      </button>
      {open && (
        <div className="fsel-menu">
          {options.map((opt) => {
            const isSel = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                className={`fsel-item${isSel ? ' fsel-item-active' : ''}`}
                onClick={() => { onChange(opt.value); setOpen(false); }}
              >
                <span className="fsel-icon" style={opt.iconColor ? { color: opt.iconColor } : undefined}>
                  {opt.icon}
                </span>
                <span className="fsel-item-label">{opt.label}</span>
                {isSel && <Check size={12} className="fsel-check" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
