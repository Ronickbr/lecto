-- Grant execution of SECURITY DEFINER functions to authenticated users for RLS policy checks
GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_school_id(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_school_editor(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_attempt_staff(UUID) TO authenticated, service_role;
