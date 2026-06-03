-- (1) Đơn cũ: 4 con số này phải Y HỆT bước A
select oi.order_id, oi.unit_snapshot, oi.quantity, oi.unit_price, oi.line_total
from order_items oi
where oi.product_id = '903d369a-5758-4363-95d6-d7d4f52736ca';

