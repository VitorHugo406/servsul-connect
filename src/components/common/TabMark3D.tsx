// Small 3D mark used beside a desktop tab title instead of emojis: three stacked plates in
// perspective with the tab's line icon on the top plate. Neutral tones follow the theme.
import type { ReactNode } from 'react';
import './tabMark3d.css';

export function TabMark3D({ icon }: { icon: ReactNode }) {
  return (
    <span className="tm3d" aria-hidden="true">
      <span className="tm3d-s">
        <i className="tm3d-p tm3d-p3" />
        <i className="tm3d-p tm3d-p2" />
        <i className="tm3d-p tm3d-p1"><span className="tm3d-i">{icon}</span></i>
      </span>
    </span>
  );
}
