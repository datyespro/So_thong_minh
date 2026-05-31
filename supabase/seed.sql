-- TIP-002 local seed.
-- Safe default: do not hardcode an auth user. If a local auth user already
-- exists, seed a tiny owner-scoped dataset for manual testing.

DO $$
DECLARE
  v_owner_id UUID;
  v_customer_lan UUID;
  v_customer_hung UUID;
  v_product_xi_mang UUID;
  v_product_gach_do UUID;
  v_product_cat_vang UUID;
  v_supplier UUID;
  v_order UUID;
BEGIN
  SELECT id
  INTO v_owner_id
  FROM auth.users
  ORDER BY created_at
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE NOTICE 'TIP-002 seed skipped: create a local auth user first, then insert owner-scoped sample rows if needed.';
    RETURN;
  END IF;

  INSERT INTO public.customers (owner_id, name, phone, aliases, note)
  VALUES (v_owner_id, 'Cô Lan', NULL, ARRAY['co lan', 'lan'], 'TIP-002 seed')
  RETURNING id INTO v_customer_lan;

  INSERT INTO public.customers (owner_id, name, phone, aliases, note)
  VALUES (v_owner_id, 'Anh Hùng', NULL, ARRAY['anh hung', 'hung'], 'TIP-002 seed')
  RETURNING id INTO v_customer_hung;

  INSERT INTO public.products (owner_id, name, unit, sell_price, cost_price, min_stock, aliases)
  VALUES (v_owner_id, 'Xi măng', 'bao', 85000, 78000, 10, ARRAY['xi mang', 'ximang'])
  RETURNING id INTO v_product_xi_mang;

  INSERT INTO public.products (owner_id, name, unit, sell_price, cost_price, min_stock, aliases)
  VALUES (v_owner_id, 'Gạch đỏ', 'viên', 1500, 1200, 1000, ARRAY['gach do'])
  RETURNING id INTO v_product_gach_do;

  INSERT INTO public.products (owner_id, name, unit, sell_price, cost_price, min_stock, aliases)
  VALUES (v_owner_id, 'Cát vàng', 'khối', 350000, 300000, 2, ARRAY['cat vang'])
  RETURNING id INTO v_product_cat_vang;

  INSERT INTO public.suppliers (owner_id, name, aliases, note)
  VALUES (v_owner_id, 'Nhà cung cấp A', ARRAY['ncc a'], 'TIP-002 seed')
  RETURNING id INTO v_supplier;

  INSERT INTO public.orders (
    owner_id,
    customer_id,
    business_date,
    status,
    total_amount,
    paid_amount,
    debt_amount,
    raw_input,
    idempotency_key
  )
  VALUES (
    v_owner_id,
    v_customer_lan,
    current_date,
    'confirmed',
    170000,
    70000,
    100000,
    'Cô Lan mua 2 bao xi măng, trả 70000',
    'seed-tip002-order-1'
  )
  RETURNING id INTO v_order;

  INSERT INTO public.order_items (
    owner_id,
    order_id,
    product_id,
    product_name_snapshot,
    unit_snapshot,
    quantity,
    unit_price,
    line_total
  )
  VALUES (
    v_owner_id,
    v_order,
    v_product_xi_mang,
    'Xi măng',
    'bao',
    2,
    85000,
    170000
  );

  INSERT INTO public.payments (
    owner_id,
    customer_id,
    order_id,
    amount,
    method,
    raw_input,
    idempotency_key
  )
  VALUES (
    v_owner_id,
    v_customer_lan,
    v_order,
    30000,
    'cash',
    'Cô Lan trả thêm 30000',
    'seed-tip002-payment-1'
  );

  INSERT INTO public.inventory_movements (
    owner_id,
    product_id,
    movement_type,
    quantity_delta,
    source_type,
    source_id,
    note,
    created_by
  )
  VALUES
    (v_owner_id, v_product_xi_mang, 'purchase', 20, 'manual', NULL, 'TIP-002 seed nhập', v_owner_id),
    (v_owner_id, v_product_xi_mang, 'sale', -2, 'order', v_order, 'TIP-002 seed bán', v_owner_id);

  INSERT INTO public.usage_events (owner_id, event_type)
  VALUES
    (v_owner_id, 'login'),
    (v_owner_id, 'order_created'),
    (v_owner_id, 'query');

  PERFORM public.sync_customer_debt_total(v_owner_id, v_customer_lan);
  PERFORM public.sync_product_current_stock(v_owner_id, v_product_xi_mang);

  RAISE NOTICE 'TIP-002 seed inserted for owner %', v_owner_id;
END;
$$;
