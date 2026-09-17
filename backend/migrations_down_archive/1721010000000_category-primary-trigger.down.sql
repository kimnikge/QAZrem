-- Down: category-primary-trigger
DROP TRIGGER IF EXISTS trg_pcl_sync_category ON part_category_links;
DROP FUNCTION IF EXISTS sync_parts_category_id();
