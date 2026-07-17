-- ============================================================
-- Forkcast data restore
-- Paste this whole file into Supabase SQL Editor (New query) and RUN.
-- ============================================================
BEGIN;

-- Drop any prior empty copies (safe: idempotent)
DROP TABLE IF EXISTS public.meal_plans CASCADE;
DROP TABLE IF EXISTS public.meals CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Schema: public.users
CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Schema: public.meals
CREATE TABLE public.meals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    title character varying(255) NOT NULL,
    ingredients text NOT NULL,
    instructions text NOT NULL,
    image_url text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    gallery_images text
);

-- Schema: public.meal_plans
CREATE TABLE public.meal_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    date date NOT NULL,
    meal_type character varying(20) NOT NULL,
    meal_id uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT meal_plans_meal_type_check CHECK (((meal_type)::text = ANY ((ARRAY['breakfast'::character varying, 'lunch'::character varying, 'dinner'::character varying])::text[])))
);

-- Data: public.users (7 rows)
INSERT INTO public.users (id, username, password, created_at) VALUES (E'42eeabe9-e595-4a35-969d-c30a0d3dcbd8', E'newuser', E'$2a$12$f/m7Nk2f9FrtkPa3gY.clOqvu39LLRtdHWaT6TYiuBlZYzb8qE3Uu', E'2025-09-06 11:33:39.726+00');
INSERT INTO public.users (id, username, password, created_at) VALUES (E'e9566907-f511-4c8a-92a4-2bc91d2b51cc', E'Chef-Du-Jour', E'$2a$12$AwOih/u7.i4LmTD.7Z5gJe/Yham7Vl6VG7YjqLDigVdzZCfCXFVF2', E'2025-09-06 11:37:06.934+00');
INSERT INTO public.users (id, username, password, created_at) VALUES (E'3f3f32cf-2574-4012-bbaf-cb404661687e', E'verification_user', E'$2a$12$EA7VNDTfT9itBRSmXgzj5uFVqv8Lz0nN6o0OgnG040Nky5vSZ7Wqy', E'2025-09-07 15:12:28.531+00');
INSERT INTO public.users (id, username, password, created_at) VALUES (E'0ea4e77f-b94a-4e69-b976-be2b5e7c03df', E'dbcheck_1757260138', E'$2a$12$dwqWzBhcGNmzFifkpzxSJ.NBX6JCDuqYBEgKzO58EwFhdYaDYWXWa', E'2025-09-07 15:48:59.265+00');
INSERT INTO public.users (id, username, password, created_at) VALUES (E'13c828a1-08e2-4a8d-8833-12b91d51d0bc', E'testmealplans', E'$2a$12$SDU77deYJEkjY2kIeKWP9.FspTvJx8xlt3CY5ImDEIEC.q7lcDgcK', E'2025-09-07 15:55:05.456+00');
INSERT INTO public.users (id, username, password, created_at) VALUES (E'01cea3c7-2071-49ae-9b07-ecbd8ce8f467', E'demo', E'$2a$12$wR.qdShAzEXpQIX5YCzWtO5PU59RXcqylyQx5FH1c.t7PNNqwpIZu', E'2025-09-07 16:00:43.928+00');
INSERT INTO public.users (id, username, password, created_at) VALUES (E'1e520e0f-41de-49c7-a660-b06d42ed37f8', E'pdftester', E'$2a$12$AgiAD6WfNdMb9B2EpIMa7u7rPpuHo1uxyUrJFMQlIN2J5OEOtZLAq', E'2025-09-07 17:12:51.028+00');

