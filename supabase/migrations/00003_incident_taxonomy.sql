-- ============================================================
-- 00003: Incident taxonomy
-- Hierarchical category system for all incident types
-- Covers §6.1–6.9 modules
-- ============================================================

create table public.incident_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  parent_id uuid references public.incident_categories(id),
  label_en text not null,
  label_af text,
  description_en text,
  description_af text,
  module text not null, -- ait, unrest_watch, bias_monitor, etc.
  icon_key text,
  colour_key text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  requires_two_person_approval boolean not null default false,
  default_location_tier public.location_tier not null default 'l4_approximate_cell',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_categories_parent on public.incident_categories(parent_id);
create index idx_categories_module on public.incident_categories(module);
create index idx_categories_slug on public.incident_categories(slug);

comment on table public.incident_categories is 'Hierarchical incident classification. Top-level = module, children = subtypes.';

-- ────────────────────────────────────────────────────────
-- Seed: top-level modules and key subtypes
-- ────────────────────────────────────────────────────────

-- AIT — Alt Afrikaner Incident Tracker (§6.2)
insert into public.incident_categories (slug, label_en, label_af, module, sort_order, requires_two_person_approval) values
  ('farm_attack', 'Farm Attack', 'Plaasaanval', 'ait', 10, true),
  ('farm_murder', 'Farm Murder', 'Plaasmoord', 'ait', 11, true),
  ('attempted_murder_rural', 'Attempted Murder (Rural)', 'Poging tot Moord (Landelik)', 'ait', 12, true),
  ('smallholding_attack', 'Smallholding Attack', 'Kleinhoewes-aanval', 'ait', 13, true),
  ('rural_ordinary_crime', 'Ordinary Crime on Agricultural Property', 'Gewone Misdaad op Landbou-eiendom', 'ait', 14, false),
  ('rural_domestic_dispute', 'Domestic Dispute (Rural)', 'Huishoudelike Geskil (Landelik)', 'ait', 15, false),
  ('rural_labour_dispute', 'Labour Dispute (Rural)', 'Arbeidsgeskil (Landelik)', 'ait', 16, false),
  ('organised_robbery_rural', 'Organised Robbery (Rural)', 'Georganiseerde Roof (Landelik)', 'ait', 17, false),
  ('rural_road_attack', 'Rural Road Attack', 'Landelike Padaanval', 'ait', 18, false),
  ('livestock_theft', 'Livestock Theft', 'Veediefstal', 'ait', 19, false),
  ('equipment_theft_rural', 'Equipment Theft', 'Toerustingdiefstal', 'ait', 20, false),
  ('crop_destruction', 'Crop Destruction', 'Oesvernietiging', 'ait', 21, false),
  ('arson_rural', 'Arson (Rural)', 'Brandstigting (Landelik)', 'ait', 22, false),
  ('sabotage_rural', 'Sabotage (Rural)', 'Sabotasie (Landelik)', 'ait', 23, false),
  ('intimidation_rural', 'Intimidation (Rural)', 'Intimidasie (Landelik)', 'ait', 24, false),
  ('suspicious_surveillance', 'Suspicious Surveillance', 'Verdagte Waarneming', 'ait', 25, false),
  ('land_invasion', 'Land Invasion Report', 'Grondbesettingsverslag', 'ait', 26, false),
  ('political_intimidation_rural', 'Political Intimidation (Rural)', 'Politieke Intimidasie (Landelik)', 'ait', 27, true);

-- Unrest Watch (§6.3)
insert into public.incident_categories (slug, label_en, label_af, module, sort_order) values
  ('peaceful_protest', 'Peaceful Protest', 'Vreedsame Protes', 'unrest_watch', 30),
  ('disruptive_protest', 'Disruptive Protest', 'Ontwrigtende Protes', 'unrest_watch', 31),
  ('road_blockade', 'Road Blockade', 'Padblokkade', 'unrest_watch', 32),
  ('violent_protest', 'Violent Protest', 'Gewelddadige Protes', 'unrest_watch', 33),
  ('riot', 'Riot', 'Oproer', 'unrest_watch', 34),
  ('looting', 'Looting', 'Plundering', 'unrest_watch', 35),
  ('arson_unrest', 'Arson (Unrest)', 'Brandstigting (Onrus)', 'unrest_watch', 36),
  ('political_violence', 'Political Violence', 'Politieke Geweld', 'unrest_watch', 37),
  ('labour_action', 'Labour Action', 'Arbeidaksie', 'unrest_watch', 38),
  ('taxi_violence', 'Taxi Violence', 'Taxi-geweld', 'unrest_watch', 39),
  ('university_protest', 'University Protest', 'Universiteitsprotes', 'unrest_watch', 40),
  ('service_delivery_protest', 'Service Delivery Protest', 'Diensleweringsprotes', 'unrest_watch', 41),
  ('xenophobic_violence', 'Xenophobic Violence', 'Xenofobiese Geweld', 'unrest_watch', 42),
  ('police_intervention', 'Police Intervention', 'Polisie-ingryping', 'unrest_watch', 43);

-- Violent Crime (§6.1 national monitor)
insert into public.incident_categories (slug, label_en, label_af, module, sort_order, requires_two_person_approval) values
  ('murder', 'Murder', 'Moord', 'national_monitor', 50, true),
  ('attempted_murder', 'Attempted Murder', 'Poging tot Moord', 'national_monitor', 51, true),
  ('sexual_offence', 'Sexual Offence', 'Seksuele Oortreding', 'national_monitor', 52, true),
  ('kidnapping', 'Kidnapping', 'Ontvoering', 'national_monitor', 53, true),
  ('robbery', 'Robbery', 'Roof', 'national_monitor', 54, false),
  ('arson', 'Arson', 'Brandstigting', 'national_monitor', 55, false),
  ('intimidation', 'Intimidation', 'Intimidasie', 'national_monitor', 56, false);

-- Infrastructure (§6.5)
insert into public.incident_categories (slug, label_en, label_af, module, sort_order) values
  ('electricity_disruption', 'Electricity Disruption', 'Elektrisiteitsontwrigting', 'infrastructure_watch', 60),
  ('water_disruption', 'Water Disruption', 'Waterontwrigting', 'infrastructure_watch', 61),
  ('road_disruption', 'Road / Rail Disruption', 'Pad / Spoor Ontwrigting', 'infrastructure_watch', 62),
  ('port_border_disruption', 'Port / Border Disruption', 'Hawe / Grens Ontwrigting', 'infrastructure_watch', 63),
  ('telecom_outage', 'Telecommunications Outage', 'Telekommunikasie-onderbreking', 'infrastructure_watch', 64),
  ('municipal_failure', 'Municipal Failure', 'Munisipale Versuim', 'infrastructure_watch', 65);

-- Natural Events (§6.8)
insert into public.incident_categories (slug, label_en, label_af, module, sort_order) values
  ('fire', 'Fire', 'Brand', 'natural_events', 70),
  ('flood', 'Flood', 'Vloed', 'natural_events', 71),
  ('drought', 'Droogte', 'Droogte', 'natural_events', 72),
  ('severe_storm', 'Severe Storm', 'Ernstige Storm', 'natural_events', 73),
  ('extreme_temperature', 'Extreme Temperature', 'Uiterste Temperatuur', 'natural_events', 74),
  ('pollution', 'Pollution', 'Besoedeling', 'natural_events', 75),
  ('dam_risk', 'Dam Risk', 'Damrisiko', 'natural_events', 76),
  ('environmental_damage', 'Environmental Damage', 'Omgewingskade', 'natural_events', 77);
