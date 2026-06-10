-- Tổng bán 31/05
select count(*) so_don, coalesce(sum(total_amount),0) tong_ban
from orders
where business_date = '2026-05-31' and status = 'confirmed' and deleted_at is null;


