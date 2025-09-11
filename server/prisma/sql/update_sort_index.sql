-- 为现有附件设置默认的 sortIndex
UPDATE attachments 
SET "sortIndex" = COALESCE("sortIndex", 0) 
WHERE "sortIndex" IS NULL;

-- 为每个笔记的附件按创建时间设置递增的 sortIndex
WITH numbered_attachments AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY roteid ORDER BY "createdAt") - 1 as new_sort_index
  FROM attachments 
  WHERE roteid IS NOT NULL
)
UPDATE attachments 
SET "sortIndex" = numbered_attachments.new_sort_index
FROM numbered_attachments 
WHERE attachments.id = numbered_attachments.id;
