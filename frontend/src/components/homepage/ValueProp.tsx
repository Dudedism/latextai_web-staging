import React from 'react';
import './ValueProp.css';

type Props = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  cta?: { label: string; onClick: () => void } | null;
  align?: 'center' | 'left'; // layout variant
};

const ValueProp: React.FC<Props> = ({
  title = 'Save hours of work.',
  description = (
    <>
      Most authors spend around 4 hours formatting their paper in LaTeX to match
      publisher guidelines. We reduce that to minutes.
    </>
  ),
  icon,
  cta = null,
  align = 'center',
}) => {
  return (
    <section className={`section vp ${align === 'left' ? 'vp-left' : ''}`}>
      <div className="vp-wrap">
        <div className="vp-bubble" aria-hidden="true" />

        <div className="vp-content">
          <div className="vp-icon" aria-hidden="true" role="img">
            {icon ?? (
              <svg viewBox="0 0 24 24" className="vp-icon-svg">
                <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M12 7.5v5l3 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>

          <h2 className="vp-title">{title}</h2>
          <p className="vp-subtext">{description}</p>

          {cta && (
            <button type="button" className="btn-outline vp-cta" onClick={cta.onClick}>
              {cta.label} ↗
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

export default ValueProp;
