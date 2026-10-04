import type { SVGProps } from "react";
const paths = {
  mark: <path d="M5 19C3 10 7 3 12 4c5 1 1 9-7 15ZM19 5c2 9-2 16-7 15-5-1-1-9 7-15Z" />,
  pill: <><path d="M4.7 19.3a5.5 5.5 0 0 1 0-7.8l6.8-6.8a5.5 5.5 0 0 1 7.8 7.8l-6.8 6.8a5.5 5.5 0 0 1-7.8 0Z" /><path d="m8 8 8 8" /></>,
  timeline: <><path d="M6 5v14M12 5h7M12 12h7M12 19h7" /><circle cx="6" cy="5" r="2" /><circle cx="6" cy="12" r="2" /><circle cx="6" cy="19" r="2" /></>,
  book: <path d="M12 5v15M12 6C8 3 4 4 3 5v14c3-2 6-1 9 1 3-2 6-3 9-1V5c-3-2-6-1-9 1Z" />,
  cycle: <><path d="M20 8a9 9 0 1 0 1 6M20 3v5h-5" /><path d="M12 7v5l3 2" /></>,
  plus: <path d="M12 5v14M5 12h14" />, arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4M17 3v4M3 10h18M8 14h1M15 14h1" /></>,
  wave: <path d="M2 12h4l3-7 5 14 3-7h5" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
  moon: <path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z" />,
  smile: <><circle cx="12" cy="12" r="9" /><path d="M8 9h.01M16 9h.01M8 14c2 3 6 3 8 0" /></>,
  energy: <path d="m13 2-9 12h7l-1 8 10-13h-8l1-7Z" />,
  water: <path d="M12 3c-3 5-7 8-7 12a7 7 0 0 0 14 0c0-4-4-7-7-12Z" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  edit: <><path d="m15 4 5 5M4 20l5-1L20 8a2.8 2.8 0 0 0-4-4L5 15l-1 5Z" /></>,
  chart: <><path d="M4 4v16h16M7 14l4-5 4 3 5-7" /><circle cx="7" cy="14" r="1" /><circle cx="11" cy="9" r="1" /><circle cx="15" cy="12" r="1" /></>,
};
export type IconName = keyof typeof paths;
export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) { return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" {...props}>{paths[name]}</svg>; }
