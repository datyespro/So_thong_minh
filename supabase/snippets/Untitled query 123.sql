select customer_id, business_date, total_amount, count(*)
from orders where status='confirmed' and deleted_at is null
group by 1,2,3 having count(*) > 1;