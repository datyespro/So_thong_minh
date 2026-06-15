CREATE OR REPLACE FUNCTION public.ai_usage_current_month_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT count(*)::bigint
    FROM public.ai_interactions
    WHERE created_at >= (date_trunc('month', (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')) AT TIME ZONE 'Asia/Ho_Chi_Minh');
$$;

REVOKE ALL ON FUNCTION public.ai_usage_current_month_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_usage_current_month_count() TO authenticated;
