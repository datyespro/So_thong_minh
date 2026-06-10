select content, metadata->'card' as card, created_at
from chat_messages
where role='assistant' and metadata ? 'card'
order by created_at desc limit 5;