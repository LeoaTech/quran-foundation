import { usePermissions } from '../hooks/usePermissions';

/**
 * Conditionally renders children based on the current user's permissions.
 *
 * Props (use exactly one of permission / anyOf / allOf):
 *   permission  string        — user must have this key
 *   anyOf       string[]      — user must have at least one of these keys
 *   allOf       string[]      — user must have every one of these keys
 *   fallback    ReactNode     — rendered when access is denied (default: null)
 *   children    ReactNode     — rendered when access is allowed
 *
 * Usage:
 *   <Can permission="centers.create">
 *     <Button>Add center</Button>
 *   </Can>
 *
 *   <Can anyOf={['reports.view_org', 'reports.view_center']} fallback={<span>No access</span>}>
 *     <ReportLink />
 *   </Can>
 *
 * Before permissions are loaded (null in AuthContext), children are always
 * rendered to prevent a layout flash on the initial paint.
 */
export default function Can({ permission, anyOf, allOf, fallback = null, children }) {
  const { can, canAny, canAll, loaded } = usePermissions();

  // No restriction declared → always render.
  const hasRestriction = permission || anyOf?.length || allOf?.length;
  if (!hasRestriction) return children;

  // Permissions not loaded yet → show children to prevent flash.
  if (!loaded) return children;

  let allowed = false;
  if (permission)       allowed = can(permission);
  else if (anyOf?.length) allowed = canAny(...anyOf);
  else if (allOf?.length) allowed = canAll(...allOf);

  return allowed ? children : fallback;
}
