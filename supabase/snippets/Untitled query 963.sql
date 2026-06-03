select c.debt_total as stored,
  (select coalesce(sum(debt_amount),0) from orders where customer_id=c.id and status='confirmed' and deleted_at is null)
  - (select coalesce(sum(amount),0) from payments where customer_id=c.id and deleted_at is null) as recomputed
from customers c where c.name = 'Lan';