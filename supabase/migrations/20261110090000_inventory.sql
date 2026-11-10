create table public.products (
  id text primary key,
  name text not null check (char_length(name) between 1 and 120),
  brand text not null default '' check (char_length(brand) <= 60),
  specs text not null check (char_length(specs) between 1 and 500),
  description text not null default '' check (char_length(description) <= 1000),
  price integer not null check (price between 1 and 100000000),
  category text not null check (category in (
    'laptops',
    'all-in-ones',
    'ex-uk-deals',
    'brand-new-laptops',
    'pos-systems',
    'accessories',
    'printers-scanners',
    'networking',
    'gaming',
    'apple-products',
    'service-repair'
  )),
  badge text not null default '' check (char_length(badge) <= 40),
  image_url text not null default '',
  in_stock boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
);

create policy "Public can view product images"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'product-images');

insert into public.products (
  id, name, brand, specs, description, price, category, badge, image_url, in_stock, created_at
) values
  ('p1', 'Dell Latitude 5490', '', 'Intel i5 · 8GB RAM · 256GB SSD · 14" FHD · Ex-UK', '', 18500, 'laptops', 'Ex-UK', '', true, now() - interval '1 minute'),
  ('p2', 'HP EliteBook 840 G5', '', 'Intel i7 · 16GB RAM · 512GB SSD · 14" · Ex-UK', '', 28500, 'laptops', 'Popular', '', true, now() - interval '2 minutes'),
  ('p3', 'Lenovo ThinkPad T480', '', 'Intel i5 · 8GB RAM · 256GB SSD · 14" · Ex-UK', '', 19500, 'laptops', 'Ex-UK', '', true, now() - interval '3 minutes'),
  ('p4', 'MacBook Air 2017', '', 'Intel i5 · 8GB RAM · 128GB SSD · 13" · Ex-UK', '', 32000, 'laptops', 'Apple', '', true, now() - interval '4 minutes'),
  ('p5', 'Dell OptiPlex Desktop', '', 'Intel i5 · 8GB RAM · 500GB HDD · Complete Set', '', 14500, 'all-in-ones', 'Desktop', '', true, now() - interval '5 minutes'),
  ('p6', 'Acer Aspire 5 (New)', '', 'Ryzen 5 · 8GB RAM · 512GB SSD · 15.6" · New', '', 45000, 'laptops', 'New', '', true, now() - interval '6 minutes'),
  ('p7', '8GB DDR4 RAM Module', '', 'DDR4 2666MHz · Compatible with most laptops', '', 3500, 'accessories', 'Upgrade', '', true, now() - interval '7 minutes'),
  ('p8', '256GB NVMe SSD', '', 'PCIe Gen3 · High-speed · Laptop upgrade', '', 4500, 'accessories', 'Upgrade', '', true, now() - interval '8 minutes'),
  ('p9', 'Laptop Backpack', '', '15.6" compatible · Water-resistant', '', 2500, 'accessories', '', '', true, now() - interval '9 minutes'),
  ('p10', 'Wireless Mouse + Keyboard', '', 'Combo set · USB receiver · Quiet keys', '', 2800, 'accessories', '', '', true, now() - interval '10 minutes'),
  ('p11', 'HP ProBook 450 G6', '', 'Intel i5 · 8GB RAM · 256GB SSD · 15.6" · Ex-UK', '', 22000, 'laptops', 'Ex-UK', '', true, now() - interval '11 minutes'),
  ('p12', 'Entry Level Laptop', '', 'Intel Celeron · 4GB RAM · 128GB SSD · 14" · Ex-UK', '', 6500, 'laptops', 'From 6.5K', '', true, now() - interval '12 minutes');
