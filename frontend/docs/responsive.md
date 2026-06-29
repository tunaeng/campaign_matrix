# Мобильная адаптация: как делать страницы

Единый брейкпоинт: **мобильный = ширина < 768px** (antd `md`). Инфраструктура:

| Что | Где |
|-----|-----|
| Хук `useIsMobile()` / `useIsCompact()` | `src/hooks/useResponsive.ts` |
| Глобальные media-стили (`.filter-bar`, Modal, Drawer, Kanban) | `src/styles/responsive.css` |
| Таблицы | `src/components/responsive/ResponsiveTable.tsx` |
| Адаптивный layout (бургер-меню) | `src/components/AppLayout.tsx` |

## Чек-лист для новой страницы

1. **Таблицы — только через `ResponsiveTable`** (drop-in замена antd `Table`).
   На мобильных она автоматически даёт горизонтальный скролл, компактный размер и простую пагинацию.
   Для лучшего UX можно включить карточный вид:

   ```tsx
   <ResponsiveTable
     dataSource={rows}
     columns={columns}
     rowKey="id"
     mobileCardRender={(row) => (
       <Card size="small">
         <Typography.Text strong>{row.name}</Typography.Text>
         <div>{row.status_display}</div>
       </Card>
     )}
   />
   ```

   Карточный вид не поддерживает `rowSelection` — массовые операции остаются за десктопом.

2. **Панели фильтров — класс `.filter-bar`** (на `Space` или `div`):

   ```tsx
   <Space className="filter-bar" wrap>
     <Input.Search style={{ width: 280 }} ... />
     <Select style={{ width: 220 }} ... />
   </Space>
   ```

   На десктопе фиксированные ширины работают как раньше; на мобильных CSS растягивает
   все контролы на 100% ширины — ничего не переполняется.

3. **Сетки — responsive-спаны, не голый `span`:**

   ```tsx
   <Row gutter={[16, 12]}>
     <Col xs={12} sm={8} xl={4}><Statistic ... /></Col>  {/* KPI */}
     <Col xs={24} lg={12}><Card ... /></Col>             {/* графики/панели */}
   </Row>
   ```

4. **Никаких фиксированных `width` в px у контейнеров.** Только `maxWidth` + `width: '100%'`
   (пример: карточка логина `width: '100%', maxWidth: 400`).

5. **Modal/Drawer — ничего делать не нужно:** глобальный CSS делает их почти полноэкранными
   на мобильных, любой `width={980}` безопасен.

6. **Ветвление по устройству — только через `useIsMobile()`**, не через `window.innerWidth`:

   ```tsx
   const isMobile = useIsMobile();
   return isMobile ? <CompactHeader /> : <FullHeader />;
   ```

7. **Kanban-доски** — используйте классы `.kanban-board` / `.kanban-column` из
   `BoardStyles.css`: на мобильных колонки автоматически становятся 85vw со scroll-snap.

8. **Steps** — добавляйте проп `responsive` (вертикальная раскладка на узких экранах).

## Проверка

Перед сдачей страницы прогоните её в браузере на вьюпорте 390×844 (iPhone 12/13/14):
ничего не должно вылезать за экран по горизонтали, все действия должны быть доступны.
