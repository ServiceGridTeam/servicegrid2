# Multi-Business Architecture v4 Implementation Plan

## Executive Summary

This plan implements the Multi-Business Architecture FeatureSpec v4, enabling ServiceGrid2 users to belong to multiple businesses with different roles in each, with seamless business switching and role-based navigation filtering. The implementation follows the "Paintbrush Principle" - UI responds to intent, not completion.

---

## Current State Analysis

### What Exists
| Component | Status | Notes |
|-----------|--------|-------|
| `app_role` enum | EXISTS | `owner`, `admin`, `technician`, `viewer` |
| `user_roles` table | EXISTS | Links user_id to role (but NOT business-scoped) |
| `profiles.business_id` | EXISTS | Single business only (limitation) |
| `team_invites` table | EXISTS | For inviting to ONE business |
| `accept_team_invite` RPC | EXISTS | Needs update for memberships |
| Team management hooks | EXISTS | `useTeamManagement.ts` |
| AppSidebar | EXISTS | No role-based filtering |

### What's Missing (Gap Analysis)
| Component | Priority | Notes |
|-----------|----------|-------|
| `business_memberships` table | P0 | Core multi-business link |
| `business_membership_audit` table | P2 | Audit trail |
| `profiles.active_business_id` column | P0 | Current context |
| `profiles.active_role` column | P0 | Current role cache |
| `src/lib/localState.ts` | P0 | localStorage persistence |
| `src/lib/precompute.ts` | P0 | Pre-computed nav by role |
| `src/lib/permissions.ts` | P0 | Role level constants |
| `src/lib/navigation.ts` | P0 | Nav items with minRole |
| `useOptimisticBusiness.ts` | P0 | Optimistic state machine |
| `usePrefetch.ts` | P1 | Prefetch on hover |
| `useBusinessMemberships.ts` | P0 | Fetch with cache |
| `useBusinessContext.ts` | P0 | Full context hook |
| `BusinessSwitcher.tsx` | P0 | Dropdown component |
| Updated `AppSidebar.tsx` | P0 | Role-based nav filtering |
| `RoleGate.tsx` | P0 | Access control wrapper |
| `membership-management` edge function | P1 | Server-side actions |
| Framer Motion | P1 | Micro-animations |

---

## Phase 1: Database Migration (Foundation)

### 1.1 Create `business_memberships` Table

```sql
CREATE TABLE IF NOT EXISTS business_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  status text NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'suspended', 'left', 'removed')),
  is_primary boolean NOT NULL DEFAULT false,
  invited_by uuid REFERENCES profiles(id),
  invited_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT NOW(),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, business_id)
);
```

### 1.2 Add Profile Columns

```sql
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS active_business_id uuid REFERENCES businesses(id),
  ADD COLUMN IF NOT EXISTS active_role app_role;
```

### 1.3 Create Indexes

- Unique index for one primary per user
- Performance indexes for active memberships
- Index for business lookups

### 1.4 Create Helper Functions

- `switch_active_business(p_business_id uuid)` - Switch context
- `get_user_business_ids(p_user_id uuid)` - Get all business IDs for RLS
- `clear_active_business_if_removed()` - Cleanup helper

### 1.5 Create Triggers

- Auto-create owner membership when business created
- Cleanup when business deleted
- Update `updated_at` on membership changes

### 1.6 Migrate Existing Data

```sql
-- Migrate existing profiles.business_id to memberships
INSERT INTO business_memberships (user_id, business_id, role, is_primary, status)
SELECT 
  p.id,
  p.business_id,
  COALESCE(ur.role, 'viewer'),
  true,
  'active'
FROM profiles p
LEFT JOIN user_roles ur ON p.id = ur.user_id
WHERE p.business_id IS NOT NULL;

-- Set active_business_id for all users
UPDATE profiles 
SET 
  active_business_id = business_id,
  active_role = (SELECT role FROM user_roles WHERE user_id = profiles.id LIMIT 1)
WHERE business_id IS NOT NULL;
```

