-- Fix mixed UUID/text schemas around store GRN -> PO item updates.
-- Some deployments have store_grn_items.po_item_id as varchar while
-- store_po_items.id remains uuid. Cast both sides to text in the trigger.

CREATE OR REPLACE FUNCTION public.update_po_item_from_grn()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.grn_approved = true AND (OLD.grn_approved IS NULL OR OLD.grn_approved = false) THEN
    UPDATE public.store_po_items poi
    SET
      quantity_received = COALESCE(poi.quantity_received, 0) + COALESCE(gi.accepted_quantity, gi.quantity_accepted, gi.quantity_received, 0),
      quantity_pending = GREATEST(
        0,
        COALESCE(poi.quantity_ordered, 0)
          - (COALESCE(poi.quantity_received, 0) + COALESCE(gi.accepted_quantity, gi.quantity_accepted, gi.quantity_received, 0))
      ),
      quantity_rejected = COALESCE(poi.quantity_rejected, 0)
        + COALESCE(gi.rejected_quantity, gi.quantity_rejected, 0)
        + COALESCE(gi.damaged_quantity, gi.quantity_damaged, 0),
      updated_at = NOW()
    FROM public.store_grn_items gi
    WHERE gi.grn_id = NEW.id
      AND gi.po_item_id IS NOT NULL
      AND gi.po_item_id::text = poi.id::text;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_po_item_from_grn_trigger ON public.store_grn;
CREATE TRIGGER update_po_item_from_grn_trigger
  AFTER UPDATE OF grn_approved ON public.store_grn
  FOR EACH ROW
  EXECUTE FUNCTION public.update_po_item_from_grn();
