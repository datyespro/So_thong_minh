select oi.order_id, oi.product_name_snapshot, oi.unit_snapshot,
       oi.quantity, oi.unit_price, oi.line_total
from order_items oi
where oi.product_id = 'a585bd97-2306-49b5-887f-b2f18699591e';