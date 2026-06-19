-- RPC: Điều chỉnh tồn kho (kiểm kho) qua ledger
-- SECURITY INVOKER — chạy với quyền user đang đăng nhập
CREATE OR REPLACE FUNCTION public.adjust_product_stock(
  p_product_id UUID,
  p_new_quantity NUMERIC,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_current NUMERIC(14,2);
  v_delta NUMERIC(14,2);
  v_synced NUMERIC(14,2);
BEGIN
  -- Lấy owner từ auth context
  v_owner_id := auth.uid();
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Đọc sản phẩm (owner-scoped, active, chưa xóa)
  SELECT current_stock INTO v_current
  FROM public.products
  WHERE id = p_product_id
    AND owner_id = v_owner_id
    AND is_active = TRUE
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'product_not_found';
  END IF;

  -- Tính delta
  v_delta := p_new_quantity - v_current;

  -- delta = 0 → không cần điều chỉnh
  IF v_delta = 0 THEN
    RETURN jsonb_build_object(
      'adjusted', FALSE,
      'current_stock', v_current,
      'delta', 0
    );
  END IF;

  -- Ghi movement vào ledger
  INSERT INTO public.inventory_movements (
    owner_id, product_id, movement_type, quantity_delta,
    source_type, source_id, note, created_by
  ) VALUES (
    v_owner_id, p_product_id, 'adjustment', v_delta,
    'manual', NULL, p_note, v_owner_id
  );

  -- Sync denorm
  v_synced := public.sync_product_current_stock(v_owner_id, p_product_id);

  -- Audit log
  INSERT INTO public.audit_log (
    owner_id, actor_id, entity_type, entity_id, action,
    before_data, after_data, metadata
  ) VALUES (
    v_owner_id, v_owner_id, 'product', p_product_id, 'adjust_stock',
    jsonb_build_object('current_stock', v_current),
    jsonb_build_object('current_stock', v_synced),
    jsonb_build_object(
      'delta', v_delta,
      'new_quantity_requested', p_new_quantity,
      'note', COALESCE(p_note, '')
    )
  );

  RETURN jsonb_build_object(
    'adjusted', TRUE,
    'current_stock', v_synced,
    'delta', v_delta
  );
END;
$$;

-- Quyền: authenticated EXECUTE, anon KHÔNG
REVOKE ALL ON FUNCTION public.adjust_product_stock(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_product_stock(UUID, NUMERIC, TEXT) TO authenticated;
