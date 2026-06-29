import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

type KanbanBoardLayoutContextValue = {
  registerTitleWidth: (columnKey: string, width: number) => void;
  registerHeaderHeight: (columnKey: string, height: number) => void;
  unregisterColumn: (columnKey: string) => void;
};

const KanbanBoardLayoutContext = createContext<KanbanBoardLayoutContextValue | null>(null);

export function useKanbanBoardLayout() {
  return useContext(KanbanBoardLayoutContext);
}

/** Ширина заголовка в одну строку — для выравнивания счётчиков. */
export function measureKanbanTitleWidth(titleElement: HTMLElement): number {
  const h4 = titleElement.querySelector('h4');
  if (!h4) return 0;

  const clone = h4.cloneNode(true) as HTMLElement;
  clone.style.position = 'absolute';
  clone.style.visibility = 'hidden';
  clone.style.pointerEvents = 'none';
  clone.style.whiteSpace = 'nowrap';
  clone.style.display = 'block';
  clone.style.overflow = 'visible';
  clone.style.webkitLineClamp = 'unset';
  clone.style.maxWidth = 'none';
  clone.style.width = 'max-content';

  document.body.appendChild(clone);
  const width = Math.ceil(clone.getBoundingClientRect().width);
  document.body.removeChild(clone);
  return width;
}

interface KanbanBoardLayoutProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Синхронизирует ширину блока заголовков и высоту (линию снизу) по самому длинному тексту на доске. */
export default function KanbanBoardLayout({ children, className, style }: KanbanBoardLayoutProps) {
  const titleWidthsRef = useRef<Record<string, number>>({});
  const headerHeightsRef = useRef<Record<string, number>>({});
  const [titleSlotWidth, setTitleSlotWidth] = useState(0);
  const [headerSyncHeight, setHeaderSyncHeight] = useState(0);

  const sync = useCallback(() => {
    const nextTitleWidth = Math.max(0, ...Object.values(titleWidthsRef.current));
    const nextHeaderHeight = Math.max(0, ...Object.values(headerHeightsRef.current));
    setTitleSlotWidth((prev) => (prev === nextTitleWidth ? prev : nextTitleWidth));
    setHeaderSyncHeight((prev) => (prev === nextHeaderHeight ? prev : nextHeaderHeight));
  }, []);

  const registerTitleWidth = useCallback(
    (columnKey: string, width: number) => {
      if (titleWidthsRef.current[columnKey] === width) return;
      titleWidthsRef.current[columnKey] = width;
      sync();
    },
    [sync],
  );

  const registerHeaderHeight = useCallback(
    (columnKey: string, height: number) => {
      if (headerHeightsRef.current[columnKey] === height) return;
      headerHeightsRef.current[columnKey] = height;
      sync();
    },
    [sync],
  );

  const unregisterColumn = useCallback(
    (columnKey: string) => {
      let changed = false;
      if (columnKey in titleWidthsRef.current) {
        delete titleWidthsRef.current[columnKey];
        changed = true;
      }
      if (columnKey in headerHeightsRef.current) {
        delete headerHeightsRef.current[columnKey];
        changed = true;
      }
      if (changed) sync();
    },
    [sync],
  );

  const contextValue = useMemo(
    () => ({ registerTitleWidth, registerHeaderHeight, unregisterColumn }),
    [registerTitleWidth, registerHeaderHeight, unregisterColumn],
  );

  const mergedStyle: CSSProperties = {
    ...style,
    ...(titleSlotWidth > 0 ? { ['--kanban-title-slot-width' as string]: `${titleSlotWidth}px` } : {}),
    ...(headerSyncHeight > 0 ? { ['--kanban-header-sync-height' as string]: `${headerSyncHeight}px` } : {}),
  };

  return (
    <KanbanBoardLayoutContext.Provider value={contextValue}>
      <div className={className} style={mergedStyle}>
        {children}
      </div>
    </KanbanBoardLayoutContext.Provider>
  );
}
