-- EWPros Integrated Business System v3.1.0
-- CRM-centered customer and appointment migration.
-- Run AFTER the v3.0, v3.0.2 and v3.0.3 migrations already used by EWPros.
-- This migration is additive. It does not delete existing customers, appointments,
-- projects, invoices, audits, bank transactions, or accounting history.

begin;

-- Appointments now reference the CRM master customer and related operating records.
alter table public.appointments add column if not exists customer_id uuid;
alter table public.appointments add column if not exists project_id uuid;
alter table public.appointments add column if not exists business_line_id uuid;
alter table public.appointments add column if not exists assigned_worker_id uuid;
alter table public.appointments add column if not exists appointment_type text;
alter table public.appointments add column if not exists appointment_notes text;
alter table public.appointments add column if not exists scheduled_end timestamptz;
alter table public.appointments add column if not exists auditor_visible boolean not null default true;
alter table public.appointments add column if not exists crm_created boolean not null default false;

-- Add foreign keys only when they do not already exist.
do $$
begin
  if not exists (select 1 from pg_constraint where conname='appointments_customer_id_fkey') then
    alter table public.appointments add constraint appointments_customer_id_fkey foreign key (customer_id) references public.customers(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='appointments_project_id_fkey') then
    alter table public.appointments add constraint appointments_project_id_fkey foreign key (project_id) references public.projects(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='appointments_business_line_id_fkey') then
    alter table public.appointments add constraint appointments_business_line_id_fkey foreign key (business_line_id) references public.business_lines(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='appointments_assigned_worker_id_fkey') then
    alter table public.appointments add constraint appointments_assigned_worker_id_fkey foreign key (assigned_worker_id) references public.workers(id) on delete set null;
  end if;
end $$;

create index if not exists appointments_customer_idx on public.appointments(customer_id);
create index if not exists appointments_project_idx on public.appointments(project_id);
create index if not exists appointments_assigned_worker_idx on public.appointments(assigned_worker_id);
create index if not exists appointments_scheduled_idx on public.appointments(scheduled_start);

-- Replace the old one-appointment/one-customer synchronizer with a CRM linker.
-- CRM-created appointments already contain customer_id and are never allowed to
-- create duplicate CRM customers. Legacy/Asana appointments are matched to the
-- existing CRM by their prior legacy link, email, phone, or name+address.
drop trigger if exists ewpros_sync_appointment_crm on public.appointments;

create or replace function public.ewpros_link_appointment_to_crm()
returns trigger
language plpgsql
as $$
declare
  v_customer_id uuid;
  v_project_id uuid;
  v_line_id uuid;
  v_project_name text;
  v_project_status text;
  v_phone text;
  v_email text;
  v_name text;
  v_address text;