### 1.7 Create RLS Policies

- Users can see own memberships + memberships in their businesses
- Insert only via edge functions (service role)
- Users can update their own membership (limited fields)
- Audit table visible to owners/admins only

### 1.8 Create Audit Table (P2)

```sql
CREATE TABLE IF NOT EXISTS business_membership_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES business_memberships(id) ON DELETE CASCADE,
  business_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN (
    'created', 'role_changed', 'suspended', 'reactivated', 'removed', 'left', 'ownership_transferred'
  )),
  old_value jsonb,
  new_value jsonb,
  performed_by uuid REFERENCES profiles(id),
  performed_at timestamptz NOT NULL DEFAULT NOW(),
  reason text
);
```

---

## Phase 2: Core Library Files

### 2.1 Create `src/lib/permissions.ts`

Define role hierarchy and helper functions:
- `ROLE_LEVELS` constant: `{ owner: 100, admin: 75, technician: 50, viewer: 25 }`
- `hasMinRole(userRole, minRole)` function
- `BUSINESS_SCOPED_QUERY_KEYS` array for cache invalidation

### 2.2 Create `src/lib/navigation.ts`

Define navigation items with role requirements:
- Dashboard (viewer)
- Calendar (viewer)
- Jobs (viewer)
- Customers (technician)
- Quotes (admin)
- Invoices (admin)
- Requests (admin)
- Team (technician - limited view)
- Routes (admin)
- Settings (admin)
- Marketing (admin)

### 2.3 Create `src/lib/precompute.ts`

Pre-compute navigation for ALL roles at startup:
- `NAV_BY_ROLE` object with filtered items per role
- `ROLE_CONFIG` with icon, color, label per role

### 2.4 Create `src/lib/localState.ts`

localStorage persistence layer:
- `getActiveBusiness()` - sync read
- `getActiveRole()` - sync read
- `getMemberships()` - cached memberships with TTL
- `setActiveBusiness(businessId, role)` - async-safe write
- `setMemberships(memberships)` - cache update
- `clear()` - logout cleanup

---

## Phase 3: React Hooks

### 3.1 Create `src/hooks/useOptimisticBusiness.ts`

Optimistic state machine:
- Tracks pending switch state
- Manages rollback point
- Returns effective values (optimistic if pending, server otherwise)
- Methods: `startOptimisticSwitch`, `confirmSwitch`, `rollbackSwitch`

### 3.2 Create `src/hooks/usePrefetch.ts`

Prefetch strategy:
- `prefetchBusiness(businessId)` - prefetch dashboard data
- `prefetchAllBusinesses(businessIds)` - staggered prefetch
- Uses React Query's `prefetchQuery`

### 3.3 Create `src/hooks/useBusinessMemberships.ts`

Fetch with cache:
- Query business_memberships joined with businesses
- Filter by active status
- Order by is_primary, joined_at
- `placeholderData` from localStorage for instant hydration
- Update localStorage cache on fresh fetch

### 3.4 Create `src/hooks/useBusinessContext.ts` (Main Hook)

Full implementation:
- Resolution priority: URL param > profile > localStorage > primary > first
- Integrates optimistic state layer
- Pre-computed nav items from `NAV_BY_ROLE`
- `switchBusiness()` with optimistic update + server persist
- `buildUrl()` with business context for non-primary
- `prefetch()` handler for dropdown hover
- Returns: businessId, business, role, navItems, memberships, isSwitching, etc.

### 3.5 Create `src/hooks/usePermission.ts`

Simple permission check:
- `usePermission(minRole)` returns `{ allowed, isLoading }`
- Uses `useBusinessContext` for role

---

## Phase 4: UI Components

### 4.1 Create `src/components/layout/BusinessSwitcher.tsx`

