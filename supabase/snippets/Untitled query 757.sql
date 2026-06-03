select oi.product_id,
       p.name  as master_name,
       p.unit  as master_unit,      -- đơn vị MASTER (lát nữa bác sẽ đổi cái này)
       oi.unit_snapshot,            -- đơn vị ĐÔNG CỨNG trong đơn (phải KHÔNG đổi)
       oi.quantity, oi.unit_price, oi.line_total,
       oi.order_id
from order_items oi
join products p on p.id = oi.product_id
order by oi.order_id desc
limit 10;