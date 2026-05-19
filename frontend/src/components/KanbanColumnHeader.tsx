import type { ReactNode } from 'react';
import { Checkbox } from 'antd';
import { applyColumnSelection, getColumnSelectState } from '../utils/kanbanSelection';

interface KanbanColumnHeaderProps {
  count: number;
  columnIds: number[];
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

export default function KanbanColumnHeader({
  count,
  columnIds,
  selectedIds,
  onSelectionChange,
  disabled = false,
  className,
  children,
}: KanbanColumnHeaderProps) {
  const selectedSet = new Set(selectedIds);
  const { checked, indeterminate } = getColumnSelectState(columnIds, selectedSet);
  const showSelect = columnIds.length > 0;

  return (
    <div className={`kanban-column-header${className ? ` ${className}` : ''}`}>
      <div className="kanban-column-header-main">
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
        <div className="kanban-column-header-text">{children}</div>
      </div>
      <span className="kanban-column-count">{count}</span>
    </div>
  );
}
