-- Run against the migrated local database. Every fixture is rolled back.
begin;
set local role service_role;
do $$
declare
    a uuid; b uuid;
    v1 extensions.vector := ('[1,' || array_to_string(array_fill(0, array[1535]), ',') || ']')::extensions.vector;
    v2 extensions.vector := ('[0,1,' || array_to_string(array_fill(0, array[1534]), ',') || ']')::extensions.vector;
    vb extensions.vector := ('[0.8,0.6,' || array_to_string(array_fill(0, array[1534]), ',') || ']')::extensions.vector;
    old_vector extensions.vector := ('[1,' || array_to_string(array_fill(0, array[4095]), ',') || ']')::extensions.vector;
    result jsonb;
    snapshot_count integer;
begin
    insert into public.subreddits(name) values ('zz_openai_vector_a') returning id into a;
    insert into public.subreddits(name) values ('zz_openai_vector_b') returning id into b;
    insert into public.subreddit_descriptions(subreddit_id, description, description_embedding, description_embedding_openai)
    values (a, 'unchanged description', old_vector, v1), (b, 'another description', old_vector, vb);
    insert into public.subreddit_self_promotion_details(subreddit_id, self_promotion, self_promotion_detail)
    values (a, 'unspecified', ''), (b, 'unspecified', '');

    result := public.match_subreddits_by_descriptions_openai(jsonb_build_array(v1::text::jsonb, v2::text::jsonb), 0.3);
    -- Check relative order without relying on the rest of the local corpus.
    if (select ordinality from jsonb_array_elements(result) with ordinality where value->>'name'='zz_openai_vector_b')
       >= (select ordinality from jsonb_array_elements(result) with ordinality where value->>'name'='zz_openai_vector_a') then
        raise exception 'ranking must use mean similarity';
    end if;
    result := public.match_subreddits_by_descriptions_openai(jsonb_build_array(v1::text::jsonb, v2::text::jsonb), 0.9);
    if not result @> '[{"name":"zz_openai_vector_a"}]'::jsonb
       or result @> '[{"name":"zz_openai_vector_b"}]'::jsonb then
        raise exception 'qualification must use best-term similarity';
    end if;

    -- A model-only refresh preserves the original description and old vector.
    perform public.save_subreddit_snapshot('update', jsonb_build_object(
        'name','zz_openai_vector_a', 'weekly_active_users',3000,
        'description','unchanged description', 'description_embedding_openai',vb::text,
        'self_promotion','unspecified', 'self_promotion_detail','', 'self_promotion_confidence',null
    ), '[]'::jsonb);
    if not exists (select 1 from public.current_subreddits where id=a
        and description='unchanged description' and description_embedding=old_vector
        and description_embedding_openai=vb) then
        raise exception 'model refresh lost a description or legacy vector';
    end if;
    select count(*) into snapshot_count from public.subreddit_descriptions where subreddit_id=a;
    perform public.save_subreddit_snapshot('update', jsonb_build_object(
        'name','zz_openai_vector_a', 'weekly_active_users',3000,
        'description','unchanged description', 'description_embedding_openai',vb::text,
        'self_promotion','unspecified', 'self_promotion_detail','', 'self_promotion_confidence',null
    ), '[]'::jsonb);
    if (select count(*) from public.subreddit_descriptions where subreddit_id=a) <> snapshot_count then
        raise exception 'unchanged OpenAI snapshot was duplicated';
    end if;
    -- A legacy writer must not carry an OpenAI vector across a text change.
    perform public.save_subreddit_snapshot('update', jsonb_build_object(
        'name','zz_openai_vector_a', 'weekly_active_users',3000,
        'description','changed description', 'description_embedding',old_vector::text,
        'self_promotion','unspecified', 'self_promotion_detail','', 'self_promotion_confidence',null
    ), '[]'::jsonb);
    if exists (select 1 from public.current_subreddits where id=a and description_embedding_openai is not null) then
        raise exception 'stale OpenAI vector retained after a description change';
    end if;
end $$;
reset role;
do $$ begin
    if has_function_privilege('anon','public.match_subreddits_by_descriptions_openai(jsonb,double precision)','execute')
       or has_function_privilege('authenticated','public.match_subreddits_by_descriptions_openai(jsonb,double precision)','execute') then
        raise exception 'OpenAI search must remain service-role only';
    end if;
end $$;
rollback;