begin
  select id into v_line_id from public.business_lines where code='utility_programs' limit 1;
  new.business_line_id := coalesce(new.business_line_id, v_line_id);

  -- A CRM appointment already points at its authoritative customer.
  if new.customer_id is not null then
    return new;
  end if;

  -- Preserve the exact customer previously created for an existing legacy appointment.
  select id into v_customer_id
  from public.customers
  where legacy_appointment_id = new.id
  limit 1;

  v_email := lower(trim(coalesce(new.customer_email,'')));
  v_phone := regexp_replace(coalesce(new.customer_phone,''), '[^0-9]', '', 'g');
  v_name := lower(trim(coalesce(new.customer_name,'')));
  v_address := lower(regexp_replace(trim(coalesce(new.service_address,'')), '\s+', ' ', 'g'));

  if v_customer_id is null and v_email <> '' then
    select id into v_customer_id
    from public.customers
    where lower(trim(coalesce(email,''))) = v_email
    order by active desc, updated_at desc
    limit 1;
  end if;

  if v_customer_id is null and length(v_phone) >= 7 then
    select id into v_customer_id
    from public.customers
    where regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g') = v_phone
    order by active desc, updated_at desc
    limit 1;
  end if;

  if v_customer_id is null and v_name <> '' and v_address <> '' then
    select id into v_customer_id
    from public.customers
    where lower(trim(display_name)) = v_name
      and lower(regexp_replace(trim(coalesce(service_address,'')), '\s+', ' ', 'g')) = v_address
    order by active desc, updated_at desc
    limit 1;
  end if;

  if v_customer_id is null then
    insert into public.customers(
      legacy_appointment_id, external_key, primary_business_line_id, customer_type,
      display_name, company_name, contact_name, phone, email, service_address,
      city, state_code, zipcode, source, active
    ) values (
      new.id,
      new.external_task_id,
      coalesce(new.business_line_id, v_line_id),
      'customer',
      coalesce(nullif(new.customer_name,''), 'Unnamed Customer'),
      coalesce(new.source_payload->>'company_name', new.source_payload->>'facility_name', new.customer_name),
      new.source_payload->>'contact_name',
      new.customer_phone,
      new.customer_email,
      new.service_address,
      new.source_payload->>'city',
      new.source_payload->>'state',
      new.source_payload->>'zipcode',
      case when new.source_system='asana_csv' then 'asana_import' else 'appointment' end,
      coalesce(new.source_active,true)
    ) returning id into v_customer_id;
  else
    -- Appointment imports may fill blanks, but do not overwrite CRM-managed values.
    update public.customers set
      phone = coalesce(nullif(phone,''), new.customer_phone),
      email = coalesce(nullif(email,''), new.customer_email),
      service_address = coalesce(nullif(service_address,''), new.service_address),
      contact_name = coalesce(nullif(contact_name,''), new.source_payload->>'contact_name'),
      city = coalesce(nullif(city,''), new.source_payload->>'city'),
      state_code = coalesce(nullif(state_code,''), new.source_payload->>'state'),
      zipcode = coalesce(nullif(zipcode,''), new.source_payload->>'zipcode'),
      updated_at = now()
    where id=v_customer_id;
  end if;

  new.customer_id := v_customer_id;

  -- Legacy/Asana appointments keep their automatically-created utility project.
  -- CRM appointments use the project explicitly selected by the administrator.
  if new.project_id is null and coalesce(new.crm_created,false)=false then
    select id into v_project_id
    from public.projects
    where legacy_appointment_id=new.id
    limit 1;

    v_project_name := coalesce(new.source_payload->>'project_id', new.source_payload->>'facility_name', new.customer_name, 'Imported project');
    v_project_status := case
      when not coalesce(new.source_active,true) or new.appointment_status='archived' then 'archived'
      when new.appointment_status='cancelled' then 'cancelled'
      when new.appointment_status='completed' then 'completed'
      when new.scheduled_start is not null then 'scheduled'
      else 'active'
    end;

    if v_project_id is null then
      insert into public.projects(
        legacy_appointment_id, external_key, customer_id, business_line_id,
        project_number, name, project_type, status, start_date,
        service_address, description
      ) values (
        new.id,
        new.external_task_id,
        v_customer_id,
        coalesce(new.business_line_id,v_line_id),
        nullif(new.source_payload->>'project_id',''),
        v_project_name,
        'Utility Audit',
        v_project_status,
        coalesce(nullif(new.source_payload->>'scheduled_date','')::date, new.scheduled_start::date),
        new.service_address,
        'Migrated from EWPros Auditor appointment'
      ) returning id into v_project_id;
    else
      update public.projects set
        customer_id=v_customer_id,
        business_line_id=coalesce(new.business_line_id,business_line_id),
        name=v_project_name,
        status=v_project_status,
        start_date=coalesce(nullif(new.source_payload->>'scheduled_date','')::date,new.scheduled_start::date,start_date),
        service_address=coalesce(new.service_address,service_address),
        updated_at=now()
      where id=v_project_id;
    end if;

    new.project_id := v_project_id;
  end if;

  return new;
exception when others then
  -- Legacy appointment imports must not be blocked by optional CRM linkage.
  raise warning 'EWPros CRM link skipped appointment %: %', new.id, sqlerrm;
  return new;
end $$;

create trigger ewpros_sync_appointment_crm
before insert or update on public.appointments
for each row execute function public.ewpros_link_appointment_to_crm();

-- Backfill CRM links on existing appointments. This does not change their audit data.
update public.appointments
set updated_at=updated_at
where customer_id is null;

-- Ensure browser roles cannot directly access the new appointment CRM fields.
alter table public.appointments enable row level security;
revoke all on table public.appointments from anon, authenticated;
grant all on table public.appointments to service_role;

commit;
