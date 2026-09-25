-- BookSyde — scanner proporcional da estante física
alter table public.physical_shelf_books add column if not exists aspect_ratio numeric;
alter table public.physical_shelf_books add column if not exists crop_x numeric;
alter table public.physical_shelf_books add column if not exists crop_y numeric;
alter table public.physical_shelf_books add column if not exists crop_w numeric;
alter table public.physical_shelf_books add column if not exists crop_h numeric;
