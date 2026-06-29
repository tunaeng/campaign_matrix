import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Checkbox } from 'antd';
import { applyColumnSelection, getColumnSelectState } from '../utils/kanbanSelection';
import { measureKanbanTitleWidth, useKanbanBoardLayout } from './KanbanBoardLayout';

interface KanbanColumnHeaderProps {
  columnKey: string;
  count: number;
  columnIds: number[];
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

export default function KanbanColumnHeader({
  columnKey,
  count,
  columnIds,
  selectedIds,
  onSelectionChange,
  disabled = false,
  className,
  children,
}: KanbanColumnHeaderProps) {
  const boardLayout = useKanbanBoardLayout();
  const headerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const selectedSet = new Set(selectedIds);
  const { checked, indeterminate } = getColumnSelectState(columnIds, selectedSet);
  const showSelect = columnIds.length > 0;

  useLayoutEffect(() => {
    if (!boardLayout || !headerRef.current || !textRef.current || !mainRef.current) return;

    const measure = () => {
      if (!headerRef.current || !textRef.current || !mainRef.current) return;

      const reservedForControls = showSelect ? 56 : 40;
      const available = Math.max(0, mainRef.current.clientWidth - reservedForControls);
      const naturalTitleWidth = measureKanbanTitleWidth(textRef.current);
      boardLayout.registerTitleWidth(columnKey, Math.min(naturalTitleWidth, available));

      // Высота контента + padding + border (без учёта sync min-height)
      const contentHeight = mainRef.current.offsetHeight;
      const styles = getComputedStyle(headerRef.current);
      const paddingBottom = parseFloat(styles.paddingBottom) || 0;
      const borderBottom = parseFloat(styles.borderBottomWidth) || 0;
      boardLayout.registerHeaderHeight(columnKey, Math.ceil(contentHeight + paddingBottom + borderBottom));
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(headerRef.current);
    observer.observe(mainRef.current);
    return () => {
      observer.disconnect();
      boardLayout.unregisterColumn(columnKey);
    };
  }, [boardLayout, columnKey, children, showSelect]);

  return (
    <div ref={headerRef} className={`kanban-column-header${className ? ` ${className}` : ''}`}>
      <div ref={mainRef} className="kanban-column-header-main">
        {showSelect && (
          <Checkbox
            className="kanban-column-select"
            checked={checked}
            indeterminate={indeterminate}
            disabled={disabled}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              onSelectionChange(applyColumnSelection(selectedIds, columnIds, e.target.checked));
            }}
          />
        )}
        <div ref={textRef} className="kanban-column-header-text">
          {children}
        </div>
        <span className="kanban-column-count">{count}</span>
      </div>
    </div>
  );
}
