-- So denorm với tổng tính-lại-từ-nguồn
select
  c.debt_total as stored_debt,
  (select coalesce(sum(debt_amount),0) from orders
     where customer_id = c.id and status='confirmed' and deleted_at is null)
  - (select coalesce(sum(amount),0) from payments
     where customer_id = c.id and deleted_at is null) as recomputed_debt
from customers c where c.name = 'chị Lan';

-- Liệt kê các đơn confirmed của Lan để thấy 11tr đến từ đâu
select id, business_date, status, total_amount, paid_amount, debt_amount
from orders
where customer_id = (select id from customers where name = 'chị Lan' limit 1)
  and status='confirmed' and deleted_at is null
order by business_date;