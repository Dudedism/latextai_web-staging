// Migration: Free Credits System
// Adds free_credit_balance (750) and first_purchase_discount_used (false) to all users.
// Orphans all existing projects (same as account deletion logic).
//
// Usage:
//   mongosh "mongodb://..." migrate_free_credits.js
//   mongosh "mongodb://..." --eval 'var DRY_RUN=true' migrate_free_credits.js
//
// Connection strings:
//   Staging:    mongosh "mongodb://admin:6364c3b75dfa0a523296bea188de76e696e04d72a023f9d175aad8d407eb9cee@staging.latext.ai:27017/latext_db?tls=true&authSource=admin" migrate_free_credits.js
//   Production: mongosh "mongodb://admin:b13aa0e5f6147ca8cb3055c59a15e336591dfb4ad932944b3f397498ee3b9085@latext.ai:27017/latext_db?tls=true&authSource=admin" migrate_free_credits.js

const dryRun = typeof DRY_RUN !== 'undefined' && DRY_RUN;
if (dryRun) print("=== DRY RUN — no changes will be written ===\n");

const db = db.getSiblingDB('latext_db');
const now = new Date();

// ---------- Step 1: Orphan all non-orphaned projects ----------
print("--- Step 1: Orphan projects ---");

const projects = db.projects.find({ is_orphaned: { $ne: true } }).toArray();
print(`  Found ${projects.length} projects to orphan`);

if (!dryRun && projects.length > 0) {
  const projectIds = projects.map(p => p.project_id);

  const orphanResult = db.projects.updateMany(
    { project_id: { $in: projectIds } },
    { $set: {
      user_email: null,
      upload_filename: null,
      error_message: null,
      is_orphaned: true,
      orphaned_at: now
    }}
  );
  print(`  Orphaned ${orphanResult.modifiedCount} projects`);

  // Delete document_analysis for orphaned projects
  const analysisResult = db.document_analysis.deleteMany(
    { project_id: { $in: projectIds } }
  );
  print(`  Deleted ${analysisResult.deletedCount} document_analysis records`);
}

// ---------- Step 2: Orphan credit transactions ----------
print("--- Step 2: Orphan credit transactions ---");

const txnCount = db.credit_transactions.countDocuments({ user_email: { $ne: null } });
print(`  Found ${txnCount} transactions to orphan`);

if (!dryRun && txnCount > 0) {
  const txnResult = db.credit_transactions.updateMany(
    { user_email: { $ne: null } },
    { $set: { user_email: null } }
  );
  print(`  Orphaned ${txnResult.modifiedCount} credit transactions`);
}

// ---------- Step 3: Delete used tokens ----------
print("--- Step 3: Delete used tokens ---");

const tokenCount = db.used_tokens.countDocuments({});
print(`  Found ${tokenCount} used tokens`);

if (!dryRun && tokenCount > 0) {
  const tokenResult = db.used_tokens.deleteMany({});
  print(`  Deleted ${tokenResult.deletedCount} used tokens`);
}

// ---------- Step 4: Update all non-deleted users ----------
print("--- Step 4: Update users ---");

const users = db.users.find({ is_deleted: { $ne: true } }).toArray();
print(`  Found ${users.length} active users`);

for (const user of users) {
  const email = user.email;
  const label = email || `_id:${user._id}`;
  const isAnon = user.is_anonymous === true;

  if (isAnon) {
    // Delete anonymous users outright
    if (!dryRun) {
      db.users.updateOne(
        { _id: user._id },
        { $set: { is_deleted: true, deleted_at: now, deleted_reason: 'migration_free_credits' } }
      );
    }
    print(`  [ANON] Marked deleted: ${label}`);
    continue;
  }

  const updates = {
    free_credit_balance: 750,
    first_purchase_discount_used: false,
    preview_count: 0,
    free_upload_used: false,
    free_project_id: null,
  };

  // Invalidate refresh tokens (force re-login)
  const unsets = {
    refresh_token_jti: "",
    token_updated_at: ""
  };

  if (!dryRun) {
    db.users.updateOne(
      { _id: user._id },
      { $set: updates, $unset: unsets }
    );
  }
  print(`  [USER] Updated: ${label} — 750 free credits, discount available, tokens invalidated`);
}

// ---------- Summary ----------
print("\n=== Migration complete ===");
print(`  Projects orphaned: ${projects.length}`);
print(`  Transactions orphaned: ${txnCount}`);
print(`  Tokens deleted: ${tokenCount}`);
print(`  Users updated: ${users.filter(u => !u.is_anonymous).length}`);
print(`  Anonymous users deleted: ${users.filter(u => u.is_anonymous).length}`);
if (dryRun) print("\n=== DRY RUN — nothing was written. Run without DRY_RUN to apply. ===");
