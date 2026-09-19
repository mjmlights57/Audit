-- EWPros v3.1.3: permanently remove archived projects and their project-specific entries.
-- Run AFTER the v3.1.0 migration. Back up Supabase BEFORE running or using this action.
-- The project purge runs in ONE database transaction. If any step fails, it all rolls back.
-- It deliberately preserves ORIGINAL imported bank statement lines. If previously posted
-- against the deleted project, those bank lines are returned to the review queue.
-- Removing real invoices, payments and accounting journals alters historical reports.

begin;

create or replace function public.ewpros_purge_archived_project(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project public.projects%rowtype;
  v_journals integer := 0;
  v_financial integer := 0;
  v_bank_reset integer := 0;
  v_invoices integer := 0;
  v_payments integer := 0;
  v_worker_payments integer := 0;
  v_timesheets integer := 0;
  v_mileage integer := 0;
  v_appointments integer := 0;
  v_reminders integer := 0;
  v_detached_journal_lines integer := 0;
begin
  if p_project_id is null then
    raise exception 'A project ID is required.';
  end if;

  select * into v_project
  from public.projects
  where id = p_project_id
  for update;

  if not found then
    raise exception 'Project not found. It may already have been deleted.';
  end if;
  if v_project.status is distinct from 'archived' then
    raise exception 'Only archived projects can be permanently deleted.';
  end if;

  -- Clear the project's accounting journals BEFORE deleting source transactions.
  -- Journal lines belonging to those journals are removed by their existing FK cascade.
  delete from public.journal_entries je
  where je.source_id in (
    select ft.id from public.financial_transactions ft
    where ft.project_id = p_project_id
  ) and je.source_type is distinct from 'opening_balance';
  get diagnostics v_journals = row_count;

  -- Keep original imported bank-statement rows so the account's statement history,
  -- duplicate-import protection and audit trail remain available. Re-review any
  -- affected previously posted row after removing its project financial entry.
  update public.bank_transactions bt
  set project_id = null,
      review_status = case when bt.review_status = 'posted' then 'pending' else bt.review_status end,
      reviewed_at = case when bt.review_status = 'posted' then null else bt.reviewed_at end,
      review_notes = concat_ws(E'\n', nullif(bt.review_notes, ''),
        'Previous project permanently deleted; review and repost if applicable.')
  where bt.project_id = p_project_id
     or bt.id in (
       select ft.bank_transaction_id from public.financial_transactions ft
       where ft.project_id = p_project_id and ft.bank_transaction_id is not null
     );
  get diagnostics v_bank_reset = row_count;

  delete from public.financial_transactions where project_id = p_project_id;
  get diagnostics v_financial = row_count;

  -- Remove project-owned invoices and their line items, and any recorded payments
  -- linked to those invoices, even when a legacy payment has no project_id.
  delete from public.payments p
  where p.project_id = p_project_id
     or p.invoice_id in (select i.id from public.invoices i where i.project_id = p_project_id);
  get diagnostics v_payments = row_count;

  delete from public.invoices where project_id = p_project_id;
  get diagnostics v_invoices = row_count;

  delete from public.worker_payments where project_id = p_project_id;
  get diagnostics v_worker_payments = row_count;

  delete from public.time_entries where project_id = p_project_id;
  get diagnostics v_timesheets = row_count;

  delete from public.mileage_trips where project_id = p_project_id;
  get diagnostics v_mileage = row_count;

  delete from public.reminders where project_id = p_project_id;
  get diagnostics v_reminders = row_count;

  delete from public.appointments where project_id = p_project_id;
  get diagnostics v_appointments = row_count;

  -- Do not remove journal *lines* from unrelated journal entries: that could
  -- unbalance an otherwise valid entry. Drop only the link to the deleted project.
  update public.journal_lines set project_id = null where project_id = p_project_id;
  get diagnostics v_detached_journal_lines = row_count;

  -- Existing FK cascades remove project_workers; SET NULL removes any remaining
  -- project references from reusable bank rules and other shared records.
  delete from public.projects where id = p_project_id;
  if not found then
    raise exception 'Project deletion failed.';
  end if;

  return jsonb_build_object(
    'mode', 'permanently_deleted',
    'project_id', p_project_id,
    'name', v_project.name,
    'removed', jsonb_build_object(
      'appointments', v_appointments,
      'reminders', v_reminders,
      'invoices', v_invoices,
      'payments', v_payments,
      'financial_transactions', v_financial,
      'journal_entries', v_journals,
      'worker_payments', v_worker_payments,
      'time_entries', v_timesheets,
      'mileage_trips', v_mileage
    ),
    'bank_rows_returned_for_review', v_bank_reset,
    'other_journal_lines_detached', v_detached_journal_lines
  );
end;
$$;

-- This operation must be available ONLY to the authorized server-side service role;
-- never expose it to the browser's anon/authenticated Supabase keys.
revoke all on function public.ewpros_purge_archived_project(uuid) from public;
revoke all on function public.ewpros_purge_archived_project(uuid) from anon;
revoke all on function public.ewpros_purge_archived_project(uuid) from authenticated;
grant execute on function public.ewpros_purge_archived_project(uuid) to service_role;

commit;
