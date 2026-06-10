-- Tổng bán ngày (thay ngày)
select count(*) so_don, coalesce(sum(total_amount),0) tong_ban
from orders where owner_id = auth.uid()
  and business_date = '2026-06-10' and status='confirmed' and deleted_at is null;

