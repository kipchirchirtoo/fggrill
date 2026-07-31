-- Rename legacy automated overstay charge references to a cleaner room-night
-- extension format while preserving the same idempotency meaning.
UPDATE folio_transactions
SET
  reference = regexp_replace(
    reference,
    '^AUTO-OVERSTAY-(.*)-([0-9]{4})-([0-9]{2})-([0-9]{2})$',
    'ROOM-NIGHT-EXT-\1-\2\3\4'
  ),
  description = regexp_replace(
    COALESCE(description, ''),
    '^Automatic overdue room-night extension for ',
    'Extra room night posted for '
  )
WHERE reference ~ '^AUTO-OVERSTAY-.*-[0-9]{4}-[0-9]{2}-[0-9]{2}$';