Dropdown with micro-feedback:
- Only renders if `hasMultipleBusinesses`
- Shows current business avatar, name, role badge
- Dropdown with all memberships
- Prefetch on hover
- Animations with Framer Motion:
  - Crossfade on business change
  - Slide transition for name
  - Check mark animation for active
- Press state feedback (scale down on click)

### 4.2 Update `src/components/layout/AppSidebar.tsx`

Role-based filtering:
- Use `useBusinessContext().navItems` instead of hardcoded items
- Add animation on role change
- Use `buildUrl()` for links
- Disable during switch (`isSwitching`)

### 4.3 Update `src/components/layout/AppHeader.tsx`

Add BusinessSwitcher:
- Insert `<BusinessSwitcher />` in header
- Position between breadcrumbs and global search

### 4.4 Create `src/components/auth/RoleGate.tsx`

Access control wrapper:
- Props: `minRole`, `children`, `fallback`, `redirectTo`, `loadingFallback`
- Uses `useBusinessContext` for role check
- Handles loading state
- Returns children if access, fallback/redirect otherwise

### 4.5 Update `src/contexts/AuthContext.tsx`

Clear localStorage on logout:
- Call `localState.clear()` in `signOut()`

---

## Phase 5: Edge Functions

### 5.1 Update `accept_team_invite` RPC

Modify to:
- Create `business_memberships` record instead of just linking profile
- Set `active_business_id` and `active_role` on profile
- Handle existing membership case (reactivate vs error)

### 5.2 Create `membership-management` Edge Function (P1)

Actions:
- `invite-member` - Create invite + send email
- `change-role` - Update role (with ownership transfer protection)
- `remove-member` - Set status to 'removed', clear active if needed
- `leave-business` - Set status to 'left', clear active if needed
- `suspend-member` - Set status to 'suspended'
- `reactivate-member` - Set status back to 'active'
- `transfer-ownership` - Atomic owner transfer
- `set-primary` - Change primary business

All actions create audit log entries.

---

## Phase 6: Update Existing Components

### 6.1 Update Team Management

- `useTeamMembers` - Use `business_memberships` for role lookup
- `useUpdateMemberRole` - Update membership role, not user_roles
- `useRemoveTeamMember` - Update membership status
- Team settings - Show role in context of current business

### 6.2 Update Onboarding

- When business is created, ensure owner membership is created
- Set as primary business
- Set active_business_id

### 6.3 Update All Business-Scoped Queries

Ensure all queries use `active_business_id` context:
- Jobs, Customers, Quotes, Invoices, etc.
- May need to pass `businessId` from context to hooks

---

## Phase 7: Testing & Verification

### 7.1 Test Data Setup

Create test scenarios:
1. User with single business (owner)
2. User with 2 businesses (owner of one, technician of another)
3. User invited to business (pending invite)
4. User removed from business

### 7.2 Functional Tests

- [ ] Business switcher shows all memberships
- [ ] Switching updates navigation immediately (optimistic)
- [ ] Navigation filters by role
- [ ] Dashboard shows correct business data
- [ ] URL param `?businessId=` works for deep links
- [ ] localStorage hydration works on reload
- [ ] Primary business loads by default
- [ ] Invite flow creates membership correctly
- [ ] Remove member clears active if needed
- [ ] Role change reflected immediately

### 7.3 Performance Tests

- [ ] Switch perceived latency < 50ms
- [ ] Mount with localStorage < 100ms
- [ ] Prefetch completes before click
- [ ] No flash of wrong nav items
- [ ] Animations run at 60fps

---

## Implementation Order

