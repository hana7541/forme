// FORME에서 쓰는 작은 선 아이콘 모음 (1.5px 선, 20px 기준)
type IconProps = { className?: string; size?: number };

function Svg({ size = 18, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="9" r="5.5" />
    <path d="M13.2 13.2 17 17" />
  </Svg>
);

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 4v12M4 10h12" />
  </Svg>
);

export const MenuIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 6h14M3 10h14M3 14h14" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 5l10 10M15 5 5 15" />
  </Svg>
);

export const HeartIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 16.5s-6-3.6-6-8A3.3 3.3 0 0 1 10 6.3a3.3 3.3 0 0 1 6 2.2c0 4.4-6 8-6 8Z" />
  </Svg>
);

export const GridIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="5" height="6.5" rx="1" />
    <rect x="11.5" y="3.5" width="5" height="4" rx="1" />
    <rect x="3.5" y="13" width="5" height="3.5" rx="1" />
    <rect x="11.5" y="10.5" width="5" height="6" rx="1" />
  </Svg>
);

export const FolderIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h3l1.5 1.5h6.5A1.5 1.5 0 0 1 17 8v6.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5Z" />
  </Svg>
);

// 톱니바퀴 (24 기준으로 그려서 다른 아이콘과 같은 두께로 맞춤)
export const SettingsIcon = ({ size = 18, className }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const LogoutIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M12 6.5 15.5 10 12 13.5M15.5 10H8" />
  </Svg>
);

export const UploadIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 13V3.5M6.5 7 10 3.5 13.5 7M4 13.5v2A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5v-2" />
  </Svg>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12.5 4.5 7 10l5.5 5.5" />
  </Svg>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7.5 4.5 13 10l-5.5 5.5" />
  </Svg>
);

export const ExternalIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M11 4h5v5M16 4l-7 7M14 11.5V15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3.5" />
  </Svg>
);

export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h12M8 6V4.5A.5.5 0 0 1 8.5 4h3a.5.5 0 0 1 .5.5V6M6 6l.7 9.2a1 1 0 0 0 1 .8h4.6a1 1 0 0 0 1-.8L14 6" />
  </Svg>
);

export const BoardIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3.5" width="14" height="13" rx="1.5" />
    <rect x="5.5" y="6" width="4.5" height="5.5" rx="0.5" />
    <rect x="11.5" y="8.5" width="3" height="5" rx="0.5" />
  </Svg>
);

export const SlidersIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 6h8M15 6h1.5M3.5 14h2M9 14h7.5" />
    <circle cx="13" cy="6" r="1.8" />
    <circle cx="7" cy="14" r="1.8" />
  </Svg>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.5 8 10 12.5 14.5 8" />
  </Svg>
);

export const DownloadIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 3.5V13M6.5 9.5 10 13l3.5-3.5M4 13.5v2A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5v-2" />
  </Svg>
);
