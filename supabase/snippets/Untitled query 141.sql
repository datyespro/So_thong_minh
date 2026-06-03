select p.name, p.current_stock as stored,
  (select coalesce(sum(quantity_delta),0) from inventory_movements where product_id=p.id) as recomputed
from products p where p.name='xi măng';

