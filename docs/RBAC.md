# Role-based access control
Users retain their existing role code. WorkspaceMember retains its existing workspace-scoped role code. Role definitions use the unique (scope, code) key. A permission set is embedded in each role so it is fetched in one indexed read. Built-in defaults remain available until the role catalog is initialized. No user/password migration is required.

Company-wide monitoring and user administration require a platform permission. Workspace membership management accepts either company-level authority or an appropriate membership in that specific workspace. A workspace membership alone never grants company-wide admin rights. Legacy Admin/ADMINISTRATOR are normalized to ADMIN. Only an owner can assign or modify owner accounts; self-offboarding and self-role changes are rejected.

Initialize missing built-in role documents using authenticated POST /api/admin/roles (company admin). GET /api/admin/roles returns the effective role catalog. This is an additive operation; it never overwrites a configured permission set. No production migration was executed by this commit. Custom roles and full resource-level authorization are not yet supported.

Existing workspace visibility remains shared across authenticated users; membership-only visibility is intentionally not enabled until existing memberships are reconciled. Role management is not yet a complete audit of every task/project mutation endpoint.
