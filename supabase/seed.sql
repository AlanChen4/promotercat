-- Cat-themed local development data.
-- Counts, descriptions, and promotion policies are illustrative, not verified Reddit data.
-- Re-running this file updates these examples without duplicating them.
-- Includes one local test account and illustrative history baselines. No billing records are created.

begin;

-- Local-only credentials match the development sign-in button.
insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token,
    email_change_token_new, email_change, created_at, updated_at
)
values (
    '00000000-0000-0000-0000-000000000000',
    'c47c47c4-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'miso@promotercat.local',
    extensions.crypt('promotercat-local-only', extensions.gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{"name":"Miso"}',
    '', '', '', '', now(), now()
)
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
values (
    'c47c47c4-0000-4000-8000-000000000001',
    'c47c47c4-0000-4000-8000-000000000001',
    '{"sub":"c47c47c4-0000-4000-8000-000000000001","email":"miso@promotercat.local","email_verified":true}',
    'email', now(), now()
)
on conflict (provider_id, provider) do nothing;

-- One fixed, illustrative baseline keeps seeds idempotent and older than scrapes.
with seed_subreddits (id, name, weekly_active_users, self_promotion, self_promotion_detail, description) as (
    values
    ('5c3c475c-0d37-5c6c-9964-5ce18208f6c2', 'cats', 340000, 'not_allowed',
     'No ads, referral links, or product promotions.',
     'Photos, stories, and everyday life with pet cats and kittens.'),
    ('2c38933f-8c26-55f0-b23e-2f64cf6b8d54', 'catpictures', 49000, 'not_allowed',
     'Original cat photos only. No shop links or watermarks.',
     'Share original cat photography, portraits, and candid kitten pictures.'),
    ('c2c476af-005f-5c51-a8bb-f0a4bac38dcb', 'Catswithjobs', 57500, 'unspecified',
     'No explicit promotion rule in this sample.',
     'Funny photos of cats helping in offices, workshops, and home businesses.'),
    ('22796e24-9bcb-564d-93d2-cc2c8e3c9f57', 'IllegallySmolCats', 72500, 'not_allowed',
     'No sales posts or fundraising links.',
     'Tiny kittens, rescue stories, and photos of very small cats.'),
    ('73b82df8-3c66-5c85-8ebe-b371e80d374f', 'OneOrangeBraincell', 47500, 'not_allowed',
     'Memes welcome; commercial links are not.',
     'Orange cat antics, silly behavior, and cat memes.'),
    ('14940a49-62a7-536e-9964-9871f9c15df3', 'blackcats', 41250, 'unspecified',
     'No explicit promotion rule in this sample.',
     'Black cat photos, adoption stories, and appreciation for miniature house panthers.'),
    ('46708df1-3131-566b-838e-dccd6e65e6ca', 'standardissuecat', 21500, 'not_allowed',
     'No advertising, affiliate links, or merchandise sales.',
     'Brown tabby cats, their markings, personalities, and everyday adventures.'),
    ('0a486b8b-97d9-5f48-9d4c-d18fec492633', 'tuxedocats', 14000, 'unspecified',
     'No explicit promotion rule in this sample.',
     'Black and white tuxedo cats, photographs, and stories from their owners.'),
    ('dc24584d-27bc-5ac1-a5f4-b91368115c7a', 'torties', 8000, 'unspecified',
     'No explicit promotion rule in this sample.',
     'Tortoiseshell cats, their colorful coats, and spirited personalities.'),
    ('d1379bfa-2a5e-500d-9ca0-a871be77a991', 'SiameseCats', 3600, 'allowed_limited',
     'Relevant resources may be shared in the monthly advice thread.',
     'Siamese cat care, training, behavior, and enrichment ideas.'),
    ('344aa970-4480-5e5b-a8c9-fda352aaa722', 'MaineCoon', 9250, 'not_allowed',
     'No breeder advertising or cat sales.',
     'Maine Coon grooming, photos, and life with large long-haired cats.'),
    ('85f8a447-2da7-59ff-bc5d-2a934135edbb', 'ragdolls', 5750, 'unspecified',
     'No explicit promotion rule in this sample.',
     'Ragdoll cat photos, grooming routines, and breed discussions.'),
    ('198a3e2d-7509-54a7-b6a6-3333d15b5264', 'BengalCats', 4750, 'allowed_limited',
     'Share useful care resources in the weekly discussion thread.',
     'Bengal cat exercise, interactive play, training, and indoor enrichment.'),
    ('ae55ce37-23d2-5789-afc7-b9f534048161', 'catsinsinks', 6000, 'not_allowed',
     'Cat photos only. No promotional links.',
     'Cats sleeping, hiding, or relaxing in sinks and other unexpected places.'),
    ('6aedc9cb-4c1c-5a32-b90e-fec61c76177a', 'catsinboxes', 3400, 'unspecified',
     'No explicit promotion rule in this sample.',
     'Cats enjoying cardboard boxes, homemade forts, and cozy hiding spots.'),
    ('98e8c035-3acd-52e7-8448-a2166850528c', 'CatAdvice', 32500, 'allowed_limited',
     'Disclose your affiliation and link only when answering a relevant question.',
     'Practical cat behavior advice, litter box problems, introductions, and pet care.'),
    ('a89a8a62-3f97-526b-9604-34d8cc561d3d', 'catcare', 6000, 'allowed_limited',
     'Educational guides are welcome once per week; no direct sales.',
     'Cat grooming, daily care routines, and helpful resources for new owners.'),
    ('566dbfd1-dd72-5f11-94fd-422005e767f9', 'CatToys', 2750, 'allowed_full',
     'Share your toys, demos, and shop links. Disclose that you are the maker.',
     'Cat toy makers, puzzle feeders, interactive toys, and product demonstrations.'),
    ('a5c7eef6-bf22-5fa4-87d9-fdbc41ddccd1', 'CatFurniture', 2100, 'allowed_full',
     'Original cat furniture and product launches are welcome with clear pricing.',
     'Cat shelves, scratching posts, window perches, and furniture design projects.'),
    ('7aa18ca0-f7cc-5ee4-a884-059569c04fed', 'CatArt', 7500, 'allowed_full',
     'Artists may share original work, commission pages, and print shops.',
     'Original cat illustrations, paintings, digital artwork, and artist portfolios.'),
    ('aa74eb62-7b3b-5831-a4f0-143409bcd865', 'CatPhotography', 5500, 'allowed_limited',
     'Portfolio links are welcome on Feedback Friday. No unsolicited ads.',
     'Cat photography techniques, lighting, camera gear, and portfolio feedback.'),
    ('4e76ac3e-98f8-5a93-aaa5-4973395b2049', 'CatCrafts', 1350, 'allowed_full',
     'Handmade cat crafts and shop links are welcome. Include original photos.',
     'Handmade cat accessories, crochet patterns, sewing projects, and small craft shops.'),
    ('f214cd75-7aba-5677-839a-e08b80f14713', 'CatGameDev', 1150, 'allowed_full',
     'Share playable demos and store pages. Include a gameplay clip.',
     'Indie game development featuring cats, cozy games, and feline game characters.'),
    ('e034cb43-cb31-5781-b349-22ec2ed1d9a0', 'CatTech', 900, 'allowed_full',
     'Cat apps and gadgets are welcome with a demo and a clear explanation.',
     'Cat technology, pet tracking apps, smart feeders, and connected pet gadgets.'),
    ('80c49698-0e61-5b08-bee5-f22f5c14730b', 'CatStartups', 625, 'allowed_full',
     'Founders may share launches and request feedback. No repeated posts.',
     'Founders building cat products, pet software, and small businesses for cat owners.'),
    ('abe55bdf-201d-5743-98c7-dd0d6c9e9194', 'CatRescue', 4600, 'allowed_limited',
     'Verified rescues may share adoption events; fundraising needs moderator approval.',
     'Cat rescue organizations, shelter cats, adoption events, and volunteer coordination.'),
    ('30029feb-206e-5616-8183-3de3742bc088', 'CatFosters', 1550, 'allowed_limited',
     'Share foster resources in the weekly thread. Ask before posting donation links.',
     'Fostering kittens, bottle feeding, rescue support, and preparing cats for adoption.'),
    ('00d5268a-e92a-5e3e-9225-50779c15d4c2', 'SeniorCats', 4400, 'unspecified',
     'No explicit promotion rule in this sample.',
     'Life with older cats, accessible homes, gentle play, and senior pet routines.'),
    ('41c243e7-31c8-5b98-bff0-edb64e309593', 'KittenCare', 2350, 'allowed_limited',
     'Helpful care guides are welcome; disclose any connection to the resource.',
     'New kitten care, feeding schedules, socialization, and first-time cat ownership.'),
    ('b160d7fe-ba7a-55c3-b6f3-7200dd3c975a', 'CatEnrichment', 3100, 'unspecified',
     'No explicit promotion rule in this sample.',
     'Indoor cat enrichment, climbing spaces, puzzle games, and play routines.'),
    ('84d5ce20-412e-506f-a5ef-d1d7d3bafd9b', 'CatNutrition', 2550, 'not_allowed',
     'No food brand promotions, affiliate links, or supplement sales.',
     'Cat food labels, feeding routines, and general nutrition discussions.'),
    ('6f100628-5334-5691-95ef-6db1ecd096b8', 'CatShopOwners', 700, 'allowed_full',
     'Cat shop owners may share new products and lessons from running a store.',
     'Small businesses selling cat accessories, handmade gifts, and pet products.')
), seed_rules (subreddit_name, title, description) as (
    values
        ('cats', 'Stay on topic', 'Photos, stories, and everyday life with pet cats and kittens.'),
        ('cats', 'Promotion policy', 'No ads, referral links, or product promotions.'),
        ('cats', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('catpictures', 'Stay on topic', 'Share original cat photography, portraits, and candid kitten pictures.'),
        ('catpictures', 'Promotion policy', 'Original cat photos only. No shop links or watermarks.'),
        ('catpictures', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('Catswithjobs', 'Stay on topic', 'Funny photos of cats helping in offices, workshops, and home businesses.'),
        ('Catswithjobs', 'Promotion policy', 'No explicit promotion rule in this sample.'),
        ('Catswithjobs', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('IllegallySmolCats', 'Stay on topic', 'Tiny kittens, rescue stories, and photos of very small cats.'),
        ('IllegallySmolCats', 'Promotion policy', 'No sales posts or fundraising links.'),
        ('IllegallySmolCats', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('OneOrangeBraincell', 'Stay on topic', 'Orange cat antics, silly behavior, and cat memes.'),
        ('OneOrangeBraincell', 'Promotion policy', 'Memes welcome; commercial links are not.'),
        ('OneOrangeBraincell', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('blackcats', 'Stay on topic', 'Black cat photos, adoption stories, and appreciation for miniature house panthers.'),
        ('blackcats', 'Promotion policy', 'No explicit promotion rule in this sample.'),
        ('blackcats', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('standardissuecat', 'Stay on topic', 'Brown tabby cats, their markings, personalities, and everyday adventures.'),
        ('standardissuecat', 'Promotion policy', 'No advertising, affiliate links, or merchandise sales.'),
        ('standardissuecat', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('tuxedocats', 'Stay on topic', 'Black and white tuxedo cats, photographs, and stories from their owners.'),
        ('tuxedocats', 'Promotion policy', 'No explicit promotion rule in this sample.'),
        ('tuxedocats', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('torties', 'Stay on topic', 'Tortoiseshell cats, their colorful coats, and spirited personalities.'),
        ('torties', 'Promotion policy', 'No explicit promotion rule in this sample.'),
        ('torties', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('SiameseCats', 'Stay on topic', 'Siamese cat care, training, behavior, and enrichment ideas.'),
        ('SiameseCats', 'Promotion policy', 'Relevant resources may be shared in the monthly advice thread.'),
        ('SiameseCats', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('MaineCoon', 'Stay on topic', 'Maine Coon grooming, photos, and life with large long-haired cats.'),
        ('MaineCoon', 'Promotion policy', 'No breeder advertising or cat sales.'),
        ('MaineCoon', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('ragdolls', 'Stay on topic', 'Ragdoll cat photos, grooming routines, and breed discussions.'),
        ('ragdolls', 'Promotion policy', 'No explicit promotion rule in this sample.'),
        ('ragdolls', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('BengalCats', 'Stay on topic', 'Bengal cat exercise, interactive play, training, and indoor enrichment.'),
        ('BengalCats', 'Promotion policy', 'Share useful care resources in the weekly discussion thread.'),
        ('BengalCats', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('catsinsinks', 'Stay on topic', 'Cats sleeping, hiding, or relaxing in sinks and other unexpected places.'),
        ('catsinsinks', 'Promotion policy', 'Cat photos only. No promotional links.'),
        ('catsinsinks', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('catsinboxes', 'Stay on topic', 'Cats enjoying cardboard boxes, homemade forts, and cozy hiding spots.'),
        ('catsinboxes', 'Promotion policy', 'No explicit promotion rule in this sample.'),
        ('catsinboxes', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('CatAdvice', 'Stay on topic', 'Practical cat behavior advice, litter box problems, introductions, and pet care.'),
        ('CatAdvice', 'Promotion policy', 'Disclose your affiliation and link only when answering a relevant question.'),
        ('CatAdvice', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('catcare', 'Stay on topic', 'Cat grooming, daily care routines, and helpful resources for new owners.'),
        ('catcare', 'Promotion policy', 'Educational guides are welcome once per week; no direct sales.'),
        ('catcare', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('CatToys', 'Stay on topic', 'Cat toy makers, puzzle feeders, interactive toys, and product demonstrations.'),
        ('CatToys', 'Promotion policy', 'Share your toys, demos, and shop links. Disclose that you are the maker.'),
        ('CatToys', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('CatFurniture', 'Stay on topic', 'Cat shelves, scratching posts, window perches, and furniture design projects.'),
        ('CatFurniture', 'Promotion policy', 'Original cat furniture and product launches are welcome with clear pricing.'),
        ('CatFurniture', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('CatArt', 'Stay on topic', 'Original cat illustrations, paintings, digital artwork, and artist portfolios.'),
        ('CatArt', 'Promotion policy', 'Artists may share original work, commission pages, and print shops.'),
        ('CatArt', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('CatPhotography', 'Stay on topic', 'Cat photography techniques, lighting, camera gear, and portfolio feedback.'),
        ('CatPhotography', 'Promotion policy', 'Portfolio links are welcome on Feedback Friday. No unsolicited ads.'),
        ('CatPhotography', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('CatCrafts', 'Stay on topic', 'Handmade cat accessories, crochet patterns, sewing projects, and small craft shops.'),
        ('CatCrafts', 'Promotion policy', 'Handmade cat crafts and shop links are welcome. Include original photos.'),
        ('CatCrafts', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('CatGameDev', 'Stay on topic', 'Indie game development featuring cats, cozy games, and feline game characters.'),
        ('CatGameDev', 'Promotion policy', 'Share playable demos and store pages. Include a gameplay clip.'),
        ('CatGameDev', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('CatTech', 'Stay on topic', 'Cat technology, pet tracking apps, smart feeders, and connected pet gadgets.'),
        ('CatTech', 'Promotion policy', 'Cat apps and gadgets are welcome with a demo and a clear explanation.'),
        ('CatTech', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('CatStartups', 'Stay on topic', 'Founders building cat products, pet software, and small businesses for cat owners.'),
        ('CatStartups', 'Promotion policy', 'Founders may share launches and request feedback. No repeated posts.'),
        ('CatStartups', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('CatRescue', 'Stay on topic', 'Cat rescue organizations, shelter cats, adoption events, and volunteer coordination.'),
        ('CatRescue', 'Promotion policy', 'Verified rescues may share adoption events; fundraising needs moderator approval.'),
        ('CatRescue', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('CatFosters', 'Stay on topic', 'Fostering kittens, bottle feeding, rescue support, and preparing cats for adoption.'),
        ('CatFosters', 'Promotion policy', 'Share foster resources in the weekly thread. Ask before posting donation links.'),
        ('CatFosters', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('SeniorCats', 'Stay on topic', 'Life with older cats, accessible homes, gentle play, and senior pet routines.'),
        ('SeniorCats', 'Promotion policy', 'No explicit promotion rule in this sample.'),
        ('SeniorCats', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('KittenCare', 'Stay on topic', 'New kitten care, feeding schedules, socialization, and first-time cat ownership.'),
        ('KittenCare', 'Promotion policy', 'Helpful care guides are welcome; disclose any connection to the resource.'),
        ('KittenCare', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('CatEnrichment', 'Stay on topic', 'Indoor cat enrichment, climbing spaces, puzzle games, and play routines.'),
        ('CatEnrichment', 'Promotion policy', 'No explicit promotion rule in this sample.'),
        ('CatEnrichment', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('CatNutrition', 'Stay on topic', 'Cat food labels, feeding routines, and general nutrition discussions.'),
        ('CatNutrition', 'Promotion policy', 'No food brand promotions, affiliate links, or supplement sales.'),
        ('CatNutrition', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.'),
        ('CatShopOwners', 'Stay on topic', 'Small businesses selling cat accessories, handmade gifts, and pet products.'),
        ('CatShopOwners', 'Promotion policy', 'Cat shop owners may share new products and lessons from running a store.'),
        ('CatShopOwners', 'Be kind and protect privacy', 'Give constructive feedback. Do not post personal details about other members.')
), saved_subreddits as (
    insert into public.subreddits (id, name)
    select id::uuid, name from seed_subreddits
    on conflict (name) do update set name = excluded.name
    returning id, name
), saved_details as (
    insert into public.subreddit_details
        (subreddit_id, observed_at, description, self_promotion, self_promotion_detail)
    select saved.id, '2026-01-01T00:00:00Z'::timestamptz, seed.description,
        seed.self_promotion::public.self_promotion_status, seed.self_promotion_detail
    from saved_subreddits saved join seed_subreddits seed on seed.name = saved.name
    on conflict (subreddit_id, observed_at) do update set
        description = excluded.description,
        self_promotion = excluded.self_promotion,
        self_promotion_detail = excluded.self_promotion_detail
    returning subreddit_id, observed_at
), saved_members as (
    insert into public.subreddit_member (subreddit_id, observed_at, weekly_active_users)
    select saved.id, '2026-01-01T00:00:00Z'::timestamptz, seed.weekly_active_users
    from saved_subreddits saved join seed_subreddits seed on seed.name = saved.name
    on conflict (subreddit_id, observed_at) do update set
        weekly_active_users = excluded.weekly_active_users
)
insert into public.subreddit_rules (subreddit_id, observed_at, position, title, description)
select details.subreddit_id, details.observed_at,
    row_number() over (partition by details.subreddit_id order by rule.title, rule.description)::integer,
    rule.title, rule.description
from saved_details details
join saved_subreddits saved on saved.id = details.subreddit_id
join seed_rules rule on rule.subreddit_name = saved.name
on conflict (subreddit_id, observed_at, position) do update set
    title = excluded.title,
    description = excluded.description;

commit;
