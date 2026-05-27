ALTER TABLE daily_report_summary
ADD COLUMN extra_uploaded_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_daily_report_summary_date
ON daily_report_summary(date);