```
Week 1: Foundation
------------------
Day 1-2: Database migration (Phase 1)
  - Create tables, indexes, functions, triggers
  - Migrate existing data
  - RLS policies

Day 3: Library files (Phase 2)
  - permissions.ts
  - navigation.ts
  - precompute.ts
  - localState.ts

Day 4-5: Core hooks (Phase 3)
  - useOptimisticBusiness.ts
  - usePrefetch.ts
  - useBusinessMemberships.ts
  - useBusinessContext.ts
  - usePermission.ts

Week 2: UI & Integration
------------------------
Day 6-7: UI components (Phase 4)
  - BusinessSwitcher.tsx
  - RoleGate.tsx
  - Update AppSidebar.tsx
  - Update AppHeader.tsx
  - Update AuthContext.tsx

Day 8: Edge functions (Phase 5)
  - Update accept_team_invite
  - Create membership-management

Day 9-10: Updates & Testing (Phase 6-7)
  - Update team management
  - Update onboarding
  - Test data setup
  - Verification
```

---

## Files to Create/Modify

### New Files (12)
| File | Purpose |
|------|---------|
| `src/lib/permissions.ts` | Role levels and helpers |
| `src/lib/navigation.ts` | Nav items with minRole |
| `src/lib/precompute.ts` | Pre-computed nav by role |
| `src/lib/localState.ts` | localStorage persistence |
| `src/hooks/useOptimisticBusiness.ts` | Optimistic state machine |
| `src/hooks/usePrefetch.ts` | Prefetch on hover |
| `src/hooks/useBusinessMemberships.ts` | Fetch memberships |
| `src/hooks/useBusinessContext.ts` | Main context hook |
| `src/hooks/usePermission.ts` | Permission check |
| `src/components/layout/BusinessSwitcher.tsx` | Switcher dropdown |
| `src/components/auth/RoleGate.tsx` | Access control |
| `supabase/functions/membership-management/index.ts` | Server actions |

### Modified Files (6)
| File | Changes |
|------|---------|
| `src/components/layout/AppSidebar.tsx` | Use context navItems |
| `src/components/layout/AppHeader.tsx` | Add BusinessSwitcher |
| `src/contexts/AuthContext.tsx` | Clear localStorage on logout |
| `src/hooks/useTeamManagement.ts` | Use memberships table |
| `src/pages/Onboarding.tsx` | Ensure membership created |
| `supabase/functions/send-team-invite-email/index.ts` | May need updates |

### Database Migration
| Change | Type |
|--------|------|
| `business_memberships` table | CREATE |
| `business_membership_audit` table | CREATE |
| `profiles.active_business_id` | ADD COLUMN |
| `profiles.active_role` | ADD COLUMN |
| `switch_active_business` function | CREATE |
| `get_user_business_ids` function | CREATE |
| Triggers for auto-membership | CREATE |
| RLS policies | CREATE |
| Data migration from profiles | INSERT |

---

## Dependencies

### Required (Already Installed)
- `@tanstack/react-query` - Data fetching
- `sonner` - Toast notifications
- `react-router-dom` - Routing with URL params

### Optional (Recommended)
- `framer-motion` - Micro-animations (NOT currently installed)

If framer-motion is not added, fallback to CSS transitions.

---

## Critical Files for Implementation

1. **Database Migration SQL** - Foundation for everything
2. **`src/hooks/useBusinessContext.ts`** - Core hook that everything depends on
3. **`src/components/layout/BusinessSwitcher.tsx`** - Main UI for switching
4. **`src/components/layout/AppSidebar.tsx`** - Role-based nav filtering
5. **`src/lib/localState.ts`** - Instant hydration layer

---

## Next Highest Leverage Move

**Start with the Database Migration** - This is the foundation for everything else. Without the `business_memberships` table and profile columns, no other work can proceed.

After the migration, implement the hooks in order: `localState.ts` -> `useBusinessMemberships.ts` -> `useBusinessContext.ts` -> `BusinessSwitcher.tsx` -> update `AppSidebar.tsx`.

This gives us:
1. Multi-business data model
2. Instant hydration from localStorage
3. Business switching UI
4. Role-based navigation

All in approximately 3-4 implementation sessions.
