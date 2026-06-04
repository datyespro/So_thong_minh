select entity_type, entity_id, action, before_data, after_data, metadata, created_at
from audit_log
where entity_type = 'product'
order by created_at desc
limit 10;