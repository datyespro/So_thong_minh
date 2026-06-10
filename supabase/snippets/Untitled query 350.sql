-- Khách nợ (khớp panel)

-- Khách nợ
select count(*) from customers
where debt_total > 0 and is_active and deleted_at is null;