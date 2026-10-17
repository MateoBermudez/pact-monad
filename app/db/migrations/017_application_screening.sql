alter table applications
  add column ai_verdict text check (ai_verdict in ('accept', 'review', 'reject')),
  add column ai_score smallint check (ai_score between 0 and 100),
  add column ai_summary text,
  add column ai_strengths text[] not null default '{}',
  add column ai_concerns text[] not null default '{}',
  add column ai_evaluated_at timestamptz;

alter table ai_settings
  add column screening_mode text not null default 'assist' check (screening_mode in ('off', 'assist', 'auto')),
  add column screening_criteria text check (char_length(screening_criteria) <= 1000);

alter table jobs drop constraint jobs_kind_check;
alter table jobs add constraint jobs_kind_check check (kind in ('review_delivery', 'screen_application'));
