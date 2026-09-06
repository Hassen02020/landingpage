-- Demo catalog data so the storefront isn't empty on first deploy.
-- Safe to delete/replace once real product data is loaded via the admin.

insert into categories (name, slug, pet_type, image_url, sort_order) values
  ('Dog Food', 'dog-food', 'dog', 'https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?w=800', 1),
  ('Cat Food', 'cat-food', 'cat', 'https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=800', 2),
  ('Treats', 'treats', 'both', 'https://images.unsplash.com/photo-1591946614720-90a587da4a36?w=800', 3),
  ('Toys', 'toys', 'both', 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=800', 4),
  ('Dental Care', 'dental-care', 'both', 'https://images.unsplash.com/photo-1560743641-3914f2c45636?w=800', 5),
  ('Grooming', 'grooming', 'both', 'https://images.unsplash.com/photo-1591343395082-e120087004b4?w=800', 6),
  ('Beds', 'beds', 'both', 'https://images.unsplash.com/photo-1601979031925-424e53b6caaa?w=800', 7),
  ('Accessories', 'accessories', 'both', 'https://images.unsplash.com/photo-1544568100-847a948585b9?w=800', 8),
  ('Cat Litter', 'cat-litter', 'cat', 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=800', 9);

insert into brands (name, slug, logo_url, sort_order) values
  ('Wilderness Trail', 'wilderness-trail', null, 1),
  ('Coastal Harvest', 'coastal-harvest', null, 2),
  ('Homestead Kitchen', 'homestead-kitchen', null, 3),
  ('Pawline', 'pawline', null, 4),
  ('Furfield', 'furfield', null, 5),
  ('Basecamp Pets', 'basecamp-pets', null, 6);

do $$
declare
  cat_dog_food uuid := (select id from categories where slug = 'dog-food');
  cat_cat_food uuid := (select id from categories where slug = 'cat-food');
  cat_treats uuid := (select id from categories where slug = 'treats');
  cat_toys uuid := (select id from categories where slug = 'toys');
  cat_dental uuid := (select id from categories where slug = 'dental-care');
  cat_grooming uuid := (select id from categories where slug = 'grooming');
  cat_beds uuid := (select id from categories where slug = 'beds');
  cat_litter uuid := (select id from categories where slug = 'cat-litter');

  brand_wt uuid := (select id from brands where slug = 'wilderness-trail');
  brand_ch uuid := (select id from brands where slug = 'coastal-harvest');
  brand_hk uuid := (select id from brands where slug = 'homestead-kitchen');
  brand_pl uuid := (select id from brands where slug = 'pawline');
  brand_ff uuid := (select id from brands where slug = 'furfield');
  brand_bc uuid := (select id from brands where slug = 'basecamp-pets');

  p_id uuid;
  v_id uuid;
begin
  -- Product 1: Grain-Free Dry Dog Food
  insert into products (brand_id, category_id, name, slug, short_description, description, ingredients, feeding_instructions, pet_type, life_stage, status, is_subscribable, avg_rating, review_count, tags)
  values (brand_wt, cat_dog_food, 'Grain-Free Salmon & Sweet Potato Recipe', 'grain-free-salmon-sweet-potato-dog-food',
    'Real salmon, no fillers, made for everyday energy.', 'A grain-free recipe built around real deboned salmon, easy on sensitive stomachs and rich in omega fatty acids for a healthy coat.',
    'Deboned Salmon, Sweet Potatoes, Peas, Salmon Meal, Canola Oil, Flaxseed, Vitamins & Minerals.',
    'Feed 1 to 1.5 cups per 20 lbs of body weight daily, split into two meals.',
    'dog', 'adult', 'active', true, 4.7, 128, array['best-seller','grain-free'])
  returning id into p_id;

  insert into product_variants (product_id, sku, size, price_cents, compare_at_price_cents, is_default, sort_order)
  values (p_id, 'WT-SLM-4LB', '4 lb', 1999, 2299, false, 1) returning id into v_id;
  insert into inventory (variant_id, quantity_available) values (v_id, 240);

  insert into product_variants (product_id, sku, size, price_cents, compare_at_price_cents, is_default, sort_order)
  values (p_id, 'WT-SLM-15LB', '15 lb', 5499, 6199, true, 2) returning id into v_id;
  insert into inventory (variant_id, quantity_available) values (v_id, 180);

  insert into product_images (product_id, url, alt, sort_order) values
    (p_id, 'https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?w=1200', 'Grain-Free Salmon dog food bag', 1);

  -- Product 2: Puppy Food
  insert into products (brand_id, category_id, name, slug, short_description, description, ingredients, feeding_instructions, pet_type, life_stage, status, is_subscribable, avg_rating, review_count, tags)
  values (brand_hk, cat_dog_food, 'Chicken & Brown Rice Puppy Formula', 'chicken-brown-rice-puppy-formula',
    'Balanced nutrition for growing puppies.', 'DHA-enriched chicken formula that supports brain development and healthy joint growth in puppies up to 12 months.',
    'Chicken, Brown Rice, Chicken Meal, Fish Oil, DHA, Vitamins & Minerals.',
    'Feed per weight chart on packaging, 3 times daily for puppies under 6 months.',
    'dog', 'puppy_kitten', 'active', true, 4.8, 96, array['puppy'])
  returning id into p_id;

  insert into product_variants (product_id, sku, size, price_cents, is_default, sort_order)
  values (p_id, 'HK-PUP-6LB', '6 lb', 2699, true, 1) returning id into v_id;
  insert into inventory (variant_id, quantity_available) values (v_id, 150);

  insert into product_images (product_id, url, alt, sort_order) values
    (p_id, 'https://images.unsplash.com/photo-1601758003122-53c40e686a19?w=1200', 'Puppy food bag', 1);

  -- Product 3: Cat Food
  insert into products (brand_id, category_id, name, slug, short_description, description, ingredients, feeding_instructions, pet_type, life_stage, status, is_subscribable, avg_rating, review_count, tags)
  values (brand_ch, cat_cat_food, 'Wild-Caught Tuna Pate Wet Food', 'wild-caught-tuna-pate-wet-cat-food',
    'High-protein pate cats ask for by name.', 'A smooth pate made with wild-caught tuna, no artificial flavors, grain-free and gently cooked to lock in nutrients.',
    'Tuna, Tuna Broth, Fish Oil, Taurine, Vitamins & Minerals.',
    'Feed 1 can per 5 lbs of body weight daily. Refrigerate unused portion.',
    'cat', 'adult', 'active', true, 4.6, 210, array['best-seller','wet-food'])
  returning id into p_id;

  insert into product_variants (product_id, sku, size, price_cents, is_default, sort_order)
  values (p_id, 'CH-TUNA-3OZ-12PK', '3 oz (12-pack)', 1899, true, 1) returning id into v_id;
  insert into inventory (variant_id, quantity_available) values (v_id, 300);

  insert into product_images (product_id, url, alt, sort_order) values
    (p_id, 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=1200', 'Cat pate wet food cans', 1);

  -- Product 4: Cat Dry Food
  insert into products (brand_id, category_id, name, slug, short_description, description, ingredients, feeding_instructions, pet_type, life_stage, status, is_subscribable, avg_rating, review_count, tags)
  values (brand_hk, cat_cat_food, 'Indoor Chicken Recipe Dry Cat Food', 'indoor-chicken-recipe-dry-cat-food',
    'Weight-conscious formula for indoor cats.', 'Lower-calorie kibble designed for less active indoor cats, with added fiber for hairball control.',
    'Chicken Meal, Brown Rice, Chicken Fat, Dried Beet Pulp, Vitamins & Minerals.',
    'Feed 1/3 to 1/2 cup daily based on body weight, adjust for treats.',
    'cat', 'adult', 'active', true, 4.5, 74, array['indoor'])
  returning id into p_id;

  insert into product_variants (product_id, sku, size, price_cents, is_default, sort_order)
  values (p_id, 'HK-IND-5LB', '5 lb', 2199, true, 1) returning id into v_id;
  insert into inventory (variant_id, quantity_available) values (v_id, 120);

  insert into product_images (product_id, url, alt, sort_order) values
    (p_id, 'https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=1200', 'Dry cat food bag', 1);

  -- Product 5: Dog Treats
  insert into products (brand_id, category_id, name, slug, short_description, description, ingredients, feeding_instructions, pet_type, life_stage, status, is_subscribable, avg_rating, review_count, tags)
  values (brand_pl, cat_treats, 'Peanut Butter Training Treats', 'peanut-butter-training-treats',
    'Soft, bite-sized treats made for training.', 'Low-calorie soft training treats your dog will work for, made with real peanut butter and no artificial preservatives.',
    'Peanut Butter, Oat Flour, Molasses, Sunflower Oil, Natural Flavor.',
    'Use as a training reward, no more than 10% of daily calories.',
    'dog', 'all', 'active', false, 4.9, 340, array['best-seller','training'])
  returning id into p_id;

  insert into product_variants (product_id, sku, size, price_cents, is_default, sort_order)
  values (p_id, 'PL-PB-6OZ', '6 oz', 899, true, 1) returning id into v_id;
  insert into inventory (variant_id, quantity_available) values (v_id, 400);

  insert into product_images (product_id, url, alt, sort_order) values
    (p_id, 'https://images.unsplash.com/photo-1591946614720-90a587da4a36?w=1200', 'Peanut butter dog treats bag', 1);

  -- Product 6: Cat Treats
  insert into products (brand_id, category_id, name, slug, short_description, description, ingredients, feeding_instructions, pet_type, life_stage, status, is_subscribable, avg_rating, review_count, tags)
  values (brand_ff, cat_treats, 'Freeze-Dried Chicken Breast Cat Treats', 'freeze-dried-chicken-breast-cat-treats',
    'Single-ingredient, freeze-dried chicken.', 'Just one ingredient — 100% chicken breast, freeze-dried to lock in flavor and nutrients cats love.',
    'Chicken Breast.',
    'Feed as a treat, up to 5 pieces daily.',
    'cat', 'all', 'active', false, 4.8, 155, array['single-ingredient'])
  returning id into p_id;

  insert into product_variants (product_id, sku, size, price_cents, is_default, sort_order)
  values (p_id, 'FF-CHK-2OZ', '2 oz', 1099, true, 1) returning id into v_id;
  insert into inventory (variant_id, quantity_available) values (v_id, 200);

  insert into product_images (product_id, url, alt, sort_order) values
    (p_id, 'https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=1200', 'Freeze dried chicken cat treats', 1);

  -- Product 7: Dog Toy
  insert into products (brand_id, category_id, name, slug, short_description, description, ingredients, feeding_instructions, pet_type, life_stage, status, is_subscribable, avg_rating, review_count, tags)
  values (brand_bc, cat_toys, 'Durable Rope & Rubber Chew Toy', 'durable-rope-rubber-chew-toy',
    'Built for the toughest chewers.', 'Natural cotton rope wrapped around a rubber core, designed to survive aggressive chewers while cleaning teeth as they play.',
    null, null,
    'dog', 'all', 'active', false, 4.4, 88, array['durable'])
  returning id into p_id;

  insert into product_variants (product_id, sku, size, price_cents, is_default, sort_order)
  values (p_id, 'BC-ROPE-M', 'Medium', 1499, true, 1) returning id into v_id;
  insert into inventory (variant_id, quantity_available) values (v_id, 90);

  insert into product_images (product_id, url, alt, sort_order) values
    (p_id, 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=1200', 'Rope and rubber dog chew toy', 1);

  -- Product 8: Cat Toy
  insert into products (brand_id, category_id, name, slug, short_description, description, ingredients, feeding_instructions, pet_type, life_stage, status, is_subscribable, avg_rating, review_count, tags)
  values (brand_pl, cat_toys, 'Interactive Feather Wand Toy', 'interactive-feather-wand-toy',
    'Hours of pounce-and-chase play.', 'A telescoping wand with natural feathers and a bell to trigger your cat''s natural hunting instinct.',
    null, null,
    'cat', 'all', 'active', false, 4.6, 61, array['interactive'])
  returning id into p_id;

  insert into product_variants (product_id, sku, size, price_cents, is_default, sort_order)
  values (p_id, 'PL-WAND-1', 'One size', 1299, true, 1) returning id into v_id;
  insert into inventory (variant_id, quantity_available) values (v_id, 130);

  insert into product_images (product_id, url, alt, sort_order) values
    (p_id, 'https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=1200', 'Feather wand cat toy', 1);

  -- Product 9: Dental Care
  insert into products (brand_id, category_id, name, slug, short_description, description, ingredients, feeding_instructions, pet_type, life_stage, status, is_subscribable, avg_rating, review_count, tags)
  values (brand_wt, cat_dental, 'Daily Dental Chew Sticks', 'daily-dental-chew-sticks',
    'Vet-recommended daily dental care.', 'Textured chew sticks that reduce plaque and tartar buildup with daily use, in a size dogs actually enjoy.',
    'Wheat Starch, Glycerin, Gelatin, Chlorophyll, Vitamins & Minerals.',
    'Feed one stick daily as part of a balanced diet.',
    'dog', 'adult', 'active', true, 4.5, 142, array['dental'])
  returning id into p_id;

  insert into product_variants (product_id, sku, size, price_cents, is_default, sort_order)
  values (p_id, 'WT-DENT-28CT', '28 count', 1699, true, 1) returning id into v_id;
  insert into inventory (variant_id, quantity_available) values (v_id, 175);

  insert into product_images (product_id, url, alt, sort_order) values
    (p_id, 'https://images.unsplash.com/photo-1560743641-3914f2c45636?w=1200', 'Dental chew sticks box', 1);

  -- Product 10: Cat Litter
  insert into products (brand_id, category_id, name, slug, short_description, description, ingredients, feeding_instructions, pet_type, life_stage, status, is_subscribable, avg_rating, review_count, tags)
  values (brand_ch, cat_litter, 'Ultra Clumping Unscented Cat Litter', 'ultra-clumping-unscented-cat-litter',
    '99% dust-free, tight clumping.', 'Fast-clumping, low-tracking litter that locks in odor without added fragrance.',
    null, null,
    'cat', 'all', 'active', true, 4.7, 302, array['best-seller'])
  returning id into p_id;

  insert into product_variants (product_id, sku, size, price_cents, compare_at_price_cents, is_default, sort_order)
  values (p_id, 'CH-LTR-20LB', '20 lb', 1999, 2399, true, 1) returning id into v_id;
  insert into inventory (variant_id, quantity_available) values (v_id, 260);

  insert into product_images (product_id, url, alt, sort_order) values
    (p_id, 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=1200', 'Cat litter bag', 1);

  -- Product 11: Dog Bed
  insert into products (brand_id, category_id, name, slug, short_description, description, ingredients, feeding_instructions, pet_type, life_stage, status, is_subscribable, avg_rating, review_count, tags)
  values (brand_bc, cat_beds, 'Orthopedic Memory Foam Dog Bed', 'orthopedic-memory-foam-dog-bed',
    'Joint support for senior and active dogs.', 'Egg-crate memory foam cradles joints and pressure points, with a removable, machine-washable cover.',
    null, null,
    'dog', 'senior', 'active', false, 4.8, 118, array['orthopedic'])
  returning id into p_id;

  insert into product_variants (product_id, sku, size, price_cents, is_default, sort_order)
  values (p_id, 'BC-BED-L', 'Large', 6499, true, 1) returning id into v_id;
  insert into inventory (variant_id, quantity_available) values (v_id, 60);

  insert into product_images (product_id, url, alt, sort_order) values
    (p_id, 'https://images.unsplash.com/photo-1601979031925-424e53b6caaa?w=1200', 'Orthopedic dog bed', 1);

  -- Product 12: Collar
  insert into products (brand_id, category_id, name, slug, short_description, description, ingredients, feeding_instructions, pet_type, life_stage, status, is_subscribable, avg_rating, review_count, tags)
  values (brand_ff, cat_dog_food, 'Classic Leather Collar', 'classic-leather-collar', 'Durable everyday collar.', 'Full-grain leather collar with a solid brass buckle, built to age well.', null, null, 'dog', 'all', 'active', false, 4.3, 44, array['accessories'])
  returning id into p_id;
  update products set category_id = (select id from categories where slug = 'accessories') where id = p_id;

  insert into product_variants (product_id, sku, size, price_cents, is_default, sort_order)
  values (p_id, 'FF-COL-M', 'Medium', 2499, true, 1) returning id into v_id;
  insert into inventory (variant_id, quantity_available) values (v_id, 85);

  insert into product_images (product_id, url, alt, sort_order) values
    (p_id, 'https://images.unsplash.com/photo-1544568100-847a948585b9?w=1200', 'Leather dog collar', 1);
end $$;

insert into promotions (title, subtitle, cta_label, cta_href, badge_text, placement, sort_order) values
  ('30% Off Your First Order', 'New to PETORA? Save on your first order of food, treats and essentials.', 'Shop Now', '/deals', '30% OFF', 'homepage_banner', 1),
  ('Save on Every Autoship Order', 'Set your favorites on repeat and save automatically, every time.', 'Start Autoship', '/subscribe', 'AUTOSHIP', 'homepage_banner', 2);
