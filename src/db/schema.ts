import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const applications = sqliteTable('applications', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    appId: text('app_id').notNull().unique(),
    fullName: text('full_name'),
    nationalId: text('national_id'),
    verificationStatus: text('verification_status'),
    completenessStatus: text('completeness_status'),
    createdAt: text('created_at'), // ISO string
    updatedAt: text('updated_at'), // ISO string
    phone: text('phone'),
    rawData: text('raw_data'), // JSON string of the full manifest
    deletedAt: text('deleted_at'), // ISO string – null = active, set = soft-deleted
});

export const hubs = sqliteTable('hubs', {
    id: text('id').primaryKey(), // UUID or cuid
    name: text('name').notNull().unique(),
    created_at: text('created_at').default(sql`(datetime('now'))`), // ISO string
    updated_at: text('updated_at').default(sql`(datetime('now'))`), // ISO string
});

export const users = sqliteTable('users', {
    id: text('id').primaryKey(), // UUID or Integer as string
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    role: text('role').notNull(), // admin | employee
    phone: text('phone'),
    password_hash: text('password_hash'),
    avatar_url: text('avatar_url'),
    status: text('status').notNull().default('active'),
    hubId: text('hub_id').references(() => hubs.id, { onDelete: 'set null' }), // Reference to hubs
});

export const dailyReportSummary = sqliteTable('daily_report_summary', {
    email: text('email').notNull(),
    date: text('date').notNull(),
    fullName: text('full_name'),
    appId: text('app_id'),
    uploadedCount: integer('uploaded_count').notNull(),
    extraUploadedCount: integer('extra_uploaded_count').notNull().default(0),
    totalSlots: integer('total_slots').notNull(),
    lastUpdated: text('last_updated'),
    status: text('status').notNull(),
    notes: text('notes'),
}, (table) => {
    return {
        pk: primaryKey({ columns: [table.email, table.date] })
    };
});
