import { useState, type ReactNode } from 'react';
import { Table, Pagination, Spin, Empty } from 'antd';
import type { TableProps, TablePaginationConfig } from 'antd';
import { useIsMobile } from '../../hooks/useResponsive';

export interface ResponsiveTableProps<T> extends TableProps<T> {
  /**
   * Карточный вид на мобильных: вместо таблицы рендерится список карточек.
   * Если не задан — таблица остаётся, но получает горизонтальный скролл
   * (scroll.x = max-content), компактный размер и упрощённую пагинацию.
   *
   * В карточном виде rowSelection не поддерживается — массовые операции
   * остаются за десктопом.
   */
  mobileCardRender?: (record: T, index: number) => ReactNode;
}

/**
 * Обёртка над antd Table — единая точка мобильного поведения таблиц.
 * На десктопе ведёт себя ровно как Table (props прокидываются как есть).
 */
export default function ResponsiveTable<T extends object>(props: ResponsiveTableProps<T>) {
  const isMobile = useIsMobile();
  const { mobileCardRender, ...tableProps } = props;
  const [innerPage, setInnerPage] = useState(1);
  const [innerPageSize, setInnerPageSize] = useState(10);

  if (!isMobile) {
    return <Table<T> {...tableProps} />;
  }

  if (!mobileCardRender) {
    const pagination: TablePaginationConfig | false =
      tableProps.pagination === false
        ? false
        : { simple: true, showSizeChanger: false, ...tableProps.pagination };
    return (
      <Table<T>
        {...tableProps}
        size="small"
        scroll={{ x: 'max-content', ...tableProps.scroll }}
        pagination={pagination}
      />
    );
  }

  const dataSource = (tableProps.dataSource ?? []) as T[];
  const paginationProp = tableProps.pagination;
  const isControlled =
    paginationProp !== false &&
    paginationProp !== undefined &&
    paginationProp.current !== undefined;

  let pageItems = dataSource;
  let paginationNode: ReactNode = null;

  if (paginationProp === false) {
    // без пагинации — показываем всё
  } else if (isControlled) {
    // серверная пагинация: dataSource уже содержит текущую страницу
    paginationNode = (
      <Pagination
        simple
        current={paginationProp.current}
        pageSize={paginationProp.pageSize}
        total={paginationProp.total}
        onChange={(page, pageSize) => paginationProp.onChange?.(page, pageSize)}
      />
    );
  } else {
    const pageSize = paginationProp?.pageSize ?? innerPageSize;
    pageItems = dataSource.slice((innerPage - 1) * pageSize, innerPage * pageSize);
    if (dataSource.length > pageSize) {
      paginationNode = (
        <Pagination
          simple
          current={innerPage}
          pageSize={pageSize}
          total={dataSource.length}
          onChange={(page, size) => {
            setInnerPage(page);
            setInnerPageSize(size);
          }}
        />
      );
    }
  }

  return (
    <Spin spinning={Boolean(tableProps.loading)}>
      <div className="responsive-table-cards">
        {pageItems.length === 0 && !tableProps.loading ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          pageItems.map((record, index) => {
            const key = tableProps.rowKey
              ? typeof tableProps.rowKey === 'function'
                ? tableProps.rowKey(record)
                : String((record as Record<string, unknown>)[tableProps.rowKey as string])
              : index;
            return <div key={key}>{mobileCardRender(record, index)}</div>;
          })
        )}
      </div>
      {paginationNode && <div className="responsive-table-cards__pagination">{paginationNode}</div>}
    </Spin>
  );
}
