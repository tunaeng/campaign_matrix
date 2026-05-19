export function getColumnSelectState(
  columnIds: number[],
  selectedSet: Set<number>,
): { checked: boolean; indeterminate: boolean } {
  if (columnIds.length === 0) {
    return { checked: false, indeterminate: false };
  }
  let selectedInColumn = 0;
  for (const id of columnIds) {
    if (selectedSet.has(id)) selectedInColumn += 1;
  }
  return {
    checked: selectedInColumn === columnIds.length,
    indeterminate: selectedInColumn > 0 && selectedInColumn < columnIds.length,
  };
}

export function applyColumnSelection(
  selectedIds: number[],
  columnIds: number[],
  select: boolean,
): number[] {
  if (select) {
    return [...new Set([...selectedIds, ...columnIds])];
  }
  const remove = new Set(columnIds);
  return selectedIds.filter((id) => !remove.has(id));
}

export function toggleItemSelection(selectedIds: number[], id: number, checked: boolean): number[] {
  if (checked) {
    return selectedIds.includes(id) ? selectedIds : [...selectedIds, id];
  }
  return selectedIds.filter((itemId) => itemId !== id);
}
