const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const HeartIcon = ({ filled, ...p }) => (
  <svg {...base} {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" />
  </svg>
);
export const CommentIcon = (p) => (
  <svg {...base} {...p}><path d="M20 11.5c0 4.1-3.6 7.5-8 7.5-1.2 0-2.3-.2-3.3-.6L4 19.5l1.2-3.8A7.2 7.2 0 0 1 4 11.5C4 7.4 7.6 4 12 4s8 3.4 8 7.5z" /></svg>
);
export const BackIcon = (p) => <svg {...base} {...p}><path d="M15 5l-7 7 7 7" /></svg>;
export const PlusIcon = (p) => <svg {...base} {...p} strokeWidth={2.6}><path d="M12 5v14M5 12h14" /></svg>;
export const MoreIcon = (p) => (
  <svg {...base} {...p} fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
);
export const PhotoIcon = (p) => (
  <svg {...base} {...p}><rect x="3.5" y="5" width="17" height="14" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="M20.5 15.5l-4.5-4.5-8.5 8" /></svg>
);
export const LinkIcon = (p) => (
  <svg {...base} {...p}><path d="M10 14a4.5 4.5 0 0 0 6.4 0l2.8-2.8a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-2.8 2.8a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" /></svg>
);
export const CloseIcon = (p) => <svg {...base} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const CopyIcon = (p) => (
  <svg {...base} {...p}><rect x="8.5" y="8.5" width="11" height="11" rx="2.5" /><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" /></svg>
);
export const BellIcon = (p) => (
  <svg {...base} {...p}><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></svg>
);
export const ShareIcon =(p) => (
  <svg {...base} {...p}><path d="M12 3.5v11" /><path d="M8 7.5l4-4 4 4" /><path d="M7 11H5.5v9h13v-9H17" /></svg>
);
export const PenIcon =(p) => (
  <svg {...base} {...p} strokeWidth={1.7}>
    <path d="M14.5 5.5l4 4L9 19l-5 1 1-5z" />
    <path d="M12.5 7.5l4 4" />
    <path d="M5 15l4 4" />
  </svg>
);
export const PeopleIcon =(p) => (
  <svg {...base} {...p}><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5" /><circle cx="16.5" cy="9.5" r="2.6" /><path d="M16 14.2c2.4.1 4 1.6 4.5 4.3" /></svg>
);
export const CheckIcon =(p) => <svg {...base} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const SendIcon = (p) => <svg {...base} {...p}><path d="M5 12h13M13 6l6 6-6 6" /></svg>;
export const GearIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);
