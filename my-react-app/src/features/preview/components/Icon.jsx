const paths = {
  layers: <><path d="m12 3 10 5-10 5L2 8l10-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>,
  box: <><path d="m12 3 9 5v9l-9 5-9-5V8l9-5Z"/><path d="m3 8 9 5 9-5m-9 5v9M7.5 5.5l9 5"/></>,
  chip: <><rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"/></>,
  board: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h4v4H7zm8 0h2m-2 4h2M7 16h10"/></>,
  power: <path d="M12 2v10M6.3 5.7a8 8 0 1 0 11.4 0"/>,
  button: <><path d="M5 14v4c0 2 14 2 14 0v-4"/><ellipse cx="12" cy="13" rx="7" ry="3"/><path d="M7 12V7c0-3 10-3 10 0v5"/><ellipse cx="12" cy="7" rx="5" ry="2"/></>,
  light: <path d="M8 14a6 6 0 1 1 8 0v3H8v-3Zm1 7h6M8 17h8"/>,
  plug: <path d="M8 3v5m8-5v5M6 8h12v3a6 6 0 0 1-12 0V8Zm6 9v5"/>,
  water: <><path d="M12 2C10 7 5 10 5 15a7 7 0 0 0 14 0c0-5-5-8-7-13Z"/><path d="M8.5 15a3.5 3.5 0 0 0 3.5 3.5"/></>,
  chevron: <path d="m9 5 7 7-7 7"/>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.01"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1-1.5 3m0 3v.01"/></>,
  reset: <path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
  minus: <path d="M5 12h14"/>,
  eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  'eye-off': <path d="m3 3 18 18M9.9 5.2A12 12 0 0 1 12 5c7 0 10 7 10 7a17 17 0 0 1-3.1 4.1M6 6.2A20 20 0 0 0 2 12s3 7 10 7c1.7 0 3.2-.4 4.5-1.1M10 10a3 3 0 0 0 4 4"/>,
  rotate: <><path d="m5 8-3 4 3 4m14-8 3 4-3 4"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
  target: <><circle cx="12" cy="12" r="7"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/></>,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>,
  tag: <><path d="M3 4h10l8 8-9 9-9-9V4Z"/><circle cx="8" cy="9" r="1"/></>,
};

export default function Icon({ name, size = 20, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.box}</svg>;
}
