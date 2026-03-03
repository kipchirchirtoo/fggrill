# NOTIFICATIONS KEEP LOADING - FIX

## THE PROBLEM
Notifications keep reappearing even after marking them as read or deleting them.

## ROOT CAUSE
The notifications system has a fundamental design flaw:

1. Notifications can be sent to:
   - Specific users (`user_id`)
   - All users with a role (`role`)
   - All users in a branch (`branch_id`)

2. When a notification is sent to a role (e.g., "cashier"), it creates ONE notification record with `role='cashier'` and `user_id=NULL`

3. When User A (a cashier) marks it as read, the system updates `is_read=true` on that ONE record

4. When User B (also a cashier) views notifications, they see the SAME record marked as read by User A

5. The polling mechanism refetches notifications every 30 seconds, bringing back the same data

## THE REAL ISSUE
The current schema doesn't track WHICH USER read WHICH NOTIFICATION. It only tracks if a notification is read or not.

For role/branch notifications, we need a many-to-many relationship:
- One notification can be read by multiple users
- One user can read multiple notifications

## SOLUTIONS

### Solution 1: User-Specific Read Tracking (RECOMMENDED)
Create a `notification_reads` table to track which users have read which notifications:

```sql
CREATE TABLE notification_reads (
  id SERIAL PRIMARY KEY,
  notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(notification_id, user_id)
);

CREATE INDEX idx_notification_reads_user ON notification_reads(user_id);
CREATE INDEX idx_notification_reads_notification ON notification_reads(notification_id);
```

Then modify the backend to:
1. When fetching notifications, exclude ones in `notification_reads` for the current user
2. When marking as read, insert into `notification_reads` instead of updating `is_read`
3. When clearing notifications, delete from `notification_reads` for the current user

### Solution 2: Duplicate Notifications Per User (SIMPLER)
When sending a notification to a role/branch, create individual notification records for each user:

```typescript
// Instead of:
await supabase.from('notifications').insert({
  role: 'cashier',
  title: 'New order',
  message: 'Order #123'
});

// Do this:
const cashiers = await supabase.from('users').select('id').eq('role', 'cashier');
const notifications = cashiers.map(user => ({
  user_id: user.id,
  title: 'New order',
  message: 'Order #123'
}));
await supabase.from('notifications').insert(notifications);
```

This way, each user has their own notification record that can be marked as read independently.

### Solution 3: Quick Fix - Filter on Frontend (TEMPORARY)
Store read notification IDs in localStorage and filter them out on the frontend:

```typescript
const readNotificationIds = JSON.parse(localStorage.getItem('readNotifications') || '[]');
const filteredNotifications = notifications.filter(n => !readNotificationIds.includes(n.id));
```

## IMPLEMENTED FIX (TEMPORARY)
I've updated the frontend to reload notifications after marking as read or deleting. This ensures the UI stays in sync with the backend.

However, the fundamental issue remains: role/branch notifications are shared across users.

## RECOMMENDED ACTION
Implement Solution 2 (Duplicate Notifications Per User) because:
- Simpler to implement
- No schema changes needed
- Each user gets their own notification
- Marking as read/deleting works correctly
- No complex joins needed

## FILES MODIFIED
- `frontend/src/components/modals/NotificationModal.tsx` - Added reload after mark as read/delete

## NEXT STEPS
1. Update `notificationService.notifyRole()` to create individual notifications per user
2. Update `notificationService.notifyBranch()` to create individual notifications per user
3. Test with multiple users in the same role/branch