-- Data: public.meals (2 rows)
INSERT INTO public.meals (id, user_id, title, ingredients, instructions, image_url, created_at, updated_at, gallery_images) VALUES (E'5dc086f7-03e2-4766-a49e-ee96b23216be', E'0ea4e77f-b94a-4e69-b976-be2b5e7c03df', E'Test Meal for Plan', E'Test ingredient', E'Test instruction', NULL, E'2025-09-07 15:49:00.309+00', E'2025-09-07 15:49:00.309+00', NULL);
INSERT INTO public.meals (id, user_id, title, ingredients, instructions, image_url, created_at, updated_at, gallery_images) VALUES (E'768ba52d-1683-4f94-aaf1-427cb1a3177b', E'01cea3c7-2071-49ae-9b07-ecbd8ce8f467', E'Spaghetti Carbonara', E'100g pancetta
50g pecorino cheese
50g parmesan
3 large eggs
350g spaghetti
2 plump garlic cloves (peeled and left whole)
50g unsalted butter
sea salt and freshly ground black pepper', E'Put a large saucepan of water on to boil.

Finely chop the 100g pancetta, having first removed any rind. Finely grate 50g pecorino cheese and 50g parmesan and mix them together.

Beat the 3 large eggs in a medium bowl and season with a little freshly grated black pepper. Set everything aside.

Add 1 tsp salt to the boiling water, add 350g spaghetti and when the water comes back to the boil, cook at a constant simmer, covered, for 10 minutes or until al dente (just cooked).

Squash 2 peeled plump garlic cloves with the blade of a knife, just to bruise it.

While the spaghetti is cooking, fry the pancetta with the garlic. Drop 50g unsalted butter into a large frying pan or wok and, as soon as the butter has melted, tip in the pancetta and garlic.

Leave to cook on a medium heat for about 5 minutes, stirring often, until the pancetta is golden and crisp. The garlic has now imparted its flavour, so take it out with a slotted spoon and discard.

Keep the heat under the pancetta on low. When the pasta is ready, lift it from the water with a pasta fork or tongs and put it in the frying pan with the pancetta. Don’t worry if a little water drops in the pan as well (you want this to happen) and don’t throw the pasta water away yet.

Mix most of the cheese in with the eggs, keeping a small handful back for sprinkling over later.

Take the pan of spaghetti and pancetta off the heat. Now quickly pour in the eggs and cheese. Using the tongs or a long fork, lift up the spaghetti so it mixes easily with the egg mixture, which thickens but doesn’t scramble, and everything is coated.

Add extra pasta cooking water to keep it saucy (several tablespoons should do it). You don’t want it wet, just moist. Season with a little salt, if needed.

Use a long-pronged fork to twist the pasta on to the serving plate or bowl. Serve immediately with a little sprinkling of the remaining cheese and a grating of black pepper. If the dish does get a little dry before serving, splash in some more hot pasta water and the glossy sauciness will be revived.', E'https://res.cloudinary.com/dfdyheeak/image/upload/v1757260892/forkcast/meals/meal-01cea3c7-2071-49ae-9b07-ecbd8ce8f467-1757260892000.png', E'2025-09-07 16:09:53.79+00', E'2025-09-07 17:07:50.677+00', E'["https://res.cloudinary.com/dfdyheeak/image/upload/v1757264827/forkcast/meals/meal-01cea3c7-2071-49ae-9b07-ecbd8ce8f467-1757264826946.png","https://res.cloudinary.com/dfdyheeak/image/upload/v1757264838/forkcast/meals/meal-01cea3c7-2071-49ae-9b07-ecbd8ce8f467-1757264838099.png","https://res.cloudinary.com/dfdyheeak/image/upload/v1757264849/forkcast/meals/meal-01cea3c7-2071-49ae-9b07-ecbd8ce8f467-1757264849118.png","https://res.cloudinary.com/dfdyheeak/image/upload/v1757264858/forkcast/meals/meal-01cea3c7-2071-49ae-9b07-ecbd8ce8f467-1757264858237.png"]');

-- Data: public.meal_plans (4 rows)
INSERT INTO public.meal_plans (id, user_id, date, meal_type, meal_id, created_at) VALUES (E'e665d904-1d48-47ef-b880-a9eb412e090e', E'0ea4e77f-b94a-4e69-b976-be2b5e7c03df', E'2025-09-08', E'lunch', E'5dc086f7-03e2-4766-a49e-ee96b23216be', E'2025-09-07 15:49:01.210343+00');
INSERT INTO public.meal_plans (id, user_id, date, meal_type, meal_id, created_at) VALUES (E'ff40d5b3-7047-418d-a1ca-c5f42f0f655a', E'01cea3c7-2071-49ae-9b07-ecbd8ce8f467', E'2025-09-07', E'breakfast', E'768ba52d-1683-4f94-aaf1-427cb1a3177b', E'2025-09-07 16:10:54.438063+00');
INSERT INTO public.meal_plans (id, user_id, date, meal_type, meal_id, created_at) VALUES (E'34645f1e-3a0d-4ddf-a478-0d11620e8784', E'01cea3c7-2071-49ae-9b07-ecbd8ce8f467', E'2025-09-09', E'lunch', E'768ba52d-1683-4f94-aaf1-427cb1a3177b', E'2025-09-07 16:10:58.201922+00');
INSERT INTO public.meal_plans (id, user_id, date, meal_type, meal_id, created_at) VALUES (E'a53a9590-92fa-40d3-a05d-9abf69038e39', E'01cea3c7-2071-49ae-9b07-ecbd8ce8f467', E'2025-09-10', E'breakfast', E'768ba52d-1683-4f94-aaf1-427cb1a3177b', E'2025-09-07 19:23:46.183004+00');

-- Constraints
ALTER TABLE ONLY public.meal_plans
    ADD CONSTRAINT meal_plans_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.meal_plans
    ADD CONSTRAINT meal_plans_user_id_date_meal_type_key UNIQUE (user_id, date, meal_type);
ALTER TABLE ONLY public.meals
    ADD CONSTRAINT meals_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);
ALTER TABLE ONLY public.meal_plans
    ADD CONSTRAINT meal_plans_meal_id_fkey FOREIGN KEY (meal_id) REFERENCES public.meals(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.meal_plans
    ADD CONSTRAINT meal_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.meals
    ADD CONSTRAINT meals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Indexes
CREATE INDEX idx_meal_plans_user_date ON public.meal_plans USING btree (user_id, date);
CREATE INDEX idx_meal_plans_user_id ON public.meal_plans USING btree (user_id);
CREATE INDEX idx_meals_created_at ON public.meals USING btree (created_at);
CREATE INDEX idx_meals_user_id ON public.meals USING btree (user_id);
CREATE INDEX idx_users_username ON public.users USING btree (username);

COMMIT;