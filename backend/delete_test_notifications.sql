-- Delete all test notifications
DELETE FROM notifications 
WHERE title = 'Test Notification' 
   OR title = 'Kyogongs Connected!';

-- Show remaining notification count
SELECT COUNT(*) as remaining_notifications FROM notifications;
