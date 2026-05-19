import { Select, Tag } from 'antd';
import type { SelectProps } from 'antd';
import type { OrganizationTag } from '../types';

/** Нормализует цвет для Ant Design Tag (preset или hex). */
export function normalizeTagColor(color?: string): string | undefined {
  if (!color || typeof color !== 'string') return undefined;
  const c = color.trim();
  if (!c) return undefined;
  const presets = ['magenta', 'red', 'volcano', 'orange', 'gold', 'lime', 'green', 'cyan', 'blue', 'geekblue', 'purple'];
  if (presets.includes(c)) return c;
  if (/^#?[0-9a-fA-F]{3,8}$/.test(c)) return c.startsWith('#') ? c : `#${c}`;
  return undefined;
}

interface Props extends Omit<SelectProps, 'mode' | 'options' | 'value' | 'onChange'> {
  availableTags?: OrganizationTag[];
  value?: number[];
  onChange?: (tagIds: number[]) => void;
}

export default function EntityTagSelect({ availableTags, value, onChange, placeholder = 'Теги', ...rest }: Props) {
  const groupedOptions = (() => {
    const list = availableTags || [];
    const byCategory = new Map<string, { value: number; label: string }[]>();
    for (const t of list) {
      const key = (t.category || '').trim() || 'Без категории';
      const group = byCategory.get(key) || [];
      group.push({ value: t.id, label: t.name });
      byCategory.set(key, group);
    }
    return Array.from(byCategory.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'ru'))
      .map(([label, options]) => ({ label, options }));
  })();

  return (
    <Select
      mode="multiple"
      allowClear
      placeholder={placeholder}
      value={value}
      onChange={onChange as SelectProps['onChange']}
      options={groupedOptions}
      tagRender={(props) => {
        const { label, value: v, closable, onClose } = props;
        const idNum = typeof v === 'number' ? v : Number(v);
        const meta = availableTags?.find((t) => t.id === idNum);
        return (
          <Tag color={normalizeTagColor(meta?.color)} onClose={onClose} closable={closable} style={{ marginRight: 4 }}>
            {label}
          </Tag>
        );
      }}
      optionFilterProp="label"
      style={{ minWidth: 200, ...rest.style }}
      {...rest}
    />
  );
}

export function renderTagChips(
  tagNames: string[] | undefined,
  tagsMeta?: Pick<OrganizationTag, 'id' | 'name' | 'color'>[],
  tagIds?: number[],
) {
  if (!tagNames?.length && !tagIds?.length) return null;
  const byId = new Map((tagsMeta || []).map((t) => [t.id, t]));
  const byName = new Map((tagsMeta || []).map((t) => [t.name, t]));
  if (tagIds?.length) {
    return tagIds.map((id) => {
      const meta = byId.get(id);
      const name = meta?.name ?? String(id);
      return (
        <Tag key={id} color={normalizeTagColor(meta?.color)} style={{ marginBottom: 2 }}>
          {name}
        </Tag>
      );
    });
  }
  return tagNames!.map((name) => (
    <Tag key={name} color={normalizeTagColor(byName.get(name)?.color)} style={{ marginBottom: 2 }}>
      {name}
    </Tag>
  ));
}
